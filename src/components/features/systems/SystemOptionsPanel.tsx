//test message
import React from "react";
import {
  useAppModel,
  EngineeredOptions,
  PreEngineeredOptions,
  FILL_PRESSURES,
  PRE_FILL_PRESSURES,
  Enclosure,
  WaterTankCert,
} from "@/state/app-model";

import {
  pickDefaultNozzle,
  getStylesFor,
  MethodName,
  NozzleCode,
  EmitterStyleKey,
} from "@/core/catalog/emitter.catalog";

import styles from "@/styles/systemoptionspanel.module.css";
/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */
type Props = { systemId: string };

const WATER_CERT_OPTIONS: { value: WaterTankCert; label: string }[] = [
  { value: "ASME/FM", label: "ASME/FM" },
  { value: "CE/ASME/FM", label: "CE/ASME/FM" },
  { value: "CE", label: "CE" },
];

const BULK_TUBE_FILL_PRESSURE = "2400 PSI/165.5 BAR";

const BULK_TUBE_OPTIONS: { value: string; label: string; scf: number }[] = [
  { value: `38x24_2400`, label: `38' x 24" @ 2,400 psi`, scf: 15567 },
  // { value: `36x24_2400`, label: `36' x 24" @ 2,400 psi`, scf: 14715 },
  // { value: `34x22_2400`, label: `34' x 22" @ 2,400 psi`, scf: 12838 },
  { value: `24x24_2400`, label: `24' x 24" @ 2,400 psi`, scf: 9601 },
  // { value: `12x24_2400`, label: `12' x 24" @ 2,400 psi`, scf: 4497 },
];

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function bulkTubeByValue(value?: string) {
  return (
    BULK_TUBE_OPTIONS.find((o) => o.value === value) ?? BULK_TUBE_OPTIONS[0]
  );
}

function defaultCertForCurrency(curr: string | undefined): WaterTankCert {
  return curr === "USD" ? "ASME/FM" : "CE";
}

/* -------------------------------------------------------------------------- */
/*                                    HOOKS                                   */
/* -------------------------------------------------------------------------- */

