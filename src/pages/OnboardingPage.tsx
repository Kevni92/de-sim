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
            Der Deutschland-Simulator berechnet die Einkommensteuer nach dem hinterlegten Tarif und zeigt weitere
            Haushalts- und Budgetwirkungen dort, wo sie modelliert sind. Grundlage, Berichtsjahr und Grenzen stehen
            beim jeweiligen Ergebnis. Noch nicht berechnete Bereiche werden benannt. Wir bewerten keine Parteien und vergeben keine Punkte.
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

        <aside className="card-flat onboarding-note" aria-labelledby="result-status-title">
          <h2 id="result-status-title">So sind Ergebnisse einzuordnen</h2>
          <dl className="result-status-guide">
            <div><dt>Tarifberechnung</dt><dd>Der Einkommensteuertarif folgt dem Rechtsstand 2026. Geänderte Parameter ergeben ein Szenario, keine amtliche Wirkungsprognose.</dd></div>
            <div><dt>Modellschätzung</dt><dd>Verteilungs-, Budget- und Langfristergebnisse hängen je nach Kennzahl von gewichteten Referenzpunkten oder Modellannahmen ab.</dd></div>
            <div><dt>Beispielwert</dt><dd>Der feste Schuldenstand ist ein Beispiel ohne belegten Stichtag und wird nicht aus Szenarioänderungen fortgeschrieben.</dd></div>
            <div><dt>Noch nicht berechnet</dt><dd>Regionale Wirkungen liegen nicht vor; eine Karte oder regionale Rangfolge wird daher nicht gezeigt.</dd></div>
          </dl>
          <div className="notice-box onboarding-status-note">
            <strong>Ein amtlicher Rechtsstand belegt die verwendete Regel.</strong> Er bestätigt nicht automatisch die Qualität oder amtliche Gültigkeit abgeleiteter Modellwerte.
          </div>
        </aside>
      </main>
    </div>
  );
}
