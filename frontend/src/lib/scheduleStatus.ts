import type { EventStatus } from "@/types";

export const SCHEDULE_STATUSES = ["pending", "done", "cancelled"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export function normalizeEventStatus(status: EventStatus): ScheduleStatus {
  if (status === "in_progress") return "pending";
  return status;
}
