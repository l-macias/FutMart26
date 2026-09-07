"use client";

import { useEffect, useRef } from "react";

export function ConfirmAction({
  title,
  consequence,
  pending,
  onConfirm,
  onCancel,
}: Readonly<{
  title: string;
  consequence: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div
      aria-labelledby="confirm-title"
      aria-modal="true"
      className="confirm-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
        if (event.key === "Tab") {
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled)",
          );
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
      role="dialog"
    >
      <div className="confirm-dialog" ref={dialogRef}>
        <div className="section-stack">
          <span className="eyebrow">ACCIÓN SENSIBLE</span>
          <h2 id="confirm-title">{title}</h2>
          <p className="muted">{consequence}</p>
        </div>
        <div className="actions">
          <button
            className="button-danger"
            disabled={pending}
            onClick={onConfirm}
          >
            Confirmar
          </button>
          <button disabled={pending} onClick={onCancel} ref={cancelRef}>
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
