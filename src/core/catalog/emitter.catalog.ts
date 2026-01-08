// src/core/catalog/emitter.catalog.ts

import {
  __flow_cartridge_106,
  __1_emitter_dom_es,
  __flow_cartridge_79,
  __flow_cartridge_53,
  __58_emitter_cav_es,
  __58_emitter_cav_sp,
  __flow_cartridge_26,
  __flow_cartridge_13,
  __38_emitter_cav_es,
  __38_emitter_cav_ss,
  __flow_cartridge_211,
  __flow_cartridge_159,
  __12_emitter_dom_es,
  __12_emitter_dom_ss,
  __12_emitter_dom_sp,
  __38_emitter_dom_es,
  __38_emitter_dom_ss,
  __14_emitter_dom_ss,
  __18_emitter_dom_ss,
  __14_emitter_dom_es,
  __1_emitter_dom_ss,
  type Codes,
  __12_emitter_dom_br,
  __58_emitter_cav_ss,
} from "./parts.constants";

// emitter.catalog.ts (add near the top, after types)
export type CatalogOpts = { systemType?: "engineered" | "preengineered" };

// Allowed nozzle codes for PRE-ENGINEERED per design method
const PREENG_NOZZLE_WHITELIST: Record<MethodName, NozzleCode[]> = {
  "NFPA 770 Class A/C": ["5850", "5825", "3850", "3825"],
  "NFPA 770 Class B": ["1250", "1225", "3850", "3825"],
  "FM Data Centers": ["5850", "3850"],
  "FM Turbines": [],
  "FM Machine Spaces": [],
};

// Allowed styles for each allowed PRE-ENG nozzle
const PREENG_STYLE_WHITELIST: Record<
  MethodName,
  Record<NozzleCode, EmitterStyleKey[]>
> = {
  "NFPA 770 Class A/C": {
    "5850": ["escutcheon-stainless", "standard-pvdf", "standard-stainless"], // 5/8" Cavity @ 50
    "5825": ["escutcheon-stainless", "standard-pvdf", "standard-stainless"], // 5/8" Cavity @ 25
    "3850": ["escutcheon-stainless", "standard-stainless"], // 3/8" Cavity @ 50
    "3825": ["escutcheon-stainless", "standard-stainless"], // 3/8" Cavity @ 25
  },
  "NFPA 770 Class B": {
    "1250": ["escutcheon-stainless", "standard-stainless", "standard-pvdf"], // 1/2" Dome @ 50
    "1225": ["escutcheon-stainless", "standard-stainless", "standard-pvdf"], // 1/2" Dome @ 25
    "3850": ["escutcheon-stainless", "standard-stainless"], // 3/8" Dome @ 50
    "3825": ["escutcheon-stainless", "standard-stainless"], // 3/8" Dome @ 25
  },
  "FM Data Centers": {
    "5850": ["escutcheon-stainless"], // 5/8" Cavity @ 50
    "3850": ["escutcheon-stainless"], // 3/8" Cavity @ 50
  },
  "FM Turbines": {},
  "FM Machine Spaces": {},
};

// helper
function intersect<T>(a: T[], b: T[]) {
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}

