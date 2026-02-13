// src/pages/builder.tsx
import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

import Navbar from "@/components/ui/NavBar";
import StatusConsole from "@/components/ui/StatusConsole";
import PreEngPrereqModal, {
  shouldShowPreEngPrereq,
} from "@/components/ui/PreEngPrereqModal";
import SystemOptionsPanel from "@/components/features/systems/SystemOptionsPanel";

import styles from "@/styles/builder.module.css";
import navStyles from "@/styles/navbar.module.css";

import { useAppModel, Zone, Enclosure } from "@/state/app-model";

import {
  pickDefaultNozzle,
  pickDefaultStyle,
  getStylesFor,
  getNozzlesForMethod,
  getNozzleLabel,
  MethodName,
  NozzleCode,
  EmitterStyleKey,
} from "@/core/catalog/emitter.catalog";

import type { CallBackProps } from "react-joyride";
import { EVENTS, STATUS, ACTIONS } from "react-joyride";

import {
  tutorialSteps,
  shouldRunTutorial,
  markTutorialSeen,
} from "@/components/features/tutorial/tutorial.steps.tsx";

import {
  computePreEngGuidance,
  fmtFt2AndM2,
} from "@/core/calc/preengineered/guidance";
import { useUIFlags } from "@/state/ui-flags";

// Joyride must be client-only to avoid hydration mismatch
const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

/* ──────────────────────────────────────────────────────────────
   Tutorial step constants (keep in one place for gating)
   ────────────────────────────────────────────────────────────── */
const STEP = {
  INTRODUCTION: 0,
  COLLAPSE: 1,
  SYSTEM_CONTROL: 2,
  SYSTEM_CONFIG: 3,
  SYSTEM_ADDONS: 4,
  ENCLOSURES: 5,
  CALCULATE_1: 6,
  STATUS_OVERVIEW: 7,
  STATUS_MSG_1: 8,
  ENC_NAME_2: 9,
  CALCULATE_2: 10,
  STATUS_MSG_2: 11,
  RESULTS_GRID: 12,
  SYSTEM_RESULTS: 13,
  EST_VALS: 14,
  PRICING: 15,
  GENERATE_BOM: 16,
  SUBMIT: 17,
  EXPORT: 18,
  IMPORT: 19,
} as const;

const GATED_STEPS = new Set<number>([
  STEP.COLLAPSE,
  STEP.CALCULATE_1,
  STEP.STATUS_MSG_1,
  STEP.CALCULATE_2,
]);
/* ──────────────────────────────────────────────────────────────
   Catalog helpers
   ────────────────────────────────────────────────────────────── */

// normalize the catalog’s "" default to undefined
function pickStyleOrUndef(
  method: MethodName,
  nozzle: NozzleCode | undefined,
  opts?: { systemType?: "engineered" | "preengineered" },
): EmitterStyleKey | undefined {
  if (!nozzle) return undefined;
  const s = pickDefaultStyle(method, nozzle, opts);
  return (s || undefined) as EmitterStyleKey | undefined;
}

/** Convert model value -> input value. Blank if undefined/null. */
export function toInputValue(v: number | null | undefined): string | number {
  return v ?? "";
}

/**
 * Convert input value -> model value.
 * Returns undefined when the field is blank or mid-typing ("-", ".", "-.").
 */
export function fromNumberInput(raw: string): number | undefined {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.")
    return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Like fromNumberInput but supports keeping "" as a controlled input value */
export function fromEditableNumber(raw: string): number | "" {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

const STYLE_LABELS: Record<EmitterStyleKey, string> = {
  "standard-stainless": "Standard, Stainless",
  "standard-pvdf": "Standard, PVDF",
  "standard-brass": "Standard, Brass",
  "escutcheon-stainless": "Escutcheon, Stainless",
};

export function getStyleLabel(style: EmitterStyleKey): string {
  return STYLE_LABELS[style] ?? style;
}

function getStickyStackHeight() {
  const nav = document.querySelector("[data-nav='1']") as HTMLElement | null;
  const controls = document.querySelector(
    "[data-controls-sticky='1']",
  ) as HTMLElement | null;
  const summary = document.querySelector(
    "[data-sys-summary='1']",
  ) as HTMLElement | null; // optional

  const navH = nav?.getBoundingClientRect().height ?? 0;
  const controlsH = controls?.getBoundingClientRect().height ?? 0;

  // If you have an additional sticky summary bar in the middle column, include it.
  const summaryH = summary?.getBoundingClientRect().height ?? 0;

  // Your CSS uses --sticky-gutter too. Mirror it here.
  const gutter = 24;

  return navH + controlsH + summaryH + gutter;
}

function isFullyVisible(el: Element, topPad: number, bottomPad: number) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;

  const topSafe = topPad;
  const bottomSafe = vh - bottomPad;

  return r.top >= topSafe && r.bottom <= bottomSafe;
}

/**
 * Scroll so the target is fully visible within the "safe viewport":
 * below sticky stack and above bottom padding (tooltip space).
 */
function scrollTargetToSafeSpot(el: Element) {
  const topPad = getStickyStackHeight();

  // reserve space so the tooltip doesn't push content off the bottom
  const bottomPad = 220;

  // If it’s already fully visible in the safe viewport, don’t move.
  if (isFullyVisible(el, topPad, bottomPad)) return;

  const r = el.getBoundingClientRect();
  const y = window.scrollY;

  // If target is above safe zone → align its top just under sticky stack
  if (r.top < topPad) {
    const desired = y + (r.top - topPad) - 8;
    window.scrollTo({ top: Math.max(0, desired), behavior: "smooth" });
    return;
  }

  // If target is below safe zone → align its bottom into safe zone
  const vh = window.innerHeight;
  const bottomSafe = vh - bottomPad;

  if (r.bottom > bottomSafe) {
    const desired = y + (r.bottom - bottomSafe) + 8;
    window.scrollTo({ top: Math.max(0, desired), behavior: "smooth" });
  }
}

/* ──────────────────────────────────────────────────────────────
   Label helpers
   ────────────────────────────────────────────────────────────── */
type HasIdName = { id: string; name?: string | null };

function normName(v?: string | null) {
  return (v ?? "").trim();
}

/** Generic: "System 1" or "System 1: Data Hall" */
function formatIndexedName(base: string, index1: number, name?: string | null) {
  const def = `${base} ${index1}`;
  const n = normName(name);
  if (!n || n === def) return def;
  return `${def}: ${n}`;
}

/** Build a fast lookup so you can label-by-id anywhere */
function makeLabelById<T extends HasIdName>(
  items: T[] | undefined,
  base: string,
) {
  const arr = items ?? [];
  const indexById = new Map<string, number>();
  arr.forEach((it, i) => indexById.set(it.id, i));

  return (id?: string | null) => {
    if (!id) return "—";
    const i = indexById.get(id);
    if (i == null) return "—";
    return formatIndexedName(base, i + 1, arr[i]?.name);
  };
}
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);

  return matches;
}

/* ──────────────────────────────────────────────────────────────
   Status highlighting helpers
   ────────────────────────────────────────────────────────────── */
type HighlightLevel = "error" | "warn" | null;

const sevRank: Record<string, number> = { info: 0, warn: 1, error: 2 };

function maxSev(a: HighlightLevel, b: "error" | "warn"): HighlightLevel {
  if (!a) return b;
  return sevRank[b] > sevRank[a] ? b : a;
}

function buildHighlights(status: any[]) {
  const zoneLevel = new Map<string, HighlightLevel>(); // zoneId -> level
  const encLevel = new Map<string, HighlightLevel>(); // enclosureId -> level

  for (const m of status) {
    if (m.severity !== "error" && m.severity !== "warn") continue;

    if (m.enclosureId) {
      encLevel.set(
        m.enclosureId,
        maxSev(encLevel.get(m.enclosureId) ?? null, m.severity),
      );
      if (m.zoneId)
        zoneLevel.set(
          m.zoneId,
          maxSev(zoneLevel.get(m.zoneId) ?? null, m.severity),
        );
      continue;
    }

    if (m.zoneId) {
      zoneLevel.set(
        m.zoneId,
        maxSev(zoneLevel.get(m.zoneId) ?? null, m.severity),
      );
      continue;
    }
  }

  return { zoneLevel, encLevel };
}

