import { createProbot } from "probot";
import { fullSync } from "@wei/probot-scheduler";
import logger from "@/src/utils/logger.ts";
import { connectMongoDB, disconnectMongoDB } from "@/src/configs/database.ts";
import { getRepositorySchedule } from "@/src/utils/get-repository-schedule.ts";
import { getRedisClient } from "@/src/configs/redis.ts";
import { appConfig } from "@/src/configs/app-config.ts";

async function main() {
  let exitCode = 0;
  let redisClient: ReturnType<typeof getRedisClient> | undefined;

  try {
    await connectMongoDB();
    redisClient = getRedisClient(`${appConfig.appSlug}-full-sync`);

    const probot = createProbot({ overrides: { log: logger } });
    await fullSync(probot, {
      redisClient,
      getRepositorySchedule,
    });
  } catch (error) {
    logger.error(error, "Error during full sync");
    exitCode = 1;
  } finally {
    await disconnectMongoDB();
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        // ignore
      }
    }
    Deno.exit(exitCode);
  }
}

if (import.meta.main) {
  await main();
}