// Parse a numeric size from the label prefix (e.g., `5/8"`, `1/2"`, `1"` → number)
function sizeValueFromLabel(label: string): number {
  // Fast checks by common substrings
  if (label.includes('1"')) return 1.0;
  if (label.includes('5/8"')) return 0.625;
  if (label.includes('1/2"')) return 0.5;
  if (label.includes('3/8"')) return 0.375;
  if (label.includes('1/4"')) return 0.25;
  if (label.includes('1/8"')) return 0.125;

  // Fallback: try to read something like 0.625" at start of label
  const m = label.match(/^([\d./]+)"/);
  if (m) {
    const frac = m[1];
    if (frac.includes("/")) {
      const [a, b] = frac.split("/").map(Number);
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
        return a / b;
      }
    } else {
      const n = Number(frac);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0; // unknown → smallest
}

// (Bring your existing emitterConfigMap here. The imports below are whatever you already use.)
export const emitterConfigMap: any = {
  "NFPA 770 Class A/C": {
    "150": {
      q_n2: 851,
      op_psi: 50,
      q_water: 1.06,
      f_cart: __flow_cartridge_106,
      e_label: '1" Dome Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __1_emitter_dom_es,
        "standard-stainless": __1_emitter_dom_ss,
      },
    },
    "125": {
      q_n2: 534,
      op_psi: 25,
      q_water: 0.79,
      f_cart: __flow_cartridge_79,
      e_label: '1" Dome Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __1_emitter_dom_es,
        "standard-stainless": __1_emitter_dom_ss,
      },
    },
    "5850": {
      q_n2: 369,
      op_psi: 50,
      q_water: 0.53,
      f_cart: __flow_cartridge_53,
      e_label: '5/8" Cavity Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __58_emitter_cav_es,
        "standard-pvdf": __58_emitter_cav_sp,
        "standard-stainless": __58_emitter_cav_ss,
      },
      pe_code: "F",
    },
    "5825": {
      q_n2: 230,
      op_psi: 25,
      q_water: 0.26,
      f_cart: __flow_cartridge_26,
      e_label: '5/8" Cavity Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __58_emitter_cav_es,
        "standard-pvdf": __58_emitter_cav_sp,
        "standard-stainless": __58_emitter_cav_ss,
      },
      pe_code: "E",
    },
    "3850": {
      q_n2: 130,
      op_psi: 50,
      q_water: 0.13,
      f_cart: __flow_cartridge_13,
      e_label: '3/8" Cavity Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_cav_es,
        "standard-stainless": __38_emitter_cav_ss,
      },
      pe_code: "B",
    },
    "3840": {
      q_n2: 110,
      op_psi: 40,
      q_water: 0.13,
      f_cart: __flow_cartridge_13,
      e_label: '3/8" Cavity Foil @ 40 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_cav_es,
        "standard-stainless": __38_emitter_cav_ss,
      },
    },
    "3825": {
      q_n2: 82,
      op_psi: 25,
      q_water: 0.13,
      f_cart: __flow_cartridge_13,
      e_label: '3/8" Cavity Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_cav_es,
        "standard-stainless": __38_emitter_cav_ss,
      },
      pe_code: "A",
    },
  },
  "NFPA 770 Class B": {
    "125": {
      q_n2: 534,
      op_psi: 25,
      q_water: 2.11,
      f_cart: __flow_cartridge_211,
      e_label: '1" Dome Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __1_emitter_dom_es,
        "standard-stainless": __1_emitter_dom_ss,
      },
    },
    "1250": {
      q_n2: 235,
      op_psi: 50,
      q_water: 1.59,
      f_cart: __flow_cartridge_159,
      e_label: '1/2" Dome Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __12_emitter_dom_es,
        "standard-pvdf": __12_emitter_dom_sp,
        "standard-stainless": __12_emitter_dom_ss,
      },
      pe_code: "D",
    },
    "1225": {
      q_n2: 145,
      op_psi: 25,
      q_water: 1.06,
      f_cart: __flow_cartridge_106,
      e_label: '1/2" Dome Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __12_emitter_dom_es,
        "standard-pvdf": __12_emitter_dom_sp,
        "standard-stainless": __12_emitter_dom_ss,
      },
      pe_code: "C",
    },
    "3850": {
      q_n2: 130,
      op_psi: 50,
      q_water: 0.79,
      f_cart: __flow_cartridge_79,
      e_label: '3/8" Dome Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_dom_es,
        "standard-stainless": __38_emitter_dom_ss,
      },
      pe_code: "B",
    },
    "3840": {
      q_n2: 110,
      op_psi: 40,
      q_water: 0.79,
      f_cart: __flow_cartridge_79,
      e_label: '3/8" Dome Foil @ 40 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_dom_es,
        "standard-stainless": __38_emitter_dom_ss,
      },
    },
    "3825": {
      q_n2: 82,
      op_psi: 25,
      q_water: 0.53,
      f_cart: __flow_cartridge_53,
      e_label: '3/8" Dome Foil @ 25 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_dom_es,
        "standard-stainless": __38_emitter_dom_ss,
      },
      pe_code: "A",
    },
    "1440": {
      q_n2: 40,
      op_psi: 40,
      q_water: 0.26,
      f_cart: __flow_cartridge_26,
      e_label: '1/4" Dome Foil @ 40 PSI',
      e_style: {
        "standard-stainless": __14_emitter_dom_ss,
        "escutcheon-stainless": __14_emitter_dom_es,
      },
    },
    "1840": {
      q_n2: 14,
      op_psi: 40,
      q_water: 0.13,
      f_cart: __flow_cartridge_13,
      e_label: '1/8" Dome Foil @ 40 PSI',
      e_style: {
        "standard-stainless": __18_emitter_dom_ss,
      },
    },
  },
  "FM Data Centers": {
    "150": {
      q_n2: 851,
      op_psi: 50,
      q_water: 1.06,
      f_cart: __flow_cartridge_106,
      e_label: '1" Dome Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __1_emitter_dom_es,
      },
    },
    "5850": {
      q_n2: 369,
      op_psi: 50,
      q_water: 0.53,
      f_cart: __flow_cartridge_53,
      e_label: '5/8" Cavity Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __58_emitter_cav_es,
      },
      pe_code: "F",
    },
    "3850": {
      q_n2: 130,
      op_psi: 50,
      q_water: 0.13,
      f_cart: __flow_cartridge_13,
      e_label: '3/8" Cavity Foil @ 50 PSI',
      e_style: {
        "escutcheon-stainless": __38_emitter_cav_es,
      },
      pe_code: "B",
    },
  },
  "FM Machine Spaces": {
    "1225": {
      q_n2: 150,
      op_psi: 25,
      q_water: 1.06,
      f_cart: __flow_cartridge_106,
      e_label: '1/2" Dome Foil @ 25 PSI',
      e_style: {
        "standard-brass": __12_emitter_dom_br,
      },
    },
  },
  "FM Turbines": {
    "1225": {
      q_n2: 150,
      op_psi: 25,
      q_water: 1.06,
      f_cart: __flow_cartridge_106,
      e_label: '1/2" Dome Foil @ 25 PSI',
      e_style: {
        "standard-brass": __12_emitter_dom_br,
      },
    },
  },
};

