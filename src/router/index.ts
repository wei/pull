import type { Request, Response } from "express";
import type { Probot } from "probot";
import express from "express";
import getProbotStats from "@/src/router/probot-stats.ts";
import getRepoHandlers from "@/src/router/repo-handler.ts";

const createRouter = (app: Probot) => {
  const router = express.Router();

  router.get("/ping", (_req: Request, res: Response) => {
    res.json({ status: "pong" });
  });

  router.get("/probot/stats", getProbotStats);

  const { checkHandler } = getRepoHandlers(app);
  router.get("/check/:owner/:repo", checkHandler);
  // TODO Add process route

  return router;
};

export default createRouter;
