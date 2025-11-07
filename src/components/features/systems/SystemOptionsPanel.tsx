// src/components/features/systems/SystemOptionsPanel.tsx
import React from "react";
import {
  useAppModel,
  EngineeredOptions,
  PreEngineeredOptions,
  FILL_PRESSURES,
  PRE_FILL_PRESSURES,
} from "@/state/app-model";
import styles from "@/styles/systemoptionspanel.module.css";
import type { WaterTankCert } from "@/core/catalog/water_tanks.catalog";
import cfg from "@/styles/configurator.module.css";

type Props = { systemId: string };

const WATER_CERT_OPTIONS: { value: WaterTankCert; label: string }[] = [
  { value: "US_ASME_FM", label: "ASME/FM" },
  { value: "US_ASME_CE_FM", label: "CE/ASME/FM" },
  { value: "CE_SS316L", label: "CE" },
];

function defaultCertForCurrency(curr: string | undefined): WaterTankCert {
  return curr === "USD" ? "US_ASME_FM" : "CE_SS316L";
}

export default function SystemOptionsPanel({ systemId }: { systemId: string }) {
  const { project, updateSystemOptions } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId)!;
  const opts = system.options;

  const isPre = opts.kind === "preengineered";
  const preFill = (opts as any).fillPressure as string | undefined;

  React.useEffect(() => {
    if (isPre && preFill && !PRE_FILL_PRESSURES.includes(preFill as any)) {
      updateSystemOptions(systemId, { fillPressure: PRE_FILL_PRESSURES[0] });
    }
  }, [isPre, preFill, systemId, updateSystemOptions]);

  const waterTankCert = (opts as any).waterTankCertification as
    | WaterTankCert
    | undefined;
  const legacyTank = (opts as any).waterTank as string | undefined;
  const defaultCert = defaultCertForCurrency(project.currency);

  React.useEffect(() => {
    if (waterTankCert) return;
    const mapped =
      legacyTank === "ASME/FM"
        ? ("US_ASME_FM" as any)
        : legacyTank === "CE/ASME/FM"
          ? ("US_ASME_CE_FM" as any)
          : legacyTank === "CE"
            ? ("CE_SS316L" as any)
            : undefined;

    updateSystemOptions(systemId, {
      waterTankCertification: mapped ?? defaultCert,
    });
  }, [waterTankCert, legacyTank, defaultCert, systemId, updateSystemOptions]);

  return (
    <div className={styles.panel}>
      <strong className={styles.title}>
        {opts.kind === "engineered"
          ? "Engineered System Options"
          : "Pre-Engineered System Options"}
      </strong>

      {opts.kind === "engineered" ? (
        <EngineeredForm
          systemId={systemId}
          opts={opts}
          projectCurrency={project.currency}
          systemUnits={project.units} // ← was projectUnits
        />
      ) : (
        <PreForm
          systemId={systemId}
          opts={opts as PreEngineeredOptions}
          projectCurrency={project.currency}
        />
      )}
    </div>
  );
}

