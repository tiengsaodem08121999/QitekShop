"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import EventModal from "@/components/schedule/EventModal";
import FilterBar from "@/components/schedule/FilterBar";
import MonthView from "@/components/schedule/MonthView";
import WeekView from "@/components/schedule/WeekView";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  addDays, addMonths, getMonthGridRange, getWeekRange, toIsoDate,
} from "@/lib/schedule";
import type { EventStatus, ScheduleEvent, ScheduleTag } from "@/types";

type View = "week" | "month";

interface ModalState {
  initial: ScheduleEvent | null;
  defaultDate?: string;
  defaultStart?: string;
}

export default function SchedulePage() {
  const t = useT();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [tags, setTags] = useState<ScheduleTag[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<EventStatus[]>([]);
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);

  const range = useMemo(() => {
    if (view === "week") return getWeekRange(anchor);
    return getMonthGridRange(anchor);
  }, [view, anchor]);

  const loadEvents = useCallback(() => {
    const qs = new URLSearchParams({
      start_date: toIsoDate(range.start),
      end_date: toIsoDate(range.end),
    });
    apiFetch<ScheduleEvent[]>(`/api/schedule/events?${qs.toString()}`).then(setEvents);
  }, [range.start, range.end]);

  useEffect(() => {
    apiFetch<ScheduleTag[]>("/api/schedule/tags").then(setTags);
  }, []);

  useEffect(loadEvents, [loadEvents]);

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (statusFilter.length > 0 && !statusFilter.includes(e.status)) return false;
    if (tagFilter.length > 0 && !e.tags.some((tag) => tagFilter.includes(tag.id))) return false;
    return true;
  }), [events, statusFilter, tagFilter]);

  const headerLabel = useMemo(() => {
    if (view === "week") {
      const ws = getWeekRange(anchor);
      return `${toIsoDate(ws.start)} – ${toIsoDate(ws.end)}`;
    }
    return anchor.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  }, [view, anchor]);

  function navPrev() {
    if (view === "week") setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  }

  function navNext() {
    if (view === "week") setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  }

  function openCreate(date?: string, hour?: number) {
    setModal({
      initial: null,
      defaultDate: date,
      defaultStart: hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : undefined,
    });
  }

  function openEdit(event: ScheduleEvent) {
    setModal({ initial: event });
  }

  function closeModal() {
    setModal(null);
  }

  function afterSave() {
    closeModal();
    loadEvents();
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t.schedule_title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t.schedule_subtitle}</p>
          </div>
          <button onClick={() => openCreate(toIsoDate(anchor))}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            {t.schedule_add_event}
          </button>
        </div>

        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {(["week", "month"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                {t[`schedule_view_${v}` as keyof typeof t] as string}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={navPrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">{headerLabel}</span>
            <button onClick={navNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button onClick={() => setAnchor(new Date())}
              className="text-xs text-gray-500 hover:text-gray-800 ml-2">{t.schedule_today}</button>
          </div>
        </div>

        <FilterBar
          tags={tags}
          selectedStatuses={statusFilter}
          selectedTagIds={tagFilter}
          onStatusToggle={(s) => setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
          onTagToggle={(id) => setTagFilter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
          onClear={() => { setStatusFilter([]); setTagFilter([]); }}
        />

        <div className="flex-1 min-h-0 mt-3 mb-5 flex flex-col">
          {view === "week" && (
            <WeekView anchorDate={anchor} events={filteredEvents}
              onEventClick={openEdit}
              onEmptyClick={(d, h) => openCreate(d, h)} />
          )}
          {view === "month" && (
            <MonthView anchorDate={anchor} events={filteredEvents}
              onEventClick={openEdit}
              onDayClick={(d) => { setAnchor(d); setView("week"); }} />
          )}
        </div>

        {modal && (
          <EventModal
            tags={tags}
            initial={modal.initial}
            defaultDate={modal.defaultDate}
            defaultStart={modal.defaultStart}
            onClose={closeModal}
            onSaved={afterSave}
            onDeleted={afterSave}
          />
        )}
      </div>
    </AppLayout>
  );
}
