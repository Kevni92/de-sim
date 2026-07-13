import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipChildProps = { "aria-describedby"?: string };

type Props = {
  content: ReactNode;
  children: ReactElement<TooltipChildProps>;
  maxWidth?: number;
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: "top" | "bottom";
};

export function Tooltip({ content, children, maxWidth = 320 }: Props) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: -9999, left: -9999, placement: "top" });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return;
      const trigger = triggerRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const gap = 8;
      const edge = 8;
      const placement = trigger.top >= tooltip.height + gap + edge ? "top" : "bottom";
      const top = placement === "top" ? trigger.top - tooltip.height - gap : trigger.bottom + gap;
      const centeredLeft = trigger.left + trigger.width / 2 - tooltip.width / 2;
      const left = Math.min(Math.max(edge, centeredLeft), Math.max(edge, window.innerWidth - tooltip.width - edge));
      setPosition({ top, left, placement });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [maxWidth, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const existingDescription = children.props["aria-describedby"];
  const describedBy = open ? [existingDescription, tooltipId].filter(Boolean).join(" ") : existingDescription;
  const describedChild = cloneElement(children, { "aria-describedby": describedBy });

  return <>
    <span
      className="tooltip-trigger"
      ref={triggerRef}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onPointerDown={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {describedChild}
    </span>
    {open && createPortal(
      <div
        className="evidence-tooltip"
        data-placement={position.placement}
        id={tooltipId}
        ref={tooltipRef}
        role="tooltip"
        style={{ top: position.top, left: position.left, maxWidth }}
      >
        {content}
      </div>,
      document.body,
    )}
  </>;
}