/* ------------ ENGINEERED ------------ */
function EngineeredForm({
  systemId,
  opts,
  projectCurrency,
  systemUnits,
}: {
  systemId: string;
  opts: EngineeredOptions;
  projectCurrency?: string;
  systemUnits: "imperial" | "metric";
}) {
  const { project } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId);
  const t = system?.systemTotals;
  const zoneNameById = (id?: string | null) =>
    system?.zones.find((z) => z.id === id)?.name || "—";

  const n = (x?: number | null) =>
    typeof x === "number" && Number.isFinite(x) ? x.toLocaleString() : "—";

  const { updateSystemOptions } = useAppModel();
  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);
  const unitVol = systemUnits === "metric" ? "(L)" : "(gal)";
  // --- helpers at top of EngineeredForm (just inside the component) ---
  const editMap = ((opts as any)._editEstimates ?? {}) as Record<
    string,
    boolean
  >;
  const setEdit = (k: keyof EngineeredOptions["estimates"], on: boolean) => {
    const next = { ...editMap, [k]: on };
    // when toggling OFF, drop the user override so calc uses computed
    const nextEst = on
      ? opts.estimates
      : { ...opts.estimates, [k]: undefined as any };
    updateSystemOptions(systemId, {
      _editEstimates: next as any,
      estimates: nextEst,
    } as any);
  };

  const setEst = (k: keyof EngineeredOptions["estimates"], v: number) =>
    updateSystemOptions(systemId, { estimates: { ...opts.estimates, [k]: v } });
  const waterTankDesc =
    ((opts as any).waterTankPick?.description as string | undefined) ?? "—";

  const galToL = (g?: number | null) =>
    typeof g === "number" && Number.isFinite(g) ? g * 3.78541 : null;

  const n0 = (x?: number | null) =>
    typeof x === "number" && Number.isFinite(x)
      ? Math.round(x).toLocaleString()
      : "—";

  // small row component
  return (
    <div className={styles.cols3}>
      {/* ───── Column 1: wider labels ───── */}
      <div className={styles.colLeft}>
        <label>Fill Pressure</label>
        <select
          className={styles.control}
          value={opts.fillPressure}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              fillPressure: e.target.value as any,
            })
          }
        >
          {FILL_PRESSURES.map((fp) => (
            <option key={fp} value={fp}>
              {fp}
            </option>
          ))}
        </select>

        <label>Refill Adapter</label>
        <select
          className={styles.control}
          value={opts.refillAdapter ?? ""}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              refillAdapter: (e.target.value || null) as any,
            })
          }
        >
          <option value="CGA-580">CGA-580</option>
          <option value="CGA-677">CGA-677</option>
        </select>

        <label>Water Tank Certification</label>
        <select
          className={styles.control}
          value={certValue}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              waterTankCertification: e.target.value as WaterTankCert,
            })
          }
        >
          {WATER_CERT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>Panel Style</label>
        <select
          className={styles.control}
          value={opts.panelStyle}
          onChange={(e) =>
            updateSystemOptions(systemId, { panelStyle: e.target.value as any })
          }
        >
          <option value="ar">Active Release</option>
          <option value="dc">Dry Contact</option>
        </select>

        <label>Power Supply</label>
        <select
          className={styles.control}
          value={opts.powerSupply ?? ""}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              powerSupply: (e.target.value || null) as any,
            })
          }
        >
          <option value="120">120 VAC</option>
          <option value="240">240 VAC</option>
        </select>

        <label>Rundown Time (min)</label>
        <input
          className={styles.control}
          type="number"
          min={0}
          value={opts.rundownTimeMin}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              rundownTimeMin: Number(e.target.value) || 0,
            })
          }
        />
        <label>Estimated Pipe Volume {unitVol}</label>
        <input
          className={styles.control}
          type="number"
          min={0}
          value={opts.estimatedPipeVolume}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              estimatedPipeVolume: Number(e.target.value) || 0,
            })
          }
        />
      </div>

      {/* ───── Column 2: vertical Add-ons list ───── */}
      <div>
        <div className={styles.subhead}>Add-ons</div>
        <div className={styles.addons}>
          {/* Placards row with Door Count to the right */}
          <div className={styles.checkRow}>
            <label className={styles.blockCheck}>
              <input
                type="checkbox"
                checked={opts.addOns.placardsAndSignage}
                onChange={(e) =>
                  updateSystemOptions(systemId, {
                    addOns: {
                      ...opts.addOns,
                      placardsAndSignage: e.target.checked,
                    },
                  })
                }
              />
              Placards & Signage
            </label>

            <span className={`${styles.blockCheck} ${styles.doorCount}`}>
              <label>
                Door Count &nbsp;
                <input
                  type="number"
                  className={styles.controlXS}
                  min={0}
                  value={opts.addOns.doorCount}
                  onChange={(e) =>
                    updateSystemOptions(systemId, {
                      addOns: {
                        ...opts.addOns,
                        doorCount: Number(e.target.value) || 0,
                      },
                    })
                  }
                  disabled={!opts.addOns.placardsAndSignage}
                />
              </label>
            </span>
          </div>

          {/* <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.bulkRefillAdapter}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  addOns: {
                    ...opts.addOns,
                    bulkRefillAdapter: e.target.checked,
                  },
                })
              }
            />
            Bulk cylinder refill adapter
          </label> */}

          {/* <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.waterFlexLine}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  addOns: { ...opts.addOns, waterFlexLine: e.target.checked },
                })
              }
            />
            Water flex line for emitters
          </label> */}

          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.expProofTransducer}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  addOns: {
                    ...opts.addOns,
                    expProofTransducer: e.target.checked,
                  },
                })
              }
            />
            Explosion-proof pressure transducer
          </label>

          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.igsFlexibleHose48}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  addOns: {
                    ...opts.addOns,
                    igsFlexibleHose48: e.target.checked,
                  },
                })
              }
            />
            48&quot; length IGS flexible hose
          </label>
          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.bulkTubes}
              onChange={(e) =>
                updateSystemOptions(systemId, { bulkTubes: e.target.checked })
              }
            />
            <a
              href="https://assets.victaulic.com/assets/uploads/literature/SF-37.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Bulk Tube Order Form
            </a>
          </label>
          {/* Estimated Values (Engineered) */}
          <table
            className={`${cfg.resultsTable} ${styles.estTable}`}
            style={{ marginTop: 8 }}
          >
            <thead>
              <tr>
                <th colSpan={3}>
                  <strong>Estimated Values</strong>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Editable rows */}
              <tr>
                <td className={cfg.kvLabel}>Primary Release Assemblies</td>
                <td
                  className={cfg.kvValue}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span className={styles.estControls}>
                    <input
                      type="checkbox"
                      checked={!!editMap.primaryReleaseAssemblies}
                      onChange={(e) =>
                        setEdit("primaryReleaseAssemblies", e.target.checked)
                      }
                      title="Enable custom value"
                    />
                    <input
                      className={`${styles.controlXS} ${styles.estInput}`}
                      type="number"
                      min={0}
                      value={
                        Number(
                          (opts.estimates as any).primaryReleaseAssemblies
                        ) || 0
                      }
                      onChange={(e) =>
                        setEst(
                          "primaryReleaseAssemblies",
                          Number(e.target.value) || 0
                        )
                      }
                      disabled={!editMap.primaryReleaseAssemblies}
                    />
                  </span>
                </td>
              </tr>

              <tr>
                <td className={cfg.kvLabel}>Double Stacked Rack Hoses</td>
                <td
                  className={cfg.kvValue}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span className={styles.estControls}>
                    <input
                      type="checkbox"
                      checked={!!editMap.doubleStackedRackHose}
                      onChange={(e) =>
                        setEdit("doubleStackedRackHose", e.target.checked)
                      }
                      title="Enable custom value"
                    />
                    <input
                      className={`${styles.controlXS} ${styles.estInput}`}
                      type="number"
                      min={0}
                      value={
                        Number((opts.estimates as any).doubleStackedRackHose) ||
                        0
                      }
                      onChange={(e) =>
                        setEst(
                          "doubleStackedRackHose",
                          Number(e.target.value) || 0
                        )
                      }
                      disabled={!editMap.doubleStackedRackHose}
                    />
                  </span>
                </td>
              </tr>

              <tr>
                <td className={cfg.kvLabel}>Adjacent Rack Hoses</td>
                <td
                  className={cfg.kvValue}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <span className={styles.estControls}>
                    <input
                      type="checkbox"
                      checked={!!editMap.adjacentRackHose}
                      onChange={(e) =>
                        setEdit("adjacentRackHose", e.target.checked)
                      }
                      title="Enable custom value"
                    />
                    <input
                      className={`${styles.controlXS} ${styles.estInput}`}
                      type="number"
                      min={0}
                      value={
                        Number((opts.estimates as any).adjacentRackHose) || 0
                      }
                      onChange={(e) =>
                        setEst("adjacentRackHose", Number(e.target.value) || 0)
                      }
                      disabled={!editMap.adjacentRackHose}
                    />
                  </span>
                </td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Release Points</td>
                <td className={cfg.kvValue}>{n(t?.estReleasePoints)}</td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Monitor Points</td>
                <td className={cfg.kvValue}>{n(t?.estMonitorPoints)}</td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Battery Backups</td>
                <td className={cfg.kvValue}>{n(t?.estBatteryBackups)}</td>
              </tr>
            </tbody>
          </table>
        </div>{" "}
      </div>
      {/* ───── Column 3: System Totals table ───── */}
      <div className={styles.estimateCol}>
        {/* <div className={cfg.resultsHeader}>
          <strong>System Totals</strong>
        </div> */}
        {!t ? (
          <div className={styles.muted}>Run Calculate to see totals.</div>
        ) : (
          <table className={cfg.resultsTable}>
            <thead>
              <th colSpan={3}>
                <strong>System Results</strong>
              </th>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className={cfg.kvLabel}>
                  <div>
                    <strong>
                      Zone Driving N₂ Storage:{" "}
                      {zoneNameById(t.governingNitrogenZoneId)}
                    </strong>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Total Cylinders</td>
                <td className={cfg.kvValue}>{n(t.totalCylinders)}</td>
              </tr>
              <tr>
                <td>Total N₂ Requirement</td>
                <td className={cfg.kvValue}>{n(t.totalNitrogen_scf)} SCF</td>
              </tr>
              <tr>
                <td colSpan={3} className={cfg.kvLabel}>
                  <div>
                    <strong>
                      Zone Driving Water Storage:{" "}
                      {zoneNameById(t.governingWaterZoneId)}
                    </strong>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Min. Water Tank Requirement</td>
                <td className={cfg.kvValue}>
                  {typeof t?.waterTankRequired_gal === "number"
                    ? `${n0(t.waterTankRequired_gal)} gal / ${n0(galToL(t.waterTankRequired_gal))} L`
                    : "—"}
                </td>
              </tr>

              {/* REPLACE Water Discharge Requirement with Water Tank Selection */}
              <tr>
                <td className={cfg.kvLabel}>Provided Water Tank</td>
                <td className={cfg.kvValue}>{waterTankDesc}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PreForm({
  systemId,
  opts,
  projectCurrency,
}: {
  systemId: string;
  opts: PreEngineeredOptions;
  projectCurrency?: string;
}) {
  const { project, updateSystemOptions } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId);
  const t = system?.systemTotals;

  // NEW: pull the primary pre-eng enclosure for summary rows (same source as old PreSystemResults)
  const enc = system?.zones?.[0]?.enclosures?.[0] ?? {};
  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const L = Number((enc as any).length) || 0;
  const W = Number((enc as any).width) || 0;
  const H = Number((enc as any).height) || 0;
  const totalVolume = +(L * W * H).toFixed(project.units === "metric" ? 3 : 0);
  const minEmitters =
    (enc as any).minEmitters ?? (enc as any).emitterCount ?? "—";
  const cylinders = (enc as any).cylinderCount ?? "—";
  const estDischarge =
    (enc as any).estDischarge ?? (enc as any).estimatedDischarge ?? "—";
  const estO2 = (enc as any).estFinalO2 ?? (enc as any).o2Final ?? "—";

  const waterTankDesc =
    (system.options as any).waterTankPick?.description || "—";

  const zoneNameById = (id?: string | null) =>
    system?.zones.find((z) => z.id === id)?.name || "—";
  const n = (x?: number | null) =>
    typeof x === "number" && Number.isFinite(x) ? x.toLocaleString() : "—";
  const setAddOn = (patch: Partial<PreEngineeredOptions["addOns"]>) =>
    updateSystemOptions(systemId, { addOns: { ...opts.addOns, ...patch } });
  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);
  return (
    <div className={styles.cols3}>
      {/* LEFT column */}
      <div className={styles.colLeft}>
        <label>Fill Pressure</label>
        <select
          className={styles.control}
          value={opts.fillPressure}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              fillPressure: e.target.value as any,
            })
          }
        >
          {PRE_FILL_PRESSURES.map((fp) => (
            <option key={fp} value={fp}>
              {fp}
            </option>
          ))}
        </select>

        <label>Refill Adapter</label>
        <select
          className={styles.control}
          value={opts.refillAdapter ?? ""}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              refillAdapter: (e.target.value || null) as any,
            })
          }
        >
          <option value="CGA-580">CGA-580</option>
          <option value="CGA-677">CGA-677</option>
        </select>

        <label>Water Tank Certification</label>
        <select
          className={styles.control}
          value={certValue}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              waterTankCertification: e.target.value as WaterTankCert,
            } as any)
          }
        >
          {WATER_CERT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>Power Supply</label>
        <select
          className={styles.control}
          value={opts.powerSupply ?? ""}
          onChange={(e) =>
            updateSystemOptions(systemId, {
              powerSupply: (e.target.value || null) as any,
            })
          }
        >
          <option value="120">120 VAC</option>
          <option value="240">240 VAC</option>
        </select>
      </div>

      {/* MIDDLE column — Add-ons vertical */}
      <div>
        <div className={styles.subhead}>Add-ons</div>

        <div className={styles.addons}>
          {/* <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.bulkRefillAdapter}
              onChange={(e) =>
                setAddOn({ bulkRefillAdapter: e.target.checked })
              }
            />
            Bulk cylinder refill adapter
          </label> */}

          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.expProofTransducer}
              onChange={(e) =>
                setAddOn({ expProofTransducer: e.target.checked })
              }
            />
            Explosion-proof pressure transducer
          </label>
        </div>
        {/* Estimated Values (Pre-Engineered) */}
        <table
          className={`${cfg.resultsTable} ${styles.estTable}`}
          style={{ marginTop: 8 }}
        >
          <thead>
            <tr>
              <th colSpan={2}>
                <strong>Estimated Values</strong>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cfg.kvLabel}>Release Points</td>
              <td className={cfg.kvValue}>
                {typeof t?.estReleasePoints === "number"
                  ? t.estReleasePoints.toLocaleString()
                  : "—"}
              </td>
            </tr>
            <tr>
              <td className={cfg.kvLabel}>Monitor Points</td>
              <td className={cfg.kvValue}>
                {typeof t?.estMonitorPoints === "number"
                  ? t.estMonitorPoints.toLocaleString()
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RIGHT column — System Totals table (now also includes enclosure summary) */}
      <div className={styles.estimateCol}>
        {!t ? (
          <div className={styles.muted}>Run Calculate to see totals.</div>
        ) : (
          <table className={cfg.resultsTable}>
            <thead>
              <tr>
                <th colSpan={3}>
                  <strong>System Results</strong>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ——— Enclosure-derived rows ——— */}
              <tr>
                <td className={cfg.kvLabel}>Number of Nozzles</td>
                <td className={cfg.kvValue}>{minEmitters}</td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Number of Cylinders</td>
                <td className={cfg.kvValue}>{cylinders}</td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Cylinder Size @ Fill Pressure</td>
                <td className={cfg.kvValue}>
                  {(enc as any)._cylinderLabel ?? "—"}
                </td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Estimated Discharge Time</td>
                <td className={cfg.kvValue}>{estDischarge}</td>
              </tr>
              <tr>
                <td className={cfg.kvLabel}>Estimated Final O₂</td>
                <td className={cfg.kvValue}>{estO2}</td>
              </tr>
              {/* ——— System-level rows ——— */}
              <tr>
                <td className={cfg.kvLabel}>Provided Water Tank</td>
                <td className={cfg.kvValue}>{waterTankDesc}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
