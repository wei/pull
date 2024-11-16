import { Probot } from "probot";
import { createSchedulerApp, SchedulerAppOptions } from "@wei/probot-scheduler";

export default (app: Probot, opts: SchedulerAppOptions) => {
  createSchedulerApp(app, opts);
};
