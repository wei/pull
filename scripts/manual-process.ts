import { connectMongoDB, disconnectMongoDB } from "@/src/configs/database.ts";
import { JobPriority, RepositoryModel } from "@wei/probot-scheduler";
import { createProbot } from "probot";
import logger from "@/src/utils/logger.ts";
import { getPullConfig } from "@/src/utils/get-pull-config.ts";
import { Pull } from "@/src/processor/pull.ts";

async function main(full_name: string) {
  let exitCode = 0;

  try {
    await connectMongoDB();

    logger.info(`🏃 Processing repo job ${full_name}`);

    try {
      // Get Octokit
      const probot = createProbot({ overrides: { log: logger } });

      const repoRecord = await RepositoryModel.findOne({ full_name });

      if (!repoRecord) {
        logger.error({ full_name }, `❌ Repo record not found`);
        throw new Error(`❌ Repo record not found`);
      }

      const { installation_id, owner: { login: owner }, name: repo } =
        repoRecord;

      const octokit = await probot.auth(installation_id);

      const config = await getPullConfig(octokit, logger, {
        installation_id,
        owner,
        repo,
        repository_id: 0,
        metadata: {
          cron: "",
          job_priority: JobPriority.Normal,
          repository_id: 0,
        },
      });
      if (!config) {
        logger.info(`⚠️ No config found, skipping`);
        return;
      }

      const pull = new Pull(octokit, { owner, repo, logger }, config);
      await pull.routineCheck();

      logger.info(`✅ Repo job processed successfully`);
    } catch (error) {
      logger.error(error, "❌ Repo job failed");
    }
  } catch (error) {
    logger.error(error, "Error processing");
    exitCode = 1;
  } finally {
    await disconnectMongoDB();
    Deno.exit(exitCode);
  }
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length !== 1) {
    logger.error(
      "Usage: deno task manual-process <owner>/<repo>",
    );
    Deno.exit(1);
  }

  await main(args[0]);
}
