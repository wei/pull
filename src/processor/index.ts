import type { Job } from "bullmq";
import type { SchedulerJobData } from "@wei/probot-scheduler";
import type { Logger, Probot, ProbotOctokit } from "probot";
import logger from "@/src/utils/logger.ts";
import { getPullConfig } from "@/src/utils/get-pull-config.ts";
import { Pull } from "@/src/processor/pull.ts";

const TIMEOUT = 60 * 1000;

function createTimeoutPromise(log: Logger) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      log.warn("⏰ Job timed out after 1 minute");
      reject(new Error("Job timed out after 1 minute"));
    }, TIMEOUT);
  });
}

async function processRepo(
  octokit: ProbotOctokit,
  jobData: SchedulerJobData,
  log: Logger,
) {
  const { owner, repo } = jobData;

  const config = await getPullConfig(octokit, log, jobData);
  if (!config) {
    log.info(`⚠️ No config found, skipping`);
    return;
  }

  const pull = new Pull(octokit, { owner, repo, logger: log }, config);
  await pull.routineCheck();
}

export function getRepoProcessor(probot: Probot) {
  return async function RepoJobProcessor(job: Job<SchedulerJobData>) {
    const log = logger.child({
      jobId: job.id,
      jobData: job.data,
    });

    log.info("🏃 Processing repo job");

    try {
      const octokit = await probot.auth(job.data.installation_id);

      await Promise.race([
        processRepo(octokit, job.data, log),
        createTimeoutPromise(log),
      ]);

      log.info(`✅ Repo job processed successfully`);
    } catch (error) {
      log.error(error, "❌ Repo job failed");
    }
  };
}
