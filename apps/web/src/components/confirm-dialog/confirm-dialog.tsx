"use client";

import { useEffect, useId, useRef } from "react";

import { Button, Text } from "@football/ui";

import styles from "./confirm-dialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  eyebrow?: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  eyebrow = "CONFIRMAR ACCIÓN",
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmDisabled = false,
  tone = "default",
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.dialog}
      data-tone={tone}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <div className={styles.content}>
        <Text tone="accent" variant="label">
          {eyebrow}
        </Text>
        <Text as="h2" id={titleId} variant="heading-lg">
          {title}
        </Text>
        <Text tone="muted">{message}</Text>
        <div className={styles.actions}>
          <Button onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            disabled={confirmDisabled}
            onClick={onConfirm}
            variant={tone === "danger" ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
