import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Redo2, Save, SlidersHorizontal, Sun, Undo2, X } from "lucide-react";
import { haushaltsKompassDarkLogo, haushaltsKompassLightLogo } from "../branding";
import "../branding-theme.css";
import "../mobile-navigation.css";

export type AppRoute = "/" | "/dashboard" | "/bevoelkerung" | "/einkommensteuer" | "/einnahmen" | "/ausgaben" | "/wirkungen" | "/vergleich" | "/transparenz";
type AppTheme = "light" | "dark";
const themeStorageKey = "haushaltskompass-theme";
const navigationItems: Array<{ route: AppRoute; label: string }> = [
  { route: "/dashboard", label: "Dashboard" },
  { route: "/bevoelkerung", label: "Bevölkerung" },
  { route: "/einkommensteuer", label: "Einkommensteuer" },
  { route: "/einnahmen", label: "Weitere Einnahmen" },
  { route: "/ausgaben", label: "Ausgaben" },
  { route: "/wirkungen", label: "Wirkungen" },
  { route: "/vergleich", label: "Vergleich" },
  { route: "/transparenz", label: "Transparenz" },
];

function readTheme(): AppTheme { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function isActiveRoute(current: AppRoute, target: AppRoute) {
  return target === "/dashboard" ? current === "/dashboard" || current === "/" : current === target;
}

export function AppBar({
  route, scenarioName, legalYear, dataYear, canUndo, canRedo, onScenarioName, onNavigate, onUndo, onRedo, onSave, onOpenScenario,
}: {
  route: AppRoute;
  scenarioName: string;
  legalYear: number;
  dataYear: number;
  canUndo: boolean;
  canRedo: boolean;
  onScenarioName: (name: string) => void;
  onNavigate: (route: AppRoute) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onOpenScenario: () => void;
}) {
  const [theme, setTheme] = useState<AppTheme>(readTheme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const darkMode = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#0e141d" : "#f4f7fa");
    try { localStorage.setItem(themeStorageKey, theme); } catch { /* Darstellung bleibt ohne Browserspeicher aktiv. */ }
  }, [darkMode, theme]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [route]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstMenuItemRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]") ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 980) setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  const navigate = (target: AppRoute) => {
    setMobileMenuOpen(false);
    onNavigate(target);
  };

  const openScenario = () => {
    setMobileMenuOpen(false);
    onOpenScenario();
  };

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <button className="brand-link" onClick={() => navigate("/dashboard")} aria-label="Zum HaushaltsKompass-Dashboard">
          <img className="brand-logo" src={darkMode ? haushaltsKompassDarkLogo : haushaltsKompassLightLogo} alt="" aria-hidden="true" />
          <span className="brand-copy"><strong>HaushaltsKompass</strong><small>Rechtsstand {legalYear} · Datenstand {dataYear} · MODELL</small></span>
        </button>
        <nav className="top-nav" aria-label="Hauptnavigation">
          {navigationItems.map((item) => {
            const active = isActiveRoute(route, item.route);
            return <button key={item.route} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(item.route)}>{item.label}</button>;
          })}
        </nav>
        <div className="app-actions">
          <input aria-label="Szenarioname" value={scenarioName} onChange={(event) => onScenarioName(event.target.value)} />
          <button className="icon-button theme-toggle" aria-label={darkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"} title={darkMode ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"} aria-pressed={darkMode} onClick={() => setTheme(darkMode ? "light" : "dark")}>{darkMode ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="icon-button desktop-action" aria-label="Rückgängig" title="Rückgängig" onClick={onUndo} disabled={!canUndo}><Undo2 size={14} /></button>
          <button className="icon-button desktop-action" aria-label="Wiederholen" title="Wiederholen" onClick={onRedo} disabled={!canRedo}><Redo2 size={14} /></button>
          <button className="button secondary desktop-action" onClick={onSave}><Save size={14} /> Speichern</button>
          <button className="button primary scenario-button" onClick={openScenario}><SlidersHorizontal size={14} /> Szenario</button>
          <button
            ref={menuButtonRef}
            className="icon-button mobile-menu-button"
            aria-label={mobileMenuOpen ? "Hauptmenü schließen" : "Hauptmenü öffnen"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-main-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="mobile-nav-layer" data-testid="mobile-navigation-layer">
          <button className="mobile-nav-backdrop" aria-label="Hauptmenü schließen" onClick={() => setMobileMenuOpen(false)} />
          <div ref={menuPanelRef} className="mobile-nav-panel" id="mobile-main-navigation" role="dialog" aria-modal="true" aria-label="Hauptmenü">
            <div className="mobile-nav-heading">
              <div><span>Navigation</span><strong>{scenarioName}</strong></div>
              <button className="icon-button" aria-label="Hauptmenü schließen" onClick={() => { setMobileMenuOpen(false); menuButtonRef.current?.focus(); }}><X size={18} /></button>
            </div>
            <nav className="mobile-nav-items" aria-label="Mobile Hauptnavigation">
              {navigationItems.map((item, index) => {
                const active = isActiveRoute(route, item.route);
                return (
                  <button
                    key={item.route}
                    ref={index === 0 ? firstMenuItemRef : undefined}
                    className={active ? "active" : ""}
                    aria-current={active ? "page" : undefined}
                    onClick={() => navigate(item.route)}
                  >
                    <span>{item.label}</span><span aria-hidden="true">›</span>
                  </button>
                );
              })}
            </nav>
            <div className="mobile-nav-footer">
              <button className="button primary" onClick={openScenario}><SlidersHorizontal size={15} /> Szenario verwalten</button>
              <small>Rechtsstand {legalYear} · Datenstand {dataYear} · Modellrechnung</small>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
