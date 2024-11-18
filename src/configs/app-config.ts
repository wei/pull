import { readEnvOptions } from "probot/lib/bin/read-env-options.js";
import denoJson from "@/deno.json" with { type: "json" };

function getAppConfig(env: Record<string, string> = Deno.env.toObject()) {
  return {
    ...readEnvOptions(env),
    version: denoJson.version,
    appName: env.APP_NAME || "Pull",
    appSlug: env.APP_SLUG || "pull",
    botName: `${env.APP_SLUG || "pull"}[bot]`,
    configFilename: env.CONFIG_FILENAME || "pull.yml",
    mongoDBUrl: env.MONGODB_URL,
    port: parseInt(env.PORT || "3000", 10),
    webhookPath: env.WEBHOOK_PATH,
    defaultMergeMethod: env.DEFAULT_MERGE_METHOD || "hardreset",
  };
}

export const appConfig = getAppConfig();
