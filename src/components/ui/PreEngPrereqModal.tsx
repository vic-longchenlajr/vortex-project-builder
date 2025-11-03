import React from "react";
import cn from "clsx";
import styles from "@/styles/preengprereqmodal.module.css";

const STORAGE_KEY = "vv_pe_prereq_ack_v1";

type Props = {
  open: boolean;
  onCancel: () => void;
  onProceed: () => void; // call your addSystem("preengineered")
};

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    // smoke-test: set/remove
    const t = "__stor_test";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    return null;
  }
}

export function shouldShowPreEngPrereq(): boolean {
  const ls = safeStorage();
  if (!ls) return true; // if storage is blocked, show modal (safe default)
  return !ls.getItem(STORAGE_KEY);
}

export default function PreEngPrereqModal({
  open,
  onCancel,
  onProceed,
}: Props) {
  const [dontShow, setDontShow] = React.useState(false);

  const handleProceed = () => {
    const ls = safeStorage();
    if (dontShow && ls) {
      try {
        ls.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    onProceed();
  };
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="peprereq-title"
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 id="peprereq-title" className={styles.title}>
            PREREQUISITES FOR VICTAULIC VORTEX™ PRE-ENGINEERED SYSTEM
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.lede}>
            The Victaulic Vortex™ Pre-Engineered System is intended to be used
            in applications where the following requirements shall be satisfied
            prior to selection and installation of the system:
          </p>

          <ol className={styles.listDec}>
            <li>
              It is the sole responsibility of the Victaulic Vortex™ Certified
              individual to verify proper identification of the hazards present
              in the protected area has been performed for the application.
              Identification of hazards is critical to ensure performance of the
              Victaulic Vortex™ Pre-Engineered System. A fire protection
              engineer, or another qualified individual accepted by the AHJ,
              shall identify all hazards.
            </li>
            <li>
              Selection of the proper system design type shall be identified.
              The system design types applicable for the Victaulic Vortex™
              Pre-Engineered System are as follows (reference Appendix A and B
              of I-Vortex/PE.DIOM for additional information):
              <ul className={styles.listDisc}>
                <li>
                  Data Centers in accordance with the FM Approved Data
                  Processing Rooms/Halls applications
                </li>
                <li>
                  Performance-Based Class A/C Fire applications in accordance
                  with NFPA 770 discharge requirements
                </li>
                <li>
                  Performance-Based Class B Fire applications in accordance with
                  NFPA 770 discharge requirements
                </li>
              </ul>
            </li>
            <li>
              Confirm enclosure requirements (detailed in I-Vortex/PE.DIOM) are
              satisfied by the protected space.
            </li>
            <li>
              It is the responsibility of the Victaulic Vortex™ Certified
              individual to ensure the proper installation of a Fire Alarm
              system that is designed and intended for use in a special
              hazard/agent releasing configuration. This includes detection,
              control panel(s), power supply requirements, notification,
              auxiliary controls, wiring, raceways, electrical enclosures,
              devices, and any other requirements pertaining to the proper
              design, installation, and maintenance of the Fire Alarm System.
            </li>
          </ol>

          <div className={styles.warningBlock}>
            <div className={styles.warningBand}>WARNING</div>
            <ul className={cn(styles.listDisc, styles.warningList)}>
              <li>
                The Victaulic Vortex™ Pre-Engineered System is intended to
                simplify the design and installation of Victaulic Vortex™
                technology. The Certified Victaulic Vortex™ individual is
                solely responsible for verification that all applicable hazard
                analysis, fire alarm requirements, auxiliary functions,
                enclosure requirements, and special hazard requirements are
                considered and implemented.
              </li>
            </ul>
            <p className={styles.warningNote}>
              Failure to properly select system design type can result in
              abnormal performance of the Victaulic Vortex™ Pre-Engineered
              System. The wrong system design can also cause personal injury,
              property damage, and death.
            </p>
          </div>
        </div>

        <footer className={styles.footer}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            <span>Don’t show this again</span>
          </label>
          <div className={styles.btnRow}>
            <button
              className={cn(styles.btn, styles.btnGhost)}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className={cn(styles.btn, styles.btnPrimary)}
              onClick={handleProceed}
            >
              I Understand · Continue
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
