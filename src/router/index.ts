import type { Request, Response } from "express";
import type { Probot } from "probot";
import express from "express";
import getStatsHandlers from "@/src/router/stats.ts";
import getRepoHandlers from "@/src/router/repo-handler.ts";

const createRouter = (app: Probot) => {
  const router = express.Router();

  router.get("/", (_req: Request, res: Response) => {
    res.redirect("https://wei.github.io/pull");
  });

  router.get("/ping", (_req: Request, res: Response) => {
    res.json({ status: "pong" });
  });

  const { probotStatsHandler } = getStatsHandlers(app);
  router.get("/probot/stats", probotStatsHandler);

  const { checkHandler } = getRepoHandlers(app);
  router.get("/check/:owner/:repo", checkHandler);
  // TODO Add process route

  return router;
};

export default createRouter;
