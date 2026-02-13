import React from "react";
import cn from "clsx";

import styles from "@/styles/PreEngPrereqModal.module.css";

const STORAGE_KEY = "vv_pe_prereq_ack_v1";

type Props = {
  open: boolean;
  onCancel: () => void;
  onProceed: () => void; // call your addSystem("preengineered")
};

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
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
  if (!ls) return true; // safe default
  return !ls.getItem(STORAGE_KEY);
}

/* -------------------------------------------------------------------------- */
/*                          PRE-ENG PREREQ MODAL                              */
/* -------------------------------------------------------------------------- */
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
        {/* ORANGE WARNING FIRST */}
        <div className={styles.warningTop} role="note" aria-label="Warning">
          <div className={styles.warningTitle}>Warning</div>
          <div className={styles.warningText}>
            Pre-Engineered systems are limited to qualified applications and
            must be designed and verified by a{" "}
            <span className={styles.strong}>Victaulic Vortex™ Certified</span>{" "}
            individual.
          </div>
        </div>

        {/* SHORT SUMMARY (≤ ~8 lines) */}
        <div className={styles.body}>
          <h2 id="peprereq-title" className={styles.title}>
            Prerequisites for Victaulic Vortex™ Pre-Engineered System
          </h2>

          <ul className={styles.bullets}>
            <li>
              You are responsible for hazard identification and system
              applicability (including AHJ requirements).
            </li>
            <li>
              Confirm the protected space meets the enclosure and discharge
              criteria for the selected design type.
            </li>
            <li>
              Ensure the releasing fire alarm system (detection, controls,
              power, notification, wiring) is properly designed and installed.
            </li>
          </ul>
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
