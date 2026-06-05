"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useT } from "@/lib/i18n";

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface Pending {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger: boolean;
  /** alert = single OK button, no cancel */
  alert: boolean;
  resolve: (ok: boolean) => void;
}

interface ModalApi {
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, opts?: { title?: string; okLabel?: string }) => Promise<void>;
}

const ModalContext = createContext<ModalApi>({
  confirm: async () => false,
  alert: async () => {},
});

export function useConfirm() {
  return useContext(ModalContext).confirm;
}

export function useAlert() {
  return useContext(ModalContext).alert;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (message: string, opts: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, alert: false, danger: opts.danger ?? true, ...opts, resolve });
      }),
    [],
  );

  const alert = useCallback(
    (message: string, opts: { title?: string; okLabel?: string } = {}) =>
      new Promise<void>((resolve) => {
        setPending({
          message, title: opts.title, confirmLabel: opts.okLabel,
          danger: false, alert: true, resolve: () => resolve(),
        });
      }),
    [],
  );

  function settle(ok: boolean) {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  }

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[10000]"
          onClick={() => settle(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {pending.title && <h2 className="text-base font-bold text-gray-800 mb-2">{pending.title}</h2>}
            <p className="text-sm text-gray-700 mb-5 whitespace-pre-line">{pending.message}</p>
            <div className="flex justify-end gap-2">
              {!pending.alert && (
                <button
                  onClick={() => settle(false)}
                  className="border border-gray-300 px-4 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  {pending.cancelLabel ?? t.cancel}
                </button>
              )}
              <button
                onClick={() => settle(true)}
                className={`px-4 py-1.5 rounded text-sm text-white ${pending.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {pending.confirmLabel ?? t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
