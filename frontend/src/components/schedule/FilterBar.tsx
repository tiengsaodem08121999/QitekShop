"use client";

import { useT } from "@/lib/i18n";
import type { EventStatus, ScheduleTag } from "@/types";

const STATUSES: EventStatus[] = ["pending", "in_progress", "done", "cancelled"];

interface Props {
  tags: ScheduleTag[];
  selectedStatuses: EventStatus[];
  selectedTagIds: number[];
  onStatusToggle: (s: EventStatus) => void;
  onTagToggle: (id: number) => void;
  onClear: () => void;
}

export default function FilterBar({
  tags, selectedStatuses, selectedTagIds, onStatusToggle, onTagToggle, onClear,
}: Props) {
  const t = useT();
  const allActive = selectedStatuses.length === 0 && selectedTagIds.length === 0;

  return (
    <div className="bg-white border-b border-gray-100 px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">{t.schedule_field_status}:</span>
        <button onClick={onClear}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            allActive ? "bg-gray-800 text-white border-gray-800" : "text-gray-700 border-gray-300"
          }`}>
          {t.schedule_status_all}
        </button>
        {STATUSES.map((s) => {
          const active = selectedStatuses.includes(s);
          return (
            <button key={s} onClick={() => onStatusToggle(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active ? "bg-blue-600 text-white border-blue-600" : "text-gray-700 border-gray-300"
              }`}>
              {t[`schedule_status_${s}` as keyof typeof t] as string}
            </button>
          );
        })}
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">{t.schedule_field_tags}:</span>
          {tags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button key={tag.id} onClick={() => onTagToggle(tag.id)}
                style={active ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active ? "text-white" : "text-gray-700"
                }`}>
                #{tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
