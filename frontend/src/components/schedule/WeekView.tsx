"use client";

import EventBlock from "./EventBlock";
import { useT } from "@/lib/i18n";
import { addDays, isSameDay, startOfWeek, timeToHours, toIsoDate } from "@/lib/schedule";
import type { ScheduleEvent } from "@/types";

const HOUR_START = 6;
const HOUR_END = 24;
const HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 56;
const DAY_LABELS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface Props {
  anchorDate: Date;
  events: ScheduleEvent[];
  onEventClick: (e: ScheduleEvent) => void;
  onEmptyClick: (date: string, hour: number) => void;
}

export default function WeekView({ anchorDate, events, onEventClick, onEmptyClick }: Props) {
  const t = useT();
  const start = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 min-h-0">
      <div className="flex border-b border-gray-200 shrink-0">
        <div className="w-16" />
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 text-center py-2 border-l border-gray-100">
            <div className="text-xs text-gray-500">{DAY_LABELS_VI[(d.getDay() + 6) % 7]}</div>
            <div className={`text-sm font-semibold ${isSameDay(d, today) ? "text-blue-600" : "text-gray-800"}`}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-1 overflow-auto">
        <div className="w-16 text-xs text-gray-400 select-none shrink-0">
          {Array.from({ length: HOURS }, (_, i) => HOUR_START + i).map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="text-right pr-2 pt-0.5">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const iso = toIsoDate(d);
          const dayEvents = events.filter((e) => e.date === iso);
          return (
            <div key={iso} className="relative flex-1 border-l border-gray-100"
              style={{ minHeight: HOURS * HOUR_HEIGHT }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hour = Math.max(HOUR_START, Math.min(HOUR_END - 1, HOUR_START + Math.floor(y / HOUR_HEIGHT)));
                onEmptyClick(iso, hour);
              }}>
              {Array.from({ length: HOURS }, (_, i) => i).map((i) => (
                <div key={i} style={{ height: HOUR_HEIGHT }} className="border-b border-gray-50" />
              ))}
              {dayEvents.map((ev) => {
                const top = (timeToHours(ev.start_time) - HOUR_START) * HOUR_HEIGHT;
                const height = Math.max(24, (timeToHours(ev.end_time) - timeToHours(ev.start_time)) * HOUR_HEIGHT);
                return (
                  <div key={ev.id} className="absolute left-1 right-1 z-10"
                    style={{ top, height }} onClick={(e) => e.stopPropagation()}>
                    <EventBlock event={ev} onClick={() => onEventClick(ev)} style={{ height: "100%" }} />
                  </div>
                );
              })}
              {dayEvents.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 pointer-events-none">
                  {t.schedule_no_events}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
