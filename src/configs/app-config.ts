import { readEnvOptions } from "probot/lib/bin/read-env-options.js";

function getAppConfig(env: Record<string, string> = Deno.env.toObject()) {
  return {
    ...readEnvOptions(env),
    name: env.APP_NAME || "Pull",
    botName: `${(env.APP_NAME || "Pull").toLowerCase()}[bot]`,
    configFilename: env.CONFIG_FILENAME || "pull.yml",
    mongoDBUrl: env.MONGODB_URL,
    port: parseInt(env.PORT || "3000", 10),
    webhookPath: env.WEBHOOK_PATH,
    defaultMergeMethod: env.DEFAULT_MERGE_METHOD || "hardreset",
  };
}

export const appConfig = getAppConfig();
