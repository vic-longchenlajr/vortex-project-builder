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
      waterTankCertification: (mapped ?? defaultCert) as any,
    } as any);
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
  const { updateSystemOptions } = useAppModel();
  const certValue =
    ((opts as any).waterTankCertification as WaterTankCert | undefined) ??
    defaultCertForCurrency(projectCurrency);
  const unitVol = systemUnits === "metric" ? "(L)" : "(gal)";

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
            } as any)
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

          <label className={styles.blockCheck}>
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
          </label>

          <label className={styles.blockCheck}>
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
          </label>

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
        </div>
      </div>

      {/* ───── Column 3: edit + six estimate inputs ───── */}
      <div className={styles.estimateCol}>
        <div className={styles.estimateGroup}>
          <div className={styles.editToggle}>
            <input
              type="checkbox"
              checked={opts.editValues}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  editValues: e.target.checked,
                })
              }
            />
            <strong>Edit Values</strong>
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Primary Release Assemblies</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.primaryReleaseAssemblies}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    primaryReleaseAssemblies: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Double Stacked Rack Hose</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.doubleStackedRackHose}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    doubleStackedRackHose: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Adjacent Rack Hose</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.adjacentRackHose}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    adjacentRackHose: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Release Points (FACP)</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.releasePoints}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    releasePoints: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Monitor Points (FACP)</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.monitorPoints}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    monitorPoints: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Battery Backups</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.batteryBackups}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    batteryBackups: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------ PRE-ENGINEERED (3 columns) ------------ */
function PreForm({
  systemId,
  opts,
  projectCurrency,
}: {
  systemId: string;
  opts: PreEngineeredOptions;
  projectCurrency?: string;
}) {
  const { updateSystemOptions } = useAppModel();
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
          <label className={styles.blockCheck}>
            <input
              type="checkbox"
              checked={opts.addOns.bulkRefillAdapter}
              onChange={(e) =>
                setAddOn({ bulkRefillAdapter: e.target.checked })
              }
            />
            Bulk cylinder refill adapter
          </label>

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
      </div>

      {/* RIGHT column — Edit values + two estimates */}
      <div className={styles.estimateCol}>
        <div className={styles.estimateGroup}>
          <div className={styles.editToggle}>
            <input
              type="checkbox"
              checked={opts.editValues}
              onChange={(e) =>
                updateSystemOptions(systemId, { editValues: e.target.checked })
              }
            />
            <strong>Edit values</strong>
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Release Points (FACP)</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.releasePoints}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    releasePoints: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>

          <div className={styles.estimateRow}>
            <label>Est. Monitor Points (FACP)</label>
            <input
              className={styles.controlXS}
              type="number"
              min={0}
              value={opts.estimates.monitorPoints}
              onChange={(e) =>
                updateSystemOptions(systemId, {
                  estimates: {
                    ...opts.estimates,
                    monitorPoints: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={!opts.editValues}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
