import { useEffect, useId, useState, type KeyboardEvent } from "react";
import {
  expandRangeForValue,
  formatParameterNumber,
  formatParameterValue,
  isStandardRange,
  nextExpandedRange,
  parameterDecimalPlaces,
  parseLocalizedParameterValue,
  snapSliderValue,
  validateParameterValue,
  type FlexibleParameterSpec,
  type ParameterRange,
} from "../lib/parameter-control";

export function FlexibleParameterControl({ item, value, onValue }: {
  item: FlexibleParameterSpec;
  value: number;
  onValue: (value: number) => void;
}) {
  const generatedId = useId().replaceAll(":", "");
  const valueId = `${generatedId}-value`;
  const rangeId = `${generatedId}-range`;
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const rangeNoteId = `${generatedId}-range-note`;
  const [range, setRange] = useState<ParameterRange>({ min: item.sliderMin, max: item.sliderMax });
  const [draft, setDraft] = useState(() => formatParameterNumber(value, item.step));
  const [error, setError] = useState("");
  const validation = validateParameterValue(value, item);
  const rangeIsStandard = isStandardRange(range, item);
  const valueWithinStandardRange = value >= item.sliderMin && value <= item.sliderMax;
  const canResetRange = !rangeIsStandard && valueWithinStandardRange;
  const canExpandRange = item.hardMax === undefined || range.max < item.hardMax;
  const baselinePosition = range.max === range.min
    ? 0
    : Math.max(0, Math.min(100, ((item.baseline - range.min) / (range.max - range.min)) * 100));

  useEffect(() => {
    setRange((current) => expandRangeForValue(current, value, item));
    setDraft(formatParameterNumber(value, item.step));
    setError("");
  }, [item.key, item.sliderMax, item.sliderMin, value]);

  const commitDraft = () => {
    const parsed = parseLocalizedParameterValue(draft);
    const nextValidation = validateParameterValue(parsed, item);
    if (!nextValidation.valid || parsed === null) {
      setError(nextValidation.valid ? "Gib eine vollständige, endliche Zahl ein." : nextValidation.message);
      return false;
    }
    setError("");
    setDraft(formatParameterNumber(parsed, item.step));
    setRange((current) => expandRangeForValue(current, parsed, item));
    onValue(parsed);
    return true;
  };

  const setValue = (next: number) => {
    const bounded = Math.min(item.hardMax ?? Number.POSITIVE_INFINITY, Math.max(item.hardMin, next));
    const scale = 10 ** parameterDecimalPlaces(item.step);
    const rounded = Math.round(bounded * scale) / scale;
    setRange((current) => expandRangeForValue(current, rounded, item));
    setError("");
    onValue(rounded);
  };

  const stepValue = (direction: -1 | 1, large = false) => {
    const step = large ? item.largeStep ?? item.step * 10 : item.step;
    setValue(value + direction * step);
  };

  const onRangeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      stepValue(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      stepValue(-1);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      stepValue(1, true);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      stepValue(-1, true);
    }
  };

  const formattedValue = formatParameterValue(value, item);
  const extrapolationMessage = validation.valid && validation.extrapolated
    ? `Außerhalb des fachlich geprüften Bereichs (${formatParameterValue(item.validatedMin, item)} bis ${formatParameterValue(item.validatedMax, item)}). Das Ergebnis ist eine Extrapolation.`
    : validation.valid && validation.outsideStandardRange
      ? "Der Wert liegt außerhalb des üblichen Sliderbereichs. Die Skala wurde erweitert; der Wert bleibt unverändert."
      : "";
  const valueDescription = validation.valid && validation.extrapolated
    ? `${formattedValue}; außerhalb des fachlich geprüften Bereichs`
    : validation.valid
      ? formattedValue
      : `${formattedValue}; außerhalb der zulässigen Grenze`;
  const describedBy = [descriptionId, error || !validation.valid ? errorId : null, extrapolationMessage ? rangeNoteId : null].filter(Boolean).join(" ");

  return (
    <div className="revenue-parameter" data-testid={`parameter-${item.key}`}>
      <div className="parameter-heading">
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </div>

      <div className="flexible-parameter-body">
        <span id={descriptionId} className="visually-hidden">
          Ausgangswert: {formatParameterValue(item.baseline, item)}. Üblicher Sliderbereich: {formatParameterValue(item.sliderMin, item)} bis {formatParameterValue(item.sliderMax, item)}. Fachlich geprüfter Modellbereich: {formatParameterValue(item.validatedMin, item)} bis {formatParameterValue(item.validatedMax, item)}.
        </span>

        <div className="parameter-slider-group">
          <div className="parameter-current-line">
            <output htmlFor={rangeId} className="parameter-current-value">{valueDescription}</output>
            <span className="parameter-baseline-label">Baseline: {formatParameterValue(item.baseline, item)}</span>
          </div>
          <div className="parameter-range-wrap">
            <input
              id={rangeId}
              aria-label={`${item.label} Regler`}
              aria-describedby={describedBy}
              aria-valuetext={valueDescription}
              type="range"
              min={range.min}
              max={range.max}
              step="any"
              value={value}
              onKeyDown={onRangeKeyDown}
              onChange={(event) => setValue(snapSliderValue(Number(event.currentTarget.value), range, item))}
            />
            <span aria-hidden="true" className="parameter-baseline-marker" style={{ left: `${baselinePosition}%` }} />
          </div>
          <div className="parameter-scale-labels" aria-hidden="true">
            <span>{formatParameterValue(range.min, item)}</span>
            <span>{formatParameterValue(range.max, item)}</span>
          </div>
        </div>

        <div className="parameter-value-actions">
          <button type="button" className="parameter-step-button" aria-label={`${item.label} verringern`} title="Um einen Schritt verringern" onClick={() => stepValue(-1)}>−</button>
          <label className="parameter-input-label" htmlFor={valueId}>{item.label} Wert</label>
          <input
            id={valueId}
            aria-label={`${item.label} Wert`}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error) || !validation.valid}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(event) => { setDraft(event.currentTarget.value); setError(""); }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(formatParameterNumber(value, item.step));
                setError("");
              }
            }}
          />
          <button type="button" className="parameter-step-button" aria-label={`${item.label} erhöhen`} title="Um einen Schritt erhöhen" onClick={() => stepValue(1)}>+</button>
          <span className="parameter-unit">{item.unit}</span>
          <button type="button" className="parameter-reset-button" aria-label={`${item.label} auf Baseline zurücksetzen`} onClick={() => setValue(item.baseline)}>Baseline</button>
        </div>

        <div className="parameter-range-actions">
          <button
            type="button"
            className="parameter-range-action"
            onClick={() => setRange((current) => nextExpandedRange(current, item))}
            disabled={!canExpandRange}
          >
            Bereich erweitern
          </button>
          {!rangeIsStandard && <button
            type="button"
            className="parameter-range-action"
            onClick={() => setRange({ min: item.sliderMin, max: item.sliderMax })}
            disabled={!canResetRange}
            title={!valueWithinStandardRange ? "Setze den Wert zuerst in den Standardbereich zurück, damit der Regler ihn weiterhin darstellen kann." : undefined}
          >
            Standardbereich wiederherstellen
          </button>}
        </div>

        {!rangeIsStandard && !canResetRange && <p className="parameter-range-note">Setze den Wert zuerst in den üblichen Bereich zurück, damit der Regler ihn beim Wiederherstellen weiter darstellen kann.</p>}

        {(error || !validation.valid) && (
          <p id={errorId} className="parameter-validation-error" role="alert">
            {error || (validation.valid ? "" : validation.message)}
          </p>
        )}
        {extrapolationMessage && <p id={rangeNoteId} className={`parameter-range-note ${validation.valid && validation.extrapolated ? "is-extrapolated" : ""}`} role="note">{extrapolationMessage}</p>}
      </div>
    </div>
  );
}
