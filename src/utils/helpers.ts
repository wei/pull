import denoJson from "@/deno.json" with { type: "json" };

export const getRandomCronSchedule = () => {
  // Every 8 hours at a random minute
  const randomMinute = Math.floor(Math.random() * 60);
  const randomHour1 = Math.floor(Math.random() * 8);
  const randomHour2 = randomHour1 + 8;
  const randomHour3 = randomHour2 + 8;
  return `${randomMinute} ${randomHour1},${randomHour2},${randomHour3} * * *`;
};

export const timeout = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getPRTitle = (ref: string, upstream: string): string =>
  `[pull] ${ref} from ${upstream}`;

export const getPRBody = (fullName: string, prNumber?: number): string =>
  (prNumber
    ? `See [Commits](/${fullName}/pull/${prNumber}/commits) and [Changes](/${fullName}/pull/${prNumber}/files) for more details.`
    : `See Commits and Changes for more details.`) +
  `\n\n-----\nCreated by [<img src="https://prod.download/pull-18h-svg" valign="bottom"/> **pull[bot]** (v${denoJson.version})](https://github.com/wei/pull)` +
  "\n\n_Can you help keep this open source service alive? **[💖 Please sponsor : )](https://prod.download/pull-pr-sponsor)**_";
