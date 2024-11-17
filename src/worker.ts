import { createSchedulerWorker } from "@wei/probot-scheduler";
import { Redis } from "ioredis";
import { appConfig } from "@/src/configs/app-config.ts";
import RepoJobProcessor from "@/src/processor/index.ts";

const redisClient = new Redis(appConfig.redisConfig!, {
  maxRetriesPerRequest: null,
});

const worker = createSchedulerWorker(
  RepoJobProcessor,
  {
    connection: redisClient,
    concurrency: 10,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});
