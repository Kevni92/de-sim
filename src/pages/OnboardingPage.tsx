import { ModuleCalculationContextCard } from "../components/ModuleDetailComponents";
import type { ModelLevel, TimeHorizon } from "../lib/types";

export function OnboardingPage({
  modelLevel,
  horizonYears,
  onStart,
}: {
  modelLevel: ModelLevel;
  horizonYears: TimeHorizon;
  onStart: () => void;
}) {
  return (
    <div className="onboarding-page">
      <main className="onboarding-grid">
        <section>
          <span className="badge-label">Einstieg</span>
          <h1>Ein neutraler Blick auf den deutschen Staatshaushalt.</h1>
          <p className="lead">
            Der Deutschland-Simulator zeigt, wie sich Änderungen an Steuern, Sozialbeiträgen und Ausgaben auf Budget,
            Haushalte und Regionen auswirken. Für jede Kennzahl weisen wir Quelle, Berichtsjahr und Unsicherheitsgrad aus.
            Wir bewerten keine Parteien und vergeben keine Punkte.
          </p>

          <div className="notice-box onboarding-baseline" role="note" aria-label="Verwendete gesetzliche Grundlage">
            <strong>Unterstützte gesetzliche Grundlage: Rechtsstand 2026.</strong>
            <p>Die Berichtsjahre können je Kennzahl abweichen und stehen beim jeweiligen Nachweis. Der Zeitraum einer Wirkungsrechnung ist davon getrennt. Du kannst ohne weitere Einrichtung direkt in die Übersicht starten.</p>
          </div>

          <section className="onboarding-calculation" aria-label="Berechnungsrahmen des Szenarios">
            <ModuleCalculationContextCard
              modelLevel={modelLevel}
              horizonYears={horizonYears}
              description="Der Berechnungsrahmen gilt für das gesamte Szenario. Du kannst ihn zentral im Szenario ändern."
            />
          </section>

          <div className="onboarding-actions">
            <button className="button primary large" onClick={onStart}>Simulation starten</button>
            <a className="button secondary large" href="https://kevni92.github.io/de-sim-docs/" target="_blank" rel="noreferrer">Methodik lesen</a>
          </div>
        </section>

        <aside className="card-flat onboarding-note">
          <h2>Was dieser Simulator nicht ist</h2>
          <ul>
            <li>Kein Wahltest, keine Empfehlung, kein Parteiprogramm.</li>
            <li>Kein Ranking von Politik in „gut“ und „schlecht“.</li>
            <li>Keine Punktgenauigkeit – Ergebnisse sind Bandbreiten.</li>
            <li>Kein Ersatz für parlamentarische Beratung.</li>
          </ul>
          <div className="notice-box">
            <strong>Hinweis.</strong> Alle im Prototyp verwendeten Werte sind gerundete Demonstrationswerte. Für belastbare
            Aussagen werden später amtliche Quellen und validierte Modelle verwendet.
          </div>
        </aside>
      </main>
    </div>
  );
}
