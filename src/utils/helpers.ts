import { appConfig } from "@/src/configs/app-config.ts";

export const getRandomCronSchedule = () => {
  // Every 6 hours at a random minute
  const randomMinute = Math.floor(Math.random() * 60);
  const randomHour1 = Math.floor(Math.random() * 6);
  const randomHour2 = randomHour1 + 6;
  const randomHour3 = randomHour2 + 6;
  const randomHour4 = randomHour3 + 6;
  return `${randomMinute} ${randomHour1},${randomHour2},${randomHour3},${randomHour4} * * *`;
};

export const timeout = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getPRTitle = (ref: string, upstream: string): string =>
  `[pull] ${ref} from ${upstream}`;

export const getPRBody = (fullName: string, prNumber?: number): string =>
  (prNumber
    ? `See [Commits](/${fullName}/pull/${prNumber}/commits) and [Changes](/${fullName}/pull/${prNumber}/files) for more details.`
    : `See Commits and Changes for more details.`) +
  `\n\n-----\nCreated by [<img src="https://prod.download/pull-18h-svg" valign="bottom"/> **pull[bot]**](https://github.com/wei/pull) (v${appConfig.version})` +
  "\n\n_Can you help keep this open source service alive? **[💖 Please sponsor : )](https://prod.download/pull-pr-sponsor)**_";
