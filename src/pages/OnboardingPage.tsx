import type { ModelLevel } from "../lib/types";

export function OnboardingPage({
  modelLevel,
  onModelLevel,
  onStart,
}: {
  modelLevel: ModelLevel;
  onModelLevel: (level: ModelLevel) => void;
  onStart: () => void;
}) {
  return (
    <div className="onboarding-page">
      <main className="onboarding-grid">
        <section>
          <span className="badge-label">Onboarding · Schritt 1 von 3</span>
          <h1>Ein neutraler Blick auf den deutschen Staatshaushalt.</h1>
          <p className="lead">
            Der Deutschland-Simulator zeigt, wie sich Änderungen an Steuern, Sozialbeiträgen und Ausgaben auf Budget,
            Haushalte und Regionen auswirken. Jede Zahl ist mit Quelle, Datenjahr und Unsicherheitsgrad hinterlegt.
            Wir bewerten keine Parteien und vergeben keine Punkte.
          </p>

          <fieldset className="choice-fieldset">
            <legend>Basisdaten wählen</legend>
            <p>Bestimme, welchen Rechtsstand deine Simulation nutzt. Änderungen sind später möglich.</p>
            <div className="choice-grid">
              <Choice label="Rechtsstand 2024" note="letzter geschlossener Jahresabschluss" />
              <Choice label="Rechtsstand 2025" note="vorläufig, Bundesbank + BMF" />
              <Choice label="Rechtsstand 2026" note="Referenzentwurf, empfohlen" active />
            </div>
          </fieldset>

          <fieldset className="choice-fieldset">
            <legend>Modellstufe</legend>
            <p>Spekulativere Wirkungen werden klar von der statischen Berechnung getrennt.</p>
            <div className="choice-grid">
              <ChoiceButton label="Statisch" note="keine Verhaltenseffekte" active={modelLevel === "statisch"} onClick={() => onModelLevel("statisch")} />
              <ChoiceButton label="Mit Verhaltenseffekt" note="kurzfristige Reaktion" active={modelLevel === "verhalten"} onClick={() => onModelLevel("verhalten")} />
              <ChoiceButton label="Langfristszenario" note="10-Jahres-Trend" active={modelLevel === "langfrist"} onClick={() => onModelLevel("langfrist")} />
            </div>
          </fieldset>

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

function Choice({ label, note, active = false }: { label: string; note: string; active?: boolean }) {
  return (
    <div className={`choice-card ${active ? "active" : ""}`}>
      <span className="radio-dot">{active && <i />}</span>
      <strong>{label}</strong>
      <small>{note}</small>
    </div>
  );
}

function ChoiceButton({ label, note, active, onClick }: { label: string; note: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`choice-card button-card ${active ? "active" : ""}`} onClick={onClick}>
      <strong>{label}</strong>
      <small>{note}</small>
    </button>
  );
}
