import { type Logger, ProbotOctokit } from "probot";
import {
  type PullConfig,
  pullConfigSchema,
  type PullRule,
} from "@/src/utils/schema.ts";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { appConfig } from "@/src/configs/app-config.ts";
import { createLogger } from "@/src/utils/logger.ts";
import { getPRBody, getPRTitle, timeout } from "@/src/utils/helpers.ts";

interface PullOptions {
  owner: string;
  repo: string;
  logger?: Logger;
}

type PullRequestData =
  RestEndpointMethodTypes["pulls"]["create"]["response"]["data"];

type ExtendedPullConfig = PullConfig & {
  owner: string;
  repo: string;
  repoFullName: string;
};

export class Pull {
  private github: ProbotOctokit;
  private logger: Logger;
  private config: ExtendedPullConfig;

  constructor(
    github: ProbotOctokit,
    { owner, repo, logger = createLogger({ name: appConfig.name }) }:
      PullOptions,
    config: PullConfig,
  ) {
    this.github = github;
    this.logger = logger;

    const result = pullConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error("Invalid config");
    }

    this.config = {
      ...result.data,
      owner,
      repo,
      repoFullName: `${owner}/${repo}`,
    };

    // Handle deprecated config
    // this.config.rules = this.config.rules.map((r) => {
    //   if (r.mergeMethod === "none" && "autoMerge" in r) {
    //     r.mergeMethod = ("autoMergeHardReset" in r) ? "hardreset" : "merge";
    //   }
    //   return r;
    // });
  }

  async routineCheck(): Promise<void> {
    this.logger.info(`[${this.config.repoFullName}] Routine Check`);

    for (const rule of this.config.rules) {
      const { base, upstream, assignees, reviewers } = rule;
      const normalizedBase = base.toLowerCase();
      const normalizedUpstream = upstream.toLowerCase().replace(
        `${this.config.owner.toLowerCase()}:`,
        "",
      );

      if (normalizedBase === normalizedUpstream) {
        this.logger.debug(
          `[${this.config.repoFullName}] ${base} is same as ${upstream}`,
        );
        continue;
      }

      if (!(await this.hasDiff(base, upstream))) {
        this.logger.debug(
          `[${this.config.repoFullName}] ${base} is in sync with ${upstream}`,
        );
        continue;
      }

      const openPR = await this.getOpenPR(base, upstream);
      if (openPR) {
        this.logger.debug(
          `[${this.config.repoFullName}] Found a PR from ${upstream} to ${base}`,
        );
        await this.checkAutoMerge(openPR);
      } else {
        this.logger.info(
          `[${this.config.repoFullName}] Creating PR from ${upstream} to ${base}`,
        );
        const newPR = await this.createPR(base, upstream, assignees, reviewers);
        await this.checkAutoMerge(newPR);
      }
    }
  }

  private async checkAutoMerge(
    incomingPR: PullRequestData | null,
    config: { isMergeableMaxRetries?: number } = {},
  ): Promise<boolean> {
    if (!incomingPR) return false;

    const prNumber = incomingPR.number;
    this.logger.debug(
      `[${this.config.repoFullName}]#${prNumber} Checking auto merged pull request`,
    );

    const rule: PullRule | undefined = this.config.rules.find((r) =>
      r.base.toLowerCase() === incomingPR.base.ref.toLowerCase() &&
      (r.upstream.toLowerCase() === incomingPR.head.label.toLowerCase() ||
        r.upstream.toLowerCase() === incomingPR.head.ref.toLowerCase())
    );

    if (!rule) {
      this.logger.debug(
        `[${this.config.repoFullName}]#${prNumber} No rule found`,
      );
      return false;
    }

    if (incomingPR.mergeable === false) {
      await this.handleMergeConflict(prNumber, rule);
      return false;
    }

    if (
      rule.mergeMethod !== "none" &&
      incomingPR.state === "open" &&
      incomingPR.user.login === "pull[bot]"
    ) {
      return await this.processMerge(prNumber, incomingPR, rule, config);
    }

    this.logger.debug(
      `[${this.config.repoFullName}]#${prNumber} Skip processing`,
    );
    return false;
  }

  private async handleMergeConflict(
    prNumber: number,
    rule?: PullRule,
  ): Promise<void> {
    this.logger.debug(
      `[${this.config.repoFullName}]#${prNumber} mergeable:false`,
    );

    try {
      await this.github.issues.getLabel({
        owner: this.config.owner,
        repo: this.config.repo,
        name: this.config.conflictLabel,
      });
    } catch {
      await this.addLabel(
        this.config.conflictLabel,
        "ff0000",
        "Resolve conflicts manually",
      );
    }

    await this.github.issues.update({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: prNumber,
      labels: [this.config.label, this.config.conflictLabel],
      body: getPRBody(this.config.repoFullName, prNumber),
    });

    if (rule?.conflictReviewers?.length) {
      await this.addReviewers(prNumber, rule.conflictReviewers);
    }
  }

  private async processMerge(
    prNumber: number,
    incomingPR: PullRequestData,
    rule: PullRule,
    config: { isMergeableMaxRetries?: number },
  ): Promise<boolean> {
    const mergeableStatus = await this.getMergeableStatus(
      prNumber,
      incomingPR,
      rule,
      config,
    );

    if (!mergeableStatus?.mergeable) return false;

    if (rule.mergeMethod === "hardreset") {
      try {
        this.logger.debug(
          `[${this.config.repoFullName}]#${prNumber} Performing hard reset`,
        );
        await this.hardResetCommit(incomingPR.base.ref, incomingPR.head.sha);
        this.logger.info(
          `[${this.config.repoFullName}]#${prNumber} Hard reset successful`,
        );
        return true;
      } catch (e) {
        this.logger.info(
          { e },
          `[${this.config.repoFullName}]#${prNumber} Hard reset failed`,
        );
        return false;
      }
    } else if (rule.mergeMethod === "none") {
      this.logger.info(
        `[${this.config.repoFullName}]#${prNumber} Merge method is none, skip merging`,
      );
      return true;
    } else {
      let mergeMethod = rule.mergeMethod;
      if (mergeMethod === "rebase" && !mergeableStatus.rebaseable) {
        mergeMethod = "merge";
      }
      await this.mergePR(prNumber, mergeMethod);
      this.logger.info(
        `[${this.config.repoFullName}]#${prNumber} Auto merged pull request using ${mergeMethod}`,
      );
      return true;
    }
  }

  private async getMergeableStatus(
    prNumber: number,
    incomingPR: PullRequestData,
    rule: PullRule,
    config: { isMergeableMaxRetries?: number },
  ) {
    const isInitiallyMergeable = incomingPR.mergeable &&
      (incomingPR.mergeable_state === "clean" ||
        (incomingPR.mergeable_state === "unstable" && rule.mergeUnstable));

    if (isInitiallyMergeable) {
      return incomingPR;
    }

    return await this.isMergeable(prNumber, {
      maxRetries: config.isMergeableMaxRetries,
    });
  }

  private async hasDiff(base: string, upstream: string): Promise<boolean> {
    try {
      const comparison = await this.github.repos.compareCommits({
        owner: this.config.owner,
        repo: this.config.repo,
        head: encodeURIComponent(upstream),
        base: encodeURIComponent(base),
      });
      return comparison.data.total_commits > 0;
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.match(/this diff is taking too long to generate/i)) {
          return true;
        } else if (e.message.match(/not found/i)) {
          this.logger.debug(
            `[${this.config.repoFullName}] ${this.config.owner}:${base}...${upstream} Not found`,
          );
          return false;
        } else if (e.message.match(/no common ancestor/i)) {
          this.logger.debug(
            `[${this.config.repoFullName}] ${this.config.owner}:${base}...${upstream} No common ancestor`,
          );
          return false;
        }
      }
      this.logger.warn(
        {
          err: e,
          owner: this.config.owner,
          repo: this.config.repo,
          head: upstream,
        },
        `[${this.config.repoFullName}] Unable to fetch diff`,
      );
      return false;
    }
  }

  private async getOpenPR(base: string, head: string) {
    const res = await this.github.issues.listForRepo({
      owner: this.config.owner,
      repo: this.config.repo,
      creator: "pull[bot]",
      per_page: 100,
    });

    if (res.data.length === 0) return null;

    for (const issue of res.data) {
      const pr = await this.github.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: issue.number,
      });

      if (
        pr.data.user.login === "pull[bot]" &&
        pr.data.base.label.replace(`${this.config.owner}:`, "") ===
          base.replace(`${this.config.owner}:`, "") &&
        pr.data.head.label.replace(`${this.config.owner}:`, "") ===
          head.replace(`${this.config.owner}:`, "")
      ) {
        return pr.data;
      }
    }
    return null;
  }

  private async createPR(
    base: string,
    upstream: string,
    assignees: string[],
    reviewers: string[],
  ) {
    try {
      const createdPR = await this.github.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        head: upstream,
        base,
        maintainer_can_modify: false,
        title: getPRTitle(base, upstream),
        body: getPRBody(this.config.repoFullName),
      });

      const prNumber = createdPR.data.number;
      this.logger.debug(
        `[${this.config.repoFullName}]#${prNumber} Created pull request`,
      );

      await this.github.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: prNumber,
        assignees,
        labels: [this.config.label],
        body: getPRBody(this.config.repoFullName, prNumber),
      });

      await this.addReviewers(prNumber, reviewers);
      this.logger.debug(
        `[${this.config.repoFullName}]#${prNumber} Updated pull request`,
      );

      const pr = await this.github.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
      });

      return pr.data;
    } catch (e) {
      this.logger.info(
        e,
        `[${this.config.repoFullName}] Create PR from ${upstream} failed`,
      );
      return null;
    }
  }

  private async isMergeable(
    prNumber: number,
    config: { maxRetries?: number } = {},
  ): Promise<PullRequestData | null> {
    const maxRetries = config.maxRetries || 3;
    let attempts = 0;

    while (attempts++ < maxRetries) {
      const pr = await this.github.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber,
      });

      this.logger.debug(
        `[${this.config.repoFullName}]#${prNumber} Mergeability is ${pr.data.mergeable_state}`,
      );

      if (
        typeof pr.data.mergeable === "boolean" &&
        pr.data.mergeable_state !== "unknown"
      ) {
        return pr.data.mergeable && pr.data.mergeable_state === "clean"
          ? pr.data
          : null;
      }

      // Wait a bit to see if the mergeable state changes
      await timeout(4500);
    }
    return null;
  }

  private async addReviewers(
    prNumber: number | undefined,
    allReviewers: string[] | undefined,
  ): Promise<void> {
    if (!prNumber || !allReviewers?.length) return;

    const reviewers = allReviewers.filter((r) => !r.includes("/"));
    const teamReviewers = allReviewers
      .filter((r) => r.includes("/"))
      .map((r) => r.split("/")[1]);

    await this.github.pulls.requestReviewers({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      team_reviewers: teamReviewers,
      reviewers,
    });
  }

  private async addLabel(
    label: string | undefined,
    color = "ededed",
    description = "",
  ): Promise<void> {
    if (!label) return;

    await this.github.issues.createLabel({
      owner: this.config.owner,
      repo: this.config.repo,
      name: label,
      color,
      description,
    });
  }

  private async mergePR(
    prNumber: number | undefined,
    mergeMethod: "merge" | "squash" | "rebase" = "merge",
  ): Promise<void> {
    if (!prNumber) return;

    await this.github.pulls.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      merge_method: mergeMethod,
    });
  }

  private async hardResetCommit(
    baseRef: string | undefined,
    sha: string,
  ): Promise<void> {
    if (!baseRef || !sha) return;

    await this.github.git.updateRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${baseRef}`,
      sha,
      force: true,
    });
  }
}
