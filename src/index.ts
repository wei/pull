import express from "express";
import { createNodeMiddleware, createProbot } from "probot";
import { JobPriority } from "@wei/probot-scheduler";
import createSchedulerApp from "@/src/app.ts";
import { connectMongoDB, disconnectMongoDB } from "@/src/configs/database.ts";
import { appConfig } from "@/src/configs/app-config.ts";
import log from "@/src/utils/logger.ts";
import { getRandomCronSchedule } from "@/src/utils/helpers.ts";

const args = Deno.args;
const skipFullSync = args.includes("--skip-full-sync");

await connectMongoDB();

const probot = createProbot({
  overrides: {
    log,
  },
});
const schedulerApp = createSchedulerApp.bind(null, probot, {
  // Optional: Skip the initial full sync
  skipFullSync,

  // Define custom repository scheduling
  // deno-lint-ignore require-await
  getRepositorySchedule: async (repository, currentMetadata) => {
    return {
      repository_id: repository.id,
      cron: currentMetadata?.cron ?? getRandomCronSchedule(),
      job_priority: currentMetadata?.job_priority ?? JobPriority.Normal,
    };
  },
});

const server = express();
const gitHubWebhookPath = appConfig.webhookPath || "/api/github/webhooks";
server.use(
  gitHubWebhookPath,
  createNodeMiddleware(schedulerApp, {
    probot,
    webhooksPath: "/",
  }),
);

server.listen(appConfig.port, () => {
  log.info(`[Express] Server is running on port ${appConfig.port}`);
});

Deno.addSignalListener("SIGINT", () => handleAppTermination("SIGINT"));
Deno.addSignalListener("SIGTERM", () => handleAppTermination("SIGTERM"));

function handleAppTermination(signal: string) {
  log.info(`[${signal}] Signal received: closing MongoDB connection`);
  disconnectMongoDB();
  log.info("[MongoDB] Connection closed due to app termination");
  Deno.exit(0);
}
