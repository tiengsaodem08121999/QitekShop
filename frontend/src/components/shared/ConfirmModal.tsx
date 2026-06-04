"use client";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-2 text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose}
            className="border px-4 py-2 rounded text-sm hover:bg-gray-50">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
