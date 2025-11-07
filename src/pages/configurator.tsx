import React from "react";
import Head from "next/head";
import styles from "@/styles/configurator.module.css";
import Navbar from "@/components/ui/NavBar";
import navStyles from "@/styles/navbar.module.css";
import StatusConsole from "@/components/ui/StatusConsole";
import PreEngPrereqModal, {
  shouldShowPreEngPrereq,
} from "@/components/ui/PreEngPrereqModal";

import { AppModelProvider, useAppModel } from "@/state/app-model";
import SystemOptionsPanel from "@/components/features/systems/SystemOptionsPanel";

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

// normalize the catalog’s "" default to undefined
function pickStyleOrUndef(
  method: MethodName,
  nozzle: NozzleCode | undefined,
  opts?: { systemType?: "engineered" | "preengineered" }
): EmitterStyleKey | undefined {
  if (!nozzle) return undefined;
  const s = pickDefaultStyle(method, nozzle, opts);
  return (s || undefined) as EmitterStyleKey | undefined;
}

/** Convert model value -> input value. Blank if undefined/null. */
export function toInputValue(v: number | null | undefined): string | number {
  return v ?? "";
}

/** Convert input value -> model value.
 * Returns undefined when the field is blank or mid-typing ("-", ".", "-.").
 */
