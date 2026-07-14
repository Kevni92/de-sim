import { AlertTriangle, ArrowRight, Clock3, ExternalLink, Info, RefreshCw, Users } from "lucide-react";
import { calculationFreshnessLabel, type CalculationFreshness } from "../lib/scenario-calculation";
import { contextualEffectsFor, effectLinksForContext, type ContextualEffectView, type ReformContextKey } from "../lib/reform-effects";
import type { EffectRun } from "../lib/long-term-effects";

const evidenceLabels: Record<string, string> = {
  "amtlich-beobachtet": "Amtlich beobachtet",
  modellrechnung: "Modellrechnung",
  szenarioannahme: "Szenarioannahme",
  "externe-evidenz": "Externe Evidenz",
  "nicht-berechnet": "Nicht berechnet",
  "nicht-ausreichend-belegt": "Nicht ausreichend belegt",
};
const causalityLabels: Record<string, string> = {
  deskriptiv: "Deskriptiv",
  korrelativ: "Korrelativ",
  "kausal-geschaetzt": "Kausal geschätzt",
  modelliert: "Modelliert",
  hypothetisch: "Hypothetisch",
};
const layerLabels = {
  "short-term": "Kurzfristige Reaktion",
  "long-term": "Langfristiger Pfad",
  feedback: "Fiskalische Rückkopplung",
  "non-monetary": "Nicht monetäre Wirkung",
} as const;

