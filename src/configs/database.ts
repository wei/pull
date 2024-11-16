import mongoose from "mongoose";
import { appConfig } from "@/src/configs/app-config.ts";
import log from "@/src/utils/logger.ts";

export const connectMongoDB = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(appConfig.mongoDBUrl!);
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error("[MongoDB] Failed to connect");
  }
  log.info("[MongoDB] Connected");
};

export const disconnectMongoDB = async () => {
  await mongoose.disconnect();
  log.info("[MongoDB] Disconnected");
};
