"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Text } from "@football/ui";
import type { z } from "zod";
import {
  footballRoleSchema,
  footballStrengthSchema,
} from "@football/contracts";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { refreshFootballProfileProjections } from "@/lib/api/player-projection-cache";

import styles from "./football-onboarding.module.css";

type Role = z.infer<typeof footballRoleSchema>;
type Strength = z.infer<typeof footballStrengthSchema>;
const roles: { value: Role; label: string }[] = [
  { value: "LIBRE", label: "Libre" },
  { value: "DEFENSIVO", label: "Defensivo" },
  { value: "MEDIO", label: "Medio" },
  { value: "OFENSIVO", label: "Ofensivo" },
  { value: "PORTERO", label: "Portero" },
];
const strengths: Strength[] = [
  "VELOCIDAD",
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "FISICO",
];

export function FootballOnboarding({
  playerName,
  initial,
}: Readonly<{
  playerName: string;
  initial?: {
    preferredRoles: Role[];
    willingToPlayGoalkeeper: boolean;
    strengths: Strength[];
  };
}>) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [preferredRoles, setPreferredRoles] = useState<Role[]>(
    initial?.preferredRoles ?? [],
  );
  const [willing, setWilling] = useState(
    initial?.willingToPlayGoalkeeper ?? false,
  );
  const [selectedStrengths, setSelectedStrengths] = useState<Strength[]>(
    initial?.strengths ?? [],
  );
  const save = useMutation({
    mutationFn: api.savePreferences,
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.footballPreferences, data);
      await refreshFootballProfileProjections(queryClient);
    },
  });

  function toggleRole(role: Role) {
    setPreferredRoles((current) => {
      if (current.includes(role))
        return current.filter((item) => item !== role);
      if (current.length === 2) return current;
      if (role === "PORTERO") setWilling(true);
      return [...current, role];
    });
  }

  function toggleStrength(strength: Strength) {
    setSelectedStrengths((current) =>
      current.includes(strength)
        ? current.filter((item) => item !== strength)
        : current.length < 3
          ? [...current, strength]
          : current,
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Text tone="accent" variant="label">
          SETUP F5 · {step + 1}/3
        </Text>
        <Text as="h1" variant="display-lg">
          {initial ? "Ajustá tu perfil F5." : `Tu fútbol, ${playerName}.`}
        </Text>
        <div aria-hidden="true" className={styles.progress}>
          <span style={{ inlineSize: `${((step + 1) / 3) * 100}%` }} />
        </div>
      </header>

      {step === 0 ? (
        <section className={styles.step}>
          <Text as="h2" variant="heading-lg">
            ¿Dónde te gusta jugar?
          </Text>
          <Text tone="muted">
            Elegí hasta dos. El orden marca tu prioridad.
          </Text>
          <div className={styles.options}>
            {roles.map((role) => {
              const index = preferredRoles.indexOf(role.value);
              return (
                <button
                  aria-pressed={index >= 0}
                  className={styles.option}
                  key={role.value}
                  onClick={() => toggleRole(role.value)}
                  type="button"
                >
                  <span>{role.label}</span>
                  {index >= 0 && <strong>{index + 1}ª POSICIÓN</strong>}
                </button>
              );
            })}
          </div>
        </section>
      ) : step === 1 ? (
        <section className={styles.step}>
          <Text as="h2" variant="heading-lg">
            ¿Atajás si hace falta?
          </Text>
          <Text tone="muted">
            Esto ayuda a armar equipos. No modifica tu OVR.
          </Text>
          <div className={styles.binary}>
            <button
              aria-pressed={willing}
              className={styles.option}
              onClick={() => setWilling(true)}
              type="button"
            >
              Sí, puedo atajar
            </button>
            <button
              aria-pressed={!willing}
              className={styles.option}
              disabled={preferredRoles.includes("PORTERO")}
              onClick={() => setWilling(false)}
              type="button"
            >
              Prefiero no atajar
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.step}>
          <Text as="h2" variant="heading-lg">
            ¿En qué destacás?
          </Text>
          <Text tone="muted">
            Hasta tres señales iniciales. No suman atributos automáticamente.
          </Text>
          <div className={styles.options}>
            {strengths.map((strength) => (
              <button
                aria-pressed={selectedStrengths.includes(strength)}
                className={styles.option}
                key={strength}
                onClick={() => toggleStrength(strength)}
                type="button"
              >
                {strength}
              </button>
            ))}
          </div>
        </section>
      )}

      {save.isError && (
        <p className={styles.error} role="alert">
          {save.error.message}
        </p>
      )}
      <footer className={styles.actions}>
        {step > 0 && (
          <Button onClick={() => setStep((value) => value - 1)} variant="quiet">
            Atrás
          </Button>
        )}
        {step < 2 ? (
          <Button
            disabled={step === 0 && preferredRoles.length === 0}
            onClick={() => setStep((value) => value + 1)}
          >
            Continuar
          </Button>
        ) : (
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                preferredRoles,
                willingToPlayGoalkeeper: willing,
                strengths: selectedStrengths,
              })
            }
          >
            {save.isPending
              ? "Guardando…"
              : initial
                ? "Guardar preferencias"
                : "Entrar a la app"}
          </Button>
        )}
      </footer>
    </main>
  );
}
