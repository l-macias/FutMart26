import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import {
  MatchStateMark,
  OverallDisplay,
  TacticalDivider,
} from "@football/football-ui";
import { Button, IconButton, Surface, Text } from "@football/ui";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const palette = [
  ["Canvas", "background.canvas", styles.canvas!],
  ["Surface", "background.surface", styles.surface!],
  ["Elevated", "background.elevated", styles.elevated!],
  ["Primary", "foreground.primary", styles.foreground!],
  ["Muted", "foreground.muted", styles.muted!],
  ["Accent", "accent.primary", styles.accent!],
  ["Pitch", "pitch.surface", styles.pitch!],
  ["Positive", "state.positive", styles.positive!],
  ["Warning", "state.warning", styles.warning!],
  ["Negative", "state.negative", styles.negative!],
] as const;

export default function DesignSystemPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className={styles.preview}>
      <header className={styles.previewHeader}>
        <Text as="span" tone="accent" variant="label">
          Internal preview / development only
        </Text>
        <Text as="h1" variant="display-lg">
          Visual Foundation v1
        </Text>
        <Text className={styles.lede} tone="muted" variant="body">
          Night Pitch como estructura, detalle táctico como sistema y energía
          collectible reservada para los acentos.
        </Text>
      </header>

      <PreviewSection title="Color tokens">
        <div className={styles.paletteGrid}>
          {palette.map(([name, token, colorClass]) => (
            <article className={styles.swatch} key={token}>
              <span className={`${styles.swatchColor} ${colorClass}`} />
              <Text as="h3" variant="heading-md">
                {name}
              </Text>
              <Text as="span" tone="muted" variant="metadata">
                {token}
              </Text>
            </article>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="Typography roles">
        <div className={styles.typeStack}>
          <Text as="p" variant="display-xl">
            Noche de fútbol
          </Text>
          <Text as="p" variant="display-lg">
            Display sport
          </Text>
          <Text as="p" variant="score">
            04—03
          </Text>
          <Text as="h2" variant="heading-lg">
            Heading grande
          </Text>
          <Text as="h3" variant="heading-md">
            Heading medio
          </Text>
          <Text variant="body">
            La fuente de interfaz mantiene legible el contenido y deja que los
            números y títulos deportivos carguen con la personalidad.
          </Text>
          <Text as="span" variant="label">
            Label de interfaz
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            Metadata secundaria
          </Text>
        </div>
      </PreviewSection>

      <PreviewSection title="Neutral primitives">
        <div className={styles.componentRow}>
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <IconButton label="Ejemplo de acción universal">
            <span aria-hidden="true" className={styles.plusMark} />
          </IconButton>
        </div>
        <div className={styles.surfaceGrid}>
          <Surface className={styles.surfaceSample}>
            <Text as="h3" variant="heading-md">
              Surface
            </Text>
            <Text tone="muted" variant="body">
              Plano, preciso y con borde sutil.
            </Text>
          </Surface>
          <Surface className={styles.surfaceSample} elevation="raised">
            <Text as="h3" variant="heading-md">
              Elevated
            </Text>
            <Text tone="muted" variant="body">
              Elevación reservada para jerarquía real.
            </Text>
          </Surface>
        </div>
      </PreviewSection>

      <PreviewSection title="Football language">
        <div className={styles.footballRow}>
          <OverallDisplay value="84" />
          <div className={styles.stateStack}>
            <MatchStateMark>Neutral</MatchStateMark>
            <MatchStateMark tone="positive">Confirmado</MatchStateMark>
            <MatchStateMark tone="warning">Atención</MatchStateMark>
            <MatchStateMark tone="negative">Cancelado</MatchStateMark>
          </div>
        </div>
        <TacticalDivider />
      </PreviewSection>

      <PreviewSection title="Spacing, radius & border">
        <div className={styles.measureGrid}>
          <div className={styles.spacingScale} aria-label="Escala de espacios">
            {["1", "2", "3", "4", "5", "6", "7"].map((step) => (
              <span
                className={styles.spacingBar}
                key={step}
                style={
                  { "--preview-space": `var(--space-${step})` } as CSSProperties
                }
              >
                {step}
              </span>
            ))}
          </div>
          <div className={styles.radiusScale}>
            <span className={styles.radiusPanel}>Panel</span>
            <span className={styles.radiusControl}>Control</span>
            <span className={styles.radiusRound}>Round</span>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection title="Motion categories">
        <div className={styles.motionGrid}>
          <MotionSample category="Micro" motionClass={styles.motionMicro!} />
          <MotionSample
            category="Feedback"
            motionClass={styles.motionFeedback!}
          />
          <MotionSample
            category="Transition"
            motionClass={styles.motionTransition!}
          />
          <MotionSample
            category="Celebration"
            motionClass={styles.motionCelebration!}
          />
        </div>
        <Text tone="muted" variant="metadata">
          Hover o foco para inspeccionar. Reduced motion conserva el estado sin
          transición perceptible.
        </Text>
      </PreviewSection>
    </main>
  );
}

function PreviewSection({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <Text as="h2" variant="heading-lg">
          {title}
        </Text>
        <span aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

function MotionSample({
  category,
  motionClass,
}: Readonly<{ category: string; motionClass: string }>) {
  return (
    <button className={`${styles.motionSample} ${motionClass}`} type="button">
      <span aria-hidden="true" />
      <Text as="span" variant="label">
        {category}
      </Text>
    </button>
  );
}
