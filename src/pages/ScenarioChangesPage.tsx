import { ArrowRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { ScenarioDraftWithPopulationBasis } from "../lib/scenario-state";
import { formatScenarioChangeValue, type ScenarioChange, type ScenarioChangeCategory } from "../lib/scenario-changes";

const categories: Array<{ id: ScenarioChangeCategory; title: string; description: string }> = [
  { id: "policy", title: "Politische Stellschrauben", description: "Regeln, Sätze und Leistungswerte, die das Reformpaket verändern." },
  { id: "assumption", title: "Modell- und Wirkungsannahmen", description: "Getrennt ausgewiesene Annahmen und mögliche Folgewirkungen; sie sind keine politischen Beschlüsse." },
  { id: "framework", title: "Berechnungsrahmen", description: "Einstellungen, die bestimmen, mit welcher Modellstufe und welchem Zeithorizont gerechnet wird." },
];

function groupedChanges(changes: ScenarioChange[]) {
  const groups = new Map<string, { module: string; group: string; items: ScenarioChange[] }>();
  for (const change of changes) {
    const key = `${change.module}\u0000${change.group}`;
    const current = groups.get(key) ?? { module: change.module, group: change.group, items: [] };
    current.items.push(change);
    groups.set(key, current);
  }
  return [...groups.values()];
}

export function ScenarioChangesPage({
  scenario,
  changes,
  onBack,
  onOpenChange,
  onResetChange,
  onOpenScenarioSettings,
  onExploreMeasures,
}: {
  scenario: ScenarioDraftWithPopulationBasis;
  changes: ScenarioChange[];
  onBack: () => void;
  onOpenChange: (change: ScenarioChange) => void;
  onResetChange: (change: ScenarioChange) => void;
  onOpenScenarioSettings: () => void;
  onExploreMeasures: () => void;
}) {
  const policies = changes.filter((change) => change.category === "policy");
  const assumptions = changes.filter((change) => change.category === "assumption");
  const framework = changes.filter((change) => change.category === "framework");
  const activeModules = new Set(policies.map((change) => change.module)).size;

  return <main className="content-width scenario-changes-page">
    <header className="detail-header">
      <div>
        <button className="back-link" onClick={onBack}>‹ Zurück zur Übersicht</button>
        <span className="eyebrow">Szenariopaket · {scenario.name}</span>
        <h1>Deine Änderungen</h1>
        <p>Hier siehst du jede geänderte Stellschraube mit ihrem Ausgangswert und dem aktuellen Wert. So findest du Änderungen über mehrere Module hinweg und kannst jede einzeln zurücksetzen.</p>
      </div>
      <button className="button secondary" type="button" onClick={onOpenScenarioSettings}><SlidersHorizontal size={15} /> Szenarioeinstellungen</button>
    </header>

    <section className="scenario-changes-summary card-flat" aria-label="Zusammenfassung des Reformpakets" data-testid="scenario-changes-summary">
      <div><strong>{policies.length}</strong><span>politische Änderungen</span></div>
      <div><strong>{activeModules}</strong><span>betroffene Module</span></div>
      <div><strong>{assumptions.length + framework.length}</strong><span>getrennte Annahmen und Einstellungen</span></div>
      <p>Einzelwirkungen können sich überschneiden. Diese Liste addiert sie nicht zu einer scheinpräzisen Gesamtsumme.</p>
    </section>

    {changes.length === 0 ? <section className="card-flat scenario-changes-empty" data-testid="scenario-changes-empty">
      <span className="scenario-changes-empty-mark" aria-hidden="true">✓</span>
      <div><h2>Noch keine Änderungen</h2><p>Dein Szenario entspricht den hinterlegten Ausgangswerten. Ändere eine Maßnahme, um sie hier wiederzufinden.</p></div>
      <button className="button primary" type="button" onClick={onExploreMeasures}>Maßnahmen ansehen <ArrowRight size={15} /></button>
    </section> : categories.map((category) => {
      const items = groupedChanges(changes.filter((change) => change.category === category.id));
      if (!items.length) return null;
      const count = category.id === "policy" ? policies.length : category.id === "assumption" ? assumptions.length : framework.length;
      return <section className={`scenario-change-section ${category.id}`} key={category.id} aria-labelledby={`scenario-change-${category.id}-title`}>
        <header><div><h2 id={`scenario-change-${category.id}-title`}>{category.title}</h2><p>{category.description}</p></div><span>{count} {count === 1 ? "Eintrag" : "Einträge"}</span></header>
        <div className="scenario-change-groups">
          {items.map((group) => <article className="card-flat scenario-change-group" key={`${group.module}-${group.group}`}>
            <header><div><h3>{group.group === group.module ? group.module : group.module === "Berechnungsrahmen" ? group.group : `${group.module} · ${group.group}`}</h3><span>{group.items.length} {group.items.length === 1 ? "Änderung" : "Änderungen"}</span></div></header>
            <ul>
              {group.items.map((change) => <li className="scenario-change-row" key={change.id} data-testid={`scenario-change-${change.id}`}>
                <div className="scenario-change-copy">
                  <strong>{change.label}</strong>
                  {change.description && <small>{change.description}</small>}
                </div>
                <dl className="scenario-change-values">
                  <div><dt>Vorher</dt><dd>{formatScenarioChangeValue(change.baseline, change.unit, change.formatParameterId ?? change.id)}</dd></div>
                  <div><dt>Jetzt</dt><dd>{formatScenarioChangeValue(change.current, change.unit, change.formatParameterId ?? change.id)}</dd></div>
                </dl>
                <div className="scenario-change-actions">
                  <button className="button secondary small" type="button" onClick={() => onOpenChange(change)} aria-label={`Im Modul öffnen: ${change.label}`}>Im Modul öffnen <ArrowRight size={13} /></button>
                  <button className="button plain small" type="button" onClick={() => onResetChange(change)} aria-label={`${change.label} auf Baseline zurücksetzen`}><RotateCcw size={13} /> Einzelreset</button>
                </div>
              </li>)}
            </ul>
          </article>)}
        </div>
      </section>;
    })}

    <p className="scenario-changes-footnote">Ausgewählte Profilmerkmale einer Beispielperson werden nicht als Reformänderung gezählt. Änderungen aus Import, Rückgängig und Wiederholen erscheinen entsprechend dem aktuellen Arbeitsentwurf.</p>
  </main>;
}
