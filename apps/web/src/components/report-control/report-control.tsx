"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@football/ui";
import { api } from "@/lib/api/resources";
import styles from "./report-control.module.css";

type TargetType = "PLAYER" | "GROUP" | "MATCH";
type Reason =
  | "HARASSMENT"
  | "INAPPROPRIATE_CONTENT"
  | "IMPERSONATION"
  | "SPAM"
  | "SAFETY"
  | "OTHER";

export function ReportControl({
  targetType,
  targetId,
}: Readonly<{ targetType: TargetType; targetId: string }>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("HARASSMENT");
  const [comment, setComment] = useState("");
  const report = useMutation({
    mutationFn: api.createReport,
    onSuccess: () => setOpen(false),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (report.isPending) return;
    report.mutate({
      targetType,
      targetId,
      reason,
      comment: comment.trim() || null,
    });
  }
  return (
    <div className={styles.wrapper}>
      <Button onClick={() => setOpen((value) => !value)} variant="quiet">
        Reportar
      </Button>
      {open ? (
        <form className={styles.form} onSubmit={submit}>
          <label>
            Motivo
            <select
              onChange={(event) => setReason(event.target.value as Reason)}
              value={reason}
            >
              <option value="HARASSMENT">Acoso</option>
              <option value="INAPPROPRIATE_CONTENT">
                Contenido inapropiado
              </option>
              <option value="IMPERSONATION">Suplantación</option>
              <option value="SPAM">Spam</option>
              <option value="SAFETY">Seguridad</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label>
            Detalle opcional
            <textarea
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
          </label>
          {report.isError ? (
            <p className={styles.error} role="alert">
              {report.error.message}
            </p>
          ) : null}
          {report.isSuccess ? <p role="status">Reporte recibido.</p> : null}
          <div className={styles.actions}>
            <Button disabled={report.isPending} type="submit">
              {report.isPending ? "Enviando…" : "Enviar reporte"}
            </Button>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
