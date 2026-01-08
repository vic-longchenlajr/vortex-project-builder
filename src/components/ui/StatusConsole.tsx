import React from "react";
import { useAppModel } from "@/state/app-model";
import styles from "@/styles/statusconsole.module.css";

export default function StatusConsole() {
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

  return (
    <section className={`${styles.section} ${styles.statusTallCard}`}>
      <h3 className={styles.heading}>Status</h3>

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
              const severityClass =
                m.severity === "error"
                  ? styles.itemError
                  : m.severity === "warn"
                    ? styles.itemWarn
                    : styles.itemInfo;
              return (
                <div key={m.id} className={`${styles.item} ${severityClass}`}>
                  <div className={styles.itemText}>
                    {m.code ? (
                      // <a
                      //   href={codeHref(m.code)}
                      //   target="_blank"
                      //   rel="noopener noreferrer"
                      //   className={styles.itemCodeLink}
                      // >
                      //   <strong>[{m.code}]</strong>
                      // </a>
                      <strong>[{m.code}]</strong>
                    ) : null}
                    <br></br>
                    {m.text}
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
