import type { Request, Response } from "express";
import { Probot } from "probot";

function getStatsHandlers(_app: Probot) {
  async function probotStatsHandler(_req: Request, res: Response) {
    const response = await fetch(
      "https://raw.githack.com/pull-app/stats/master/stats.json",
    );
    const data = await response.json();
    res.json(data);
  }

  return {
    probotStatsHandler,
  };
}

export default getStatsHandlers;
