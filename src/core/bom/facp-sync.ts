// src/core/bom/facp-sync.ts
import type { Project, EngineeredOptions } from "@/state/app-model";
import { collectFACP } from "@/core/bom/collect-project";

export function syncPointsFromBOM(project: Project): Project {
  const facp = collectFACP(project);

  const systems = project.systems.map((sys) => {
    if (sys.type !== "engineered") return sys;

    const block = facp[sys.id];
    if (!block) return sys;

    const opts = sys.options as EngineeredOptions;
    if (opts.isEstimateEditingEnabled) return sys; // user overrides win

    const releasePoints = block.totals.releasing; // 24V releasing circuits
    const monitorPoints = block.totals.supervisory + block.totals.alarmPoints; // "monitor" = sup + alarm

    const nextEst = {
      ...opts.estimates,
      releasePoints,
      monitorPoints,
    };

    const unchanged =
      nextEst.releasePoints === opts.estimates.releasePoints &&
      nextEst.monitorPoints === opts.estimates.monitorPoints;

    return unchanged
      ? sys
      : { ...sys, options: { ...opts, estimates: nextEst } };
  });

  return { ...project, systems };
}
