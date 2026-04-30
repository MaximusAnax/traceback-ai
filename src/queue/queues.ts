import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { redisConnection } from "./connection.js";
import { MaintenanceJob } from "./jobs/maintenance-job.js";

const defaultJobOptions = {
  attempts: env.TRACEBACK_MAX_RETRIES + 1,
  removeOnComplete: 200,
  removeOnFail: 500,
};

export const ingestQueue = new Queue<MaintenanceJob>("maintenance-ingest", {
  connection: redisConnection,
  defaultJobOptions,
});

export const planQueue = new Queue<MaintenanceJob>("maintenance-plan", {
  connection: redisConnection,
  defaultJobOptions,
});

export const implementQueue = new Queue<MaintenanceJob>("maintenance-implement", {
  connection: redisConnection,
  defaultJobOptions,
});

export const verifyQueue = new Queue<MaintenanceJob>("maintenance-verify", {
  connection: redisConnection,
  defaultJobOptions,
});

export const prQueue = new Queue<MaintenanceJob>("maintenance-pr", {
  connection: redisConnection,
  defaultJobOptions,
});
