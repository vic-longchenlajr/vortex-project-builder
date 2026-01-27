// src/components/ui/GlobalDisclaimerGate.tsx
import React, { useEffect, useState } from "react";
import {
  DISCLAIMER_VERSION,
  dismissDisclaimerForToday,
  shouldShowDisclaimer,
} from "@/components/ui/disclaimer/disclaimer-store";

import styles from "@/styles/globaldisclaimergate.module.css";

type Props = {
  pathname?: string;
  onOpenChange?: (open: boolean) => void; // ✅ add
};

export default function GlobalDisclaimerGate({
  pathname,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = shouldShowDisclaimer(DISCLAIMER_VERSION);
    setOpen(show);
    onOpenChange?.(show); // ✅ notify
  }, [pathname, onOpenChange]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    onOpenChange?.(false); // ✅ notify
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.title}>Calculation update notice</div>
            <div className={styles.body}>
              This configurator includes design methodology updates that are{" "}
              <span className={styles.strong}>
                not yet reflected in the currently published manuals
              </span>
              .
              <br />
              <br />
              Key points to note:
              <br />• Nitrogen sizing is based on{" "}
              <span className={styles.strong}>
                total cylinder capacity
              </span>{" "}
              (not “usable”).
              <br />• Results reflect the{" "}
              <span className={styles.strong}>
                minimum required system sizing
              </span>{" "}
              for the inputs provided.
              <br />• Bulk nitrogen storage tubes are{" "}
              <span className={styles.strong}>sizing only</span> and are not
              included in pricing or BOM.
              <br />
              <br />
              Updated documentation will be published in the upcoming
              performance-based design manual.
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={close} className={styles.btnGhost}>
            Got it
          </button>

          <button
            onClick={() => {
              dismissDisclaimerForToday(DISCLAIMER_VERSION);
              close();
            }}
            className={styles.btnPrimary}
          >
            Don’t show again today
          </button>
        </div>
      </div>
    </div>
  );
}
