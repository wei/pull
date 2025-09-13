import { createSchedulerWorker } from "@wei/probot-scheduler";
import { Redis } from "ioredis";
import { appConfig } from "@/src/configs/app-config.ts";
import { getRepoProcessor } from "@/src/processor/index.ts";
import { createProbot } from "probot";

const probot = createProbot();
const RepoJobProcessor = getRepoProcessor(probot);

const redisClient = new Redis(appConfig.redisConfig!, {
  maxRetriesPerRequest: null,
  name: `${appConfig.appSlug}-worker`,
});

const MAX_RETAINED_JOBS = 1000;
const JOB_RETENTION_SECONDS = 3600; // 1 hour

const worker = createSchedulerWorker(
  RepoJobProcessor,
  {
    connection: redisClient,
    concurrency: 10,
    removeOnComplete: {
      count: MAX_RETAINED_JOBS,
      age: JOB_RETENTION_SECONDS,
    },
    removeOnFail: {
      count: MAX_RETAINED_JOBS,
      age: JOB_RETENTION_SECONDS,
    },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, closing worker...`);
  await worker.close();
  try {
    await redisClient.quit();
  } catch {
    // ignore
  }
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", () => gracefulShutdown("SIGINT"));
Deno.addSignalListener("SIGTERM", () => gracefulShutdown("SIGTERM"));
