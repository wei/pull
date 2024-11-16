import { readEnvOptions } from "probot/lib/bin/read-env-options.js";

function getAppConfig(env: Record<string, string> = Deno.env.toObject()) {
  return {
    ...readEnvOptions(env),
    name: env.APP_NAME || "probot-scheduler",
    mongoDBUrl: env.MONGODB_URL,
    port: parseInt(env.PORT || "3000", 10),
    webhookPath: env.WEBHOOK_PATH,
  };
}

export const appConfig = getAppConfig();
