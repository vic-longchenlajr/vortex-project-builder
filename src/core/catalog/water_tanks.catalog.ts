// src/core/catalog/water_tanks.catalog.ts
import {
  __tank_10gal,
  __tank_30gal,
  __tank_60gal,
  __tank_80gal,
  __tank_120gal,
  __tank_200gal,
  __tank_400gal,
  __tank_10gal_afc,
  __tank_30gal_afc,
  __tank_100lit,
  __tank_150lit,
  __tank_300lit,
  __tank_500lit,
  __tank_750lit,
  __tank_1000lit,
  type Codes, // <-- add this
} from "./parts.constants";
import type { WaterTankCert } from "@/state/app-model";

export type WaterTankSpec = {
  cert: WaterTankCert;
  capacityGal?: number;
  capacityL?: number;
  codes: Codes; // <-- use the shared tuple type
  description: string;
  pe_code?: string;
};

export const TANKS: WaterTankSpec[] = [
  {
    cert: "ASME/FM",
    capacityGal: 10,
    codes: __tank_10gal,
    description: "10 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
    pe_code: "A",
  },
  {
    cert: "ASME/FM",
    capacityGal: 30,
    codes: __tank_30gal,
    description: "30 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
    pe_code: "C",
  },
  {
    cert: "ASME/FM",
    capacityGal: 60,
    codes: __tank_60gal,
    description: "60 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "ASME/FM",
    capacityGal: 80,
    codes: __tank_80gal,
    description: "80 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "ASME/FM",
    capacityGal: 120,
    codes: __tank_120gal,
    description: "120 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "ASME/FM",
    capacityGal: 200,
    codes: __tank_200gal,
    description: "200 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "ASME/FM",
    capacityGal: 400,
    codes: __tank_400gal,
    description: "400 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  // TODO: hold off until inventory is in place – Samuel ship date is 3/6
  // {
  //   cert: "CE/ASME/FM",
  //   capacityGal: 10,
  //   codes: __tank_10gal_afc,
  //   description: "10 Gallon Water Tank, Red, w/ Trim, ASME, CE and FM approved",
  //   pe_code: "B",
  // },
  {
    cert: "CE/ASME/FM",
    capacityGal: 30,
    codes: __tank_30gal_afc,
    description: "30 Gallon Water Tank, Red, w/ Trim, ASME, CE and FM approved",
    pe_code: "D",
  },

  {
    cert: "CE",
    capacityL: 100,
    codes: __tank_100lit,
    description: "D/950 WATER TANK ASY UPDATED DESIGN 100L  SS316L CE",
    pe_code: "E",
  },
  {
    cert: "CE",
    capacityL: 150,
    codes: __tank_150lit,
    description: "D/950 WATER TANK ASY 150L SS316L CE",
    pe_code: "F",
  },
  {
    cert: "CE",
    capacityL: 300,
    codes: __tank_300lit,
    description: "D/950 WATER TANK ASY 300L SS316L CE",
  },
  {
    cert: "CE",
    capacityL: 500,
    codes: __tank_500lit,
    description: "D/950 WATER TANK ASY 500L SS316L CE",
  },
  {
    cert: "CE",
    capacityL: 750,
    codes: __tank_750lit,
    description: "D/950 WATER TANK ASY 750L SS316L CE",
  },
  {
    cert: "CE",
    capacityL: 1000,
    codes: __tank_1000lit,
    description: "D/950 WATER TANK ASY 1000L SS316L CE",
  },
];

// --- conversions ---
const GAL_TO_L = 3.78541;

// Pretty label for messages
export function prettyCert(cert: WaterTankCert): string {
  switch (cert) {
    case "ASME/FM":
      return "ASME and FM approved";
    case "CE/ASME/FM":
      return "ASME, CE and FM approved";
    case "CE":
      return "CE";
    default:
      return String(cert);
  }
}

export function selectWaterTankStrict(
  cert: WaterTankCert,
  requiredGallons: number
): WaterTankSpec | null {
  const reqGal = Number(requiredGallons);
  if (!Number.isFinite(reqGal) || reqGal <= 0) return null;

  const list = TANKS.filter((t) => t.cert === cert);
  if (!list.length) return null;

  if (cert === "CE") {
    const reqL = reqGal * GAL_TO_L;
    return (
      list
        .filter((t) => typeof t.capacityL === "number" && t.capacityL >= reqL)
        .sort((a, b) => a.capacityL! - b.capacityL!)[0] ?? null
    );
  }

  return (
    list
      .filter(
        (t) => typeof t.capacityGal === "number" && t.capacityGal >= reqGal
      )
      .sort((a, b) => a.capacityGal! - b.capacityGal!)[0] ?? null
  );
}
/**
 * Max capacity for the EXACT cert.
 * Returns gallons (convert from L for CE tanks).
 */
export function maxCapacityForCert(cert: WaterTankCert): number {
  const list = TANKS.filter((t) => t.cert === cert);
  if (!list.length) return 0;

  if (cert === "CE") {
    const maxL = Math.max(...list.map((t) => t.capacityL ?? 0));
    return maxL / GAL_TO_L; // return gallons as a real number
  }

  return Math.max(...list.map((t) => t.capacityGal ?? 0));
}
