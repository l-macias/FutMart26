import { SettingsFrame, SettingsRow } from "./settings-visual";
import styles from "./profile-settings.module.css";

export function ProfileSettingsScreen() {
  return (
    <SettingsFrame
      active="overview"
      description="Controlá tu identidad deportiva, tus preferencias F5 y la seguridad de tu cuenta."
      eyebrow="MI CUENTA"
      title="Configuración"
    >
      <div className={styles.dashboard}>
        <section
          aria-labelledby="sport-settings-title"
          className={styles.group}
        >
          <header className={styles.groupHeader}>
            <span>PERFIL Y FÚTBOL F5</span>
            <h2 id="sport-settings-title">Tu perfil en cancha</h2>
          </header>
          <div className={styles.rows}>
            <SettingsRow
              description="Nombre deportivo, foto y visibilidad."
              href="/profile/edit"
              mark="ID"
              title="Perfil"
              value="Identidad"
            />
            <SettingsRow
              description="Posiciones, fortalezas y disponibilidad para atajar."
              href="/profile/preferences"
              mark="F5"
              title="Fútbol F5"
              value="Preferencias"
            />
          </div>
        </section>

        <section
          aria-labelledby="account-settings-title"
          className={styles.group}
        >
          <header className={styles.groupHeader}>
            <span>CUENTA Y SEGURIDAD</span>
            <h2 id="account-settings-title">Acceso protegido</h2>
          </header>
          <div className={styles.rows}>
            <SettingsRow
              description="Contraseña y dispositivos donde tu cuenta sigue abierta."
              href="/profile/account"
              mark="AC"
              title="Cuenta y seguridad"
              value="Sesiones"
            />
          </div>
        </section>

        <section
          aria-labelledby="legal-settings-title"
          className={styles.group}
        >
          <header className={styles.groupHeader}>
            <span>LEGAL Y PRIVACIDAD</span>
            <h2 id="legal-settings-title">Políticas y soporte</h2>
          </header>
          <nav aria-label="Legal y privacidad" className={styles.rows}>
            <SettingsRow
              description="Condiciones vigentes de uso de FIFAR."
              href="/terms"
              mark="TR"
              title="Términos"
            />
            <SettingsRow
              description="Cómo se usa y protege tu información."
              href="/privacy"
              mark="PR"
              title="Privacidad"
            />
            <SettingsRow
              description="Ayuda y canales de contacto disponibles."
              href="/support"
              mark="SP"
              title="Soporte"
            />
          </nav>
        </section>

        <section
          aria-labelledby="risk-settings-title"
          className={`${styles.group} ${styles.risk}`}
        >
          <header className={styles.groupHeader}>
            <span>ZONA DE RIESGO</span>
            <h2 id="risk-settings-title">Acciones sensibles</h2>
          </header>
          <div className={styles.rows}>
            <SettingsRow
              danger
              description="Elimina el acceso y anonimiza la identidad cuando corresponde."
              href="/profile/account#delete-account"
              mark="×"
              title="Eliminar cuenta"
              value="Revisar"
            />
          </div>
        </section>
      </div>
    </SettingsFrame>
  );
}
