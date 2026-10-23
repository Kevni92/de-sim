import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ReformIcon, reformIconNames } from "../src/components/ReformIcon";

const expectedIconNames = [
  "baseline", "directEffect", "affectedGroup", "distribution", "confidence",
  "followUp", "funding", "evidence", "parameters", "expandRange", "resetBaseline",
  "incomeTax", "valueAddedTax", "inheritanceTax", "wealthTax", "socialContributions",
  "corporateTax", "capitalIncomeTax", "energyTax",
];

test("provides the complete reform icon family with a shared inline SVG contract", () => {
  assert.deepEqual(reformIconNames, expectedIconNames);

  for (const name of reformIconNames) {
    const markup = renderToStaticMarkup(createElement(ReformIcon, { name, size: 16 }));
    assert.match(markup, /viewBox="0 0 24 24"/);
    assert.match(markup, /stroke="currentColor"/);
    assert.match(markup, /stroke-width="1\.75"/);
    assert.match(markup, /stroke-linecap="round"/);
    assert.match(markup, /stroke-linejoin="round"/);
    assert.match(markup, /width="16"/);
    assert.match(markup, /height="16"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /focusable="false"/);
    assert.doesNotMatch(markup, /(?:stroke|fill)="#[\da-f]{3,8}"/i);
  }
});

test("supports larger sizes and accessible non-decorative naming", () => {
  for (const size of [20, 24]) {
    const markup = renderToStaticMarkup(createElement(ReformIcon, { name: "baseline", size }));
    assert.match(markup, new RegExp(`width="${size}"`));
    assert.match(markup, new RegExp(`height="${size}"`));
  }

  const labeled = renderToStaticMarkup(createElement(ReformIcon, {
    name: "baseline",
    decorative: false,
    "aria-label": "Ausgangswert",
  }));
  assert.match(labeled, /role="img"/);
  assert.match(labeled, /aria-label="Ausgangswert"/);
  assert.doesNotMatch(labeled, /aria-hidden/);
});