const formatBn = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Mrd. €`;
const formatCount = (value: number) => Math.round(value).toLocaleString("de-DE");

export function ContextualEffectsPanel({
  contextKey,
  active,
  run,
  status,
  basisAvailable,
  error,
  onRetry,
  onOpenSource,
  onOpenAdvanced,
  onManageBasis,
}: {
  contextKey: ReformContextKey;
  active: boolean;
  run: EffectRun | null;
  status: CalculationFreshness;
  basisAvailable: boolean;
  error: string;
  onRetry: () => void;
  onOpenSource: (sourceId: string) => void;
  onOpenAdvanced: () => void;
  onManageBasis: () => void;
}) {
  const links = effectLinksForContext(contextKey);
  const effects = contextualEffectsFor(contextKey, run);

  if (!links.length) {
    return <div className="context-effects-empty" data-testid="context-effects-empty"><strong>Keine eigene Folgewirkung hinterlegt</strong><p>Für dieses Reformmodul wird derzeit keine zusätzliche Wirkungskette behauptet. Die direkte staatliche Wirkung bleibt davon unberührt.</p></div>;
  }

  if (!active) {
    return <div className="context-effects-empty" data-testid="context-effects-inactive"><strong>Noch keine abweichende Maßnahme</strong><p>Eine kontextbezogene Folgewirkung erscheint, sobald mindestens eine Stellschraube dieses Moduls von der Baseline abweicht.</p><button className="button secondary small" type="button" onClick={onOpenAdvanced}>Vollständiges Wirkungsregister</button></div>;
  }

  if (!basisAvailable) {
    return <div className="context-effects-state warning" role="status" data-testid="context-effects-missing-basis"><AlertTriangle size={18} /><div><strong>Modellbasis fehlt</strong><p>Die direkte Wirkung bleibt nutzbar. Für kontextbezogene Personen-, Haushalts- und Zeitpfade wird eine verfügbare Modellbasis benötigt.</p><button className="button secondary small" type="button" onClick={onManageBasis}>Modellbasis prüfen</button></div></div>;
  }

  return <div className="context-effects-panel" data-testid="context-effects-panel" data-status={status}>
    <header className="context-effects-header">
      <div><span className="eyebrow">Automatisch aus dem Szenario</span><h4>Relevante Wirkungspfade</h4><p>Direkte Budgetwirkung, mögliche Reaktion und langfristiger Pfad werden nicht zu einer einzigen Gesamtzahl vermischt.</p></div>
      <span className={`context-effects-freshness ${status}`} role="status" aria-live="polite">{status === "updating" && <RefreshCw className="spin" size={13} />}{calculationFreshnessLabel(status)}</span>
    </header>

    {error && <div className="context-effects-state error" role="alert"><AlertTriangle size={17} /><div><strong>Wirkungsrechnung fehlgeschlagen</strong><p>{error}</p><button className="button secondary small" type="button" onClick={onRetry}>Erneut versuchen</button></div></div>}
    {status === "updating" && run && <div className="context-effects-state updating"><RefreshCw className="spin" size={17} /><p>Die vorhandenen Pfade bleiben zur Orientierung sichtbar, sind während der Aktualisierung aber nicht als neuer Stand gekennzeichnet.</p></div>}
    {status === "stale" && run && <div className="context-effects-state warning"><Clock3 size={17} /><p>Die sichtbaren Pfade verwenden noch eine ältere Einstellung und werden nicht als aktuell ausgegeben.</p></div>}

    <div className="context-effects-grid">
      {effects.map((effect) => <ContextEffectCard key={effect.id} effect={effect} onOpenSource={onOpenSource} />)}
    </div>

    <footer className="context-effects-footer">
      <p>Abhängige Teilpfade mit demselben Überlappungsschlüssel werden im Szenariovergleich nur einmal berücksichtigt.</p>
      <button className="button secondary small" type="button" onClick={onOpenAdvanced}>Wirkungsmodelle vollständig prüfen <ExternalLink size={13} /></button>
    </footer>
  </div>;
}

function ContextEffectCard({ effect, onOpenSource }: { effect: ContextualEffectView; onOpenSource: (sourceId: string) => void }) {
  const affected = effect.affectedHouseholds > 0
    ? `${formatCount(effect.affectedHouseholds)} Haushalte`
    : effect.affectedPersons > 0
      ? `${formatCount(effect.affectedPersons)} Personen`
      : "Zielgruppe nicht belastbar bestimmt";
  return <article className={`context-effect-card ${effect.status}`} data-testid={`context-effect-${effect.id}`}>
    <div className="context-effect-title">
      <div><span>{layerLabels[effect.layer]}</span><h5>{effect.title}</h5></div>
      <div className="context-effect-badges"><span>{evidenceLabels[effect.evidenceStatus]}</span><span>{causalityLabels[effect.causality]}</span></div>
    </div>
    <p className="context-effect-chain">{effect.chain.split(" → ").map((step, index, all) => <span key={`${effect.id}-${step}`}><b>{step}</b>{index < all.length - 1 && <ArrowRight size={12} aria-hidden="true" />}</span>)}</p>
    <div className="context-effect-meta"><span><Clock3 size={13} /> {effect.timing}</span><span><Users size={13} /> {affected}</span></div>

    {effect.status === "quantified" && effect.value !== null ? <div className="context-effect-value">
      <span>Modellierter Pfad, ohne direkte Budgetwirkung</span><strong>{formatBn(effect.value)}</strong>
      {effect.lower !== null && effect.upper !== null && <small>Unsicherheitsband {formatBn(effect.lower)} bis {formatBn(effect.upper)}</small>}
    </div> : <div className={`context-effect-no-point ${effect.status}`}><strong>{effect.status === "directional" ? "Gerichtete Wirkung ohne Punktwert" : effect.status === "unavailable" ? "Nicht ausreichend belegt" : "In dieser Modellstufe nicht quantifiziert"}</strong><p>{effect.explanation}</p></div>}

    {effect.nonMonetaryEffects.some((measure) => Math.abs(measure.value) >= 1e-9) && <div className="context-effect-natural-units">
      {effect.nonMonetaryEffects.filter((measure) => Math.abs(measure.value) >= 1e-9).slice(0, 3).map((measure) => <span key={`${effect.id}-${measure.label}`}><b>{formatCount(measure.value)}</b><small>{measure.unit} · {measure.label}</small></span>)}
    </div>}
    {effect.dependencyNote && <p className="context-effect-dependency"><Info size={13} /> {effect.dependencyNote}</p>}
    <button className="context-effect-source" type="button" onClick={() => onOpenSource(effect.sourceIds[0])}><Info size={13} /> Berechnung, Annahmen und Quellen</button>
  </article>;
}
