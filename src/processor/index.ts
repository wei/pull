import type { Job } from "bullmq";
import type { SchedulerJobData } from "@wei/probot-scheduler";
import type { Logger, Probot, ProbotOctokit } from "probot";
import type { PullMergeMethod } from "@/src/utils/schema.ts";
import { getPullConfig } from "@/src/utils/get-pull-config.ts";
import { Pull } from "@/src/processor/pull.ts";

/** Default maximum duration for processing one repository job. */
export const DEFAULT_PROCESSING_TIMEOUT_MS = 60 * 1000;

/** A scheduler-compatible function that processes one repository job. */
export type RepositoryJobProcessor = (
  job: Job<SchedulerJobData>,
) => Promise<void>;

/** Options that control repository processing when Pull is embedded. */
export interface RepositoryProcessorOptions {
  /** Logger used for processor diagnostics. Defaults to the Probot logger. */
  logger?: Logger;
  /** Maximum processing duration in milliseconds. */
  timeoutMs?: number;
  /** Bot name used in generated pull request content. */
  botName?: string;
  /** Pull version used in generated pull request content. */
  version?: string;
  /** Repository configuration filename under `.github`. */
  configFilename?: string;
  /** Merge method used when a fork has no repository configuration. */
  defaultMergeMethod?: PullMergeMethod;
}

function createTimeoutPromise(log: Logger, timeoutMs: number) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const message = `Job timed out after ${timeoutMs} ms`;
      log.warn(`⏰ ${message}`);
      reject(new Error(message));
    }, timeoutMs);
  });
}

/** Process one repository immediately, without creating a scheduler job. */
export async function processRepository(
  octokit: ProbotOctokit,
  jobData: SchedulerJobData,
  log: Logger,
  options: RepositoryProcessorOptions = {},
) {
  const { owner, repo } = jobData;

  const config = await getPullConfig(octokit, log, jobData, {
    configFilename: options.configFilename,
    defaultMergeMethod: options.defaultMergeMethod,
  });
  if (!config) {
    log.info(`⚠️ No config found, skipping`);
    return;
  }

  const pull = new Pull(
    octokit,
    {
      owner,
      repo,
      logger: log,
      botName: options.botName,
      version: options.version,
    },
    config,
  );
  await pull.routineCheck();
}

/** Create a scheduler job processor backed by the supplied Probot instance. */
export function getRepoProcessor(
  probot: Probot,
  options: RepositoryProcessorOptions = {},
): RepositoryJobProcessor {
  const logger = options.logger ?? probot.log;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROCESSING_TIMEOUT_MS;

  return async function RepoJobProcessor(job: Job<SchedulerJobData>) {
    const log = logger.child({
      jobId: job.id,
      jobData: job.data,
    });

    log.info("🏃 Processing repo job");

    try {
      const octokit = await probot.auth(job.data.installation_id);

      await Promise.race([
        processRepository(octokit, job.data, log, options),
        createTimeoutPromise(log, timeoutMs),
      ]);

      log.info(`✅ Repo job processed successfully`);
    } catch (error) {
      log.error(error, "❌ Repo job failed");
    }
  };
}
