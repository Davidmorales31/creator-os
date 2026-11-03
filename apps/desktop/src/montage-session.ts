import type { MontagePlan } from "./montage-plan";

export type MontageSession = {
  runId: string;
  plan: MontagePlan;
  index: number;
};
