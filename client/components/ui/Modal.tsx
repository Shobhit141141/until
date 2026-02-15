"use client";

import { type ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title?: string;
}

export function Modal({ children, onClose, title }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-gray-800 rounded-xl shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] max-h-[90vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b-2 border-gray-800 bg-white p-3 rounded-t-xl">
          {title && (
            <h2 id="modal-title" className="text-lg font-bold text-gray-900">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border-2 border-gray-800 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