function useSystemTotalsSnapshot(systemId: string) {
  const { project } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId);
  const zones = system?.zones ?? [];

  const totalZones = zones.length;
  const totalEnclosures = zones.reduce(
    (s, z) => s + (z.enclosures?.length ?? 0),
    0,
  );

  const bulkOn = !!(system?.options as any)?.usesBulkTubes;
  const totalTubes =
    (system as any)?.systemTotals?.totalBulkTubes ??
    zones.reduce((s, z) => s + (Number((z as any).minTotalTubes) || 0), 0);

  const totalCylinders =
    (system as any)?.systemTotals?.systemCylinderCount ??
    zones.reduce(
      (s, z) => s + (Number((z as any).requiredCylinderCount) || 0),
      0,
    );

  const storageCount = bulkOn ? totalTubes : totalCylinders;
  const storageLabel = bulkOn ? "Total Bulk Tubes" : "Total Cylinders";

  const totalNozzles = zones.reduce((s, z) => {
    const encs = z.enclosures ?? [];
    const add = encs.reduce((ss, e) => {
      const n =
        Number((e as any).requiredNozzleCount) ||
        Number((e as any).requiredNozzleCount) ||
        0;
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

/* -------------------------------------------------------------------------- */
/*                                MORE HELPERS                                */
/* -------------------------------------------------------------------------- */
/** Create a fresh random-ish id when crypto isn't available. */
function makeId(prefix: string) {
  return (
    (globalThis.crypto?.randomUUID?.() as string) ||
    `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}
function firstOrUndef<T>(arr: readonly T[]): T | undefined {
  return arr.length ? arr[0] : undefined;
}

function coerceStyle(
  method: MethodName,
  nozzle: NozzleCode,
  candidate?: EmitterStyleKey,
): EmitterStyleKey | undefined {
  const stylesFor = getStylesFor(method, nozzle); // EmitterStyleKey[]
  if (candidate && stylesFor.includes(candidate)) return candidate;
  return firstOrUndef(stylesFor);
}
// ---------- Label helpers (drop-in, no new files) ----------
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

        // ✅ Prefer existing store mutators so behavior matches "+ Add Zone"
        if (
          typeof model.addZone === "function" &&
          typeof model.removeZone === "function"
        ) {
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
      } catch (err) {
        console.error("[SystemOptionsPanel] resizeZones error:", err);
      }
    },
    [model, systemId],
  );
}

export default function SystemOptionsPanel({ systemId }: { systemId: string }) {
  const { project, updateSystemOptions } = useAppModel();
  const system = project.systems.find((s) => s.id === systemId)!;
  const opts = system.options;

  const isPre = system.type === "preengineered";
  const preFill = (opts as any).fillPressure as string | undefined;

  const isLockedFromPartcode = (opts as any).systemPartCodeLocked === true;

  React.useEffect(() => {
    if (!isPre) return;
    if (isLockedFromPartcode) return; // ✅ do not coerce when locked
    if (preFill && !PRE_FILL_PRESSURES.includes(preFill as any)) {
      updateSystemOptions(systemId, { fillPressure: PRE_FILL_PRESSURES[0] });
    }
  }, [isPre, isLockedFromPartcode, preFill, systemId, updateSystemOptions]);
  const waterTankCert = opts.waterTankCertification; // strongly typed
  const legacyTank = (opts as any).waterTank; // still WaterTankCert | null in your model now
  const defaultCert = defaultCertForCurrency(project.currency);

  React.useEffect(() => {
    if (isLockedFromPartcode) return; // ✅ do nothing when locked
    if (waterTankCert) return;

    const next: WaterTankCert = legacyTank ?? defaultCert;
    updateSystemOptions(systemId, { waterTankCertification: next });
  }, [
    isLockedFromPartcode,
    waterTankCert,
    legacyTank,
    defaultCert,
    systemId,
    updateSystemOptions,
  ]);
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
  const sysIdx = project.systems.findIndex((s) => s.id === systemId);
  const sysNumber = sysIdx >= 0 ? sysIdx + 1 : 0;
  const sysLabel =
    sysNumber > 0
      ? formatIndexedName("System", sysNumber, system?.name)
      : system?.name || "Untitled System";

  return (
    <div className={styles.panel} id={`system-panel-${systemId}`}>
      {/* Sticky summary (title bar) */}
      <div
        className={styles.stickyBar}
        role="region"
        aria-label="System summary"
        data-system-summary="1"
        data-sys-summary="1"
      >
        <div className={styles.stickyMain}>
          <div className={styles.sysTitle}>
            <span className={styles.sysName}>{sysLabel}</span>
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
                <span className={styles.kpiLabel}>
                  <strong>Total Zones</strong>
                </span>
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
              <span className={styles.kpiLabel}>
                <strong>Total Enclosures</strong>
              </span>
              <span className={styles.kpiValue}>{totalEnclosures}</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>
                <strong>{storageLabel}</strong>
              </span>
              <span className={styles.kpiValue}>
                {Number.isFinite(storageCount) ? storageCount : "—"}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>
                <strong>Total Nozzles</strong>
              </span>
              <span className={styles.kpiValue}>
                {Number.isFinite(totalNozzles) ? totalNozzles : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.panelBody}>
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               ENGINEERED FORM                              */
/* -------------------------------------------------------------------------- */

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
  const governingWaterZone = system?.zones?.find(
    (z: any) => z.id === (t as any)?.governingWaterZoneId,
  );

  const tankReqGal =
    Number(governingWaterZone?.minWaterTankCapacityGal) ??
    Number((t as any)?.requiredWaterTankCapacityGal);

  const zoneLabelById = makeLabelById(system?.zones, "Zone");
  const n = (x?: number | null) =>
    typeof x === "number" && Number.isFinite(x) ? x.toLocaleString() : "—";

  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);
  const unitVol = systemUnits === "metric" ? "(L)" : "(gal)";
  const editMap = ((opts as any).estimateOverrides ?? {}) as Record<
    string,
    boolean
  >;

  const setEdit = (k: keyof EngineeredOptions["estimates"], on: boolean) => {
    const next = { ...editMap, [k]: on };
    const nextEst = on
      ? opts.estimates
      : { ...opts.estimates, [k]: undefined as any };
    updateSystemOptions(systemId, {
      estimateOverrides: next as any,
      estimates: nextEst,
    } as any);
  };

  const setEst = (k: keyof EngineeredOptions["estimates"], v: number) =>
    updateSystemOptions(systemId, { estimates: { ...opts.estimates, [k]: v } });

  return (
    <div className={styles.sysOptionsLayout}>
      {/* Row 1 – System options in a responsive grid of blocks */}
      <section className={styles.optionRow} data-tour="system-config">
        <div className={styles.rowHeading}>System Configuration</div>
        <div className={styles.optionGrid}>
          <div className={styles.fieldBlock}>
            <label>Refill Pressure</label>
            <select
              className={styles.inputControl}
              value={
                opts.usesBulkTubes ? BULK_TUBE_FILL_PRESSURE : opts.fillPressure
              }
              disabled={!!opts.usesBulkTubes}
              onChange={(e) => {
                if (opts.usesBulkTubes) return; // bulk tubes locks this dropdown
                updateSystemOptions(systemId, {
                  fillPressure: e.target.value as any,
                });
              }}
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
        </div>
      </section>

      {/* Row 2 – Add-ons across the row */}
      <section className={styles.optionRow} data-tour="system-addons">
        <div className={styles.rowHeading}>Add-ons</div>

        <div className={styles.addonsGrid}>
          {/* Col 1 — Placards */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
              <input
                type="checkbox"
                checked={opts.addOns.hasPlacardsAndSignage}
                onChange={(e) =>
                  updateSystemOptions(systemId, {
                    addOns: {
                      ...opts.addOns,
                      hasPlacardsAndSignage: e.target.checked,
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
                disabled={!opts.addOns.hasPlacardsAndSignage}
              />
            </div>
          </div>

          {/* Col 2 — Explosion-proof */}
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
              <input
                type="checkbox"
                checked={opts.addOns.isExplosionProof}
                onChange={(e) =>
                  updateSystemOptions(systemId, {
                    addOns: {
                      ...opts.addOns,
                      isExplosionProof: e.target.checked,
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
                checked={opts.addOns.hasIgsFlexibleHose48}
                onChange={(e) =>
                  updateSystemOptions(systemId, {
                    addOns: {
                      ...opts.addOns,
                      hasIgsFlexibleHose48: e.target.checked,
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
                checked={!!opts.usesBulkTubes}
                onChange={(e) => {
                  const on = e.target.checked;

                  if (on) {
                    const currentVal = opts.bulkTubeSize;
                    const pick = bulkTubeByValue(currentVal);
                    updateSystemOptions(systemId, {
                      usesBulkTubes: true,
                      bulkTubeSize: pick.value,
                      bulkTubeLabel: pick.label,
                      bulkTubeCapacityScf: pick.scf,
                    } as any);
                  } else {
                    updateSystemOptions(systemId, {
                      usesBulkTubes: false,
                      bulkTubeCapacityScf: null,
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
                    usesBulkTubes: true,
                    bulkTubeSize: pick.value,
                    bulkTubeLabel: pick.label,
                    bulkTubeCapacityScf: pick.scf,
                  } as any);
                }}
                disabled={!opts.usesBulkTubes}
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
          <div data-tour="est-vals">
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
                  <td className={styles.kvLabel}>
                    Refill Adapters ({opts.refillAdapter ?? "CGA-580"})
                  </td>
                  <td className={styles.kvValue}>
                    <span className={styles.estControls}>
                      <input
                        type="checkbox"
                        checked={!!editMap.refillAdapters}
                        onChange={(e) =>
                          setEdit("refillAdapters", e.target.checked)
                        }
                        title="Enable custom value"
                      />
                      <input
                        className={styles.kpiInput}
                        type="number"
                        min={0}
                        value={Number(opts.estimates.refillAdapters) || 0}
                        onChange={(e) =>
                          setEst("refillAdapters", Number(e.target.value) || 0)
                        }
                        disabled={!editMap.refillAdapters}
                      />
                    </span>
                  </td>
                </tr>
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
                            Number(e.target.value) || 0,
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
                            Number(e.target.value) || 0,
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
                            Number(e.target.value) || 0,
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
                  <td className={styles.kvValue}>
                    {n((t as any)?.estimatedReleasePoints)}
                  </td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Monitor Points</td>
                  <td className={styles.kvValue}>
                    {n((t as any)?.estimatedMonitorPoints)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* System results table */}
          <div className={styles.estimateCol} data-tour="system-results">
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
                    <td className={styles.kvLabel}>
                      <strong>Zone Driving N₂ Storage</strong>
                    </td>
                    <td className={styles.kvValue}>
                      {zoneLabelById(t.governingNitrogenZoneId) || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      {opts.usesBulkTubes
                        ? "Min. Required Bulk Tubes"
                        : "Total Cylinders"}
                    </td>
                    <td className={styles.kvValue}>
                      {opts.usesBulkTubes
                        ? n(
                            (t as any).systemBulkTubeCount ??
                              (t as any).systemCylinderCount,
                          )
                        : n((t as any).systemCylinderCount)}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Total N₂ Delivered</td>
                    <td className={styles.kvValue}>
                      {n((t as any).nitrogenDeliveredScf)} SCF
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      <strong>Zone Driving Water Storage</strong>
                    </td>
                    <td className={styles.kvValue}>
                      {zoneLabelById(t.governingWaterZoneId) || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>
                      Min. Water Tank Requirement
                    </td>
                    <td className={styles.kvValue}>
                      {Number.isFinite(tankReqGal)
                        ? `${Math.ceil(tankReqGal).toLocaleString()} gal / ${Math.ceil(
                            tankReqGal * 3.78541,
                          ).toLocaleString()} L`
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Provided Water Tank</td>
                    <td className={styles.kvValue}>
                      {opts.selectedWaterTankPartDesc || "—"}
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

/* -------------------------------------------------------------------------- */
/*                             PRE-ENGINEERED FORM                            */
/* -------------------------------------------------------------------------- */

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
  const minEmitters = (enc as any).requiredNozzleCount ?? "—";
  const cylinders = (enc as any).requiredCylinderCount ?? "—";
  const estDischarge = (enc as any).estimatedDischargeDuration ?? "—";
  const estO2 = (enc as any).estimatedFinalOxygenPercent ?? "—";

  const waterTankDesc =
    (system?.options as any).selectedWaterTankPartDesc || "—";

  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);

  // When the pre-engineered system is locked to a System Partcode,
  // the system configuration controls should be read-only.
  const isLockedFromPartcode = (opts as any).systemPartCodeLocked === true;
  const setAddOn = (patch: Partial<PreEngineeredOptions["addOns"]>) =>
    updateSystemOptions(systemId, { addOns: { ...opts.addOns, ...patch } });

  const unitVol = project.units === "metric" ? "m³" : "ft³";
  const encTyped = enc as Enclosure;
  const vol =
    (encTyped.length ?? 0) * (encTyped.width ?? 0) * (encTyped.height ?? 0) ||
    Number(encTyped.volumeFt3) ||
    0;
  const volStr = vol.toLocaleString(undefined, {
    maximumFractionDigits: project.units === "metric" ? 3 : 0,
  });

  return (
    <div className={styles.sysOptionsLayout}>
      {/* Row 1 – Pre-eng system options */}
      <section className={styles.optionRow}>
        <div className={styles.rowHeading}>System Configuration</div>
        <div className={styles.optionGrid}>
          <div className={styles.fieldBlock}>
            <label>Refill Pressure</label>
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

        <div className={styles.addonsGrid}>
          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
              <input
                type="checkbox"
                checked={opts.addOns.isExplosionProof}
                onChange={(e) =>
                  setAddOn({ isExplosionProof: e.target.checked })
                }
                disabled={isLockedFromPartcode}
              />
              <span className={styles.addonLabelText}>
                Explosion-proof pressure transducer
              </span>
            </label>
          </div>

          <div className={styles.addonCol}>
            <label className={styles.addonCheck}>
              <input
                type="checkbox"
                checked={(opts.addOns as any).hasBulkRefillAdapter}
                onChange={(e) =>
                  setAddOn({ hasBulkRefillAdapter: e.target.checked } as any)
                }
                disabled={isLockedFromPartcode}
              />
              <span className={styles.addonLabelText}>
                Include bulk cylinder refill adapter
              </span>
            </label>
          </div>

          {/* Optional: keep 4-column visual consistency even with only 2 add-ons */}
          <div className={styles.addonCol} aria-hidden="true" />
          <div className={styles.addonCol} aria-hidden="true" />
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
                    {typeof (t as any)?.estimatedReleasePoints === "number"
                      ? (t as any).estimatedReleasePoints.toLocaleString()
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className={styles.kvLabel}>Monitor Points</td>
                  <td className={styles.kvValue}>
                    {typeof (t as any)?.estimatedMonitorPoints === "number"
                      ? (t as any).estimatedMonitorPoints.toLocaleString()
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
                      {isLockedFromPartcode
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
                      Cylinder Size @ Refill Pressure
                    </td>
                    <td className={styles.kvValue}>
                      {(enc as any).cylinderLabel ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Estimated Discharge Time</td>
                    <td className={styles.kvValue}>{estDischarge}</td>
                  </tr>
                  <tr>
                    <td className={styles.kvLabel}>Estimated Final O₂</td>
                    <td className={styles.kvValue}>
                      {isLockedFromPartcode
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