export function fromNumberInput(raw: string): number | undefined {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.")
    return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function fromEditableNumber(raw: string): number | "" {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

/* ───────────────────────────────
   PAGE
   ─────────────────────────────── */

export default function ConfiguratorPage() {
  return (
    <AppModelProvider>
      <Navbar />
      <Head>
        <title>Victaulic Vortex™ | Configurator</title>
      </Head>
      <div className={navStyles.navSpacer} />
      <Scaffold />
    </AppModelProvider>
  );
}

function Scaffold() {
  const { project, addSystem, clearProject, runCalculateAll } = useAppModel();
  const [showPreModal, setShowPreModal] = React.useState(false);

  // 🔹 Listen for Enter globally
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // optional: ignore if focused in a textarea, select, or button
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isTextInput =
        tag === "input" || tag === "select" || tag === "textarea";

      if (e.key === "Enter" && isTextInput) {
        // prevent default form submission behavior
        e.preventDefault();
        runCalculateAll();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [runCalculateAll]);
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
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* LEFT */}
        <div className={`${styles.leftCol} ${styles.sticky}`}>
          <PricePanel />
          <ProjectOptionsCard />
        </div>

        {/* MIDDLE */}
        <div className={styles.midCol}>
          <h1 className={styles.builderTitle}>Project Builder</h1>

          <div className={styles.addBar}>
            <button
              className={`${styles.btn} ${styles.btnSoft} ${styles.btnSoftEng}`}
              onClick={onAddEngineered}
            >
              + Add Engineered System
            </button>
            <button
              className={`${styles.btn} ${styles.btnSoft} ${styles.btnSoftPre}`}
              onClick={onAddPreClick}
            >
              + Add Pre-Engineered System
            </button>{" "}
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={clearProject}
              title="Reset the entire project"
              style={{ marginLeft: "auto" }}
            >
              Clear Project
            </button>
          </div>
          <PreEngPrereqModal
            open={showPreModal}
            onCancel={() => setShowPreModal(false)}
            onProceed={onProceedPre}
          />

          {project.systems.map((sys) => (
            <SystemCard key={sys.id} sys={sys} />
          ))}
        </div>

        {/* RIGHT */}
        <div className={`${styles.rightCol}`}>
          <StatusConsole />
          <FunctionButtons />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────
   LEFT: PRICING + PROJECT OPTIONS
   ─────────────────────────────── */

function PricePanel() {
  const { project, projectListPrice, updateProject } = useAppModel();

  const currency = project.currency || "USD";
  const listPriceNum =
    projectListPrice == null ? null : Number(projectListPrice) || 0;

  const multiplier =
    typeof project.customerMultiplier === "number"
      ? project.customerMultiplier
      : 1;

  const listPrice =
    listPriceNum == null
      ? "—"
      : listPriceNum.toLocaleString(undefined, {
          style: "currency",
          currency,
        });

  const netPriceStr =
    listPriceNum == null
      ? "—"
      : (listPriceNum * multiplier).toLocaleString(undefined, {
          style: "currency",
          currency,
        });

  const onMultiplierChange = (raw: string) => {
    let v = parseFloat(raw);
    if (Number.isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    // keep two decimals consistent with step=0.01
    updateProject({ customerMultiplier: Math.round(v * 100) / 100 });
  };

  return (
    <section className={`${styles.section} ${styles.priceCard}`}>
      <h3 className={styles.priceTitle}>Pricing</h3>

      <div className={styles.priceRow}>
        <span>List Price:</span>
        <span className={styles.priceValue}>{listPrice}</span>
      </div>
      <div className={styles.priceRow}>
        <span>Net Price:</span>
        <span className={styles.priceValue}>{netPriceStr}</span>
      </div>

      <div className={styles.priceRow}>
        <label htmlFor="cust-mult" title="0.00–1.00">
          Multiplier:
        </label>
        <input
          id="cust-mult"
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={toInputValue(multiplier)}
          onChange={(e) => onMultiplierChange(e.target.value)}
          className={styles.inputXs}
          style={{ textAlign: "right" }}
        />
      </div>
    </section>
  );
}

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

        <label className={styles.poLabel}>Currency</label>
        <select
          className={styles.poControl}
          value={project.currency}
          onChange={(e) => updateProject({ currency: e.target.value as any })}
        >
          <option value="USD">USD (US Dollar)</option>
          <option value="EUR">EUR (Euro)</option>
          <option value="GBP">GBP (British Pound)</option>
        </select>

        <label className={styles.poLabel}>Units</label>
        <select
          className={styles.poControl}
          value={project.units}
          onChange={(e) => updateProject({ units: e.target.value as any })}
        >
          <option value="imperial">Imperial (ft, °F)</option>
          <option value="metric">Metric (m, °C)</option>
        </select>

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
      </div>
    </section>
  );
}

/* ───────────────────────────────
   MIDDLE: SYSTEMS
   ─────────────────────────────── */

function SystemCard({ sys }: { sys: any }) {
  const { updateSystem, removeSystem, addZone, changeSystemType } =
    useAppModel();
  const isPre = sys.type === "preengineered";

  return (
    <section
      id={`sys-${sys.id}`}
      className={`${styles.sysCard} ${
        isPre ? styles["sysCard--pre"] : styles["sysCard--eng"]
      }`}
    >
      {/* Slim colored header band + system badge */}
      <div className={styles.sysHeader}>
        <span
          className={`${styles.sysBadge} ${
            isPre ? styles["sysBadge--pre"] : styles["sysBadge--eng"]
          }`}
        >
          {isPre ? "Pre-Engineered" : "Engineered"}
        </span>
      </div>

      <div className={styles.controlsRow}>
        <label>
          System Name:&nbsp;
          <input
            value={sys.name}
            onChange={(e) => updateSystem(sys.id, { name: e.target.value })}
            className={styles.inputMd}
          />
        </label>

        <label>
          Type:&nbsp;
          <select
            value={sys.type}
            onChange={(e) => changeSystemType(sys.id, e.target.value as any)}
          >
            <option value="engineered">Engineered</option>
            <option value="preengineered">Pre-Engineered</option>
          </select>
        </label>

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

      <SystemOptionsPanel systemId={sys.id} />

      {isPre ? (
        <PreZoneBlock sys={sys} />
      ) : sys.zones.length === 0 ? (
        <div className={styles.muted} style={{ margin: "12px 0" }}>
          <label>No zones yet.</label>
        </div>
      ) : (
        sys.zones.map((z: any, zi: number) => (
          <ZoneCard key={z.id} sysId={sys.id} zone={z} index={zi + 1} />
        ))
      )}
    </section>
  );
}

/* ENGINEERED: Zone + Tables */

function ZoneCard({
  sysId,
  zone,
  index,
}: {
  sysId: string;
  zone: any;
  index: number;
}) {
  const { updateZone, removeZone, addEnclosure, project } = useAppModel();

  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const totalVolume = (zone.enclosures ?? []).reduce(
    (sum: number, e: any) => sum + (Number(e.volume) || 0),
    0
  );

  return (
    <div
      id={`zone-${zone.id}`}
      className={`${styles.zoneCard} ${styles["stack-tight"] ?? ""}`}
    >
      <div className={styles.zoneHeader}>
        <label>
          &nbsp;Zone Name:&nbsp;
          <input
            value={zone.name}
            onChange={(e) =>
              updateZone(sysId, zone.id, { name: e.target.value })
            }
            className={styles.inputMd}
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

      {/* Quick zone metrics */}
      {/* <div className={styles.zoneMeta}>
        <span className={styles.badge}>
          Enclosures: {(zone.enclosures ?? []).length}
        </span>
        <span className={styles.badge}>
          Total Volume:&nbsp;
          {totalVolume.toLocaleString(undefined, {
            maximumFractionDigits: project.units === "metric" ? 3 : 0,
          })}
          {unitVol}
        </span>
      </div> */}

      {/* INPUT */}
      <div className={`${styles.section} ${styles["section--muted"]}`}>
        <strong className={styles.resultsHeader}>Input</strong>
        {zone.enclosures.length === 0 ? (
          <div className={styles.muted} style={{ marginTop: 8 }}>
            <label>No enclosures yet.</label>
          </div>
        ) : (
          <EngineeredEnclosureTable sysId={sysId} zone={zone} />
        )}
      </div>

      <div className={styles.resultsGrid}>
        <div className={`${styles.section} ${styles["section--ok"]}`}>
          <div className={styles.resultsHeader}>Enclosure Results</div>
          <EnclosureResultsTable sysId={sysId} zone={zone} />
        </div>
        <div className={`${styles.section} ${styles["section--ok"]}`}>
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
}: {
  sysId: string;
  zone: any;
}) {
  const { project, updateEnclosure, removeEnclosure } = useAppModel();
  const onNum = (v: string) => (isNaN(+v) ? 0 : +v);
  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const unitTemp = project.units === "metric" ? "C" : "F";

  return (
    <div className={styles.enclosureTableWrap}>
      <table className={styles.enclosureTable}>
        <colgroup>
          <col style={{ width: 44 }} />
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
            <th style={{ width: 1 }}>#</th>
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
          {zone.enclosures.map((enc: any, idx: number) => {
            const method = enc.method as MethodName;
            const nozzleOptions = getNozzlesForMethod(method);
            const styleOptions = enc.nozzleCode
              ? getStylesFor(method, enc.nozzleCode)
              : [];
            return (
              <tr key={enc.id} id={`enc-${enc.id}`}>
                <td className={styles.encIndexCell}>{idx + 1}</td>

                <td>
                  <input
                    className={styles.inputMd}
                    maxLength={30}
                    value={enc.name ?? ""}
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
                    value={toInputValue(enc.volume)}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        volume: fromNumberInput(e.target.value),
                      })
                    }
                  />
                </td>

                <td>
                  <input
                    type="number"
                    step={1}
                    className={styles.inputXs}
                    value={toInputValue(enc.tempF)}
                    onChange={(e) =>
                      updateEnclosure(sysId, zone.id, enc.id, {
                        tempF: fromNumberInput(e.target.value),
                      })
                    }
                  />
                </td>

                <td>
                  <div className={styles.selectWithPill}>
                    <select
                      value={enc.method}
                      onChange={(e) => {
                        const m = e.target.value as MethodName;
                        const nz = pickDefaultNozzle(m) as NozzleCode; // engineered
                        const st = pickStyleOrUndef(m, nz);
                        updateEnclosure(sysId, zone.id, enc.id, {
                          method: m,
                          nozzleCode: nz || undefined,
                          emitterStyle: st,
                        });
                      }}
                    >
                      {[
                        "NFPA 770 Class A/C",
                        "NFPA 770 Class B",
                        "FM Data Centers",
                        "FM Turbines",
                        "FM Machine Spaces",
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
                    className={styles.nozzleSelect}
                    value={enc.nozzleCode ?? ""}
                    onChange={(e) => {
                      const method = enc.method as MethodName;
                      const nz = e.target.value as NozzleCode;
                      const st = pickStyleOrUndef(method, nz);
                      updateEnclosure(sysId, zone.id, enc.id, {
                        nozzleCode: nz || undefined,
                        emitterStyle: st,
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
                    className={styles.styleSelect}
                    value={enc.emitterStyle ?? ""}
                    onChange={(e) => {
                      const method = enc.method as MethodName;
                      const nz = (enc.nozzleCode || "") as NozzleCode;
                      const styles = getStylesFor(method, nz);
                      const chosen = e.target.value as EmitterStyleKey;
                      // Guard against invalid pick (e.g., user had devtools open)
                      updateEnclosure(sysId, zone.id, enc.id, {
                        emitterStyle: styles.includes(chosen)
                          ? chosen
                          : styles[0],
                      });
                    }}
                    disabled={!enc.nozzleCode}
                  >
                    {styleOptions.length === 0 ? (
                      <option value="">(no styles)</option>
                    ) : (
                      styleOptions.map((s: string) => (
                        <option key={s} value={s}>
                          {s}
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

function EnclosureResultsTable({ sysId, zone }: { sysId: string; zone: any }) {
  const { updateEnclosure } = useAppModel();

  return (
    <table className={`${styles.resultsTable} ${styles.enclosureResults}`}>
      <thead>
        <tr>
          <th style={{ width: 44 }}>#</th>
          <th>Enclosure</th>
          <th title="Minimum Emitters">Min. Emitters</th>
          <th title="Estimated Discharge Time">Est. Discharge Time</th>
          <th title="Estimated Final O₂">Est. Final O₂</th>
        </tr>
      </thead>
      <tbody>
        {zone.enclosures.map((enc: any, idx: number) => {
          const calcMinEmitters = enc.minEmitters ?? enc.emitterCount ?? null;
          const isEditing = !!enc._editEmitters;
          const displayEmitters = enc.customMinEmitters ?? calcMinEmitters ?? 0;

          return (
            <tr key={enc.id}>
              <td className="center">{idx + 1}</td>
              <td>{enc.name ?? `Enclosure ${idx + 1}`}</td>
              <td className="center" style={{ whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={isEditing}
                  onChange={(e) =>
                    updateEnclosure(sysId, zone.id, enc.id, {
                      _editEmitters: e.target.checked,
                      // if turning off, drop the override
                      ...(e.target.checked ? {} : { customMinEmitters: null }),
                    })
                  }
                  title="Enable custom emitter count"
                  style={{ marginRight: 8 }}
                />
                <input
                  className={styles.controlXS}
                  type="number"
                  value={toInputValue(displayEmitters)}
                  onChange={(e) => {
                    const val = fromEditableNumber(e.target.value);
                    updateEnclosure(sysId, zone.id, enc.id, {
                      customMinEmitters:
                        val === "" ? enc.customMinEmitters : val,
                    });
                  }}
                  disabled={!isEditing}
                  style={{ width: 72, textAlign: "right" }}
                />
              </td>
              <td className="center">
                {enc.estDischarge ?? enc.estimatedDischarge ?? "—"}
              </td>
              <td className="center">{enc.estFinalO2 ?? enc.o2Final ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ZoneResultsTable({ sysId, zone }: { sysId: string; zone: any }) {
  const { project, updateZone } = useAppModel();
  const unitVol = project.units === "metric" ? "m³" : "ft³";

  const totalVolume = (zone.enclosures ?? []).reduce(
    (sum: number, e: any) => sum + (Number(e.volume) || 0),
    0
  );

  const calcMinCyl = zone.minTotalCylinders ?? null;
  const editCyl = !!zone._editCylinders;
  const displayCyl = zone.customMinTotalCylinders ?? calcMinCyl ?? 0;

  return (
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
            })}
            {unitVol}
          </td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Total N₂ Requirement</td>
          <td className={styles.kvValue}>{zone.totalNitrogen ?? "—"}</td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Number of Cylinders</td>
          <td
            className={styles.kvValue}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={editCyl}
              onChange={(e) =>
                updateZone(sysId, zone.id, {
                  _editCylinders: e.target.checked,
                  ...(e.target.checked
                    ? {}
                    : { customMinTotalCylinders: null }),
                })
              }
              title="Enable custom cylinder count"
            />
            <input
              className={styles.controlXS}
              type="number"
              value={toInputValue(displayCyl)}
              onChange={(e) => {
                const val = fromEditableNumber(e.target.value);
                updateZone(sysId, zone.id, {
                  customMinTotalCylinders:
                    val === "" ? zone.customMinTotalCylinders : val,
                });
              }}
              disabled={!editCyl}
              style={{ width: 84, textAlign: "right" }}
            />
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
  );
}

/* PRE-ENGINEERED */

function PreZoneBlock({ sys }: { sys: any }) {
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

  return (
    <div
      id={`zone-${sys.zones[0].id}`}
      className={`${styles.zoneCard} ${styles["stack-tight"] ?? ""}`}
    >
      <div className={styles.zoneHeader}>
        <label>
          &nbsp;Zone Name:&nbsp;
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
        <strong className={styles.resultsHeader}>Input</strong>
        <PreInputTable sysId={sys.id} zone={sys.zones[0]} />
      </div>

      <div className={styles.resultsGrid}>
        <div className={`${styles.section} ${styles["section--warn"]}`}>
          <PreEnclosureGuidance zone={sys.zones[0]} />
        </div>
        <div className={`${styles.section} ${styles["section--ok"]}`}>
          <div className={styles.resultsHeader}>Emitter Layout Preview</div>
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
  const emitters: number = (enc?.minEmitters ?? enc?.emitterCount ?? 0) | 0;

  // Guard: if nothing calculated yet, show a helpful note
  if (!emitters || emitters < 0) {
    return (
      <div className={styles.muted}>
        Run Calculate to determine emitters and preview the corresponding image.
      </div>
    );
  }

  // Images live in /public; filenames are "1.png", "2.png", ...
  const src = `/${emitters}.png`;
  const alt = `${emitters} emitter${emitters === 1 ? "" : "s"} layout preview`;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className={styles.mutedSm}>
        Displaying preview for <strong>{emitters}</strong> emitter
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

function PreInputTable({ sysId, zone }: { sysId: string; zone: any }) {
  const { project, updateEnclosure } = useAppModel();
  const unitLen = project.units === "metric" ? "m" : "ft";
  const unitTemp = project.units === "metric" ? "C" : "F";

  const enc = zone.enclosures[0] ?? {};
  const onNum = (v: string) => (isNaN(+v) ? 0 : +v);

  const method = (enc.method ?? "NFPA 770 Class A/C") as MethodName;
  const nozzleOptions = getNozzlesForMethod(method, {
    systemType: "preengineered",
  });
  const styleOptions = enc.nozzleCode
    ? getStylesFor(method, enc.nozzleCode, { systemType: "preengineered" })
    : [];
  const setDims = (
    patch: Partial<{ length: number; width: number; height: number }>
  ) => {
    const L = patch.length ?? enc.length ?? 0;
    const W = patch.width ?? enc.width ?? 0;
    const H = patch.height ?? enc.height ?? 0;
    updateEnclosure(sysId, zone.id, enc.id, {
      ...patch,
      length: L,
      width: W,
      height: H,
    });
  };

  return (
    <div className={styles.enclosureTableWrap}>
      <table className={`${styles.enclosureTable} ${styles.preTable}`}>
        <colgroup>
          <col style={{ width: 44 }} />
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 80 }} />
          <col />
          <col style={{ width: "18%" }} />
          <col style={{ width: "15%" }} />
        </colgroup>

        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>Enclosure Name</th>
            <th title="Length / Width / Height">L/W/H ({unitLen})</th>
            <th>Temp (°{unitTemp})</th>
            <th>Design Method</th>
            <th>Nozzle Selection</th>
            <th>Style</th>
          </tr>
        </thead>
        <tbody>
          <tr id={`enc-${enc.id}`}>
            <td className={styles.encIndexCell}>1</td>

            <td>
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

            <td className={styles.dimCell}>
              <div className={styles.dimStack}>
                <label className={styles.dimRow}>
                  <small>L</small>
                  <input
                    type="number"
                    step={1}
                    className={styles.dimInput}
                    value={toInputValue(enc.length)}
                    onChange={(e) =>
                      setDims({
                        length: fromNumberInput(e.target.value) as any,
                      })
                    }
                  />
                </label>
                <label className={styles.dimRow}>
                  <small>W</small>
                  <input
                    type="number"
                    step={1}
                    className={styles.dimInput}
                    value={toInputValue(enc.width)}
                    onChange={(e) =>
                      setDims({ width: fromNumberInput(e.target.value) as any })
                    }
                  />
                </label>
                <label className={styles.dimRow}>
                  <small>H</small>
                  <input
                    type="number"
                    step={1}
                    className={styles.dimInput}
                    value={toInputValue(enc.height)}
                    onChange={(e) =>
                      setDims({
                        height: fromNumberInput(e.target.value) as any,
                      })
                    }
                  />
                </label>
              </div>
            </td>

            <td>
              <input
                type="number"
                step={1}
                className={styles.inputXs}
                value={enc.tempF ?? 70}
                onChange={(e) =>
                  updateEnclosure(sysId, zone.id, enc.id, {
                    tempF: onNum(e.target.value),
                  })
                }
              />
            </td>

            <td>
              <div className={styles.selectWithPill}>
                <select
                  value={enc.method ?? "NFPA 770 Class A/C"}
                  onChange={(e) => {
                    const m = e.target.value as MethodName;
                    const nz = pickDefaultNozzle(m, {
                      systemType: "preengineered",
                    }) as NozzleCode;
                    const st = pickStyleOrUndef(m, nz, {
                      systemType: "preengineered",
                    });
                    updateEnclosure(sysId, zone.id, enc.id, {
                      method: m,
                      nozzleCode: nz || undefined,
                      emitterStyle: st,
                    });
                  }}
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
                className={styles.preNozzleSelect}
                value={enc.nozzleCode ?? ""}
                onChange={(e) => {
                  const method = (enc.method ??
                    "NFPA 770 Class A/C") as MethodName;
                  const nz = e.target.value as NozzleCode;
                  const st = pickStyleOrUndef(method, nz, {
                    systemType: "preengineered",
                  });
                  updateEnclosure(sysId, zone.id, enc.id, {
                    nozzleCode: nz || undefined,
                    emitterStyle: st,
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
                className={styles.preStyleSelect}
                value={enc.emitterStyle ?? ""}
                onChange={(e) => {
                  const method = (enc.method ??
                    "NFPA 770 Class A/C") as MethodName;
                  const nz = (enc.nozzleCode || "") as NozzleCode;
                  const styles = getStylesFor(method, nz, {
                    systemType: "preengineered",
                  });
                  const chosen = e.target.value as EmitterStyleKey;
                  updateEnclosure(sysId, zone.id, enc.id, {
                    emitterStyle: styles.includes(chosen) ? chosen : styles[0],
                  });
                }}
                disabled={!enc.nozzleCode}
              >
                {styleOptions.length === 0 ? (
                  <option value="">(no styles)</option>
                ) : (
                  styleOptions.map((s: string) => (
                    <option key={s} value={s}>
                      {s}
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

import {
  computePreEngGuidance,
  fmtFt2AndM2,
} from "@/core/calc/preengineered/guidance";

function PreSystemResults({ zone }: { zone: any }) {
  const { project } = useAppModel();
  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const enc = (zone.enclosures && zone.enclosures[0]) || {};

  const L = Number(enc.length) || 0;
  const W = Number(enc.width) || 0;
  const H = Number(enc.height) || 0;
  const totalVolume = +(L * W * H).toFixed(project.units === "metric" ? 3 : 0);

  const minEmitters = enc.minEmitters ?? enc.emitterCount ?? "—";
  const cylinders = enc.cylinderCount ?? "—";
  const estDischarge = enc.estDischarge ?? enc.estimatedDischarge ?? "—";
  const estO2 = enc.estFinalO2 ?? enc.o2Final ?? "—";

  return (
    <table className={styles.resultsTable}>
      <thead>
        <tr>
          <th colSpan={2}>System Totals</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={styles.kvLabel}>Total Volume</td>
          <td className={styles.kvValue}>
            {totalVolume.toLocaleString(undefined, {
              maximumFractionDigits: project.units === "metric" ? 3 : 0,
            })}
            {unitVol}
          </td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Minimum # Emitters</td>
          <td className={styles.kvValue}>{minEmitters}</td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Minimum # Cylinders</td>
          <td className={styles.kvValue}>{cylinders}</td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Cylinder Size @ Fill Pressure</td>
          <td className={styles.kvValue}>{enc._cylinderLabel ?? "—"}</td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Estimated Discharge Time</td>
          <td className={styles.kvValue}>{estDischarge}</td>
        </tr>
        <tr>
          <td className={styles.kvLabel}>Estimated Final O₂</td>
          <td className={styles.kvValue}>{estO2}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PreEnclosureGuidance({ zone }: { zone: any }) {
  const { project } = useAppModel();
  const enc = zone.enclosures?.[0];
  const g = computePreEngGuidance(enc, project);
  if (!g) return null;

  const openMax = fmtFt2AndM2(g.openMaxFt2);
  const openMin = fmtFt2AndM2(g.openMinFt2);

  return (
    <>
      <div className={styles.resultsHeader}>Enclosure Requirements</div>
      <table className={styles.resultsTable}>
        <tbody>
          <tr>
            <td className={styles.kvLabel}>Max Opening</td>
            <td>
              {openMax.ft2} ft² / {openMax.m2} m²
            </td>
          </tr>
          <tr>
            <td className={styles.kvLabel}>Min Opening</td>
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
            <th>Emitter</th>
            <th>Between Emitters</th>
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
              {g.pendent.foilToCeilingIn[0]}–{g.pendent.foilToCeilingIn[1]} in (
              {g.pendent.foilToCeilingMm[0]}–{g.pendent.foilToCeilingMm[1]} mm)
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

function FunctionButtons() {
  const {
    runCalculateAll, // or runCalculateAllAndPrice if you made a wrapper
    hasErrors,
    exportProjectToFile,
    triggerImportFilePicker,
    generateEngineeredBOM, // <- NEW
    project, // <- add this from your model
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

    // Use CRLF for widest mail client compatibility
    const body = lines.join("\r\n");

    const parts: string[] = [];
    if (cc) parts.push(`cc=${encodeURIComponent(cc)}`);
    parts.push(`subject=${encodeURIComponent(subject)}`);
    parts.push(`body=${encodeURIComponent(body)}`);

    const href = `mailto:${to}?${parts.join("&")}`;
    window.location.href = href;
  };
  return (
    <section className={styles.section}>
      <h3 style={{ marginTop: 0 }}>Actions</h3>
      <div className={styles.btnStack}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={runCalculateAll}
        >
          Calculate
        </button>
        <button
          className={styles.btn}
          disabled={hasErrors}
          onClick={generateEngineeredBOM}
        >
          Generate BOM
        </button>
        <button className={styles.btn} onClick={triggerImportFilePicker}>
          Import Project
        </button>
        <button className={styles.btn} onClick={exportProjectToFile}>
          Export Project
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
        >
          Submit Project
        </button>
      </div>
    </section>
  );
}
