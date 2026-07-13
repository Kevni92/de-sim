import { Copy, CopyPlus, Download, FilePlus2, Upload, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { localServer } from "../lib/local-server-client";
import type { ModelLevel, ScenarioDraft, TimeHorizon } from "../lib/types";

export function ScenarioPanel({
  open,
  scenario,
  activeScenarioId,
  savedCount,
  onPatch,
  onClose,
  onNew,
  onDuplicate,
  onExport,
  onImport,
  onCopy,
}: {
  open: boolean;
  scenario: ScenarioDraft;
  activeScenarioId: string | null;
  savedCount: number;
  onPatch: (patch: Partial<ScenarioDraft>) => void;
  onClose: () => void;
  onNew: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onCopy: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const closeAndPersist = () => {
    void localServer.saveActiveDraft({ activeScenarioId, scenario }).finally(onClose);
  };

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => event.key === "Escape" && closeAndPersist();
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [open, activeScenarioId, scenario]);

  if (!open) return null;

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Szenario verwalten">
      <button className="drawer-backdrop" onClick={closeAndPersist} aria-label="Szenarioverwaltung schließen" />
      <aside className="scenario-drawer">
        <header>
          <div>
            <span className="eyebrow">Zentrales Szenariomodell</span>
            <h2>Szenario verwalten</h2>
          </div>
          <button className="icon-button" onClick={closeAndPersist} aria-label="Schließen"><X size={15} /></button>
        </header>

        <div className="scenario-scroll">
          <section className="scenario-status">
            <div><span>Status</span><strong>{activeScenarioId ? "Gespeichertes Szenario" : "Lokaler Entwurf"}</strong></div>
            <div><span>Lokale Szenarien</span><strong>{savedCount}</strong></div>
            <div><span>Modellversion</span><strong>{scenario.modelVersion}</strong></div>
          </section>

          <section className="scenario-form">
            <label>
              <span>Name</span>
              <input aria-label="Szenarioname im Dialog" value={scenario.name} onChange={(event) => onPatch({ name: event.target.value })} />
            </label>
            <label>
              <span>Beschreibung</span>
              <textarea aria-label="Szenariobeschreibung" rows={3} value={scenario.description} onChange={(event) => onPatch({ description: event.target.value })} />
            </label>

            <div className="scenario-form-grid">
              <label>
                <span>Rechtsstand</span>
                <input aria-label="Rechtsstand" type="number" min="2020" max="2040" value={scenario.legalYear} onChange={(event) => onPatch({ legalYear: Number(event.target.value) })} />
              </label>
              <label>
                <span>Datenstand</span>
                <input aria-label="Datenstand" type="number" min="2015" max="2040" value={scenario.dataYear} onChange={(event) => onPatch({ dataYear: Number(event.target.value) })} />
              </label>
              <label>
                <span>Zeithorizont</span>
                <select aria-label="Zeithorizont" value={scenario.horizonYears} onChange={(event) => onPatch({ horizonYears: Number(event.target.value) as TimeHorizon })}>
                  <option value={1}>1 Jahr</option>
                  <option value={5}>5 Jahre</option>
                  <option value={10}>10 Jahre</option>
                  <option value={20}>20 Jahre</option>
                </select>
              </label>
              <label>
                <span>Modellstufe</span>
                <select aria-label="Modellstufe im Dialog" value={scenario.modelLevel} onChange={(event) => onPatch({ modelLevel: event.target.value as ModelLevel })}>
                  <option value="statisch">statisch</option>
                  <option value="verhalten">mit Verhaltenseffekt</option>
                  <option value="langfrist">Langfristszenario</option>
                </select>
              </label>
            </div>

            <label>
              <span>Annahmen · eine pro Zeile</span>
              <textarea
                aria-label="Annahmen"
                rows={5}
                value={scenario.assumptions.join("\n")}
                onChange={(event) => onPatch({ assumptions: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
              />
            </label>

            <div className="scenario-sources">
              <span>Verknüpfte Quellen</span>
              <div>{scenario.sourceIds.map((sourceId) => <code key={sourceId}>{sourceId}</code>)}</div>
            </div>
          </section>

          <section className="scenario-actions-grid" aria-label="Szenarioaktionen">
            <button className="button secondary" onClick={onNew}><FilePlus2 size={14} /> Neu</button>
            <button className="button secondary" onClick={onDuplicate}><CopyPlus size={14} /> Duplizieren</button>
            <button className="button secondary" onClick={onExport}><Download size={14} /> JSON exportieren</button>
            <button className="button secondary" onClick={() => fileInput.current?.click()}><Upload size={14} /> JSON importieren</button>
            <button className="button primary scenario-copy" onClick={onCopy}><Copy size={14} /> Als JSON kopieren</button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              aria-label="Szenario-JSON auswählen"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
                event.currentTarget.value = "";
              }}
            />
          </section>
        </div>

        <footer>Änderungen werden automatisch über den lokalen Worker in IndexedDB gesichert.</footer>
      </aside>
    </div>
  );
}