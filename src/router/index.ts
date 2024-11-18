import type { Request, Response } from "express";
import type { Probot } from "probot";
import express from "express";
import { createSchedulerService } from "@wei/probot-scheduler";
import { appConfig } from "@/src/configs/app-config.ts";
import getStatsHandlers from "@/src/router/stats.ts";
import getRepoHandlers from "@/src/router/repo-handler.ts";

const createRouter = (
  app: Probot,
  schedulerService: ReturnType<typeof createSchedulerService>,
) => {
  const router = express.Router();

  router.get("/", (_req: Request, res: Response) => {
    res.redirect("https://wei.github.io/pull");
  });

  router.get("/version", (_req: Request, res: Response) => {
    res.json({ name: appConfig.appName, version: appConfig.version });
  });

  router.get("/ping", (_req: Request, res: Response) => {
    res.json({ status: "pong" });
  });

  const { probotStatsHandler } = getStatsHandlers(app);
  router.get("/probot/stats", probotStatsHandler);

  const { checkHandler, processHandler } = getRepoHandlers(
    app,
    schedulerService,
  );
  router.get("/check/:owner/:repo", checkHandler);
  router.get("/process/:owner/:repo", processHandler);
  router.post("/process/:owner/:repo", processHandler);

  return router;
};

export default createRouter;
