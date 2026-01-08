// src/components/features/systems/SystemOptionsPanel.tsx
import React from "react";
import {
  useAppModel,
  EngineeredOptions,
  PreEngineeredOptions,
  FILL_PRESSURES,
  PRE_FILL_PRESSURES,
} from "@/state/app-model";
import {
  pickDefaultNozzle,
  getStylesFor,
  MethodName,
  NozzleCode,
  EmitterStyleKey,
} from "@/core/catalog/emitter.catalog";

import type { Enclosure } from "@/state/app-model";
import styles from "@/styles/systemoptionspanel.module.css";
import type { WaterTankCert } from "@/state/app-model";
import { asEngineeredOptions } from "@/core/calc/engineered/index";
type Props = { systemId: string };

const WATER_CERT_OPTIONS: { value: WaterTankCert; label: string }[] = [
  { value: "ASME/FM", label: "ASME/FM" },
  { value: "CE/ASME/FM", label: "CE/ASME/FM" },
  { value: "CE", label: "CE" },
];

const BULK_TUBE_FILL_PRESSURE = "2400 PSI/165.5 BAR";

const BULK_TUBE_OPTIONS: { value: string; label: string; scf: number }[] = [
  { value: `38x24_2400`, label: `38' x 24" @ 2,400 psi`, scf: 15567 },
  { value: `36x24_2400`, label: `36' x 24" @ 2,400 psi`, scf: 14715 },
  { value: `34x22_2400`, label: `34' x 22" @ 2,400 psi`, scf: 12838 },
  { value: `24x24_2400`, label: `24' x 24" @ 2,400 psi`, scf: 9601 },
  { value: `12x24_2400`, label: `12' x 24" @ 2,400 psi`, scf: 4497 },
];

function bulkTubeByValue(value?: string) {
  return (
    BULK_TUBE_OPTIONS.find((o) => o.value === value) ?? BULK_TUBE_OPTIONS[0]
  );
}

function defaultCertForCurrency(curr: string | undefined): WaterTankCert {
  return curr === "USD" ? "ASME/FM" : "CE";
}

function useSystemTotalsSnapshot(systemId: string) {
  const { project } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId);
  const zones = system?.zones ?? [];

  const totalZones = zones.length;
  const totalEnclosures = zones.reduce(
    (s, z) => s + (z.enclosures?.length ?? 0),
    0
  );

  const bulkOn = !!(system?.options as any)?.bulkTubes;

  // Sum tube mins across zones (or take max—see note below)
  const totalTubes =
    (system as any)?.systemTotals?.totalBulkTubes ??
    zones.reduce((s, z) => s + (Number((z as any).minTotalTubes) || 0), 0);

  // Existing cylinder logic
  const totalCylinders =
    (system as any)?.systemTotals?.totalCylinders ??
    zones.reduce((s, z) => s + (Number((z as any).minTotalCylinders) || 0), 0);

  // Pick the displayed “storage count”
  const storageCount = bulkOn ? totalTubes : totalCylinders;
  const storageLabel = bulkOn ? "Total Bulk Tubes" : "Total Cylinders";

  // Count “nozzles” as minEmitters/emitterCount across all enclosures
  const totalNozzles = zones.reduce((s, z) => {
    const encs = z.enclosures ?? [];
    const add = encs.reduce((ss, e) => {
      const n =
        Number((e as any).minEmitters) || Number((e as any).emitterCount) || 0;
      return ss + (Number.isFinite(n) ? n : 0);
    }, 0);
    return s + add;
  }, 0);

  const systemType =
    (system?.type ?? (system?.options as any)?.kind) === "preengineered"
      ? "Pre-Engineered"
      : "Engineered";

  return {
    system,
    systemType,
    totalZones,
    totalEnclosures,
    totalTubes, // optional but useful
    storageCount,
    storageLabel,
    totalNozzles,
  };
}