export type MethodName =
  | "NFPA 770 Class A/C"
  | "NFPA 770 Class B"
  | "FM Data Centers"
  | "FM Turbines"
  | "FM Machine Spaces";

export type NozzleCode = string; // e.g. "5825"

export function getNozzlesForMethod(method: MethodName, opts?: CatalogOpts) {
  const cfg = emitterConfigMap[method];
  if (!cfg) return [];

  // Build raw list with access to op_psi and label
  let list = Object.entries(cfg).map(([code, spec]: any) => ({
    code,
    label: spec.e_label as string,
    psi: Number(spec.op_psi) || 0,
    sizeVal: sizeValueFromLabel(String(spec.e_label || "")),
  }));

  // Pre-engineered: apply whitelist
  if (opts?.systemType === "preengineered") {
    const allowed = new Set(PREENG_NOZZLE_WHITELIST[method] ?? []);
    list = list.filter((n) => allowed.has(n.code));
  }

  // Sort by decreasing nozzle size, then by decreasing operating pressure
  list.sort((a, b) => {
    if (b.psi !== a.psi) return b.psi - a.psi; // 50 > 40 > 25
    if (b.sizeVal !== a.sizeVal) return b.sizeVal - a.sizeVal; // 1" > 5/8" > 3/8" ...
    return a.label.localeCompare(b.label); // stable tiebreaker
  });

  // Return the shape used by the UI
  return list.map(({ code, label }) => ({ code, label }));
}

export function getStylesFor(
  method: MethodName,
  nozzle: NozzleCode,
  opts?: CatalogOpts
) {
  const spec = emitterConfigMap[method]?.[nozzle];
  if (!spec?.e_style) return [];

  let styles = Object.keys(spec.e_style) as EmitterStyleKey[];

  if (opts?.systemType === "preengineered") {
    const allow = PREENG_STYLE_WHITELIST[method]?.[nozzle];
    if (!allow) return []; // nozzle not allowed for pre-eng
    styles = intersect(styles, allow); // keep only allowed subset
  }
  return styles;
}

export function getNozzleLabel(method: MethodName, nozzle: NozzleCode) {
  return emitterConfigMap[method]?.[nozzle]?.e_label ?? nozzle;
}