/* ──────────────────────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────────────────────── */

export default function BuilderPage() {
  return (
    <>
      <Navbar />
      <Head>
        <title>Victaulic Vortex™ | Builder</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/vx.ico" sizes="any" />
      </Head>{" "}
      <div className={navStyles.navSpacer} />
      <Scaffold />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   SCAFFOLD (layout + tutorial controller)
   ────────────────────────────────────────────────────────────── */

function Scaffold() {
  const {
    project,
    addSystem,
    clearProject,
    runCalculateAll,
    status,
    importProjectFromFile,
    clearStatus,
    setAutosaveEnabled,
    restoreAutosaveFromRaw,
  } = useAppModel();
  const { disclaimerOpen } = useUIFlags();

  // UI state
  const [showPreModal, setShowPreModal] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const controlsStickyRef = React.useRef<HTMLDivElement | null>(null);
  const calc2ArmedRef = React.useRef(false);
  const calc2TickRef = React.useRef(0); // increments when user clicks Calculate during CALCULATE_2
  const tutorialTempModeRef = React.useRef(false);
  const tutorialRestoreRawRef = React.useRef<string | null>(null);

  // Derived UI state
  const highlights = React.useMemo(() => buildHighlights(status), [status]);

  // Tutorial state
  const [runTour, setRunTour] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  const stopTour = React.useCallback(
    (opts?: { markSeen?: boolean }) => {
      const markSeen = opts?.markSeen !== false;

      if (markSeen) markTutorialSeen();

      setRunTour(false);

      // If we launched tutorial in temp mode, restore the user's prior project
      if (tutorialTempModeRef.current && tutorialRestoreRawRef.current) {
        restoreAutosaveFromRaw(tutorialRestoreRawRef.current);
      }

      // Re-enable autosave after tutorial exits
      if (tutorialTempModeRef.current) {
        setAutosaveEnabled(true);
      }

      // Clean up query params so refresh doesn’t re-trigger tutorial
      try {
        window.history.replaceState({}, "", "/builder");
      } catch {
        /* ignore */
      }

      tutorialTempModeRef.current = false;
      tutorialRestoreRawRef.current = null;
    },
    [restoreAutosaveFromRaw, setAutosaveEnabled],
  );

  /**
   * Load a known configuration so the tutorial targets & messages are predictable.
   * Must live inside the component so useAppModel() is valid.
   */
  const loadTutorialProject = React.useCallback(async () => {
    const res = await fetch(
      "/tutorial/VortexProject_Tutorial_Project_v2_1_2.json",
      {
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error("Tutorial project not found");

    const text = await res.text();
    const file = new File([text], "Tutorial.json", {
      type: "application/json",
    });
    await importProjectFromFile(file);
  }, [importProjectFromFile]);

  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;

    // ✅ If disclaimer is showing, wait.
    if (disclaimerOpen) return;

    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;

    const forceTutorial = params?.get("tutorial") === "1";
    const tempMode = params?.get("mode") === "temp";

    if (!forceTutorial && !shouldRunTutorial()) return;

    // ✅ only mark started once we actually start
    startedRef.current = true;

    (async () => {
      tutorialTempModeRef.current = !!tempMode;

      if (tempMode) {
        try {
          tutorialRestoreRawRef.current =
            localStorage.getItem("vortex:autosave");
        } catch {
          tutorialRestoreRawRef.current = null;
        }
        setAutosaveEnabled(false);
      }

      await loadTutorialProject();

      setStepIndex(0);
      setRunTour(true);
      clearStatus();

      if (forceTutorial) {
        try {
          window.history.replaceState({}, "", "/builder");
        } catch { }
      }
    })().catch(console.error);
  }, [disclaimerOpen, loadTutorialProject, clearStatus, setAutosaveEnabled]);

  // Global Enter => Calculate (keeps your existing workflow)
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // ✅ Disable Enter-to-calc during tutorial
      if (runTour) return;

      const target = e.target as HTMLElement;
      if (target.closest("[data-no-enter-calc='1']")) return;

      const tag = target?.tagName?.toLowerCase();
      const isTextInput =
        tag === "input" || tag === "select" || tag === "textarea";

      if (e.key === "Enter" && isTextInput) {
        e.preventDefault();
        runCalculateAll();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [runCalculateAll, runTour]);

  // Measure sticky controls height so scroll offsets can use CSS variables
  React.useEffect(() => {
    const el = controlsStickyRef.current;
    if (!el) return;

    const set = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--controls-height", `${h}px`);
      document.documentElement.style.setProperty(
        "--app-sticky-top",
        `calc(var(--nav-height, 56px) + var(--sticky-gutter, 24px) + ${h}px)`,
      );
    };

    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  /* ──────────────────────────────────────────────────────────
     Tutorial: gates & callback controller
     ────────────────────────────────────────────────────────── */

  // Gate: sidebar collapse must be clicked to advance
  const onCollapseClick = React.useCallback(() => {
    setSidebarOpen((o) => !o);
    if (runTour && stepIndex === STEP.COLLAPSE) setStepIndex(STEP.COLLAPSE + 1);
  }, [runTour, stepIndex]);

  // Gate: Calculate is a real button click (tour doesn’t “press next”)
  const onTutorialCalculate = React.useCallback(() => {
    // if we’re on the CALCULATE_2 step, record a “user clicked calculate”
    if (runTour && stepIndex === STEP.CALCULATE_2) {
      calc2TickRef.current += 1;
    }

    runCalculateAll();
  }, [runCalculateAll, runTour, stepIndex]);
  const handleTour = React.useCallback(
    (data: CallBackProps) => {
      const { status: tourStatus, type, action, index } = data;

      if (tourStatus === STATUS.FINISHED || tourStatus === STATUS.SKIPPED) {
        stopTour();
        return;
      }
      if (type === EVENTS.STEP_BEFORE) {
        const step = tutorialSteps[index];
        const selector = step.target as string;

        // Wait for DOM + tooltip to mount and layout to settle
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(selector);
            if (el) scrollTargetToSafeSpot(el);
          });
        });

        // Optional extra nudge for images/tables that resize a moment later
        setTimeout(() => {
          const el = document.querySelector(selector);
          if (el) scrollTargetToSafeSpot(el);
        }, 120);
      }

      if (type === EVENTS.STEP_AFTER) {
        console.log("IDX: " + data.index);

        if (GATED_STEPS.has(index)) return;

        if (index === STEP.ENC_NAME_2) {
          calc2ArmedRef.current = true;
        }

        setStepIndex((prev) => {
          if (action === ACTIONS.PREV) return Math.max(0, prev - 1);
          return prev + 1;
        });
        return;
      }
      if (type === EVENTS.TARGET_NOT_FOUND) {
        console.log("TNF IDX: " + index);

        if (GATED_STEPS.has(index)) return;
        setStepIndex((prev) => prev + 1);
        return;
      }
    },
    [stopTour],
  );

  // Gate: after Calculate, we wait for status messages (async-ish)
  React.useEffect(() => {
    if (!runTour) return;

    // after first Calculate -> jump to status overview when messages exist
    if (stepIndex === STEP.CALCULATE_1 && status.length > 0) {
      setStepIndex(STEP.STATUS_OVERVIEW);
      return;
    }

    if (stepIndex === STEP.CALCULATE_2) {
      if (!calc2ArmedRef.current) return;

      // ✅ Only advance if the user actually clicked Calculate while on this step.
      if (calc2TickRef.current <= 0) return;

      // We’ve observed the click; consume it so it can’t auto-advance again.
      calc2TickRef.current = 0;
      calc2ArmedRef.current = false;

      setStepIndex(STEP.STATUS_MSG_2);
    }
  }, [runTour, stepIndex, status]);

  React.useEffect(() => {
    if (!runTour) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stopTour({ markSeen: false });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runTour, stopTour]);
  const joyrideRun = runTour && !disclaimerOpen;
  const stackedResults = useMediaQuery("(max-width: 1600px)");

  const joyrideWidth = stackedResults ? 410 : 620;

  /* ──────────────────────────────────────────────────────────
     App actions
     ────────────────────────────────────────────────────────── */
  const onAddEngineered = () => addSystem("engineered");

  const onAddPreClick = () => {
    if (shouldShowPreEngPrereq()) setShowPreModal(true);
    else addSystem("preengineered");
  };

  const onProceedPre = () => {
    setShowPreModal(false);
    addSystem("preengineered");
  };

  return (
    <div
      className={styles.container}
      data-sidebar-open={sidebarOpen ? "1" : "0"}
      data-tour="introduction"
    >
      <div className={styles.grid}>
        {/* LEFT: Project Options */}
        <div className={`${styles.leftCol} ${styles.sticky}`}>
          <div className={styles.leftPanel} data-tour="project-options">
            <ProjectOptionsCard />
            <button
              className={styles.leftColHandle}
              aria-label={
                sidebarOpen
                  ? "Collapse project options"
                  : "Expand project options"
              }
              title={sidebarOpen ? "Collapse" : "Expand"}
              onClick={onCollapseClick}
              data-tour="collapse-btn"
            >
              {sidebarOpen ? "«" : "»"}
            </button>
          </div>
        </div>

        {/* MIDDLE */}
        <div className={styles.midCol}>
          <h1 className={styles.builderTitle}>
            Victaulic Vortex™ Project Builder
          </h1>

          <div className={styles.controlsSticky} data-controls-sticky="1">
            <div ref={controlsStickyRef}>
              <ControlBar
                onAddEngineered={onAddEngineered}
                onAddPreClick={onAddPreClick}
                onClearProject={clearProject}
                onCalculate={onTutorialCalculate}
              />
            </div>
          </div>

          <PreEngPrereqModal
            open={showPreModal}
            onCancel={() => setShowPreModal(false)}
            onProceed={onProceedPre}
          />

          {project.systems.map((sys) => (
            <SystemCard key={sys.id} sys={sys} highlights={highlights} />
          ))}
        </div>

        {/* RIGHT: Pricing + Status */}
        <div className={styles.rightCol}>
          <PricePanel />
          <StatusConsole
            onTutorialStatusClick={(m) => {
              if (!runTour) return;

              // Gate: click the missing-name error to advance
              if (
                stepIndex === STEP.STATUS_MSG_1 &&
                m.code === "ENC.MISSING_NAME"
              ) {
                setStepIndex(STEP.ENC_NAME_2);
              }
            }}
          />
        </div>
      </div>
      <Joyride
        steps={tutorialSteps}
        run={joyrideRun}
        stepIndex={stepIndex}
        callback={handleTour}
        continuous
        showProgress
        showSkipButton={false}
        hideCloseButton
        disableScrolling
        scrollToFirstStep={false}
        spotlightClicks
        disableOverlayClose
        styles={{
          options: {
            zIndex: 9999,
            overlayColor: "rgba(15, 23, 42, 0.45)",
            width: joyrideWidth,
            // IMPORTANT: don't set primaryColor to white or your Next button becomes invisible
            primaryColor: "#ff6900",
          },
          tooltip: {
            borderRadius: "6px",
            // optional safety so it never runs off screen vertically
            maxHeight: "70vh",
            overflowY: "auto",
          },
          spotlight: { borderRadius: "6px" },
          tooltipContainer: { textAlign: "left" },
          buttonNext: { borderRadius: "6px" },
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   CONTROL BAR
   ────────────────────────────────────────────────────────────── */

function ControlBar({
  onAddEngineered,
  onAddPreClick,
  onClearProject,
  onCalculate,
}: {
  onAddEngineered: () => void;
  onAddPreClick: () => void;
  onClearProject: () => void;
  onCalculate: () => void;
}) {
  const {
    hasErrors,
    hasCalculated,
    exportProjectToFile,
    triggerImportFilePicker,
    generateEngineeredBOM,
    project,
  } = useAppModel();

  const onSubmitProject = () => {
    if (hasErrors) return;

    const to = "fireprotection@victaulic.com";
    const cc = (project?.email || "").trim();
    const subject =
      `Victaulic Vortex Project Submission — ` +
      (project?.name?.trim() || "Untitled Project");

    const lines = [
      "Please attach the project file below for submission to Customer Care for ordering or estimation.",
      "",
      "Project Details:",
      `Project: ${project?.name || "Untitled Project"}`,
      `Company: ${project?.companyName || ""}`,
      `Contact: ${project?.firstName || ""} ${project?.lastName || ""}`.trim(),
      `Phone: ${project?.phone || ""}`,
      `Email: ${project?.email || ""}`,
    ];

    const body = lines.join("\r\n");
    const parts: string[] = [];
    if (cc) parts.push(`cc=${encodeURIComponent(cc)}`);
    parts.push(`subject=${encodeURIComponent(subject)}`);
    parts.push(`body=${encodeURIComponent(body)}`);

    window.location.href = `mailto:${to}?${parts.join("&")}`;
  };

  return (
    <div className={styles.controlBar}>
      <div className={styles.controlGroupPrimary}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onCalculate}
          data-tour="calculate-btn"
        >
          Calculate
        </button>

        <button
          className={styles.btn}
          disabled={hasErrors || !hasCalculated}
          onClick={generateEngineeredBOM}
          title={
            hasErrors
              ? "Resolve errors before generating BOM"
              : !hasCalculated
                ? "Run Calculate before generating BOM"
                : "Generate BOM"
          }
          data-tour="generate-bom-btn"
        >
          Generate BOM
        </button>
        <button
          className={styles.btn}
          onClick={triggerImportFilePicker}
          data-tour="import-btn"
        >
          Load
        </button>

        <button
          className={styles.btn}
          onClick={exportProjectToFile}
          data-tour="export-btn"
        >
          Save
        </button>

        <button
          className={styles.btn}
          disabled={hasErrors}
          onClick={onSubmitProject}
          title={
            hasErrors
              ? "Resolve errors before submitting the project"
              : "Submit project via email"
          }
          data-tour="submit-btn"
        >
          Submit
        </button>
      </div>

      <div data-tour="system-control" className={styles.controlGroupSecondary}>
        <button
          className={`${styles.btn} ${styles.btnSoft} ${styles.btnSoftEng}`}
          onClick={onAddEngineered}
          title="Add Engineered System"
        >
          + Add Engineered
        </button>

        <button
          className={`${styles.btn} ${styles.btnSoft} ${styles.btnSoftPre}`}
          onClick={onAddPreClick}
          title="Add Pre-Engineered System"
        >
          + Add Pre-Engineered
        </button>

        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={onClearProject}
          title="Reset the entire project"
        >
          Clear Project
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   LEFT: PROJECT OPTIONS
   ────────────────────────────────────────────────────────────── */

const ELEVATION_OPTIONS = [
  { v: "-3000FT/-0.92KM", label: "-3000 ft / -0.92 km" },
  { v: "-2000FT/-0.61KM", label: "-2000 ft / -0.61 km" },
  { v: "-1000FT/-0.30KM", label: "-1000 ft / -0.30 km" },
  { v: "0FT/0KM", label: "0 ft / 0 km" },
  { v: "1000FT/0.30KM", label: "1000 ft / 0.30 km" },
  { v: "2000FT/0.61KM", label: "2000 ft / 0.61 km" },
  { v: "3000FT/0.91KM", label: "3000 ft / 0.91 km" },
  { v: "4000FT/1.22KM", label: "4000 ft / 1.22 km" },
  { v: "5000FT/1.52KM", label: "5000 ft / 1.52 km" },
  { v: "6000FT/1.83KM", label: "6000 ft / 1.83 km" },
  { v: "7000FT/2.13KM", label: "7000 ft / 2.13 km" },
  { v: "8000FT/2.45KM", label: "8000 ft / 2.45 km" },
  { v: "9000FT/2.74KM", label: "9000 ft / 2.74 km" },
  { v: "10000FT/3.05KM", label: "10000 ft / 3.05 km" },
];

function ProjectOptionsCard() {
  const { project, updateProject } = useAppModel();

  return (
    <section className={styles.section}>
      <h3 style={{ marginTop: 0 }}>Project Options</h3>

      <div className={styles.poGrid}>
        <label className={styles.poLabel}>Project Name</label>
        <input
          className={styles.poControl}
          value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })}
          placeholder="Project name"
        />

        <label className={styles.poLabel}>Company</label>
        <input
          className={styles.poControl}
          value={project.companyName}
          onChange={(e) => updateProject({ companyName: e.target.value })}
          placeholder="Company name"
        />

        <label className={styles.poLabel}>First Name</label>
        <input
          className={styles.poControl}
          value={project.firstName}
          onChange={(e) => updateProject({ firstName: e.target.value })}
          placeholder="First name"
        />

        <label className={styles.poLabel}>Last Name</label>
        <input
          className={styles.poControl}
          value={project.lastName}
          onChange={(e) => updateProject({ lastName: e.target.value })}
          placeholder="Last name"
        />

        <label className={styles.poLabel}>Phone</label>
        <input
          className={styles.poControl}
          type="tel"
          value={project.phone}
          onChange={(e) => updateProject({ phone: e.target.value })}
          placeholder="(555) 555-5555"
        />

        <label className={styles.poLabel}>Email</label>
        <input
          className={styles.poControl}
          type="email"
          value={project.email}
          onChange={(e) => updateProject({ email: e.target.value })}
          placeholder="name@example.com"
        />

        <label className={styles.poLabel}>Project Location</label>
        <input
          className={styles.poControl}
          value={project.projectLocation}
          onChange={(e) => updateProject({ projectLocation: e.target.value })}
          placeholder="City, State / Country"
        />
        <label className={styles.poLabel}>Project Elevation</label>
        <select
          className={styles.poControl}
          value={project.elevation}
          onChange={(e) => updateProject({ elevation: e.target.value })}
        >
          {ELEVATION_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <label className={styles.poLabel}>Units</label>
        <select
          className={styles.poControl}
          value={project.units}
          onChange={(e) => updateProject({ units: e.target.value as any })}
        >
          <option value="imperial">Imperial (ft, gal, °F)</option>
          <option value="metric">Metric (m, L, °C)</option>
        </select>

        <label className={styles.poLabel}>Currency</label>
        <select
          className={styles.poControl}
          value={project.currency}
          onChange={(e) => {
            const prev = project.currency;
            const next = e.target.value as any;

            let nextCylinderSupply = project.cylinderSupply;

            if (next === "USD") {
              // Always switch to factory-filled for USD
              nextCylinderSupply = "FACTORY_FILL";
            } else {
              // Switching away from USD -> default to unpressurized
              // But switching between non-USD currencies should preserve existing value
              if (prev === "USD" && next !== "USD") {
                nextCylinderSupply = "LOCAL_FILL";
              } else {
                // preserve existing (or default to LOCAL_FILL if missing)
                nextCylinderSupply = project.cylinderSupply ?? "LOCAL_FILL";
              }
            }

            updateProject({
              currency: next,
              cylinderSupply: nextCylinderSupply,
            });
          }}
        >
          <option value="USD">USD (US Dollar)</option>
          <option value="EUR">EUR (Euro)</option>
          <option value="GBP">GBP (British Pound)</option>
        </select>

        {/* Cylinder supply → radios when non-USD */}
        {project.currency !== "USD" && (
          <fieldset
            className={styles.cylFieldset}
            aria-describedby="cylSupplyHelp"
          >
            <legend className={styles.poLabel} style={{ marginBottom: 6 }}>
              Cylinder Supply
            </legend>

            <div className={styles.cylOptions}>
              <label htmlFor="cyl-local" className={styles.cylOptionLabel}>
                <input
                  id="cyl-local"
                  name="cylinderSupply"
                  type="radio"
                  value="LOCAL_FILL"
                  checked={
                    (project.cylinderSupply ?? "LOCAL_FILL") === "LOCAL_FILL"
                  }
                  onChange={() =>
                    updateProject({ cylinderSupply: "LOCAL_FILL" })
                  }
                />
                <span>
                  Unpressurized
                  <br />
                  <span className={styles.cylSub}>Local Fill</span>
                </span>
              </label>

              <label htmlFor="cyl-factory" className={styles.cylOptionLabel}>
                <input
                  id="cyl-factory"
                  name="cylinderSupply"
                  type="radio"
                  value="FACTORY_FILL"
                  checked={project.cylinderSupply === "FACTORY_FILL"}
                  onChange={() =>
                    updateProject({ cylinderSupply: "FACTORY_FILL" })
                  }
                />
                <span>Factory Filled</span>
              </label>
            </div>

            <div id="cylSupplyHelp" className={styles.cylHelp}>
              Factory-filled cylinders may not be available in some regions due
              to shipping regulations.
            </div>
          </fieldset>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   RIGHT: PRICING
   ────────────────────────────────────────────────────────────── */

function PricePanel() {
  const {
    project,
    updateProject,
    engListPrice, // number | null
    preListPrice, // number | null
  } = useAppModel();

  const currency = project.currency || "USD";

  // Use saved project values with sane defaults
  const engMult =
    typeof project.priceMultiplierEngineered === "number"
      ? clamp01(project.priceMultiplierEngineered)
      : 0.35; // default engineered multiplier

  const preMult =
    typeof project.priceMultiplierPreEngineered === "number"
      ? clamp01(project.priceMultiplierPreEngineered)
      : 0.3; // default pre-engineered multiplier (fixed by product)

  function clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
  }

  const fmt = (n: number | null) =>
    n == null
      ? "—"
      : n.toLocaleString(undefined, { style: "currency", currency });

  const onEngMultChange = (raw: string) => {
    const n = Number(raw);
    const v = Number.isFinite(n) ? clamp01(n) : 0;
    // persist into project so BOM generator can read it
    updateProject({ priceMultiplierEngineered: Math.round(v * 100) / 100 });
  };

  // Keep pre multiplier non-editable in the UI by default.
  // If you want to make it editable, wire this to an <input> onChange and call updateProject.
  const onPreMultChange = (raw: string) => {
    const n = Number(raw);
    const v = Number.isFinite(n) ? clamp01(n) : 0;
    updateProject({ priceMultiplierPreEngineered: Math.round(v * 100) / 100 });
  };

  // Order blocks by first appearance of each system type
  const blocks = React.useMemo(() => {
    const firstIdxEng = project.systems.findIndex(
      (s) => s.type === "engineered",
    );
    const firstIdxPre = project.systems.findIndex(
      (s) => s.type === "preengineered",
    );

    return [
      { key: "engineered" as const, idx: firstIdxEng },
      { key: "preengineered" as const, idx: firstIdxPre },
    ]
      .filter((b) => b.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
  }, [project.systems]);

  const engNet = engListPrice == null ? null : engListPrice * engMult;
  const preNet = preListPrice == null ? null : preListPrice * preMult;

  // simple + correct
  const projectNet =
    engNet == null && preNet == null ? null : (engNet ?? 0) + (preNet ?? 0);

  if (blocks.length === 0) {
    return (
      <section
        className={`${styles.section} ${styles.priceCard}`}
        data-tour="pricing-panel"
      >
        <h3 className={styles.priceTitle}>Pricing</h3>
        <div className={styles.mutedSm}>Add a system to view pricing.</div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.section} ${styles.priceCard}`}
      data-tour="pricing-panel"
    >
      <h3 className={styles.priceTitle}>Pricing</h3>

      <div className={styles.priceStack}>
        {blocks.map((b) => {
          const isEng = b.key === "engineered";
          const title = isEng ? "Engineered" : "Pre-Engineered";
          const list = isEng ? engListPrice : preListPrice;
          const net = isEng ? engNet : preNet;
          const mult = isEng ? engMult : preMult;

          return (
            <div key={b.key} className={styles.priceBlock}>
              <div className={styles.priceBlockHead}>
                <div
                  className={styles.priceBlockTitle}
                  data-type={isEng ? "eng" : "pre"}
                >
                  {title}
                </div>

                <div className={styles.priceBlockMult}>
                  <span className={styles.mutedSm}>×</span>

                  {/* Engineered: editable; Pre-Engineered: read-only (product fixed) */}
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={toInputValue(mult)}
                    onChange={(e) =>
                      isEng
                        ? onEngMultChange(e.target.value)
                        : onPreMultChange(e.target.value)
                    }
                    className={styles.inputNumXs}
                    style={{ textAlign: "right" }}
                  />
                </div>
              </div>

              <div className={styles.priceRowTight}>
                <span className={styles.mutedSm}>List</span>
                <span className={styles.priceValue}>{fmt(list)}</span>
              </div>

              <div className={styles.priceRowTight}>
                <span className={styles.mutedSm}>Net</span>
                <span className={styles.priceValue}>{fmt(net)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.priceDivider} />

      <div className={styles.priceRowTight}>
        <span className={styles.priceProjectLabel}>Project Net</span>
        <span className={styles.priceValue}>{fmt(projectNet)}</span>
      </div>
    </section>
  );
}
/* ──────────────────────────────────────────────────────────────
   MIDDLE: Systems / Zones / Tables
   (your existing components continue below unchanged)
   ────────────────────────────────────────────────────────────── */

// NOTE: Everything below this point can remain functionally identical.
// I did NOT rewrite your remaining components here because your paste
// was partial (and I don’t want to accidentally drop anything).
// Keep your existing SystemCard/ZoneCard/PreEng components beneath this line.
//
// IMPORTANT: Do NOT add any useAppModel() calls at module scope.
// All useAppModel() usage must stay inside components.

/* ───────────────────────────────
   MIDDLE: Systems / Zones / Tables
   (UNCHANGED functional components below)
   ─────────────────────────────── */

function SystemCard({
  sys,
  highlights,
}: {
  sys: any;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { project } = useAppModel(); // add project if not already available

  const sysIndex =
    (project.systems ?? []).findIndex((s: any) => s.id === sys.id) + 1;

  const systemSummaryLabel = formatIndexedName("System", sysIndex, sys.name);
  const systemDefaultName = `System ${sysIndex}`;

  const {
    updateSystem,
    removeSystem,
    addZone,
    changeSystemType,
    updateSystemOptions,
  } = useAppModel();

  const isPre = sys.type === "preengineered";

  const preOpts = isPre ? (sys.options as any) : null;
  const systemPartCode: string = preOpts?.systemPartCode ?? "";
  const systemPartCodeLocked: boolean = !!preOpts?.systemPartCodeLocked;

  return (
    <section
      id={`sys-${sys.id}`}
      className={`${styles.sysCard} ${isPre ? styles["sysCard--pre"] : styles["sysCard--eng"]
        }`}
    >
      {/* Slim colored header band + system badge */}
      <div className={styles.sysHeader}>
        <span
          className={`${styles.sysBadge} ${isPre ? styles["sysBadge--pre"] : styles["sysBadge--eng"]
            }`}
        >
          {isPre ? "Pre-Engineered" : "Engineered"}
        </span>
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.controlsLeft}>
          <label className={styles.labelGroup}>
            <span style={{ fontWeight: 600 }}>{`System ${sysIndex}:`}</span>
            <input
              value={sys.name}
              onChange={(e) => updateSystem(sys.id, { name: e.target.value })}
              className={styles.inputMd}
              placeholder={systemDefaultName} // helpful cue
            />
          </label>

          <label className={styles.labelGroup}>
            Type:
            <select
              value={sys.type}
              onChange={(e) => changeSystemType(sys.id, e.target.value as any)}
              className={styles.inputMd}
            >
              <option value="engineered">Engineered</option>
              <option value="preengineered">Pre-Engineered</option>
            </select>
          </label>
        </div>

        <div className={styles.controlsRight}>
          {isPre && (
            <label className={styles.partcodeGroup}>
              <span className={styles.partcodeLabel}>
                <input
                  type="checkbox"
                  checked={systemPartCodeLocked}
                  onChange={(e) =>
                    updateSystemOptions(sys.id, {
                      systemPartCodeLocked: e.target.checked,
                    } as any)
                  }
                />
                System Partcode:
              </span>

              <input
                className={styles.inputMd}
                value={systemPartCode}
                disabled={!systemPartCodeLocked}
                onChange={(e) =>
                  updateSystemOptions(sys.id, {
                    systemPartCode: e.target.value,
                  } as any)
                }
                placeholder="S-xxx-9PE-xxx-xxx-xx"
              />
            </label>
          )}

          <div className={styles.actionsRight}>
            {!isPre && (
              <button className={styles.btn} onClick={() => addZone(sys.id)}>
                + Add Zone
              </button>
            )}
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => {
                if (
                  confirm("Remove this system and all of its zones/enclosures?")
                )
                  removeSystem(sys.id);
              }}
            >
              − Remove System
            </button>
          </div>
        </div>
      </div>

      <SystemOptionsPanel systemId={sys.id} />

      {isPre ? (
        <PreZoneBlock sys={sys} highlights={highlights} />
      ) : sys.zones.length === 0 ? (
        <div className={styles.muted} style={{ margin: "12px 0" }}>
          <label>No zones yet.</label>
        </div>
      ) : (
        sys.zones.map((z: any, zi: number) => (
          <ZoneCard
            key={z.id}
            sysId={sys.id}
            zone={z}
            index={zi + 1}
            highlights={highlights}
          />
        ))
      )}
    </section>
  );
}

/* ENGINEERED: Zone + Tables (unchanged, trimmed for brevity) */
function ZoneCard({
  sysId,
  zone,
  index,
  highlights,
}: {
  sysId: string;
  zone: any;
  index: number;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { updateZone, removeZone, addEnclosure, project } = useAppModel();

  // Pull the system to see if bulk tubes are enabled for this system
  const system = project.systems.find((s) => s.id === sysId);
  const bulkOn = !!(system?.options as any)?.usesBulkTubes;

  // Default valve-open time (minutes) when bulk is enabled
  const tOpen = Number(zone.bulkValveOpenTimeMin);
  const tOpenDisplay = Number.isFinite(tOpen) ? tOpen : 10; // default

  const unitVol = project.units === "metric" ? "m³" : "ft³";

  const zoneHl = highlights.zoneLevel.get(zone.id) ?? null;
  const zoneHlClass =
    zoneHl === "error"
      ? styles.zoneCardError
      : zoneHl === "warn"
        ? styles.zoneCardWarn
        : "";
  return (
    <div
      id={`zone-${zone.id}`}
      className={`${styles.zoneCard} ${styles["stack-tight"] ?? ""} ${zoneHlClass}`}
    >
      <div className={styles.zoneHeader}>
        <label className={styles.labelGroup}>
          <span style={{ fontWeight: 600 }}>Zone {index}:</span>
          <input
            value={zone.name}
            onChange={(e) =>
              updateZone(sysId, zone.id, { name: e.target.value })
            }
            className={styles.inputMd}
            placeholder="Zone Name"
          />
        </label>

        <div className={styles.actionsRight}>
          <button
            className={styles.btn}
            onClick={() => addEnclosure(sysId, zone.id)}
          >
            + Add Enclosure
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              if (confirm("Remove this zone and its enclosures?"))
                removeZone(sysId, zone.id);
            }}
          >
            − Remove Zone
          </button>
        </div>
      </div>
      <div className={styles.rowHeading}>Zone Configuration</div>

      {/* Zone-level rundown time */}
      <div className={styles.optionGrid}>
        <div className={styles.fieldBlock}>
          <label>Rundown Time (min)</label>
          <input
            className={styles.inputMd}
            type="number"
            min={0}
            value={toInputValue(zone.rundownTimeMin)}
            onChange={(e) =>
              updateZone(sysId, zone.id, {
                rundownTimeMin: fromNumberInput(e.target.value) ?? null,
              })
            }
          />
        </div>
        {/* Zone-level estimated dry water pipe volume */}
        <div className={styles.fieldBlock}>
          <label>Est. Dry Water Pipe Vol. ({unitVol})</label>
          <input
            className={styles.inputMd}
            type="number"
            min={0}
            value={toInputValue(zone.pipeVolumeGal)}
            onChange={(e) =>
              updateZone(sysId, zone.id, {
                pipeVolumeGal: fromNumberInput(e.target.value) ?? null,
              })
            }
          />
        </div>
        <div className={styles.fieldBlock}></div>
        <div className={styles.fieldBlock}></div>{" "}
        <div className={styles.fieldBlock}></div>
        <div className={styles.fieldBlock}></div>
      </div>

      <div
        className={`${styles.section} ${styles["section--muted"]}`}
        data-tour="enclosure-table"
      >
        <div className={styles.resultsHeader}>Enclosure Input</div>

        {zone.enclosures.length === 0 ? (
          <div className={styles.muted} style={{ marginTop: 8 }}>
            <label>No enclosures yet.</label>
          </div>
        ) : (
          <EngineeredEnclosureTable
            sysId={sysId}
            zone={zone}
            highlights={highlights}
          />
        )}
      </div>

      <div className={styles.resultsGrid} data-tour="results-grid">
        <div className={`${styles.section} ${styles["section--muted"]}`}>
          <div className={styles.resultsHeader}>Enclosure Results</div>
          <EnclosureResultsTable
            sysId={sysId}
            zone={zone}
            highlights={highlights}
          />
        </div>
        <div className={`${styles.section} ${styles["section--muted"]}`}>
          <div className={styles.resultsHeader}>Zone Results</div>
          <ZoneResultsTable sysId={sysId} zone={zone} />
        </div>
      </div>
    </div>
  );
}

function EngineeredEnclosureTable({
  sysId,
  zone,
  highlights,
}: {
  sysId: string;
  zone: any;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { project, updateEnclosure, removeEnclosure } = useAppModel();
  const onNum = (v: string) => (isNaN(+v) ? 0 : +v);
  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const unitTemp = project.units === "metric" ? "C" : "F";

  return (
    <div className={styles.enclosureTableWrap}>
      <table className={styles.enclosureTable}>
        <colgroup>
          <col />
          <col style={{ width: 104 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: "22%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: 56 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Enclosure Name</th>
            <th>Volume ({unitVol})</th>
            <th>Temp (°{unitTemp})</th>
            <th>Design Method</th>
            <th>Nozzle Selection</th>
            <th>Style</th>
            <th style={{ width: 48 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {zone.enclosures.map((enc: Enclosure, idx: number) => {
            const method = enc.designMethod as MethodName;
            const nozzleOptions = getNozzlesForMethod(method);
            const styleOptions = enc.nozzleModel
              ? getStylesFor(method, enc.nozzleModel)
              : [];
            const hl = highlights.encLevel.get(enc.id) ?? null;
            const rowClass =
              hl === "error"
                ? styles.encRowError
                : hl === "warn"
                  ? styles.encRowWarn
                  : "";

            return (
              <tr key={enc.id} className={rowClass}>
                <td id={`enc-${enc.id}`}>
                  <input
                    className={styles.inputMd}
                    maxLength={30}
                    value={enc.name ?? ""}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        name: e.target.value,
                      })
                    }
                    data-tour={`enc-name-${idx + 1}`}
                  />{" "}
                </td>
                <td>
                  <input
                    type="number"
                    step={1}
                    className={styles.inputSm}
                    value={toInputValue(enc.volumeFt3)}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        volumeFt3: fromNumberInput(e.target.value),
                      })
                    }
                  />
                </td>

                <td>
                  <input
                    type="number"
                    step={1}
                    className={styles.inputXs}
                    value={toInputValue(enc.temperatureF)}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        temperatureF: fromNumberInput(e.target.value),
                      })
                    }
                  />
                </td>

                <td>
                  <div className={styles.selectWithPill}>
                    <select
                      className={styles.inputControl}
                      value={enc.designMethod ?? ""}
                      onChange={(e) => {
                        const m = e.target.value as MethodName;
                        // reset nozzle/style on method change
                        updateEnclosure(sysId, zone.id, enc.id, {
                          designMethod: m,
                          nozzleModel: pickDefaultNozzle(m),
                          nozzleOrientation: undefined,
                        });
                      }}
                    >
                      {[
                        "NFPA 770 Class A/C",
                        "NFPA 770 Class B",
                        "FM Data Centers",
                        "FM Machine Spaces/Turbines",
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>

                <td>
                  <select
                    className={styles.inputControl}
                    value={enc.nozzleModel ?? ""}
                    onChange={(e) => {
                      const method = enc.designMethod as MethodName;
                      const nz = e.target.value as NozzleCode;
                      const st = pickStyleOrUndef(method, nz);
                      updateEnclosure(sysId, zone.id, enc.id, {
                        nozzleModel: nz || undefined,
                        nozzleOrientation: st,
                      });
                    }}
                  >
                    {nozzleOptions.map((n) => (
                      <option key={n.code} value={n.code}>
                        {getNozzleLabel(method, n.code)}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <select
                    className={styles.inputControl}
                    value={enc.nozzleOrientation ?? ""}
                    onChange={(e) => {
                      const method = enc.designMethod as MethodName;
                      const nz = (enc.nozzleModel || "") as NozzleCode;
                      const styles = getStylesFor(method, nz);
                      const chosen = e.target.value as EmitterStyleKey;
                      // Guard against invalid pick (e.g., user had devtools open)
                      updateEnclosure(sysId, zone.id, enc.id, {
                        nozzleOrientation: styles.includes(chosen)
                          ? chosen
                          : styles[0],
                      });
                    }}
                    disabled={!enc.nozzleModel}
                  >
                    {styleOptions.length === 0 ? (
                      <option value="">(no styles)</option>
                    ) : (
                      styleOptions.map((s: string) => (
                        <option key={s} value={s}>
                          {getStyleLabel(s as any)}
                        </option>
                      ))
                    )}
                  </select>
                </td>

                <td>
                  <button
                    className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`}
                    onClick={() => {
                      if (confirm("Remove this enclosure?"))
                        removeEnclosure(sysId, zone.id, enc.id);
                    }}
                    title="Remove Enclosure"
                    aria-label="Remove enclosure"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Results tables (shared) */

function EnclosureResultsTable({
  sysId,
  zone,
  highlights,
}: {
  sysId: string;
  zone: any;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { updateEnclosure } = useAppModel();

  return (
    <div className={styles.resultsTableWrap}>
      <table className={`${styles.resultsTable} ${styles.enclosureResults}`}>
        <thead>
          <tr>
            <th>Enclosure</th>
            <th title="Minimum Nozzles">Min. Nozzles</th>
            <th title="Flow Cartridge">Flow Cartridge Selection</th>
            <th title="Estimated Discharge Time">Est. Design Discharge Time</th>
            <th title="Estimated Final O₂">Est. Final O₂</th>
          </tr>
        </thead>
        <tbody>
          {zone.enclosures.map((enc: Enclosure, idx: number) => {
            const calcMinEmitters =
              enc.requiredNozzleCount ?? enc.requiredNozzleCount ?? null;
            const isEditing = !!enc.isNozzleCountOverridden;
            const displayEmitters =
              enc.customNozzleCount ?? calcMinEmitters ?? 0;
            const hl = highlights.encLevel.get(enc.id) ?? null;
            const rowClass =
              hl === "error"
                ? styles.encRowError
                : hl === "warn"
                  ? styles.encRowWarn
                  : "";
            return (
              <tr key={enc.id} className={rowClass}>
                <td>{formatIndexedName("Enclosure", idx + 1, enc.name)}</td>
                <td className={styles.center}>
                  <input
                    type="checkbox"
                    checked={isEditing}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        isNozzleCountOverridden: e.target.checked,
                        // if turning off, drop the override
                        ...(e.target.checked
                          ? {}
                          : { customNozzleCount: null }),
                      })
                    }
                    title="Enable custom nozzle count"
                    style={{ marginRight: 8 }}
                  />
                  <input
                    className={`${styles.inputNumSm}`}
                    type="number"
                    value={toInputValue(displayEmitters)}
                    onChange={(e) => {
                      const val = fromEditableNumber(e.target.value);
                      updateEnclosure(sysId, zone.id, enc.id, {
                        customNozzleCount:
                          val === "" ? enc.customNozzleCount : val,
                      });
                    }}
                    disabled={!isEditing}
                    style={{ width: 72, textAlign: "right" }}
                  />
                </td>
                <td className={styles.center}>{enc.flowCartridge ?? "—"}</td>
                <td className={styles.center}>
                  {enc.estimatedDischargeDuration ?? "—"}
                </td>
                <td className={styles.center}>
                  {enc.estimatedFinalOxygenPercent ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ZoneResultsTable({ sysId, zone }: { sysId: string; zone: Zone }) {
  const { project, updateZone } = useAppModel();
  const unitVol = project.units === "metric" ? "m³" : "ft³";

  const totalVolume = (zone.enclosures ?? []).reduce(
    (sum: number, e: any) => sum + (Number(e.volumeFt3) || 0),
    0,
  );
  const calcMinCyl = zone.requiredCylinderCount ?? null;
  const editCyl = !!zone.isCylinderCountOverridden;
  const displayCyl = zone.customCylinderCount ?? calcMinCyl ?? 0;
  const system = project.systems.find((s) => s.id === sysId);
  const bulkOn = !!(system?.options as any)?.usesBulkTubes;
  const requiredOpen = Number(zone.bulkValveOpenTimeMinRequired);
  const requiredOpenDisplay = Number.isFinite(requiredOpen) ? requiredOpen : 0;
  const minWaterTankReq = zone.minWaterTankCapacityGal;

  const editOpen = !!zone.isBulkValveOpenTimeOverridden;

  const tOpen = Number(zone.bulkValveOpenTimeMin);
  const tOpenDisplay = Number.isFinite(tOpen) ? tOpen : requiredOpenDisplay;

  return (
    <div className={styles.resultsTableWrap}>
      <table className={`${styles.resultsTable} ${styles.zoneResults}`}>
        <thead>
          <tr>
            <th colSpan={2}>Zone Totals</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.kvLabel}>Total Volume</td>
            <td className={styles.kvValue}>
              {totalVolume.toLocaleString(undefined, {
                maximumFractionDigits: project.units === "metric" ? 3 : 0,
              })}{" "}
              {unitVol}
            </td>
          </tr>

          {bulkOn ? (
            <tr>
              <td className={styles.kvLabel}>
                Bulk Tube Valve Open Time (min)
              </td>
              <td
                className={`${styles.kvValue} ${styles.kvRowRight}`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  checked={editOpen}
                  onChange={(e) =>
                    updateZone(sysId, zone.id, {
                      isBulkValveOpenTimeOverridden: e.target.checked,
                      ...(e.target.checked
                        ? {}
                        : { bulkValveOpenTimeMin: requiredOpenDisplay }),
                    })
                  }
                  title="Enable custom valve open time (can only increase)"
                />

                <input
                  className={styles.inputNumSm}
                  type="number"
                  step={0.01}
                  min={requiredOpenDisplay}
                  value={toInputValue(tOpenDisplay)}
                  onChange={(e) =>
                    updateZone(sysId, zone.id, {
                      bulkValveOpenTimeMin: fromNumberInput(e.target.value),
                    })
                  }
                  disabled={!editOpen}
                  style={{ width: 84, textAlign: "right" }}
                  title={
                    editOpen
                      ? `Minimum allowed: ${requiredOpenDisplay} min`
                      : `Auto = ${requiredOpenDisplay} min (enable checkbox to increase)`
                  }
                />
              </td>
            </tr>
          ) : (
            <tr>
              <td className={styles.kvLabel}>Number of Cylinders</td>
              <td
                className={`${styles.kvValue} ${styles.kvRowRight}`}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  checked={editCyl}
                  onChange={(e) =>
                    updateZone(sysId, zone.id, {
                      isCylinderCountOverridden: e.target.checked,
                      ...(e.target.checked
                        ? {}
                        : { customCylinderCount: null }),
                    })
                  }
                  title="Enable custom cylinder count"
                />
                <input
                  className={styles.inputNumSm}
                  type="number"
                  value={toInputValue(displayCyl)}
                  onChange={(e) => {
                    const val = fromEditableNumber(e.target.value);
                    updateZone(sysId, zone.id, {
                      customCylinderCount:
                        val === "" ? zone.customCylinderCount : val,
                    });
                  }}
                  disabled={!editCyl}
                  style={{ width: 84, textAlign: "right" }}
                />
              </td>
            </tr>
          )}

          <tr>
            <td className={styles.kvLabel}>Total N₂ Required</td>
            <td className={styles.kvValue}>
              {typeof zone.nitrogenRequiredScf === "number"
                ? `${Math.round(zone.nitrogenRequiredScf).toLocaleString()} SCF`
                : "—"}
            </td>
          </tr>

          <tr>
            <td className={styles.kvLabel}>Total N₂ Delivered</td>
            <td className={styles.kvValue}>
              {typeof zone.nitrogenDeliveredScf === "number"
                ? `${Math.round(zone.nitrogenDeliveredScf).toLocaleString()} SCF`
                : "—"}
            </td>
          </tr>
          <tr>
            <td className={styles.kvLabel}>Min. Water Tank Requirement</td>
            <td className={styles.kvValue}>
              {typeof zone?.minWaterTankCapacityGal === "number"
                ? `${Math.ceil(
                  zone.minWaterTankCapacityGal,
                ).toLocaleString()} gal / ${Math.ceil(
                  (zone.minWaterTankCapacityGal || 0) * 3.78541,
                ).toLocaleString()} L`
                : "—"}
            </td>
          </tr>

          <tr>
            <td className={styles.kvLabel}>Number of Panels</td>
            <td className={styles.kvValue}>
              {(() => {
                const q = (zone?.panelSizing?.qty ?? 0) as number;
                return Number.isFinite(q) ? q.toLocaleString() : "—";
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* PRE-ENGINEERED */

function PreZoneBlock({
  sys,
  highlights,
}: {
  sys: any;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { addZone, addEnclosure, updateZone } = useAppModel();
  const zone = sys.zones[0];

  React.useEffect(() => {
    if (!zone) {
      addZone(sys.id);
      return;
    }
    if (!zone.enclosures || zone.enclosures.length === 0) {
      addEnclosure(sys.id, zone.id);
    }
  }, [sys.id, zone?.id]); // eslint-disable-line

  if (!sys.zones[0]) return null;

  const zoneHl = highlights.zoneLevel.get(sys.zones[0].id) ?? null;
  const zoneHlClass =
    zoneHl === "error"
      ? styles.zoneCardError
      : zoneHl === "warn"
        ? styles.zoneCardWarn
        : "";

  return (
    <div
      id={`zone-${sys.zones[0].id}`}
      className={`${styles.zoneCard} ${styles["stack-tight"] ?? ""} ${zoneHlClass}`}
    >
      <div className={styles.zoneHeader}>
        <label className={styles.labelGroup}>
          Zone Name:&nbsp;
          <input
            value={sys.zones[0].name}
            onChange={(e) =>
              updateZone(sys.id, sys.zones[0].id, { name: e.target.value })
            }
            className={styles.inputMd}
          />
        </label>
      </div>

      <div className={`${styles.section} ${styles["section--muted"]}`}>
        <div className={styles.resultsHeader}>Enclosure Input</div>
        <PreInputTable
          sysId={sys.id}
          zone={sys.zones[0]}
          highlights={highlights}
        />
      </div>

      <div className={styles.resultsGrid}>
        <div className={`${styles.section} ${styles["section--muted"]}`}>
          <PreEnclosureGuidance zone={sys.zones[0]} />
        </div>
        <div className={`${styles.section} ${styles["section--muted"]}`}>
          <div className={styles.resultsHeader}>Nozzle Layout Preview</div>
          <EmitterImagePanel zone={sys.zones[0]} />
        </div>
      </div>
    </div>
  );
}

function EmitterImagePanel({ zone }: { zone: any }) {
  // Pre-eng is single-enclosure; use the first
  const enc = zone?.enclosures?.[0] ?? null;

  // Prefer the computed minimum emitters; fall back to any existing count
  const raw = enc?.requiredNozzleCount ?? enc?.requiredNozzleCount;
  const emitters = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;

  // Guard: if nothing calculated yet, show a helpful note
  if (!emitters || emitters < 0) {
    return (
      <div className={styles.muted}>
        Run Calculate to determine nozzles and preview the recommended nozzle
        layout.
      </div>
    );
  }

  // Images live in /public; filenames are "1.png", "2.png", ...
  const src = `/img/nozzles/${emitters}.png`;
  const alt = `${emitters} nozzle${emitters === 1 ? "" : "s"} layout preview`;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className={styles.mutedSm}>
        Displaying preview for <strong>{emitters}</strong> nozzle
        {emitters === 1 ? "" : "s"}.
      </div>
      <div
        style={{
          border: "1px solid #e3e6ef",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "contain",
            maxHeight: 360,
            background: "#fff",
          }}
          onError={(e) => {
            // Friendly fallback if an image for this count doesn't exist
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    </div>
  );
}

function PreInputTable({
  sysId,
  zone,
  highlights,
}: {
  sysId: string;
  zone: any;
  highlights: ReturnType<typeof buildHighlights>;
}) {
  const { project, updateEnclosure } = useAppModel();
  const system = project.systems.find((s) => s.id === sysId);
  const preOpts = (system?.options as any) ?? {};
  const locked = !!preOpts.systemPartCodeLocked;
  const showDash = locked;

  const unitLen = project.units === "metric" ? "m" : "ft";
  const unitTemp = project.units === "metric" ? "C" : "F";
  const unitVol = project.units === "metric" ? "m³" : "ft³";

  const enc = zone.enclosures[0] ?? {};
  const hl = highlights.encLevel.get(enc.id) ?? null;
  const rowClass =
    hl === "error"
      ? styles.encRowError
      : hl === "warn"
        ? styles.encRowWarn
        : "";

  const onNum = (v: string) => (isNaN(+v) ? 0 : +v);

  const method = (enc.designMethod ?? "NFPA 770 Class A/C") as MethodName;
  const nozzleOptions = getNozzlesForMethod(method, {
    systemType: "preengineered",
  });
  const styleOptions = enc.nozzleModel
    ? getStylesFor(method, enc.nozzleModel, { systemType: "preengineered" })
    : [];
  return (
    <div className={styles.enclosureTableWrap}>
      <table className={`${styles.enclosureTable} ${styles.preTable}`}>
        <colgroup>
          <col />
          <col style={{ width: 104 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: "18%" }} />
          <col style={{ width: "15%" }} />
        </colgroup>

        <thead>
          <tr>
            <th>Enclosure Name</th>
            <th>Volume ({unitVol})</th>
            <th>Temp (°{unitTemp})</th>
            <th>Design Method</th>
            <th>Nozzle Selection</th>
            <th>Style</th>
          </tr>
        </thead>
        <tbody>
          <tr className={rowClass}>
            <td id={`enc-${enc.id}`}>
              <input
                className={styles.inputMd}
                value={enc.name ?? ""}
                maxLength={30}
                onChange={(e) =>
                  updateEnclosure(sysId, zone.id, enc.id, {
                    name: e.target.value,
                  })
                }
              />
            </td>

            <td>
              <input
                type="number"
                step={1}
                className={styles.inputSm}
                value={showDash ? "" : toInputValue(enc.volumeFt3)}
                placeholder={showDash ? "—" : undefined}
                onChange={(e) =>
                  updateEnclosure(sysId, zone.id, enc.id, {
                    volumeFt3: fromNumberInput(e.target.value),
                  })
                }
                disabled={locked}
              />
            </td>

            <td>
              <input
                type="number"
                step={1}
                className={styles.inputXs}
                onChange={(e) =>
                  updateEnclosure(sysId, zone.id, enc.id, {
                    temperatureF: onNum(e.target.value),
                  })
                }
                value={showDash ? "" : (enc.temperatureF ?? 70)}
                placeholder={showDash ? "—" : undefined}
                disabled={locked}
              />
            </td>

            <td>
              <div className={styles.selectWithPill}>
                <select
                  value={enc.designMethod ?? "NFPA 770 Class A/C"}
                  className={styles.inputControl}
                  onChange={(e) => {
                    const m = e.target.value as MethodName;
                    const nz = pickDefaultNozzle(m, {
                      systemType: "preengineered",
                    }) as NozzleCode;
                    const st = pickStyleOrUndef(m, nz, {
                      systemType: "preengineered",
                    });
                    updateEnclosure(sysId, zone.id, enc.id, {
                      designMethod: m,
                      nozzleModel: nz || undefined,
                      nozzleOrientation: st,
                    });
                  }}
                  disabled={locked}
                >
                  {[
                    "NFPA 770 Class A/C",
                    "NFPA 770 Class B",
                    "FM Data Centers",
                  ].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </td>

            <td>
              <select
                className={styles.inputControl}
                value={enc.nozzleModel ?? ""}
                onChange={(e) => {
                  const method = (enc.designMethod ??
                    "NFPA 770 Class A/C") as MethodName;
                  const nz = e.target.value as NozzleCode;
                  const st = pickStyleOrUndef(method, nz, {
                    systemType: "preengineered",
                  });
                  updateEnclosure(sysId, zone.id, enc.id, {
                    nozzleModel: nz || undefined,
                    nozzleOrientation: st,
                  });
                }}
                disabled={locked}
              >
                {nozzleOptions.map((n) => (
                  <option key={n.code} value={n.code}>
                    {getNozzleLabel(method, n.code)}
                  </option>
                ))}
              </select>
            </td>

            <td>
              <select
                className={styles.inputControl}
                value={enc.nozzleOrientation ?? ""}
                onChange={(e) => {
                  const method = (enc.designMethod ??
                    "NFPA 770 Class A/C") as MethodName;
                  const nz = (enc.nozzleModel || "") as NozzleCode;
                  const styles = getStylesFor(method, nz, {
                    systemType: "preengineered",
                  });
                  const chosen = e.target.value as EmitterStyleKey;
                  updateEnclosure(sysId, zone.id, enc.id, {
                    nozzleOrientation: styles.includes(chosen)
                      ? chosen
                      : styles[0],
                  });
                }}
                disabled={!enc.nozzleModel || locked}
              >
                {styleOptions.length === 0 ? (
                  <option value="">(no styles)</option>
                ) : (
                  styleOptions.map((s: string) => (
                    <option key={s} value={s}>
                      {getStyleLabel(s as any)}
                    </option>
                  ))
                )}
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PreEnclosureGuidance({ zone }: { zone: any }) {
  const { project } = useAppModel();
  const enc = zone.enclosures?.[0];
  const g = computePreEngGuidance(enc, project);
  if (!g) return null;

  const openMax = fmtFt2AndM2(g.openMaxFt2);
  const openMin = fmtFt2AndM2(g.openMinFt2);
  const emitterSize = g.pendent.size;

  return (
    <>
      <div className={styles.resultsHeader}>Enclosure Requirements</div>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th>Opening</th>
            <th>Nozzle</th>
            <th>Allowable Opening Area</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.kvLabel}>Maximum Opening</td>
            <td>{emitterSize}</td>
            <td>
              {openMax.ft2} ft² / {openMax.m2} m²
            </td>
          </tr>
          <tr>
            <td className={styles.kvLabel}>Minimum Opening</td>
            <td>{emitterSize}</td>
            <td>
              {openMin.ft2} ft² / {openMin.m2} m²
            </td>
          </tr>
        </tbody>
      </table>

      <div className={styles.resultsHeader}>Spacing Requirements</div>
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Nozzle</th>
            <th>Between Nozzles</th>
            <th>Min to Wall</th>
            <th>Foil to Ceiling (A)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pendent</td>
            <td>{g.pendent.size}</td>
            <td>{g.pendent.distBetween}</td>
            <td>
              {g.pendent.minToWallFt} ft / {g.pendent.minToWallM} m
            </td>
            <td>
              {g.pendent.foilToCeilingIn[0]}–{g.pendent.foilToCeilingIn[1]} in{" "}
              <br></br> ({g.pendent.foilToCeilingMm[0]}–
              {g.pendent.foilToCeilingMm[1]} mm)
            </td>
          </tr>
          {g.sidewall && (
            <tr>
              <td>Sidewall</td>
              <td>{g.sidewall.size}</td>
              <td>{g.sidewall.distBetween}</td>
              <td>
                {g.sidewall.minToAdjWallFt} ft / {g.sidewall.minToAdjWallM} m
              </td>
              <td>—</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
