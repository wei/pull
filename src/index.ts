import express from "express";
import { createNodeMiddleware, createProbot } from "probot";
import { createSchedulerService } from "@wei/probot-scheduler";
import createSchedulerApp from "@/src/app.ts";
import { appConfig } from "@/src/configs/app-config.ts";
import log from "@/src/utils/logger.ts";
import { connectMongoDB, disconnectMongoDB } from "@/src/configs/database.ts";
import { getRedisClient } from "@/src/configs/redis.ts";
import createRouter from "@/src/router/index.ts";
import { getRepositorySchedule } from "@/src/utils/get-repository-schedule.ts";

const args = Deno.args;
const skipFullSync = args.includes("--skip-full-sync");

await connectMongoDB();

const redisClient = getRedisClient(`${appConfig.appSlug}-app`);

const probot = createProbot({
  overrides: {
    log,
  },
});
const schedulerApp = createSchedulerApp.bind(null, probot, {
  // Optional: Skip the initial full sync
  skipFullSync,

  redisClient,

  // Define custom repository scheduling
  getRepositorySchedule,
});
const schedulerService = createSchedulerService(probot, {
  redisClient,
  getRepositorySchedule,
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
server.use("/", createRouter(probot, schedulerService));

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
