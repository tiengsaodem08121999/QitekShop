import type { EventStatus } from "@/types";
import { normalizeEventStatus } from "@/lib/scheduleStatus";

interface Props {
  status: EventStatus;
  size?: number;
  className?: string;
}

export default function EventStatusIcon({ status, size = 14, className = "" }: Props) {
  const s = normalizeEventStatus(status);
  const box = { width: size, height: size };

  if (s === "pending") {
    return (
      <span
        aria-hidden
        className={`inline-block rounded-[3px] bg-blue-500 shrink-0 ${className}`}
        style={box}
      />
    );
  }

  if (s === "done") {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center rounded-[3px] bg-green-500 shrink-0 ${className}`}
        style={box}
      >
        <svg viewBox="0 0 12 12" className="w-[70%] h-[70%]" fill="none" stroke="white" strokeWidth="2">
          <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-[3px] bg-red-400 shrink-0 ${className}`}
      style={box}
    >
      <svg viewBox="0 0 12 12" className="w-[70%] h-[70%]" fill="none" stroke="white" strokeWidth="2">
        <path d="M3 3l6 6M9 3L3 9" strokeLinecap="round" />
      </svg>
    </span>
  );
}
