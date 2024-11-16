import type { Request, Response } from "express";

async function getProbotStats(_req: Request, res: Response) {
  const response = await fetch(
    "https://raw.githack.com/pull-app/stats/master/stats.json",
  );
  const data = await response.json();
  res.json(data);
}

export default getProbotStats;
