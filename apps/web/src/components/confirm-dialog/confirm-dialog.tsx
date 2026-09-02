"use client";

import { useEffect, useRef } from "react";

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
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className={styles.dialog}
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
        <Text as="h2" variant="heading-lg">
          {title}
        </Text>
        <Text tone="muted">{message}</Text>
        <div className={styles.actions}>
          <Button onClick={onCancel} variant="secondary">
            {cancelLabel}
          </Button>
          <Button disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
