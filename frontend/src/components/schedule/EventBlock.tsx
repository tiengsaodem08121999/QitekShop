"use client";

import { trimSeconds } from "@/lib/schedule";
import type { ScheduleEvent } from "@/types";

const NEUTRAL = "#94A3B8";

interface Props {
  event: ScheduleEvent;
  onClick: () => void;
  style?: React.CSSProperties;
}

export default function EventBlock({ event, onClick, style }: Props) {
  const color = event.tags[0]?.color ?? NEUTRAL;
  const dim = event.status === "done" || event.status === "cancelled";

  return (
    <button onClick={onClick}
      style={{ backgroundColor: color, opacity: dim ? 0.5 : 1, ...style }}
      className={`text-left text-xs p-1.5 rounded text-white shadow-sm hover:shadow transition-shadow w-full overflow-hidden ${
        dim ? "line-through" : ""
      }`}>
      <div className="font-medium truncate">{event.title}</div>
      <div className="text-[10px] opacity-90">
        {trimSeconds(event.start_time)}–{trimSeconds(event.end_time)}
      </div>
    </button>
  );
}
