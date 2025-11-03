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

export type WaterTankCert = "US_ASME_FM" | "US_ASME_CE_FM" | "CE_SS316L";

export type WaterTankSpec = {
  cert: WaterTankCert;
  capacityGal?: number;
  capacityL?: number;
  codes: Codes; // <-- use the shared tuple type
  description: string;
  pe_code?: string;
};

const TANKS: WaterTankSpec[] = [
  {
    cert: "US_ASME_FM",
    capacityGal: 10,
    codes: __tank_10gal,
    description: "10 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
    pe_code: "A",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 30,
    codes: __tank_30gal,
    description: "30 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
    pe_code: "C",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 60,
    codes: __tank_60gal,
    description: "60 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 80,
    codes: __tank_80gal,
    description: "80 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 120,
    codes: __tank_120gal,
    description: "120 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 200,
    codes: __tank_200gal,
    description: "200 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  {
    cert: "US_ASME_FM",
    capacityGal: 400,
    codes: __tank_400gal,
    description: "400 Gallon Water Tank, Red, w/ Trim, ASME and FM approved",
  },
  // TODO: hold off until inventory is in place – Samuel ship date is 3/6
  // {
  //   cert: "US_ASME_CE_FM",
  //   capacityGal: 10,
  //   codes: __tank_10gal_afc,
  //   description: "10 Gallon Water Tank, Red, w/ Trim, ASME, CE and FM approved",
  //   pe_code: "B",
  // },
  {
    cert: "US_ASME_CE_FM",
    capacityGal: 30,
    codes: __tank_30gal_afc,
    description: "30 Gallon Water Tank, Red, w/ Trim, ASME, CE and FM approved",
    pe_code: "D",
  },

  {
    cert: "CE_SS316L",
    capacityL: 100,
    codes: __tank_100lit,
    description: "D/950 WATER TANK ASY UPDATED DESIGN 100L  SS316L CE",
    pe_code: "E",
  },
  {
    cert: "CE_SS316L",
    capacityL: 150,
    codes: __tank_150lit,
    description: "D/950 WATER TANK ASY 150L SS316L CE",
    pe_code: "F",
  },
  {
    cert: "CE_SS316L",
    capacityL: 300,
    codes: __tank_300lit,
    description: "D/950 WATER TANK ASY 300L SS316L CE",
  },
  {
    cert: "CE_SS316L",
    capacityL: 500,
    codes: __tank_500lit,
    description: "D/950 WATER TANK ASY 500L SS316L CE",
  },
  {
    cert: "CE_SS316L",
    capacityL: 750,
    codes: __tank_750lit,
    description: "D/950 WATER TANK ASY 750L SS316L CE",
  },
  {
    cert: "CE_SS316L",
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
    case "US_ASME_FM":
      return "ASME and FM approved";
    case "US_ASME_CE_FM":
      return "ASME, CE and FM approved";
    case "CE_SS316L":
      return "CE";
  }
}

export function selectWaterTankStrict(
  cert: WaterTankCert,
  requiredGallons: number
): WaterTankSpec | null {
  const reqGal = Math.max(0, Math.ceil(Number(requiredGallons) || 0));
  const list = TANKS.filter((t) => t.cert === cert);
  if (!list.length) return null;

  if (cert === "CE_SS316L") {
    const reqL = Math.ceil(reqGal * 3.78541);
    return (
      list
        .filter(
          (t) =>
            typeof t.capacityL === "number" && (t.capacityL as number) >= reqL
        )
        .sort((a, b) => (a.capacityL as number) - (b.capacityL as number))[0] ??
      null
    );
  }

  return (
    list
      .filter(
        (t) =>
          typeof t.capacityGal === "number" &&
          (t.capacityGal as number) >= reqGal
      )
      .sort(
        (a, b) => (a.capacityGal as number) - (b.capacityGal as number)
      )[0] ?? null
  );
}
/**
 * Max capacity for the EXACT cert.
 * Returns gallons (convert from L for CE tanks).
 */
export function maxCapacityForCert(cert: WaterTankCert): number {
  const list = TANKS.filter((t) => t.cert === cert);
  if (list.length === 0) return 0;

  if (cert === "CE_SS316L") {
    const maxL = Math.max(...list.map((t) => t.capacityL ?? 0));
    // Convert back to gallons for consistent UI/messages
    return Math.floor(maxL / GAL_TO_L);
  }

  return Math.max(...list.map((t) => t.capacityGal ?? 0));
}

export { TANKS }; // optional export
