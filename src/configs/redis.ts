import { appConfig } from "@/src/configs/app-config.ts";
import { Redis } from "ioredis";

export const getRedisClient = () => {
  const redisClient = new Redis(appConfig.redisConfig!, {
    maxRetriesPerRequest: null,
  });
  return redisClient;
};
