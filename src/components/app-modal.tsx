"use client";

import { ModalPortal } from "@/components/modal-portal";

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  panelClassName?: string;
}

/** Full-viewport modal with backdrop blur — rendered via portal (covers sidebar + header). */
export function AppModal({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  panelClassName = "",
}: AppModalProps) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] overflow-y-auto">
        <div
          className="fixed inset-0 bg-[#2e3230]/30 backdrop-blur-[3px]"
          aria-hidden
          onClick={onClose}
        />
        <div className="relative z-[201] flex min-h-full items-center justify-center p-4 sm:p-8">
          <div
            className={`bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full ${maxWidth} shadow-2xl animate-fade-in-up overflow-hidden ${panelClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
