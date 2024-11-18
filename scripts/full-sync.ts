import { connectMongoDB, disconnectMongoDB } from "@/src/configs/database.ts";
import { fullSync } from "@wei/probot-scheduler";
import { createProbot } from "probot";
import logger from "@/src/utils/logger.ts";
import { getRepositorySchedule } from "@/src/utils/get-repository-schedule.ts";

async function main() {
  let exitCode = 0;

  try {
    await connectMongoDB();

    const probot = createProbot({ overrides: { log: logger } });
    await fullSync(probot, {
      getRepositorySchedule,
    });
  } catch (error) {
    logger.error(error, "Error during full sync");
    exitCode = 1;
  } finally {
    await disconnectMongoDB();
    Deno.exit(exitCode);
  }
}

if (import.meta.main) {
  await main();
}
