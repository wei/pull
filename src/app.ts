import type { Probot } from "probot";
import {
  createSchedulerApp,
  type SchedulerAppOptions,
} from "@wei/probot-scheduler";

/**
 * Register Pull's scheduler hooks with an existing Probot application.
 *
 * The caller owns the Probot lifecycle and all backing services. Importing this
 * module, and calling this initializer, does not start an HTTP server or open a
 * database connection.
 */
export function createPullApp(app: Probot, options: SchedulerAppOptions): void {
  createSchedulerApp(app, options);
}

export type { SchedulerAppOptions as PullAppOptions };

export default createPullApp;
