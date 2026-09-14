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
import { createGracefulShutdown } from "@/src/utils/graceful-shutdown.ts";

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

const handleAppTermination = createGracefulShutdown({
  disconnectMongoDB,
  quitRedis: () => redisClient.quit(),
  exit: Deno.exit,
  logInfo: (message) => log.info(message),
  logError: (message, error) => log.error(error, message),
});

Deno.addSignalListener("SIGINT", () => void handleAppTermination("SIGINT"));
Deno.addSignalListener("SIGTERM", () => void handleAppTermination("SIGTERM"));
