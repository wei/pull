import { type Logger, ProbotOctokit } from "probot";
import pluralize from "@wei/pluralize";
import {
  type PullConfig,
  pullConfigSchema,
  type PullRule,
} from "@/src/utils/schema.ts";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { appConfig } from "@/src/configs/app-config.ts";
import { logger as pullLogger } from "@/src/utils/logger.ts";
import { getPRBody, getPRTitle, timeout } from "@/src/utils/helpers.ts";

interface PullOptions {
  owner: string;
  repo: string;
  logger?: Logger;
}

type PullRequestData =
  RestEndpointMethodTypes["pulls"]["create"]["response"]["data"];

export class Pull {
  private github: ProbotOctokit;
  private owner: string;
  private repo: string;
  private fullName: string;
  private logger: Logger;
  private config: PullConfig;

  constructor(
    github: ProbotOctokit,
    { owner, repo, logger = pullLogger }: PullOptions,
    config: PullConfig,
  ) {
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.fullName = `${owner}/${repo}`;
    this.logger = logger.child({
      owner,
      repo,
      full_name: this.fullName,
    });

    const result = pullConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error("Invalid config");
    }

    this.config = result.data;
  }

  async routineCheck(): Promise<void> {
    this.logger.info(
      { config: this.config },
      `Routine Check - ${pluralize("rule", this.config.rules.length, true)}`,
    );

    for (const rule of this.config.rules) {
      this.logger.debug({ rule }, `Routine Check for rule`);
      const { base, upstream, assignees, reviewers } = rule;
      const normalizedBase = base.toLowerCase();
      const normalizedUpstream = upstream.toLowerCase().replace(
        `${this.owner.toLowerCase()}:`,
        "",
      );

      if (normalizedBase === normalizedUpstream) {
        this.logger.debug(
          `${base} is same as ${upstream}`,
        );
        continue;
      }

      if (!(await this.hasDiff(base, upstream))) {
        this.logger.debug(
          `${base} is in sync with ${upstream}`,
        );
        continue;
      }

      const openPR = await this.getOpenPR(base, upstream);
      if (openPR) {
        this.logger.debug(
          `Found a PR from ${upstream} to ${base}`,
        );
        await this.checkAutoMerge(openPR);
      } else {
        this.logger.info(
          `Creating PR from ${upstream} to ${base}`,
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
      `#${prNumber} Checking auto merged pull request`,
    );

    const rule: PullRule | undefined = this.config.rules.find((r) =>
      r.base.toLowerCase() === incomingPR.base.ref.toLowerCase() &&
      (r.upstream.toLowerCase() === incomingPR.head.label.toLowerCase() ||
        r.upstream.toLowerCase() === incomingPR.head.ref.toLowerCase())
    );

    if (!rule) {
      this.logger.debug(
        `#${prNumber} No rule found`,
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
      incomingPR.user.login === appConfig.botName
    ) {
      return await this.processMerge(prNumber, incomingPR, rule, config);
    }

    this.logger.debug(
      `#${prNumber} Skip processing`,
    );
    return false;
  }

  private async handleMergeConflict(
    prNumber: number,
    rule?: PullRule,
  ): Promise<void> {
    this.logger.debug(
      `#${prNumber} mergeable:false`,
    );

    try {
      await this.github.issues.getLabel({
        owner: this.owner,
        repo: this.repo,
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
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      labels: [this.config.label, this.config.conflictLabel],
      body: getPRBody(this.fullName, prNumber),
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
          `#${prNumber} Performing hard reset`,
        );
        await this.hardResetCommit(incomingPR.base.ref, incomingPR.head.sha);
        this.logger.info(
          `#${prNumber} Hard reset successful`,
        );
        return true;
      } catch (err) {
        this.logger.error(
          { err },
          `#${prNumber} Hard reset failed`,
        );
        return false;
      }
    } else if (rule.mergeMethod === "none") {
      this.logger.debug(
        `#${prNumber} Merge method is none, skip merging`,
      );
      return true;
    } else {
      let mergeMethod = rule.mergeMethod;
      if (mergeMethod === "rebase" && !mergeableStatus.rebaseable) {
        mergeMethod = "merge";
      }
      await this.mergePR(prNumber, mergeMethod);
      this.logger.info(
        `#${prNumber} Auto merged pull request using ${mergeMethod}`,
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
        owner: this.owner,
        repo: this.repo,
        head: upstream,
        base,
        per_page: 1,
      });
      return comparison.data.total_commits > 0;
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.match(/this diff is taking too long to generate/i)) {
          return true;
        } else if (e.message.match(/not found/i)) {
          this.logger.debug(
            `${this.owner}:${base}...${upstream} Not found`,
          );
          return false;
        } else if (e.message.match(/no common ancestor/i)) {
          this.logger.debug(
            `${this.owner}:${base}...${upstream} No common ancestor`,
          );
          return false;
        }
      }
      this.logger.error(
        {
          err: e,
          head: upstream,
        },
        `Unable to fetch diff`,
      );
      return false;
    }
  }

  private async getOpenPR(base: string, head: string) {
    const res = await this.github.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      creator: appConfig.botName,
      per_page: 100,
    });

    if (res.data.length === 0) return null;

    for (const issue of res.data) {
      const pr = await this.github.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: issue.number,
      });

      if (
        pr.data.user.login === appConfig.botName &&
        pr.data.base.label.replace(`${this.owner}:`, "") ===
          base.replace(`${this.owner}:`, "") &&
        pr.data.head.label.replace(`${this.owner}:`, "") ===
          head.replace(`${this.owner}:`, "")
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
        owner: this.owner,
        repo: this.repo,
        head: upstream,
        base,
        maintainer_can_modify: false,
        title: getPRTitle(base, upstream),
        body: getPRBody(this.fullName),
      });

      const prNumber = createdPR.data.number;
      this.logger.debug(
        `#${prNumber} Created pull request`,
      );

      await this.github.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        assignees,
        labels: [this.config.label],
        body: getPRBody(this.fullName, prNumber),
      });

      await this.addReviewers(prNumber, reviewers);
      this.logger.debug(
        `#${prNumber} Updated pull request`,
      );

      const pr = await this.github.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return pr.data;
    } catch (err) {
      this.logger.error(
        { err },
        `Create PR from ${upstream} failed`,
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
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      this.logger.debug(
        `#${prNumber} Mergeability is ${pr.data.mergeable_state}`,
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
      owner: this.owner,
      repo: this.repo,
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
      owner: this.owner,
      repo: this.repo,
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
      owner: this.owner,
      repo: this.repo,
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
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${baseRef}`,
      sha,
      force: true,
    });
  }
}
