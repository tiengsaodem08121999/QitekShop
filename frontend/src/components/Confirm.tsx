"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface PendingConfirm {
  message: string;
  resolve: (ok: boolean) => void;
}

const ConfirmContext = createContext<(message: string) => Promise<boolean>>(
  async () => false
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        setPending({ message, resolve });
      }),
    []
  );

  function settle(ok: boolean) {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
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
            <p className="text-sm text-gray-800 mb-5">{pending.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="border border-gray-300 px-4 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => settle(true)}
                className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
