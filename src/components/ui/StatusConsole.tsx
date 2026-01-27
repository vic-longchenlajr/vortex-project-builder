import React from "react";
import { useAppModel } from "@/state/app-model";
import styles from "@/styles/statusconsole.module.css";
import Link from "next/link";
import { codeHref } from "@/core/status/error-codes";

export default function StatusConsole({
  onTutorialStatusClick,
}: {
  onTutorialStatusClick?: (m: any) => void;
}) {
  const { project, status, hasErrors } = useAppModel();

  const errorCount = status.filter((s) => s.severity === "error").length;
  const warnCount = status.filter((s) => s.severity === "warn").length;
  const infoCount = status.filter((s) => s.severity === "info").length;

  const pathFor = (m: any) => {
    const sys = project.systems.find((s) => s.id === m.systemId);
    const zone = sys?.zones.find((z) => z.id === m.zoneId);
    const enc = zone?.enclosures.find((e) => e.id === m.enclosureId);
    return [sys?.name, zone?.name, enc?.name].filter(Boolean).join(" › ");
  };
  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    const isSysOrZone = id.startsWith("sys-") || id.startsWith("zone-");

    if (!isSysOrZone) {
      // ✅ keep current behavior for enclosures (works fine)
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // ✅ offset scroll so system/zone header doesn't get covered by sticky UI
      const root = document.documentElement;
      const css = getComputedStyle(root);

      const px = (v: string) => {
        const n = parseFloat(v || "0");
        return Number.isFinite(n) ? n : 0;
      };

      // These are your layout tokens (with safe fallbacks)
      const navH = px(css.getPropertyValue("--nav-height")) || 56;
      const gutter = px(css.getPropertyValue("--sticky-gutter")) || 24;

      // Prefer measuring actual sticky elements (best for multi-line / responsive)
      const controlsEl = document.querySelector(
        '[data-controls-sticky="1"]'
      ) as HTMLElement | null;

      const controlsH =
        controlsEl?.offsetHeight ||
        px(css.getPropertyValue("--controls-height")) ||
        47;

      // The system summary itself is sticky too — include its height so the target
      // lands below it (important for zone titles)
      const summaryEl = document.querySelector(
        '[data-system-summary="1"]'
      ) as HTMLElement | null;

      const summaryH = summaryEl?.offsetHeight ?? 0;

      const offset = navH + gutter + controlsH + summaryH + 8;

      const y = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, y - offset), behavior: "smooth" });
    }

    // flash target
    el.classList.remove(styles.flashTarget);
    void el.offsetWidth;
    el.classList.add(styles.flashTarget);
    window.setTimeout(() => el.classList.remove(styles.flashTarget), 900);
  };

  const targetIdFor = (m: any) => {
    if (m.enclosureId) return `enc-${m.enclosureId}`;
    if (m.zoneId) return `zone-${m.zoneId}`;
    if (m.systemId) return `sys-${m.systemId}`;
    return null;
  };

  const onClickMsg = (m: any) => {
    const id = targetIdFor(m);
    if (id) scrollToId(id);
    onTutorialStatusClick?.(m);
  };

  return (
    <section
      className={`${styles.section} ${styles.statusTallCard}`}
      data-tour="status-console"
    >
      <h3 className={styles.heading}>Status Console</h3>

      <div className={styles.pillRow}>
        <span className={`${styles.pill} ${styles.pillError}`}>
          {errorCount} Errors
        </span>
        <span className={`${styles.pill} ${styles.pillWarn}`}>
          {warnCount} Warnings
        </span>
        <span className={`${styles.pill} ${styles.pillInfo}`}>
          {infoCount} Info
        </span>
      </div>
      {hasErrors && (
        <div>
          <div className={styles.blocker}>
            Actions (Generate BOM + Submit Project) are disabled until errors
            are resolved.
          </div>
          <br></br>
        </div>
      )}
      <div className={styles.statusConsoleWrap}>
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className={styles.log}
        >
          {status.length === 0 ? (
            <div className={styles.empty}>
              No messages yet. Click <strong>Calculate</strong> to run checks.
            </div>
          ) : (
            status.map((m) => {
              const tourId =
                m.code === "ENC.MISSING_NAME"
                  ? "status-msg-1"
                  : m.code === "ENC.NFPA_LOW_DISCHARGE"
                    ? "status-msg-2"
                    : undefined;

              const severityClass =
                m.severity === "error"
                  ? styles.itemError
                  : m.severity === "warn"
                    ? styles.itemWarn
                    : styles.itemInfo;

              return (
                <div
                  key={m.id}
                  className={`${styles.item} ${severityClass} ${styles.itemClickable}`}
                  onClick={() => onClickMsg(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClickMsg(m);
                    }
                  }}
                  aria-label={`Jump to ${pathFor(m) || "location"}`}
                  data-tour={tourId}
                >
                  <div className={styles.itemText}>
                    {m.code ? (
                      <>
                        <Link
                          href={codeHref(m.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.codeLink}
                          aria-label={`Open ${m.code} in the Guide (opens in new tab)`}
                          title="Lookup code reference in the Guide (opens in new tab)"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <strong>[{m.code}]</strong>
                        </Link>
                        <br />
                      </>
                    ) : null}
                    {m.text}{" "}
                  </div>
                  {m.systemId || m.zoneId || m.enclosureId ? (
                    <div className={styles.itemPath}>{pathFor(m)}</div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
