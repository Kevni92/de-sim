import { useEffect, useRef } from "react";
import type { ScenarioState } from "../lib/types";

export type ScenarioGuardRequest =
  | { kind: "delete"; scenario: ScenarioState; wasActive: boolean }
  | { kind: "replace"; scenarioName: string; actionLabel: string; savedScenarioExists: boolean; apply: () => void | Promise<void> };

export function ScenarioGuardDialog({
  request,
  busy,
  error,
  onCancel,
  onDelete,
  onSaveVariant,
  onDiscard,
}: {
  request: ScenarioGuardRequest | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onDelete: () => void;
  onSaveVariant: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const cancelRef = useRef(onCancel);
  busyRef.current = busy;
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!request) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) cancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
        return;
      }
      const fallback = Array.from(document.querySelectorAll<HTMLButtonElement>(".scenario-button, .mobile-menu-button"))
        .find((button) => button.isConnected && !button.disabled && button.getClientRects().length > 0);
      fallback?.focus();
    };
  }, [request?.kind]);

  if (!request) return null;

  const isDelete = request.kind === "delete";
  const title = isDelete ? "Szenario löschen?" : "Deinen Entwurf sichern?";
  const description = isDelete
    ? `Möchtest du das gespeicherte Szenario „${request.scenario.name}“ wirklich dauerhaft löschen?`
    : request.savedScenarioExists
      ? `Dein Entwurf „${request.scenarioName}“ enthält Änderungen seit dem gespeicherten Stand. Wenn du ${request.actionLabel} möchtest, wird dieser Entwurf ersetzt.`
      : `Dein Entwurf „${request.scenarioName}“ ist noch nicht als Szenario gespeichert. Wenn du ${request.actionLabel} möchtest, wird dieser Entwurf ersetzt.`;

  return <div className="scenario-guard-backdrop">
    <section
      ref={dialogRef}
      className="scenario-guard-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scenario-guard-title"
      aria-describedby="scenario-guard-description"
      data-testid="scenario-guard-dialog"
      tabIndex={-1}
    >
      <header>
        <span className="eyebrow">Szenarioverwaltung</span>
        <h2 id="scenario-guard-title">{title}</h2>
      </header>
      <p id="scenario-guard-description">{description}</p>
      {isDelete && request.wasActive && <p className="scenario-guard-note">Dein aktueller Arbeitsentwurf bleibt erhalten. Gelöscht wird nur die gespeicherte Fassung.</p>}
      {!isDelete && <p className="scenario-guard-note">Automatisches Sichern im Browser macht daraus keine separat auswählbare Variante.</p>}
      {error && <p className="scenario-guard-error" role="alert">{error}</p>}
      <div className="scenario-guard-actions">
        {isDelete ? <>
          <button ref={cancelButtonRef} className="button secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>
          <button className="button scenario-guard-delete" disabled={busy} onClick={onDelete}>{busy ? "Wird gelöscht …" : "Szenario löschen"}</button>
        </> : <>
          <button ref={cancelButtonRef} className="button secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>
          <button className="button primary" disabled={busy} onClick={onSaveVariant}>{busy ? "Wird gesichert …" : "Als Variante sichern und fortfahren"}</button>
          <button className="button secondary" disabled={busy} onClick={onDiscard}>Entwurf verwerfen und fortfahren</button>
        </>}
      </div>
    </section>
  </div>;
}
