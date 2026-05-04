"use client";

import { useT } from "@/lib/i18n";
import { getMonthGridDates, isSameDay, toIsoDate } from "@/lib/schedule";
import type { ScheduleEvent } from "@/types";

const MAX_CHIPS = 3;
const NEUTRAL = "#94A3B8";
const DAY_LABELS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface Props {
  anchorDate: Date;
  events: ScheduleEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (e: ScheduleEvent) => void;
}

export default function MonthView({ anchorDate, events, onDayClick, onEventClick }: Props) {
  const t = useT();
  const dates = getMonthGridDates(anchorDate);
  const month = anchorDate.getMonth();
  const today = new Date();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
        {DAY_LABELS_VI.map((label) => (
          <div key={label} className="text-center text-xs text-gray-500 py-2 border-l border-gray-100 first:border-l-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {dates.map((d) => {
          const iso = toIsoDate(d);
          const inMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const dayEvents = events.filter((e) => e.date === iso);
          return (
            <div key={iso}
              onClick={() => onDayClick(d)}
              className={`border-l border-t border-gray-100 p-1 overflow-hidden cursor-pointer hover:bg-gray-50 ${
                inMonth ? "" : "bg-gray-50/50"
              }`}>
              <div className={`text-xs mb-1 ${isToday ? "text-blue-600 font-bold" : inMonth ? "text-gray-700" : "text-gray-400"}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_CHIPS).map((ev) => {
                  const color = ev.tags[0]?.color ?? NEUTRAL;
                  const dim = ev.status === "done" || ev.status === "cancelled";
                  return (
                    <button key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      style={{ backgroundColor: color, opacity: dim ? 0.5 : 1 }}
                      className={`text-left text-[10px] px-1.5 py-0.5 rounded text-white w-full truncate ${dim ? "line-through" : ""}`}>
                      {ev.title}
                    </button>
                  );
                })}
                {dayEvents.length > MAX_CHIPS && (
                  <div className="text-[10px] text-gray-500">{t.schedule_more_count(dayEvents.length - MAX_CHIPS)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
