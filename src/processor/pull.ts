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

    if (rule.mergeMethod === "reverse-rebase") {
      return await this.reverseRebase(incomingPR, rule);
    } else if (rule.mergeMethod === "hardreset") {
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
    this.logger.debug(
      `Checking for open PRs from ${head} to ${base} created by ${appConfig.botName}`,
    );

    const res = await this.github.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      creator: appConfig.botName,
      per_page: 100,
    });

    if (res.data.length > 0) {
      this.logger.debug(
        `Found ${res.data.length} open ${
          pluralize("PR", res.data.length, true)
        } from ${appConfig.botName}`,
      );

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
          this.logger.debug(
            `Found open PR #${pr.data.number} from ${head} to ${base} created by ${appConfig.botName}`,
          );
          return pr.data;
        }
      }
    }

    this.logger.debug(
      `No open PR found from ${head} to ${base} created by ${appConfig.botName}`,
    );
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

      try {
        await this.github.issues.lock({
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
        });
      } catch (err) {
        this.logger.error(
          { err },
          `#${prNumber} Lock failed`,
        );
      }

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

  /**
   * Rebase the fork-owned commits from `base` onto the new upstream tip.
   *
   * GitHub cannot rebase a branch directly. A temporary branch at the upstream
   * tip reverses the normal synchronization PR: the fork branch becomes its
   * head, and GitHub's rebase merge writes the result to the temporary branch.
   * The real branch is only moved after every observed SHA is verified.
   */
  private async reverseRebase(
    incomingPR: PullRequestData,
    rule: PullRule,
  ): Promise<boolean> {
    const prNumber = incomingPR.number;
    const baseRef = incomingPR.base.ref;
    const originalBaseSha = incomingPR.base.sha;
    const upstreamSha = incomingPR.head.sha;
    const temporaryRef = `pull-reverse-rebase/${crypto.randomUUID()}`;
    let temporaryPR: PullRequestData | null = null;
    let temporaryRefCreated = false;
    const cleanupShas = new Set([upstreamSha]);

    try {
      this.logger.debug(
        { temporaryRef, originalBaseSha, upstreamSha },
        `#${prNumber} Performing reverse rebase`,
      );

      await this.github.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${temporaryRef}`,
        sha: upstreamSha,
      });
      temporaryRefCreated = true;

      const forkComparison = await this.github.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: upstreamSha,
        head: originalBaseSha,
        per_page: 1,
      });
      if (forkComparison.data.ahead_by === 0) {
        await this.updateRefWithLease(
          incomingPR.base.repo.node_id,
          baseRef,
          originalBaseSha,
          upstreamSha,
        );
        this.logger.info(
          { originalBaseSha, upstreamSha },
          `#${prNumber} Reverse rebase fast-forward successful`,
        );
        return true;
      }

      const created = await this.github.pulls.create({
        owner: this.owner,
        repo: this.repo,
        head: baseRef,
        base: temporaryRef,
        maintainer_can_modify: false,
        title: `[Pull] Temporarily rebase ${baseRef} onto ${upstreamSha}`,
        body:
          `Temporary pull request created by Pull while processing #${prNumber}.`,
      });
      temporaryPR = created.data;

      // Fail closed if GitHub resolved either ref to an unexpected commit.
      if (
        temporaryPR.head.sha !== originalBaseSha ||
        temporaryPR.base.sha !== upstreamSha ||
        temporaryPR.head.ref !== baseRef ||
        temporaryPR.base.ref !== temporaryRef
      ) {
        throw new Error("Temporary reverse-rebase pull request refs changed");
      }

      let merged;
      try {
        merged = await this.github.pulls.merge({
          owner: this.owner,
          repo: this.repo,
          pull_number: temporaryPR.number,
          merge_method: "rebase",
          sha: originalBaseSha,
        });
      } catch (err) {
        if (this.isMergeConflictError(err)) {
          if (await this.isTemporaryPRConflicted(temporaryPR.number)) {
            await this.handleMergeConflict(prNumber, rule);
          }
          return false;
        }
        throw err;
      }
      if (!merged.data.merged || !merged.data.sha) {
        if (await this.isTemporaryPRConflicted(temporaryPR.number)) {
          await this.handleMergeConflict(prNumber, rule);
        }
        return false;
      }
      const rebasedSha = merged.data.sha;
      cleanupShas.add(rebasedSha);

      const rebasedComparison = await this.github.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: upstreamSha,
        head: rebasedSha,
        per_page: 1,
      });
      if (
        rebasedComparison.data.behind_by !== 0 ||
        rebasedComparison.data.ahead_by !== forkComparison.data.ahead_by
      ) {
        throw new Error("Rebased commit provenance check failed");
      }

      const [currentBase, currentTemporary] = await Promise.all([
        this.github.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${baseRef}`,
        }),
        this.github.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${temporaryRef}`,
        }),
      ]);

      if (currentBase.data.object.sha !== originalBaseSha) {
        throw new Error(
          `Ref heads/${baseRef} changed while reverse rebase was running`,
        );
      }
      if (currentTemporary.data.object.sha !== rebasedSha) {
        throw new Error("Temporary reverse-rebase ref has an unexpected SHA");
      }

      await this.updateRefWithLease(
        incomingPR.base.repo.node_id,
        baseRef,
        originalBaseSha,
        rebasedSha,
      );
      this.logger.info(
        { originalBaseSha, upstreamSha, rebasedSha },
        `#${prNumber} Reverse rebase successful`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        { err, temporaryRef },
        `#${prNumber} Reverse rebase failed`,
      );
      return false;
    } finally {
      if (temporaryPR) {
        await this.cleanupTemporaryPR(temporaryPR, baseRef, temporaryRef);
      }
      if (temporaryRefCreated) {
        await this.cleanupTemporaryRef(temporaryRef, cleanupShas);
      }
    }
  }

  private async isTemporaryPRConflicted(pullNumber: number): Promise<boolean> {
    const current = await this.github.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
    });
    return current.data.mergeable === false;
  }

  private isMergeConflictError(err: unknown): boolean {
    return typeof err === "object" && err !== null &&
      "status" in err && err.status === 405;
  }

  private async cleanupTemporaryPR(
    temporaryPR: PullRequestData,
    expectedHead: string,
    expectedBase: string,
  ): Promise<void> {
    try {
      const current = await this.github.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: temporaryPR.number,
      });
      if (
        current.data.state === "open" &&
        current.data.head.ref === expectedHead &&
        current.data.base.ref === expectedBase
      ) {
        await this.github.pulls.update({
          owner: this.owner,
          repo: this.repo,
          pull_number: temporaryPR.number,
          state: "closed",
        });
      }
    } catch (err) {
      this.logger.error(
        { err, pullNumber: temporaryPR.number },
        "Unable to clean up temporary reverse-rebase pull request",
      );
    }
  }

  private async cleanupTemporaryRef(
    temporaryRef: string,
    expectedShas: ReadonlySet<string>,
  ): Promise<void> {
    try {
      const current = await this.github.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${temporaryRef}`,
      });
      if (!expectedShas.has(current.data.object.sha)) {
        this.logger.error(
          { temporaryRef, sha: current.data.object.sha },
          "Refusing to delete changed temporary reverse-rebase ref",
        );
        return;
      }
      await this.github.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${temporaryRef}`,
      });
    } catch (err) {
      this.logger.error(
        { err, temporaryRef },
        "Unable to clean up temporary reverse-rebase ref",
      );
    }
  }

  private async updateRefWithLease(
    repositoryId: string,
    refName: string,
    beforeOid: string,
    afterOid: string,
  ): Promise<void> {
    if (!repositoryId || !refName || !beforeOid || !afterOid) {
      throw new Error(
        "Atomic ref update requires a repository ID, ref, and SHAs",
      );
    }

    await this.github.graphql(
      `mutation UpdateRefWithLease(
        $repositoryId: ID!
        $refName: GitRefname!
        $beforeOid: GitObjectID!
        $afterOid: GitObjectID!
        $force: Boolean!
      ) {
        updateRefs(input: {
          repositoryId: $repositoryId
          refUpdates: [{
            name: $refName
            beforeOid: $beforeOid
            afterOid: $afterOid
            force: $force
          }]
        }) {
          clientMutationId
        }
      }`,
      {
        repositoryId,
        refName: `refs/heads/${refName}`,
        beforeOid,
        afterOid,
        force: true,
      },
    );
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
