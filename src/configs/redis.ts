import { appConfig } from "@/src/configs/app-config.ts";
import { Redis } from "ioredis";

export const getRedisClient = (name?: string) => {
  const redisClient = new Redis(appConfig.redisConfig!, {
    maxRetriesPerRequest: null,
    name,
  });
  return redisClient;
};
