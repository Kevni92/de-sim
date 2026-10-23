import type { ReactNode, SVGProps } from "react";

export const reformIconNames = [
  "baseline",
  "directEffect",
  "affectedGroup",
  "distribution",
  "confidence",
  "followUp",
  "funding",
  "evidence",
  "parameters",
  "expandRange",
  "resetBaseline",
  "incomeTax",
  "valueAddedTax",
  "inheritanceTax",
  "wealthTax",
  "socialContributions",
  "corporateTax",
  "capitalIncomeTax",
  "energyTax",
] as const;

export type ReformIconName = (typeof reformIconNames)[number];
export type ReformIconTone = "neutral" | "information" | "positive" | "negative" | "affected" | "caution";

const iconArtwork: Record<ReformIconName, ReactNode> = {
  baseline: <><path d="M4 19.5h16" /><path d="M7 16v3.5M12 12v7.5M17 8v11.5" /><path d="M5 8.5h5" /></>,
  directEffect: <><path d="M4 18 9.5 12.5 13 15l7-8" /><path d="M14.5 7H20v5.5" /></>,
  affectedGroup: <><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h.5a4.5 4.5 0 0 1 4.5 4.5V19M12 14a4 4 0 0 1 3.5-2h.5a4.5 4.5 0 0 1 4.5 4.5V19" /></>,
  distribution: <><path d="M4 19.5h16M6 16v3.5M12 12v7.5M18 7v12.5" /><path d="M6 12c1.7-2 3.4-3 6-3s4.3-1 6-3" /></>,
  confidence: <><path d="M12 3 19 6v5.5c0 4.2-2.8 7.3-7 9.5-4.2-2.2-7-5.3-7-9.5V6l7-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  followUp: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h4a3 3 0 0 1 3 3v3a3 3 0 0 0 3 3h2M17 13l2 2-2 2" /></>,
  funding: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v4c0 1.7 3.1 3 7 3 1.2 0 2.3-.1 3.3-.4M5 10v4c0 1.7 3.1 3 7 3" /><path d="M19 10v4M16 16h6M17 19h4" /></>,
  evidence: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5v4h4M9 11h6M9 14.5h6M9 18h4" /></>,
  parameters: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="1.8" /><circle cx="15" cy="12" r="1.8" /><circle cx="7" cy="18" r="1.8" /></>,
  expandRange: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><path d="m4 4 6 6m10-6-6 6M4 20l6-6m10 6-6-6" /></>,
  resetBaseline: <><path d="M5 8V4m0 4h4" /><path d="M5.5 8A8 8 0 1 1 4 13" /><path d="M12 7v5l3 2" /></>,
  incomeTax: <><path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" /><path d="M9 8h6M9 12h3M9 16h6" /></>,
  valueAddedTax: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 16 8-8" /><circle cx="8.5" cy="8.5" r="1.2" /><circle cx="15.5" cy="15.5" r="1.2" /></>,
  inheritanceTax: <><path d="M4 10h16v10H4zM3 7h18v3H3z" /><path d="M12 7v13M12 7c-1.2-3.5-6-3.2-5 0 1.2 1.7 5 0 5 0Zm0 0c1.2-3.5 6-3.2 5 0-1.2 1.7-5 0-5 0Z" /></>,
  wealthTax: <><path d="M4 20h16M6 17V8h3v9M11 17V4h3v13M16 17v-6h3v6" /><path d="M5 5h3M10 2h4M15 8h5" /></>,
  socialContributions: <><circle cx="8" cy="8" r="2.4" /><circle cx="16" cy="8" r="2.4" /><path d="M3.5 19v-1a4.5 4.5 0 0 1 9 0v1M12 16a4.5 4.5 0 0 1 8.5 2v1" /><path d="M10.5 11.5h3" /></>,
  corporateTax: <><path d="M4 20h16M6 20V8l6-4 6 4v12" /><path d="M9 10h1M14 10h1M9 13h1M14 13h1M11 20v-4h2v4" /></>,
  capitalIncomeTax: <><path d="M4 20h16M6 17v-5h3v5M11 17V8h3v9M16 17V5h3v12" /><path d="m6 9 5-4 3 2 5-4M16 3h3v3" /></>,
  energyTax: <><path d="M12 3c3 4.1 6 7 6 11a6 6 0 0 1-12 0c0-4 3-6.9 6-11Z" /><path d="m13 8-4 6h3l-1 4 4-6h-3z" /></>,
};

type SharedIconProps = Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "viewBox" | "children" | "aria-label" | "aria-hidden">;

type DecorativeIconProps = SharedIconProps & {
  name: ReformIconName;
  size?: number;
  decorative?: true;
};

type LabeledIconProps = SharedIconProps & {
  name: ReformIconName;
  size?: number;
  decorative: false;
  "aria-label": string;
};

export function ReformIcon({ name, size = 24, decorative = true, ...svgProps }: DecorativeIconProps | LabeledIconProps) {
  return (
    <svg
      {...svgProps}
      data-reform-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      focusable="false"
    >
      {iconArtwork[name]}
    </svg>
  );
}