/** Create a fresh random-ish id when crypto isn't available. */
function makeId(prefix: string) {
  return (
    (globalThis.crypto?.randomUUID?.() as string) ||
    `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

/** Deep-duplicate a zone, giving new ids and incremented names.
 *  - Preserves *inputs* and configuration
 *  - Clears *calculation outputs*
 */
function cloneZoneWithNewIds(base: any, zoneIndexNumber: number) {
  const newZoneId = makeId("zone");
  // Increment zone name (handle "Zone X" trailing digits if present)
  const zoneName =
    base?.name && /\d+$/.test(base.name)
      ? base.name.replace(/\d+$/, String(zoneIndexNumber + 1))
      : `Zone ${zoneIndexNumber + 1}`;

  // Duplicate enclosures (preserve inputs/config, clear results)
  const enclosures =
    (base?.enclosures ?? []).map((e: any, j: number) => {
      const newEncId = makeId("enc");
      const encName =
        e?.name && /\d+$/.test(e.name)
          ? e.name.replace(/\d+$/, String(j + 1))
          : `Enclosure ${j + 1}`;

      // Keep inputs/config; drop most calc outputs
      const {
        // known calc outputs to clear
        minEmitters,
        emitterCount,
        cylinderCount,
        estDischarge,
        estFinalO2,
        qWater_gpm,
        qWaterTotal_gpm,
        estWater_gal,
        // potential aliases
        estimatedDischarge,
        o2Final,
        ...rest
      } = e || {};

      return {
        ...rest,
        id: newEncId,
        name: encName,
        // Explicitly clear calc-y fields
        minEmitters: undefined,
        emitterCount: undefined,
        cylinderCount: undefined,
        estDischarge: undefined,
        estFinalO2: undefined,
        qWater_gpm: undefined,
        qWaterTotal_gpm: undefined,
        estWater_gal: undefined,
      };
    }) ?? [];

  const {
    // zone-level calc outputs to clear
    minTotalCylinders,
    q_n2_peak_scfm,
    water_peak_gpm,
    waterDischarge_gal,
    waterTankMin_gal,
    panelSizing,
    designLabel,
    ...restZone
  } = base || {};

  return {
    ...restZone,
    id: newZoneId,
    name: zoneName,
    enclosures,
    minTotalCylinders: undefined,
    q_n2_peak_scfm: undefined,
    water_peak_gpm: undefined,
    waterDischarge_gal: undefined,
    waterTankMin_gal: undefined,
    panelSizing: undefined,
    designLabel: restZone?.designLabel ?? undefined,
  };
}

function firstOrUndef<T>(arr: readonly T[]): T | undefined {
  return arr.length ? arr[0] : undefined;
}

function coerceStyle(
  method: MethodName,
  nozzle: NozzleCode,
  candidate?: EmitterStyleKey
): EmitterStyleKey | undefined {
  const stylesFor = getStylesFor(method, nozzle); // EmitterStyleKey[]
  if (candidate && stylesFor.includes(candidate)) return candidate;
  return firstOrUndef(stylesFor);
}

/** Make a "default" zone like clicking Add Zone for Engineered (empty enclosures). */
function makeDefaultEmptyZone(nextIndex: number) {
  const m: MethodName = "NFPA 770 Class A/C";
  const n: NozzleCode = pickDefaultNozzle(m);
  const s: EmitterStyleKey = coerceStyle(m, n)!;
  return {
    id: makeId("zone"),
    name: `Zone ${nextIndex}`,
    enclosures: [
      {
        id: makeId("enc"),
        name: "Enclosure 1",
        volume: 1000,
        tempF: 70,
        method: m,
        nozzleCode: n,
        emitterStyle: s,
        customMinEmitters: null,
        _editEmitters: false,
      },
    ] as Enclosure[],
    customMinTotalCylinders: null as number | null,
    _editCylinders: false,
  };
}

function useResizeZones(systemId: string) {
  const model = useAppModel() as any;

  return React.useCallback(
    (nextCount: number) => {
      try {
        const project = model.project;
        const sysIdx = project.systems.findIndex((s: any) => s.id === systemId);
        if (sysIdx < 0) return;

        const system = project.systems[sysIdx];
        const currentZones = (system.zones ?? []).slice();
        const curr = currentZones.length;
        const target = Math.max(0, Math.floor(Number(nextCount) || 0));
        if (target === curr) return;

        // Pre-engineered systems should never get zone-resized here
        if (system.type === "preengineered") return;

        let nextZones = currentZones.slice();

        if (target > curr) {
          // Growth path
          const toAdd = target - curr;
          // Special rule: if no zones exist, first zone must be the *default* (like clicking Add Zone)
          if (curr === 0) {
            nextZones.push(makeDefaultEmptyZone(1));
          }

          // For remaining additions (or all additions if curr > 0), duplicate the *last* zone each time
          for (let i = 0; i < toAdd - (curr === 0 ? 1 : 0); i++) {
            const base =
              nextZones[nextZones.length - 1] ??
              currentZones[currentZones.length - 1];
            const cloned = cloneZoneWithNewIds(base, nextZones.length);
            nextZones.push(cloned);
          }
        } else {
          // Shrink path: trim from the end
          nextZones = nextZones.slice(0, target);
        }

        // Preferred mutators from your store
        if (typeof model.setSystemZones === "function") {
          model.setSystemZones(systemId, nextZones);
          return;
        }
        if (typeof model.updateSystem === "function") {
          model.updateSystem(systemId, { zones: nextZones });
          return;
        }
        if (typeof model.setProject === "function") {
          const nextProj = { ...project };
          nextProj.systems = project.systems.map((s: any) =>
            s.id === systemId ? { ...s, zones: nextZones } : s
          );
          model.setProject(nextProj);
          return;
        }
        if (
          typeof model.addZone === "function" &&
          typeof model.removeZone === "function"
        ) {
          // Fallback to iterative add/remove using exposed mutators
          if (target > curr) {
            for (let i = curr; i < target; i++) model.addZone(systemId);
          } else {
            for (let i = curr; i > target; i--) {
              const last = currentZones[i - 1];
              if (last?.id) model.removeZone(systemId, last.id);
            }
          }
          return;
        }

        // Last-resort: broadcast an event for external handlers
        window.dispatchEvent(
          new CustomEvent("vortex:resize-zones", {
            detail: { systemId, zones: nextZones },
          })
        );
        console.warn(
          "[SystemOptionsPanel] No zone update mutator found; dispatched 'vortex:resize-zones' event."
        );
      } catch (err) {
        console.error("[SystemOptionsPanel] resizeZones error:", err);
      }
    },
    [model, systemId]
  );
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
  const waterTankCert = opts.waterTankCertification; // strongly typed
  const legacyTank = opts.waterTank; // still WaterTankCert | null in your model now
  const defaultCert = defaultCertForCurrency(project.currency);

  React.useEffect(() => {
    // If already set, do nothing
    if (waterTankCert) return;

    // If legacy field exists, use it; otherwise fall back to default
    const next: WaterTankCert = legacyTank ?? defaultCert;

    updateSystemOptions(systemId, { waterTankCertification: next });
  }, [waterTankCert, legacyTank, defaultCert, systemId, updateSystemOptions]);
  // Sticky bar data + zone resizer
  const {
    systemType,
    totalZones,
    totalEnclosures,
    storageCount,
    storageLabel,
    totalNozzles,
  } = useSystemTotalsSnapshot(systemId);
  const resizeZones = useResizeZones(systemId);

  const handleZoneCountInput = (raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    resizeZones(n);
  };

  return (
    <div className={styles.panel} id={`system-panel-${systemId}`}>
      {/* Sticky summary (title bar) */}
      <div
        className={styles.stickyBar}
        role="region"
        aria-label="System summary"
      >
        <div className={styles.stickyMain}>
          <div className={styles.sysTitle}>
            <span className={styles.sysName}>
              {system.name || "Untitled System"}
            </span>
            <span
              className={`${styles.sysType} ${
                systemType.startsWith("Engineered")
                  ? styles.sysTypeEng
                  : styles.sysTypePre
              }`}
            >
              {systemType} Options
            </span>
          </div>
          <div className={styles.sysKpis}>
            {opts.kind !== "preengineered" && (
              <div className={styles.kpi}>
                <span className={styles.kpiLabel}>Total Zones</span>
                <span className={styles.kpiValue}>
                  <input
                    className={styles.kpiInput}
                    type="number"
                    min={0}
                    value={totalZones}
                    onChange={(e) => handleZoneCountInput(e.target.value)}
                    title="Set total zones (adds/removes off the end)"
                  />
                </span>
                <div className={styles.kpiBtns}>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    onClick={() => resizeZones(totalZones + 1)}
                    aria-label="Add zone"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={styles.kpiBtn}
                    onClick={() => resizeZones(Math.max(0, totalZones - 1))}
                    aria-label="Remove zone from end"
                  >
                    −
                  </button>
                </div>
              </div>
            )}
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Total Enclosures</span>
              <span className={styles.kpiValue}>{totalEnclosures}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>{storageLabel}</span>
              <span className={styles.kpiValue}>
                {Number.isFinite(storageCount) ? storageCount : "—"}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Total Nozzles</span>
              <span className={styles.kpiValue}>
                {Number.isFinite(totalNozzles) ? totalNozzles : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Options body */}
      {opts.kind === "engineered" ? (
        <EngineeredForm
          systemId={systemId}
          opts={opts}
          projectCurrency={project.currency}
          systemUnits={project.units}
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
  const { project, updateSystemOptions } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId);
  const t = system?.systemTotals;
  const zoneNameById = (id?: string | null) =>
    system?.zones.find((z) => z.id === id)?.name || "—";

  const n = (x?: number | null) =>
    typeof x === "number" && Number.isFinite(x) ? x.toLocaleString() : "—";

  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);
  const unitVol = systemUnits === "metric" ? "(L)" : "(gal)";
  const editMap = ((opts as any)._editEstimates ?? {}) as Record<
    string,
    boolean
  >;

  const setEdit = (k: keyof EngineeredOptions["estimates"], on: boolean) => {
    const next = { ...editMap, [k]: on };
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

  return (
    <div className={styles.sysOptionsLayout}>
      {/* Row 1 – System options in a responsive grid of blocks */}
      <section className={styles.optionRow}>
        <div className={styles.rowHeading}>System Configuration</div>
        <div className={styles.optionGrid}>
          <div className={styles.fieldBlock}>
            <label>Fill Pressure</label>
            <select
              className={styles.inputControl}
              value={
                opts.bulkTubes ? BULK_TUBE_FILL_PRESSURE : opts.fillPressure
              }
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  fillPressure: e.target.value as any,
                })
              }
              disabled={!!opts.bulkTubes}
            >
              {FILL_PRESSURES.map((fp) => (
                <option key={fp} value={fp}>
                  {fp}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldBlock}>
            <label>Refill Adapter</label>
            <select
              className={styles.inputControl}
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
          </div>

          <div className={styles.fieldBlock}>
            <label>Water Tank Certification</label>
            <select
              className={styles.inputControl}
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
          </div>

          <div className={styles.fieldBlock}>
            <label>Panel Style</label>
            <select
              className={styles.inputControl}
              value={opts.panelStyle}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  panelStyle: e.target.value as any,
                })
              }
            >
              <option value="ar">Active Release</option>
              <option value="dc">Dry Contact</option>
            </select>
          </div>

          <div className={styles.fieldBlock}>
            <label>Power Supply</label>
            <select
              className={styles.inputControl}
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

          <div className={styles.fieldBlock}>
            <label>Rundown Time (min)</label>
            <input
              className={styles.inputControl}
              type="number"
              min={0}
              value={opts.rundownTimeMin}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  rundownTimeMin: Number(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className={styles.fieldBlock}>
            <label>Est. Dry Water Pipe Vol. {unitVol}</label>
            <input
              className={styles.inputControl}
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
        </div>
      </section>

      {/* Row 2 – Add-ons across the row */}
      <section className={styles.optionRow}>
        <div className={styles.rowHeading}>Add-ons</div>

        <div className={styles.addonsGrid}>
          {/* Col 1 — Placards */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
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
              <span className={styles.addonLabelText}>
                Placards &amp; Signage
              </span>
            </label>

            <div className={styles.addonInlineField}>
              <span className={styles.addonInlineLabel}>Door Count</span>
              <input
                type="number"
                className={styles.addonInlineInput}
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
            </div>
          </div>

          {/* Col 2 — Explosion-proof */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
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
              <span className={styles.addonLabelText}>
                Explosion-proof pressure transducer
              </span>
            </label>
          </div>

          {/* Col 3 — 48" hose */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
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
              <span className={styles.addonLabelText}>
                48&quot; length IGS flexible hose
              </span>
            </label>
          </div>

          {/* Col 4 — Bulk tubes */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
              <input
                type="checkbox"
                checked={!!opts.bulkTubes}
                onChange={(e) => {
                  const on = e.target.checked;

                  if (on) {
                    const currentVal = opts.bulkTubeSize;
                    const pick = bulkTubeByValue(currentVal);
                    updateSystemOptions(systemId, {
                      bulkTubes: true,
                      fillPressure: BULK_TUBE_FILL_PRESSURE,
                      bulkTubeSize: pick.value,
                      bulkTubeLabel: pick.label,
                      bulkTubeNitrogenSCF: pick.scf,
                    } as any);
                  } else {
                    updateSystemOptions(systemId, {
                      bulkTubes: false,
                      bulkTubeNitrogenSCF: null,
                    } as any);
                  }
                }}
              />
              Bulk Tube
              <a
                className={styles.addonLink}
                href="https://assets.victaulic.com/assets/uploads/literature/SF-37.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Order Form
              </a>
            </label>

            <div className={styles.addonInlineField}>
              <span className={styles.addonInlineLabel}>Size @ PSI</span>
              <select
                className={styles.addonInlineSelect}
                value={opts.bulkTubeSize ?? BULK_TUBE_OPTIONS[0].value}
                onChange={(e) => {
                  const val = e.target.value;
                  const pick = bulkTubeByValue(val);
                  updateSystemOptions(systemId, {
                    bulkTubes: true,
                    fillPressure: BULK_TUBE_FILL_PRESSURE,
                    bulkTubeSize: pick.value,
                    bulkTubeLabel: pick.label,
                    bulkTubeNitrogenSCF: pick.scf,
                  } as any);
                }}
                disabled={!opts.bulkTubes}
              >
                {BULK_TUBE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Row 3 – Estimated values (left) + system results (right) */}
      <section className={`${styles.optionRow} ${styles.rowResults}`}>
        <div className={styles.rowHeading}>Estimates &amp; System Results</div>
        <div className={styles.resultsPairGrid}>
          {/* Estimated values table */}
          <div>
            <table className={`${styles.resultsTable} ${styles.estTable}`}>
              <thead>
                <tr>
                  <th colSpan={3}>
                    <strong>Estimated Values</strong>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.kvLabel}>Primary Release Assemblies</td>
                  <td className={styles.kvValue}>
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
                        className={styles.kpiInput}
                        type="number"
                        min={0}
                        value={
                          Number(opts.estimates.primaryReleaseAssemblies) || 0
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
                  <td className={styles.kvLabel}>Double Stacked Rack Hoses</td>
                  <td className={styles.kvValue}>
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
                        className={styles.kpiInput}
                        type="number"
                        min={0}
                        value={
                          Number(opts.estimates.doubleStackedRackHose) || 0
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
                  <td className={styles.kvLabel}>Adjacent Rack Hoses</td>
                  <td className={styles.kvValue}>
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
                        className={styles.kpiInput}
                        type="number"
                        min={0}
                        value={Number(opts.estimates.adjacentRackHose) || 0}
                        onChange={(e) =>
                          setEst(
                            "adjacentRackHose",
                            Number(e.target.value) || 0
                          )
                        }
                        disabled={!editMap.adjacentRackHose}
                      />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Power Supplies</td>
                  <td className={styles.kvValue}>
                    <span className={styles.estControls}>
                      <input
                        type="checkbox"
                        checked={!!editMap.batteryBackups}
                        onChange={(e) =>
                          setEdit("batteryBackups", e.target.checked)
                        }
                        title="Enable custom value"
                      />
                      <input
                        className={styles.kpiInput}
                        type="number"
                        min={0}
                        value={Number(opts.estimates.batteryBackups) || 0}
                        onChange={(e) =>
                          setEst("batteryBackups", Number(e.target.value) || 0)
                        }
                        disabled={!editMap.batteryBackups}
                      />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Release Points</td>
                  <td className={styles.kvValue}>{n(t?.estReleasePoints)}</td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Monitor Points</td>
                  <td className={styles.kvValue}>{n(t?.estMonitorPoints)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* System results table */}
          <div className={styles.estimateCol}>
            {!t ? (
              <div className={styles.muted}>Run Calculate to see totals.</div>
            ) : (
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th colSpan={3}>
                      <strong>System Results</strong>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className={styles.kvLabel}>
                      <div>
                        <strong>
                          Zone Driving N₂ Storage:
                          {zoneNameById(t.governingNitrogenZoneId)}
                        </strong>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      {opts.bulkTubes
                        ? "Min. Required Bulk Tubes"
                        : "Total Cylinders"}
                    </td>
                    <td className={styles.kvValue}>
                      {opts.bulkTubes
                        ? n((t as any).totalBulkTubes ?? t.totalCylinders)
                        : n(t.totalCylinders)}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Total N₂ Delivered</td>
                    <td className={styles.kvValue}>
                      {n(t.totalNitrogenDelivered_scf)} SCF
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className={styles.kvLabel}>
                      <div>
                        <strong>
                          Zone Driving Water Storage:
                          {zoneNameById(t.governingWaterZoneId)}
                        </strong>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      Min. Water Tank Requirement
                    </td>
                    <td className={styles.kvValue}>
                      {typeof t?.waterTankRequired_gal === "number"
                        ? `${Math.round(
                            t.waterTankRequired_gal
                          ).toLocaleString()} gal / ${Math.round(
                            (t.waterTankRequired_gal || 0) * 3.78541
                          ).toLocaleString()} L`
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Provided Water Tank</td>
                    <td className={styles.kvValue}>
                      {opts.waterTankPickDesc || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------ PRE-ENGINEERED ------------ */

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

  const enc = system?.zones?.[0]?.enclosures?.[0] ?? {};
  const minEmitters =
    (enc as any).minEmitters ?? (enc as any).emitterCount ?? "—";
  const cylinders = (enc as any).cylinderCount ?? "—";
  const estDischarge =
    (enc as any).estDischarge ?? (enc as any).estimatedDischarge ?? "—";
  const estO2 = (enc as any).estFinalO2 ?? (enc as any).o2Final ?? "—";

  const waterTankDesc =
    (system?.options as any).waterTankPick?.description || "—";

  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);

  // When the pre-engineered system is locked to a System Partcode,
  // the system configuration controls should be read-only.
  const isLockedFromPartcode = (opts as any).systemPartCodeLocked === true;
  const setAddOn = (patch: Partial<PreEngineeredOptions["addOns"]>) =>
    updateSystemOptions(systemId, { addOns: { ...opts.addOns, ...patch } });

  // Live total volume from L/W/H
  const L = Number((enc as any)?.length);
  const W = Number((enc as any)?.width);
  const H = Number((enc as any)?.height);
  const hasDims = [L, W, H].every((v) => Number.isFinite(v) && v > 0);
  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const vol =
    hasDims && Number.isFinite(L * W * H) ? (L as number) * W * H : null;
  const volStr =
    vol == null
      ? "—"
      : vol.toLocaleString(undefined, {
          maximumFractionDigits: project.units === "metric" ? 3 : 0,
        });
  const locked = !!(
    project.systems.find((s) => s.id === systemId)?.options as any
  )?.systemPartCodeLocked;

  return (
    <div className={styles.sysOptionsLayout}>
      {/* Row 1 – Pre-eng system options */}
      <section className={styles.optionRow}>
        <div className={styles.rowHeading}>System Configuration</div>
        <div className={styles.optionGrid}>
          <div className={styles.fieldBlock}>
            <label>Fill Pressure</label>
            <select
              className={styles.inputControl}
              value={opts.fillPressure}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  fillPressure: e.target.value as any,
                })
              }
              disabled={isLockedFromPartcode}
            >
              {PRE_FILL_PRESSURES.map((fp) => (
                <option key={fp} value={fp}>
                  {fp}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldBlock}>
            <label>Refill Adapter</label>
            <select
              className={styles.inputControl}
              value={opts.refillAdapter ?? ""}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  refillAdapter: (e.target.value || null) as any,
                })
              }
              disabled={isLockedFromPartcode}
            >
              <option value="CGA-580">CGA-580</option>
              <option value="CGA-677">CGA-677</option>
            </select>
          </div>

          <div className={styles.fieldBlock}>
            <label>Water Tank Certification</label>
            <select
              className={styles.inputControl}
              value={certValue}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  waterTankCertification: e.target.value as WaterTankCert,
                } as any)
              }
              disabled={isLockedFromPartcode}
            >
              {WATER_CERT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldBlock}>
            <label>Power Supply</label>
            <select
              className={styles.inputControl}
              value={opts.powerSupply ?? ""}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  powerSupply: (e.target.value || null) as any,
                })
              }
              disabled={isLockedFromPartcode}
            >
              <option value="120">120 VAC</option>
              <option value="240">240 VAC</option>
            </select>
          </div>
        </div>
      </section>

      {/* Row 2 – Add-ons */}
      <section className={styles.optionRow}>
        <div className={styles.rowHeading}>Add-ons</div>
        <div className={styles.addonsRow}>
          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.expProofTransducer}
              onChange={(e) =>
                setAddOn({ expProofTransducer: e.target.checked })
              }
              disabled={isLockedFromPartcode}
            />
            Explosion-proof pressure transducer
          </label>
          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.bulkRefillAdapter}
              onChange={(e) =>
                setAddOn({ bulkRefillAdapter: e.target.checked })
              }
              disabled={isLockedFromPartcode}
            />
            Include bulk cylinder refill adapter
          </label>
        </div>
      </section>

      {/* Row 3 – Estimated values + system results */}
      <section className={`${styles.optionRow} ${styles.rowResults}`}>
        <div className={styles.rowHeading}>Estimates &amp; System Results</div>
        <div className={styles.resultsPairGrid}>
          {/* Estimated values table */}
          <div>
            <table className={`${styles.resultsTable} ${styles.estTable}`}>
              <thead>
                <tr>
                  <th colSpan={2}>
                    <strong>Estimated Values</strong>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.kvLabel}>Release Points</td>
                  <td className={styles.kvValue}>
                    {typeof t?.estReleasePoints === "number"
                      ? t.estReleasePoints.toLocaleString()
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Monitor Points</td>
                  <td className={styles.kvValue}>
                    {typeof t?.estMonitorPoints === "number"
                      ? t.estMonitorPoints.toLocaleString()
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* System results */}
          <div className={styles.estimateCol}>
            {!t ? (
              <div className={styles.muted}>Run Calculate to see totals.</div>
            ) : (
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th colSpan={3}>
                      <strong>System Results</strong>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.kvLabel}>Total Volume</td>
                    <td className={styles.kvValue}>
                      {locked
                        ? "Overridden by system partcode lock"
                        : `${volStr} ${unitVol}`}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Number of Nozzles</td>
                    <td className={styles.kvValue}>{minEmitters}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Number of Cylinders</td>
                    <td className={styles.kvValue}>{cylinders}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      Cylinder Size @ Fill Pressure
                    </td>
                    <td className={styles.kvValue}>
                      {(enc as any)._cylinderLabel ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Estimated Discharge Time</td>
                    <td className={styles.kvValue}>{estDischarge}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Estimated Final O₂</td>
                    <td className={styles.kvValue}>
                      {locked
                        ? "Overridden by system partcode lock"
                        : `${estO2} `}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Provided Water Tank</td>
                    <td className={styles.kvValue}>{waterTankDesc}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
