// src/core/status/highlights.ts
import type { Severity, StatusMessage } from "@/state/app-model";

export type HighlightLevel = Exclude<Severity, "info"> | null;

const rank: Record<Severity, number> = { info: 0, warn: 1, error: 2 };

export function maxSeverity(a: Severity | null | undefined, b: Severity) {
  if (!a) return b;
  return rank[b] > rank[a] ? b : a;
}

export function buildHighlights(status: StatusMessage[]) {
  const zoneLevel = new Map<string, HighlightLevel>(); // key: zoneId
  const enclosureLevel = new Map<string, HighlightLevel>(); // key: enclosureId

  for (const m of status) {
    // only error/warn should highlight
    if (m.severity !== "error" && m.severity !== "warn") continue;

    // enclosure messages highlight enclosure row
    if (m.enclosureId) {
      enclosureLevel.set(
        m.enclosureId,
        maxSeverity(
          enclosureLevel.get(m.enclosureId),
          m.severity
        ) as HighlightLevel
      );
      continue;
    }

    // zone messages highlight the zone card
    if (m.zoneId) {
      zoneLevel.set(
        m.zoneId,
        maxSeverity(zoneLevel.get(m.zoneId), m.severity) as HighlightLevel
      );
      continue;
    }

    // (optional) system-level highlight could go here later
  }

  return { zoneLevel, enclosureLevel };
}
