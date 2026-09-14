import type { Logger, ProbotOctokit } from "probot";
import type { SchedulerJobData } from "@wei/probot-scheduler";
import {
  type PullConfig,
  pullConfigSchema,
  type PullMergeMethod,
} from "@/src/utils/schema.ts";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

async function getLivePullConfig(
  octokit: ProbotOctokit,
  log: Logger,
  jobData: SchedulerJobData,
  configFilename: string,
): Promise<PullConfig | null> {
  log.debug(`⚙️ Fetching live config`);

  const { owner, repo } = jobData;

  const { config } = await octokit.config.get({
    owner,
    repo,
    path: `.github/${configFilename}`,
  });

  // Log config if found
  if (!config || !config.version) {
    log.warn("⚠️ No config found");
    return null;
  } else {
    log.info({ config }, "⚙️ Config found");
  }

  const result = pullConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error("Invalid config");
  }

  return result.data;
}

function getDefaultPullConfig(
  repository: RestEndpointMethodTypes["repos"]["get"]["response"]["data"],
  log: Logger,
  defaultMergeMethod: PullMergeMethod,
): PullConfig | null {
  log.debug(`⚙️ Fetching default config`);

  if (repository.fork && repository.parent) {
    const upstreamOwner = repository.parent.owner &&
      repository.parent.owner.login;
    const defaultBranch = repository.parent.default_branch;

    if (upstreamOwner && defaultBranch) {
      log.debug(
        `Using default config ${defaultBranch}...${upstreamOwner}:${defaultBranch}`,
      );

      const defaultConfig = {
        version: "1",
        rules: [
          {
            base: `${defaultBranch}`,
            upstream: `${upstreamOwner}:${defaultBranch}`,
            mergeMethod: defaultMergeMethod,
            mergeUnstable: true,
          },
        ],
      };

      const result = pullConfigSchema.safeParse(defaultConfig);
      if (!result.success) {
        throw new Error("Invalid default config");
      }

      return result.data;
    }
  }

  return null;
}

/** Options for locating or synthesizing a repository pull configuration. */
export interface PullConfigOptions {
  configFilename?: string;
  defaultMergeMethod?: PullMergeMethod;
}

/** Load, validate, and return the effective configuration for a repository. */
export async function getPullConfig(
  octokit: ProbotOctokit,
  log: Logger,
  jobData: SchedulerJobData,
  options: PullConfigOptions = {},
): Promise<PullConfig | null> {
  log.info(`⚙️ Fetching config`);
  const configFilename = options.configFilename ?? "pull.yml";
  const defaultMergeMethod = options.defaultMergeMethod ?? "hardreset";

  const { owner, repo } = jobData;

  const { data: repository } = await octokit.rest.repos.get({ owner, repo });

  if (repository.archived) {
    log.debug(`⚠️ Repository is archived, skipping`);
    return null; // TODO Cancel scheduled job
  }

  let config = await getLivePullConfig(octokit, log, jobData, configFilename);
  if (!config && !repository.fork) {
    return null; // TODO Cancel scheduled job
  } else if (!config) {
    config = getDefaultPullConfig(repository, log, defaultMergeMethod);
  }

  return config;
}
