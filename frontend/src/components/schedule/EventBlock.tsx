"use client";

import EventStatusIcon from "./EventStatusIcon";
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

  return (
    <button onClick={onClick}
      style={{ backgroundColor: color, ...style }}
      className="text-left text-xs p-1.5 rounded text-white shadow-sm hover:shadow transition-shadow w-full overflow-hidden">
      <div className="font-medium truncate flex items-center gap-1.5">
        <EventStatusIcon status={event.status} size={16} className="opacity-90 shrink-0" />
        <span className="truncate">{event.title}</span>
      </div>
      <div className="text-[10px] opacity-90">
        {trimSeconds(event.start_time)}–{trimSeconds(event.end_time)}
      </div>
    </button>
  );
}
