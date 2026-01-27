import Link from "next/link";
import React from "react";
import type { Step } from "react-joyride";

const STORAGE_KEY = "vv_tutorial_seen_v1";
export const TUTORIAL_VERSION = "v1";

export const tutorialSteps: Step[] = [
  {
    target: '[data-tour="introduction"]',
    content: (
      <div>
        <div style={{ opacity: 0.75 }}>
          <i>v{process.env.NEXT_PUBLIC_APP_VERSION}</i>
        </div>

        <div style={{ marginTop: 8 }}>
          Welcome to the{" "}
          <strong>Victaulic Vortex™ Project Configurator</strong>.
        </div>

        <div style={{ marginTop: 10 }}>
          In this tutorial, you’ll follow a typical{" "}
          <strong>engineered system</strong> workflow:
        </div>

        <div style={{ marginTop: 10, lineHeight: 1.6 }}>
          • Configure <strong>Zones</strong> and <strong>Enclosures</strong>
          <br />• Run <strong>Calculate</strong> to generate results
          <br />• Review and resolve <strong>Errors</strong> and{" "}
          <strong>Warnings</strong>
        </div>

        <div
          style={{
            marginTop: 12,
            borderRadius: 8,
            background: "rgba(255, 105, 0, 0.10)",
            border: "1px solid rgba(255, 105, 0, 0.25)",
            color: "#9a3412",
          }}
        >
          This release includes <strong>significant updates</strong>. Read each
          step before continuing.
        </div>

        <div style={{ marginTop: 10 }}>
          Any existing progress will be restored automatically after the
          tutorial. You can rerun this tutorial anytime from the{" "}
          <Link
            key="/guide"
            href="/guide"
            role="menuitem"
            style={{ textDecoration: "none", fontWeight: 800 }}
            target="_blank"
          >
            Guide
          </Link>
          .
        </div>

        <div style={{ marginTop: 10 }}>
          Project details are pre-filled on the left—let’s get started.
        </div>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="collapse-btn"]',
    content: (
      <div>
        <span style={{ fontWeight: 700, color: "#ff6900" }}>
          Collapse this panel
        </span>{" "}
        to create more workspace and continue.
      </div>
    ),
    placement: "right",
    hideFooter: true,
    hideCloseButton: true,
    disableBeacon: true,
    disableOverlayClose: true,
  },
  {
    target: '[data-tour="system-control"]',
    content: (
      <div>
        <div>
          Projects are built from <strong>Systems</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Engineered Systems</strong> organize protection into{" "}
          <strong>Zones</strong> that contain <strong>Enclosures</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Pre-Engineered Systems</strong> are a guided configuration
          intended to protect a <strong>single Enclosure</strong>.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="system-config"]',
    content: (
      <div>
        <div>
          Configure the system's <strong>core settings</strong> here.
        </div>

        <div style={{ marginTop: 8 }}>
          These selections affect <strong>downstream calculations</strong>,{" "}
          <strong>hardware requirements</strong>, and <strong>results</strong>.
        </div>
      </div>
    ),
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="system-addons"]',
    content: (
      <div>
        <div>
          Configure optional <strong>add-ons</strong> here.
        </div>

        <div style={{ marginTop: 8 }}>
          These selections affect included hardware and <strong>BOM</strong>{" "}
          outputs.
        </div>
      </div>
    ),
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="enclosure-table"]',
    content: (
      <div>
        <div>
          <strong>Enclosures</strong> are the foundation of system design.
        </div>

        <div style={{ marginTop: 8 }}>
          Each enclosure represents a protected space and drives{" "}
          <strong>oxygen</strong> and <strong>nitrogen supply</strong>{" "}
          calculations.
        </div>
      </div>
    ),
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="calculate-btn"]',
    content: (
      <div>
        <div>
          <span style={{ fontWeight: 700, color: "#ff6900" }}>
            Click Calculate
          </span>{" "}
          to run <strong>validation</strong> on the tutorial configuration.
        </div>

        <div style={{ marginTop: 8 }}>
          This checks inputs, applies <strong>design logic</strong>, and
          generates <strong>status messages</strong>.
        </div>
      </div>
    ),
    placement: "bottom",
    hideFooter: true,
    hideCloseButton: true,
    disableBeacon: true,
    disableOverlayClose: true,
  },
  {
    target: '[data-tour="status-console"]',
    content: (
      <div>
        <div>
          The <strong>Status Console</strong> shows{" "}
          <strong>validation results</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          Resolve <strong>Errors</strong> before outputs are valid.{" "}
          <strong>Warnings</strong> highlight design limits or assumptions to
          review.
        </div>
      </div>
    ),
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="status-msg-1"]',
    content: (
      <div>
        <div>
          This is an <strong>Error</strong>. The enclosure is missing a{" "}
          <strong>required name</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Errors</strong> block valid outputs until{" "}
          <strong>resolved</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          <span style={{ fontWeight: 700, color: "#ff6900" }}>
            Click the message
          </span>{" "}
          to jump to the affected field.
          <br />
          <span style={{ fontWeight: 700, color: "#ff6900" }}>
            Click the blue error code
          </span>{" "}
          for additional guidance.
        </div>
      </div>
    ),
    placement: "left",
    hideFooter: true,
    hideCloseButton: true,
    disableBeacon: true,
    disableOverlayClose: true,
  },
  {
    target: '[data-tour="enc-name-2"]',
    content: (
      <div>
        <div>
          <span style={{ fontWeight: 700, color: "#ff6900" }}>
            Enter a name
          </span>{" "}
          for this enclosure.
        </div>

        <div style={{ marginTop: 8 }}>
          Then{" "}
          <span style={{ fontWeight: 700, color: "#ff6900" }}>click Next</span>{" "}
          to continue.
        </div>
      </div>
    ),
    placement: "top",
    disableBeacon: true,
    disableOverlayClose: true,
  },
  {
    target: '[data-tour="calculate-btn"]',
    content: (
      <div>
        <div>
          After fixing an issue,{" "}
          <span style={{ fontWeight: 700, color: "#ff6900" }}>
            click Calculate again
          </span>{" "}
          to refresh <strong>validation</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          This updates the <strong>Status Console</strong>.
        </div>
      </div>
    ),
    placement: "bottom",
    hideFooter: true,
    hideCloseButton: true,
    disableBeacon: true,
    disableOverlayClose: true,
  },
  {
    target: '[data-tour="status-msg-2"]',
    content: (
      <div>
        <div style={{ marginTop: 8 }}>
          This is a <strong>Warning</strong>. The{" "}
          <strong>estimated design discharge time</strong> is below the{" "}
          <strong>NFPA target</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Warnings</strong> do not block outputs—but they flag
          conditions that may require design adjustment or justification.
        </div>
      </div>
    ),
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="results-grid"]',
    content: (
      <div>
        <div>
          Review calculated <strong>Enclosure and Zone results</strong> here.
        </div>

        <div style={{ marginTop: 8 }}>
          This table allows you to{" "}
          <strong>optionally override select quantities </strong>
          using the provided checkboxes.
        </div>

        <div style={{ marginTop: 8 }}>
          When changes are made, rerunning <strong>Calculate</strong> applies
          those updates across the system.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="system-results"]',
    content: (
      <div>
        <div>
          <strong>System results</strong> are displayed here.
        </div>

        <div style={{ marginTop: 8 }}>
          Required <strong>nitrogen</strong> and <strong>water storage</strong>{" "}
          are based on the <strong>zone with the greatest demand</strong> to
          ensure <strong>full system coverage</strong>.
        </div>
      </div>
    ),
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="est-vals"]',
    content: (
      <div>
        <div>
          The <strong>Estimated Values</strong> table calculates additional
          system components and <strong>FACP release and monitor points</strong>
          .
        </div>

        <div style={{ marginTop: 8 }}>
          Like <strong>nozzle</strong> and <strong>cylinder</strong> counts,
          these quantities can be adjusted to meet your design needs.
        </div>
      </div>
    ),
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tour="pricing-panel"]',
    content: (
      <div>
        <div>
          <strong>Pricing</strong> is generated from the calculated{" "}
          <strong>Bill of Materials (BOM)</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          It updates only after a successful calculation.
        </div>

        <div style={{ marginTop: 8 }}>
          <strong>Net Price</strong> reflects <strong>List Price</strong> with
          the selected <strong>multiplier</strong> applied.
        </div>
      </div>
    ),
    placement: "left",
    disableBeacon: true,
  },
  {
    target: '[data-tour="generate-bom-btn"]',
    content: (
      <div>
        <div>
          <strong>Generate BOM</strong> creates a{" "}
          <strong>project-level Bill of Materials</strong> that combines{" "}
          <strong>all systems</strong> within the project.
        </div>

        <div style={{ marginTop: 8 }}>
          The generated <strong>BOM</strong> reflects:
        </div>

        <div style={{ marginTop: 8 }}>
          • All selected <strong>configuration options</strong>
          <br />• All <strong>calculated quantities</strong>
          <br />• Aggregated materials across{" "}
          <strong>enclosures, zones, and systems</strong>
        </div>

        <div style={{ marginTop: 8 }}>
          Once generated, the{" "}
          <strong>BOM represents a finalized snapshot </strong>
          of the current project configuration and should not be modified
          directly.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="submit-btn"]',
    content: (
      <div>
        <div>
          <strong>Submit</strong> generates an <strong>email draft</strong> for
          review or processing.
        </div>

        <div style={{ marginTop: 8 }}>
          When submitting a real project, the{" "}
          <strong>project BOM output </strong>
          should be attached before sending.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="export-btn"]',
    content: (
      <div>
        <div>
          <strong>Save</strong> a single project file containing the{" "}
          <strong>full configuration</strong>.
        </div>

        <div style={{ marginTop: 8 }}>
          Saved files can be shared to review or troubleshoot an exact
          configuration—even if <strong>errors or warnings</strong> are present.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="import-btn"]',
    content: (
      <div>
        <div>
          <strong>Load</strong> a previously saved project file.
        </div>

        <div style={{ marginTop: 8 }}>
          This restores the <strong>full configuration</strong>, allowing you to
          review, modify, or continue work exactly where it left off.
        </div>
      </div>
    ),
    placement: "bottom",
    disableBeacon: true,
  },
];

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    const t = "__stor_test";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    return null;
  }
}

export function shouldRunTutorial(): boolean {
  const ls = safeStorage();
  if (!ls) return true;
  return ls.getItem(STORAGE_KEY) !== TUTORIAL_VERSION;
}

export function markTutorialSeen() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, TUTORIAL_VERSION);
  } catch {
    /* ignore */
  }
}

export function resetTutorial() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