// Defaults that mirror your old logic (safe fallbacks if missing)
export function pickDefaultNozzle(
  method: MethodName,
  opts?: CatalogOpts
): NozzleCode {
  if (opts?.systemType === "preengineered") {
    const allowed = PREENG_NOZZLE_WHITELIST[method] ?? [];
    // choose first that actually exists in the catalog
    for (const code of allowed) {
      if (emitterConfigMap[method]?.[code]) return code;
    }
    return ""; // none allowed
  }

  // existing engineered default logic
  const defaults: Record<MethodName, NozzleCode> = {
    "NFPA 770 Class A/C": "5825",
    "NFPA 770 Class B": "1225",
    "FM Data Centers": "3850",
    "FM Turbines": "1225",
    "FM Machine Spaces": "1225",
  };
  const preferred = defaults[method];
  const exists = !!emitterConfigMap[method]?.[preferred];
  if (exists) return preferred;
  const list = getNozzlesForMethod(method);
  return list[0]?.code ?? "";
}

export function pickDefaultStyle(
  method: MethodName,
  nozzle: NozzleCode,
  opts?: CatalogOpts
): EmitterStyleKey | "" {
  const styles = getStylesFor(method, nozzle, opts);
  return styles[0] ?? "";
}
export type EmitterStyleKey =
  | "standard-stainless"
  | "escutcheon-stainless"
  | "standard-pvdf"
  | "standard-brass";

export function resolveEmitterSpec(
  method: MethodName,
  nozzleCode: string,
  style: EmitterStyleKey
): null | {
  emitterPart: Codes; // [BPCS, M3]
  flowCartridge: Codes; // [BPCS, M3]
  q_n2: number;
  q_water: number;
  label: string;
  pe_code: string;
} {
  const conf = emitterConfigMap[method]?.[nozzleCode];
  if (!conf) return null;
  const emitterPart = conf.e_style?.[style];
  if (!emitterPart) return null;
  return {
    emitterPart,
    flowCartridge: conf.f_cart,
    q_n2: conf.q_n2,
    q_water: conf.q_water,
    label: conf.e_label,
    pe_code: conf.pe_code,
  };
}

// Reverse lookup: find nozzleCode by (method, pe_code, style)
// Used for decoding pre-eng system partcodes.
export function findNozzleByPeCode(
  method: MethodName,
  peCode: string,
  style: EmitterStyleKey,
  opts?: CatalogOpts
): NozzleCode | undefined {
  const cfg = emitterConfigMap?.[method];
  if (!cfg) return undefined;

  // Candidate nozzle codes that match pe_code and support the style
  let candidates = Object.entries(cfg)
    .filter(([nozzle, spec]: any) => {
      if (!spec) return false;
      if (String(spec.pe_code || "") !== String(peCode || "")) return false;
      const styles = spec.e_style ? Object.keys(spec.e_style) : [];
      return styles.includes(style);
    })
    .map(([nozzle]) => nozzle as NozzleCode);

  // If pre-engineered, restrict to whitelist (and preserve its ordering)
  if (opts?.systemType === "preengineered") {
    const allowed = PREENG_NOZZLE_WHITELIST[method] ?? [];
    const allowedSet = new Set(allowed);
    candidates = candidates.filter((c) => allowedSet.has(c));

    // Prefer the whitelist order if multiple candidates
    for (const a of allowed) {
      if (candidates.includes(a)) return a;
    }
  }

  // Otherwise (or if whitelist didn't decide), apply a stable preference:
  // prefer higher op_psi, then larger size, then lexical tie-breaker
  const scored = candidates
    .map((code) => {
      const spec: any = cfg[code];
      const psi = Number(spec?.op_psi) || 0;
      const sizeVal = sizeValueFromLabel(String(spec?.e_label || ""));
      return { code, psi, sizeVal, label: String(spec?.e_label || code) };
    })
    .sort((a, b) => {
      if (b.psi !== a.psi) return b.psi - a.psi;
      if (b.sizeVal !== a.sizeVal) return b.sizeVal - a.sizeVal;
      return a.label.localeCompare(b.label);
    });

  return scored[0]?.code;
}
