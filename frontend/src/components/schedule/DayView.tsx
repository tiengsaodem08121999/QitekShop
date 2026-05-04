"use client";

import EventBlock from "./EventBlock";
import { useT } from "@/lib/i18n";
import { timeToHours, toIsoDate } from "@/lib/schedule";
import type { ScheduleEvent } from "@/types";

const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 56;

interface Props {
  date: Date;
  events: ScheduleEvent[];
  onEventClick: (e: ScheduleEvent) => void;
  onEmptyClick: (date: string, hour: number) => void;
}

export default function DayView({ date, events, onEventClick, onEmptyClick }: Props) {
  const t = useT();
  const iso = toIsoDate(date);
  const dayEvents = events.filter((e) => e.date === iso);

  function gridClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.max(HOUR_START, Math.min(HOUR_END - 1, HOUR_START + Math.floor(y / HOUR_HEIGHT)));
    onEmptyClick(iso, hour);
  }

  return (
    <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 min-h-0">
      <div className="w-16 border-r border-gray-100 text-xs text-gray-400 select-none">
        {Array.from({ length: HOURS }, (_, i) => HOUR_START + i).map((h) => (
          <div key={h} style={{ height: HOUR_HEIGHT }} className="text-right pr-2 pt-0.5">
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="relative flex-1 overflow-auto" onClick={gridClick}
        style={{ minHeight: HOURS * HOUR_HEIGHT }}>
        {Array.from({ length: HOURS }, (_, i) => i).map((i) => (
          <div key={i} style={{ height: HOUR_HEIGHT }} className="border-b border-gray-50" />
        ))}
        {dayEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
            {t.schedule_no_events}
          </div>
        )}
        {dayEvents.map((ev) => {
          const top = (timeToHours(ev.start_time) - HOUR_START) * HOUR_HEIGHT;
          const height = Math.max(24, (timeToHours(ev.end_time) - timeToHours(ev.start_time)) * HOUR_HEIGHT);
          return (
            <div key={ev.id} className="absolute left-2 right-2 z-10"
              style={{ top, height }} onClick={(e) => e.stopPropagation()}>
              <EventBlock event={ev} onClick={() => onEventClick(ev)} style={{ height: "100%" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
