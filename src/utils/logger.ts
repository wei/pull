import { appConfig } from "@/src/configs/app-config.ts";
import { pino } from "pino";
import { getTransformStream, type LogLevel } from "@probot/pino";

export const createLogger = (
  {
    name,
    logFormat = "pretty",
    logLevel = "info",
    logLevelInString = true,
    logMessageKey = "msg",
  }: {
    name: string;
    logFormat?: "json" | "pretty";
    logLevel?: LogLevel | "silent";
    logLevelInString?: boolean;
    logMessageKey?: string;
  },
) => {
  const transform = getTransformStream({
    logFormat: logFormat,
    logLevelInString: logLevelInString,
  });
  transform.pipe(pino.destination(1));

  const log = pino(
    {
      name,
      level: logLevel,
      messageKey: logMessageKey,
    },
    transform,
  );
  return log;
};

export const logger = createLogger({
  name: appConfig.appName,
  logFormat: appConfig.logFormat,
  logLevel: appConfig.logLevel,
  logLevelInString: appConfig.logLevelInString,
  logMessageKey: appConfig.logMessageKey,
});

export default logger;
