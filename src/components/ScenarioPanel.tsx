import { Copy, CopyPlus, Download, FilePlus2, Save, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_EFFECT_START_YEAR, SUPPORTED_LEGAL_YEAR } from "../lib/model-baseline";
import { MODEL_LEVEL_OPTIONS, modelLevelCaution, TIME_HORIZON_OPTIONS } from "../lib/scenario-calculation";
import type { ModelLevel, ScenarioDraft, TimeHorizon } from "../lib/types";
import { SCENARIO_CALCULATION_SETTINGS_EVENT } from "./ModuleDetailComponents";

export function ScenarioPanel({
  open,
  scenario,
  activeScenarioId,
  savedCount = 0,
  draftSaveStatus,
  draftSavedAt,
  draftSaveError,
  savedScenarioExists,
  savedScenarioUpdatedAt,
  hasChangesSinceSaved,
  onPatch,
  onClose,
  onSaveDraft,
  onRetryDraftSave,
  onSave,
  onNew,
  onDuplicate,
  onExport,
  onImport,
  onCopy,
}: {
  open: boolean;
  scenario: ScenarioDraft;
  activeScenarioId: string | null;
  savedCount?: number;
  draftSaveStatus: "idle" | "saving" | "saved" | "error";
  draftSavedAt?: string;
  draftSaveError: string;
  savedScenarioExists: boolean;
  savedScenarioUpdatedAt?: string;
  hasChangesSinceSaved: boolean;
  onPatch: (patch: Partial<ScenarioDraft>) => void;
  onClose: () => void;
  onSaveDraft: () => Promise<void>;
  onRetryDraftSave: () => Promise<void>;
  onSave: () => void;
  onNew?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onImport?: (file: File) => Promise<void>;
  onCopy?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const modelLevelInput = useRef<HTMLSelectElement>(null);
  const closingRef = useRef(false);
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [requestedCalculationFocus, setRequestedCalculationFocus] = useState(false);
  const effectiveOpen = open || requestedOpen;
  const hasScenarioActions = Boolean(onSave || onNew || onDuplicate || onExport || onImport || onCopy);
  const hasLegacyYearMetadata = scenario.legalYear !== SUPPORTED_LEGAL_YEAR || scenario.dataYear !== DEFAULT_EFFECT_START_YEAR;

  const closeAndPersist = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      await onSaveDraft();
      setRequestedOpen(false);
      setRequestedCalculationFocus(false);
      closingRef.current = false;
      onClose();
    } catch {
      closingRef.current = false;
    }
  };

  useEffect(() => {
    const listener = () => {
      setRequestedOpen(true);
      setRequestedCalculationFocus(true);
    };
    window.addEventListener(SCENARIO_CALCULATION_SETTINGS_EVENT, listener);
    return () => window.removeEventListener(SCENARIO_CALCULATION_SETTINGS_EVENT, listener);
  }, []);

  useEffect(() => {
    if (!effectiveOpen) return;
    const listener = (event: KeyboardEvent) => event.key === "Escape" && closeAndPersist();
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [effectiveOpen, onSaveDraft]);

  useEffect(() => {
    if (!effectiveOpen || !requestedCalculationFocus) return;
    const frame = window.requestAnimationFrame(() => {
      modelLevelInput.current?.scrollIntoView({ block: "center" });
      modelLevelInput.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveOpen, requestedCalculationFocus]);

  if (!effectiveOpen) return null;

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Szenario verwalten">
      <button className="drawer-backdrop" onClick={closeAndPersist} aria-label="Szenarioverwaltung schließen" />
      <aside className="scenario-drawer">
        <header>
          <div>
            <span className="eyebrow">Dein Szenario</span>
            <h2>Szenario verwalten</h2>
          </div>
          <button className="icon-button" onClick={closeAndPersist} aria-label="Schließen"><X size={15} /></button>
        </header>

        <div className="scenario-scroll">
          <section className="scenario-form scenario-primary-fields" aria-label="Name und Beschreibung">
            <label>
              <span>Name</span>
              <input aria-label="Szenarioname im Dialog" value={scenario.name} onChange={(event) => onPatch({ name: event.target.value })} />
            </label>
            <label>
              <span>Beschreibung</span>
              <textarea aria-label="Szenariobeschreibung" rows={3} value={scenario.description} onChange={(event) => onPatch({ description: event.target.value })} />
            </label>
          </section>

          <section className="scenario-storage-status" aria-label="Speicherstatus" aria-live="polite" data-testid="scenario-save-status">
            <div className={`scenario-storage-card ${draftSaveStatus === "error" ? "is-error" : ""}`}>
              <span>Dein Arbeitsentwurf</span>
              <strong>{draftSaveStatus === "saving" ? "Wird gesichert …" : draftSaveStatus === "error" ? "Sicherung fehlgeschlagen" : draftSavedAt ? "Gesichert" : "Wird vorbereitet"}</strong>
              {draftSavedAt && <small>Zuletzt gesichert: {formatSavedAt(draftSavedAt)}</small>}
              {draftSaveStatus === "error" && <>
                <p role="alert">{draftSaveError || "Der Entwurf konnte nicht gesichert werden."} Deine Eingaben bleiben hier erhalten.</p>
                <button className="button secondary small" onClick={() => { void onRetryDraftSave().catch(() => undefined); }}>Erneut versuchen</button>
              </>}
              <small>{savedCount} gespeicherte {savedCount === 1 ? "Variante" : "Varianten"} in diesem Browser</small>
            </div>
            <div className={`scenario-storage-card ${hasChangesSinceSaved ? "has-changes" : ""}`}>
              <span>Gespeicherte Fassung</span>
              <strong>{!activeScenarioId ? "Noch nicht gespeichert" : !savedScenarioExists ? "Gespeicherte Fassung nicht gefunden" : hasChangesSinceSaved ? "Änderungen seit gespeichertem Stand" : "Entspricht dem gespeicherten Stand"}</strong>
              {savedScenarioUpdatedAt && <small>Zuletzt gespeichert: {formatSavedAt(savedScenarioUpdatedAt)}</small>}
            </div>
          </section>

          {hasScenarioActions && <section className="scenario-actions-grid" aria-label="Szenarioaktionen">
            {onSave && <button className="button primary" onClick={onSave}><Save size={14} /> {activeScenarioId ? "Änderungen speichern" : "Szenario speichern"}</button>}
            {onNew && <button className="button secondary" onClick={onNew}><FilePlus2 size={14} /> Neues Szenario</button>}
            {onDuplicate && <button className="button secondary" onClick={onDuplicate}><CopyPlus size={14} /> Als neue Variante sichern</button>}
            {onExport && <button className="button secondary" onClick={onExport}><Download size={14} /> Szenario herunterladen</button>}
            {onImport && <button className="button secondary" onClick={() => fileInput.current?.click()}><Upload size={14} /> Szenario aus Datei übernehmen</button>}
            {onCopy && <button className="button primary scenario-copy" onClick={onCopy}><Copy size={14} /> Szenario-Daten kopieren</button>}
            {onImport && <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="Szenario-Datei auswählen"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
                event.currentTarget.value = "";
              }}
            />}
          </section>}
          {hasScenarioActions && <p className="scenario-file-help">Die Szenario-Datei und die kopierten Szenario-Daten nutzen das JSON-Format. Lade die Datei herunter, um eine Variante auf ein anderes Gerät mitzunehmen, und übernimm sie dort aus einer Datei. Eine automatische Synchronisierung gibt es nicht.</p>}

          <section className="scenario-form scenario-additional-settings" aria-label="Weitere Einstellungen">

            <fieldset className="scenario-calculation-settings scenario-year-context" data-testid="scenario-year-context">
              <legend>Jahresgrundlagen</legend>
              <p><strong>Gesetzliche Basis: Rechtsstand {SUPPORTED_LEGAL_YEAR}.</strong> Quellenjahre werden je Kennzahl im jeweiligen Nachweis ausgewiesen.</p>
              <p>Der Zeitbezug der Wirkungsrechnung beginnt {scenario.dataYear}. Er beschreibt die Zeitachse des Szenarios, nicht das Datenjahr einer Quelle.</p>
              {hasLegacyYearMetadata && <div className="notice-box legacy-year-warning" role="note">
                <strong>Abweichende Jahresangaben aus diesem Szenario</strong>
                <p>Importierter Rechtsstand: {scenario.legalYear} · Zeitbezug der Wirkungsrechnung: {scenario.dataYear}. Diese Angaben bleiben beim Speichern und Export erhalten. Die gesetzliche Berechnungsbasis bleibt 2026; der importierte Rechtsstand ändert sie nicht. Der Zeitbezug bestimmt die Jahresachse der Wirkungsrechnung und nicht die Quellenjahre.</p>
              </div>}
            </fieldset>

            <fieldset className="scenario-calculation-settings" data-testid="scenario-calculation-settings">
              <legend>Berechnungsrahmen</legend>
              <p>Modellstufe und Zeitraum gelten für alle Fachseiten dieses Szenarios. Änderungen aktualisieren abhängige Ergebnisse automatisch.</p>
              <div className="scenario-form-grid">
                <label>
                  <span>Modellstufe</span>
                  <select ref={modelLevelInput} aria-label="Modellstufe im Dialog" value={scenario.modelLevel} onChange={(event) => onPatch({ modelLevel: event.target.value as ModelLevel })}>
                    {MODEL_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Zeithorizont</span>
                  <select aria-label="Zeithorizont" value={scenario.horizonYears} onChange={(event) => onPatch({ horizonYears: Number(event.target.value) as TimeHorizon })}>
                    {TIME_HORIZON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <p className={`scenario-calculation-explanation ${scenario.modelLevel === "langfrist" ? "warning" : ""}`}>{modelLevelCaution(scenario.modelLevel)}</p>
            </fieldset>

            <label>
              <span>Annahmen · eine pro Zeile</span>
              <textarea
                aria-label="Annahmen"
                rows={5}
                value={scenario.assumptions.join("\n")}
                onChange={(event) => onPatch({ assumptions: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
              />
            </label>
          </section>

          <details className="scenario-technical-details">
            <summary>Technische Nachweise</summary>
            <p>Diese Angaben bleiben für Prüfung und Wiederherstellung erhalten. Für die normale Nutzung musst du sie nicht kennen.</p>
            <dl>
              <div><dt>Modellversion</dt><dd><code>{scenario.modelVersion}</code></dd></div>
              <div><dt>Interne Szenario-ID</dt><dd><code>{activeScenarioId ?? "Noch nicht gespeichert"}</code></dd></div>
              <div><dt>Quellenkennungen</dt><dd>{scenario.sourceIds.length ? scenario.sourceIds.map((sourceId) => <code key={sourceId}>{sourceId}</code>) : "Keine hinterlegt"}</dd></div>
            </dl>
          </details>
        </div>

        <footer>Dein Entwurf wird nur in diesem Browser auf diesem Gerät gesichert. Andere Geräte sehen ihn nicht automatisch.</footer>
      </aside>
    </div>
  );
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Zeitpunkt nicht verfügbar" : date.toLocaleString("de-DE");
}
