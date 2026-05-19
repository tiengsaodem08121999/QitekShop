"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_LABELS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

const POPUP_WIDTH = 256;
const POPUP_HEIGHT_APPROX = 290;

function isoToDisplay(iso: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function displayToIso(display: string): string | null {
  const m = display.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function autoFormat(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return dateToIso(new Date());
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

export default function DateInput({
  value,
  onChange,
  className,
  required,
  placeholder = "dd-mm-yyyy",
  autoFocus,
}: Props) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const initial = value || todayIso();
  const [viewYear, setViewYear] = useState(Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(initial.slice(5, 7)) - 1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const today = todayIso();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setText(isoToDisplay(value));
    if (value) {
      setViewYear(Number(value.slice(0, 4)));
      setViewMonth(Number(value.slice(5, 7)) - 1);
    }
  }, [value]);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // Prefer below, but flip up if it would overflow
    const top = rect.bottom + POPUP_HEIGHT_APPROX > vh && rect.top > POPUP_HEIGHT_APPROX
      ? rect.top - POPUP_HEIGHT_APPROX - 4
      : rect.bottom + 4;
    const left = Math.min(rect.left, vw - POPUP_WIDTH - 8);
    setPopupPos({ top, left: Math.max(8, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function handleBlur(e: React.FocusEvent) {
    // Don't validate if focus moved to the popup
    if (popupRef.current?.contains(e.relatedTarget as Node)) return;
    const trimmed = text.trim();
    if (trimmed === "") {
      if (value !== "") onChange("");
      return;
    }
    const iso = displayToIso(trimmed);
    if (iso) {
      if (iso !== value) onChange(iso);
      setText(isoToDisplay(iso));
    } else {
      setText(isoToDisplay(value));
    }
  }

  function pickDate(d: Date) {
    const iso = dateToIso(d);
    onChange(iso);
    setText(isoToDisplay(iso));
    setOpen(false);
  }

  function navMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) { m += 12; y -= 1; }
    if (m > 11) { m -= 12; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  }

  const grid = buildGrid(viewYear, viewMonth);
  const inputClass = `${className ?? ""} pr-7`;

  const popup = (
    <div
      ref={popupRef}
      style={{ position: "fixed", top: popupPos.top, left: popupPos.left, width: POPUP_WIDTH, zIndex: 1000 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-2.5"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => navMonth(-1)}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-sm font-semibold text-gray-700">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => navMonth(1)}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === viewMonth;
          const dIso = dateToIso(d);
          const selected = dIso === value;
          const isToday = dIso === today;
          return (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickDate(d)}
              className={`text-xs py-1.5 rounded transition-colors ${
                selected
                  ? "bg-blue-600 text-white font-semibold"
                  : isToday
                  ? "bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                  : inMonth
                  ? "text-gray-700 hover:bg-gray-100"
                  : "text-gray-300 hover:bg-gray-50"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pickDate(new Date())}
          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        >
          Hôm nay
        </button>
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setText(""); setOpen(false); }}
            className="text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            Xóa
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(autoFormat(e.target.value))}
        onBlur={handleBlur}
        required={required}
        maxLength={10}
        autoFocus={autoFocus}
        className={inputClass}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        tabIndex={-1}
        aria-label="Mở lịch"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {open && mounted && createPortal(popup, document.body)}
    </div>
  );
}
