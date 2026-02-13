import type { Project, System, Zone, Enclosure } from "@/state/app-model";

/**
 * Migrate legacy project references (pre-refactor) to standardized naming.
 * This is a "best effort" migration to support loading old JSON files during dev/test.
 */
export function migrateLegacyProject(input: any): Project {
    if (!input) return input;

    const project: Project = { ...input };

    // 1. Rename multipliers
    if ("engineeredMultiplier" in input) {
        project.priceMultiplierEngineered = input.engineeredMultiplier;
        delete (project as any).engineeredMultiplier;
    }
    if ("preengineeredMultiplier" in input) {
        project.priceMultiplierPreEngineered = input.preengineeredMultiplier;
        delete (project as any).preengineeredMultiplier;
    }

    // 2. Systems
    if (Array.isArray(project.systems)) {
        project.systems = project.systems.map((sys: any) => migrateSystem(sys));
    }

    return project;
}

function migrateSystem(sys: any): System {
    const s = { ...sys };

    // Options migration
    if (s.options) {
        const o = { ...s.options };

        // Engineered Options
        if (o.kind === "engineered") {
            updateField(o, "bulkTubes", "usesBulkTubes");
            updateField(o, "editValues", "isEstimateEditingEnabled");
            updateField(o, "_editEstimates", "estimateOverrides");
            updateField(o, "bulkTubeNitrogenSCF", "bulkTubeCapacityScf");
            updateField(o, "waterTankRequired_gal", "requiredWaterTankCapacityGal");
            updateField(o, "waterTankPick", "selectedWaterTankPartCode");
            updateField(o, "waterTankPickDesc", "selectedWaterTankDescription");
            updateField(o, "bulkTubesEligible", "isBulkTubeEligible");

            // waterTank -> waterTankCertification
            if ("waterTank" in o) {
                o.waterTankCertification = o.waterTank;
                delete o.waterTank;
            }
        }

        // Pre-Engineered Options
        if (o.kind === "preengineered") {
            updateField(o, "systemPartCode", "derivedSystemPartCode");
            updateField(o, "systemPartCodeLocked", "isPartCodeLocked");
            updateField(o, "waterTankRequired_gal", "requiredWaterTankCapacityGal");
            updateField(o, "waterTankPick", "selectedWaterTankPartCode");
            updateField(o, "waterTankPickDesc", "selectedWaterTankDescription");

            // AddOns
            if (o.addOns) {
                const a = { ...o.addOns };
                updateField(a, "placardsAndSignage", "hasPlacardsAndSignage");
                updateField(a, "bulkRefillAdapter", "hasBulkRefillAdapter");
                updateField(a, "expProofTransducer", "isExplosionProof");
                updateField(a, "waterFlexLine", "hasWaterFlexLine");
                updateField(a, "igsFlexibleHose48", "hasIgsFlexibleHose48");
                o.addOns = a;
            }
        }

        // System Totals (Engineered)
        updateField(o, "totalCylinders", "systemCylinderCount");
        updateField(o, "dischargePanels_qty", "dischargePanelCount");
        updateField(o, "estReleasePoints", "estimatedReleasePoints");

        s.options = o;
    }

    // Zones
    if (Array.isArray(s.zones)) {
        s.zones = s.zones.map((z: any) => migrateZone(z));
    }

    return s;
}

function migrateZone(zone: any): Zone {
    const z = { ...zone };

    updateField(z, "minTotalCylinders", "requiredCylinderCount");
    updateField(z, "totalNitrogenDelivered_scf", "nitrogenDeliveredScf");
    updateField(z, "totalNitrogenRequired_scf", "nitrogenRequiredScf");
    updateField(z, "pipeDryVolumeGal", "pipeVolumeGal");
    updateField(z, "overrideCylinders", "customCylinderCount");
    updateField(z, "_editCylinders", "isCylinderCountOverridden");
    updateField(z, "q_n2_peak_scfm", "peakNitrogenFlowRateScfm");
    updateField(z, "water_peak_gpm", "peakWaterFlowRateGpm");
    updateField(z, "waterDischarge_gal", "waterDischargeVolumeGal");
    updateField(z, "waterTankMin_gal", "minWaterTankCapacityGal");

    if (Array.isArray(z.enclosures)) {
        z.enclosures = z.enclosures.map((e: any) => migrateEnclosure(e));
    }

    return z;
}

function migrateEnclosure(enc: any): Enclosure {
    const e = { ...enc };

    updateField(e, "volume", "volumeFt3");
    updateField(e, "tempF", "temperatureF");
    updateField(e, "method", "designMethod");
    updateField(e, "nozzleCode", "nozzleModel");
    updateField(e, "emitterStyle", "nozzleOrientation");
    updateField(e, "minEmitters", "requiredNozzleCount");
    updateField(e, "customMinEmitters", "customNozzleCount");
    updateField(e, "_editEmitters", "isNozzleCountOverridden");
    updateField(e, "estDischarge", "estimatedDischargeDuration");
    updateField(e, "estFinalO2", "estimatedFinalOxygenPercent");
    updateField(e, "qWater_gpm", "waterFlowRateGpm");
    updateField(e, "qWaterTotal_gpm", "totalWaterFlowRateGpm");
    // estWater_gal -> estimatedWaterVolumeGal?
    // Let's check AppModel... Step 138-140 in task.md
    // estWater_gal -> estimatedWaterVolumeGal (Rule 39)
    updateField(e, "estWater_gal", "estimatedWaterVolumeGal");

    // 3. Pre-Engineered Volume Migration (L*W*H -> volumeFt3)
    // If we have dimensions but volume is missing/zero, back-fill it.
    // Note: L/W/H were always stored in "active units" (same as volumeFt3),
    // so we don't need a units-based conversion here, just the multiplication.
    const l = Number(e.length || 0);
    const w = Number(e.width || 0);
    const h = Number(e.height || 0);
    if ((!e.volumeFt3 || e.volumeFt3 === 0) && l > 0 && w > 0 && h > 0) {
        e.volumeFt3 = l * w * h;
    }

    return e;
}

function updateField(obj: any, oldKey: string, newKey: string) {
    if (oldKey in obj) {
        obj[newKey] = obj[oldKey];
        delete obj[oldKey];
    }
}
