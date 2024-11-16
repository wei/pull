import { createWorker } from "@wei/probot-scheduler";
import { Redis } from "ioredis";
import { appConfig } from "@/src/configs/app-config.ts";
import RepoJobProcessor from "@/src/processor.ts";

const redisClient = new Redis(appConfig.redisConfig!, {
  maxRetriesPerRequest: null,
});

const worker = createWorker(
  RepoJobProcessor, // Processor can also be a string or URL to a processor file
  {
    connection: redisClient,
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});
