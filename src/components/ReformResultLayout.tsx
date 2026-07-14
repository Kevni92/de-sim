import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { ModuleMetric, ModuleSummaryHeader } from "./ModuleDetailComponents";
import type { Confidence } from "../lib/types";

export type ReformResultStatus =
  | { kind: "ready" }
  | { kind: "loading"; message?: string }
  | { kind: "empty"; title: string; message: string }
  | { kind: "error"; title: string; message: string; actionLabel?: string; onAction?: () => void }
  | { kind: "not-calculable"; title: string; message: string };

export type ReformMetric = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "negative" | "neutral";
  testId?: string;
};

export function ReformResultLayout({
  badge,
  badgeTone,
  title,
  description,
  onOpenSource,
  onReset,
  primaryTitle,
  primaryDescription,
  primaryControl,
  metrics,
  status = { kind: "ready" },
  children,
}: {
  badge: string;
  badgeTone?: Confidence;
  title: string;
  description: string;
  onOpenSource: () => void;
  onReset: () => void;
  primaryTitle: string;
  primaryDescription: string;
  primaryControl: ReactNode;
  metrics: readonly ReformMetric[];
  status?: ReformResultStatus;
  children?: ReactNode;
}) {
  const visibleMetrics = metrics.slice(0, 4);

  return <>
    <section className="card-flat revenue-module-summary reform-result-layout" aria-busy={status.kind === "loading" ? true : undefined}>
      <ModuleSummaryHeader
        badge={badge}
        badgeTone={badgeTone}
        title={title}
        description={description}
        onOpenSource={onOpenSource}
        onReset={onReset}
      />

      {status.kind === "ready" ? <>
        <section className="reform-primary-control" aria-labelledby="reform-primary-title">
          <div>
            <span className="reform-step-label">Was wird geändert?</span>
            <h3 id="reform-primary-title">{primaryTitle}</h3>
            <p>{primaryDescription}</p>
          </div>
          <div className="reform-primary-control-body">{primaryControl}</div>
        </section>

        <div className="revenue-kpi-grid reform-kpi-grid" aria-label="Direkte Ergebnisübersicht" data-testid="reform-kpi-grid">
          {visibleMetrics.map((metric) => <ModuleMetric key={metric.label} {...metric} />)}
        </div>
      </> : <ReformStatusPanel status={status} />}
    </section>

    {status.kind === "ready" && children}
  </>;
}

export function ReformDisclosureSection({
  title,
  summary,
  children,
  defaultOpen = false,
  testId,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  return (
    <details className="card-flat reform-disclosure" open={defaultOpen} data-testid={testId}>
      <summary>
        <div>
          <span className="reform-step-label">Vertiefung</span>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="reform-disclosure-content">{children}</div>
    </details>
  );
}

function ReformStatusPanel({ status }: { status: Exclude<ReformResultStatus, { kind: "ready" }> }) {
  if (status.kind === "loading") {
    return (
      <div className="reform-state reform-state-loading" role="status" data-testid="reform-status-loading">
        <strong>Ergebnis wird berechnet</strong>
        <p>{status.message ?? "Die direkte Wirkung und ihre Belastbarkeit werden aktualisiert."}</p>
        <div className="reform-loading-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
        </div>
      </div>
    );
  }

  const label = status.kind === "empty"
    ? "Noch keine Berechnungsgrundlage"
    : status.kind === "error"
      ? "Berechnung fehlgeschlagen"
      : "Nicht seriös quantifizierbar";

  return (
    <div className={`reform-state reform-state-${status.kind}`} role={status.kind === "error" ? "alert" : "status"} data-testid={`reform-status-${status.kind}`}>
      <span className="reform-step-label">{label}</span>
      <strong>{status.title}</strong>
      <p>{status.message}</p>
      {status.kind === "error" && status.actionLabel && status.onAction && <button className="button secondary small" type="button" onClick={status.onAction}>{status.actionLabel}</button>}
    </div>
  );
}
