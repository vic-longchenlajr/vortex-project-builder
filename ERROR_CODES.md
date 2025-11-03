# Victaulic Vortex™ Configurator — Error & Warning Codes

_Last updated: 2025-10-31_

---

## 🔴 Errors (Blocking)

These must be resolved before calculations can complete or a BOM can be generated.

| Code                           | Appears When                   | Meaning                                                          | Resolution                                                                  |
| ------------------------------ | ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **PROJ.MISSING_FIELDS**        | On Validate / Before Calculate | Project header fields (name, contact, etc.) are incomplete.      | Fill in all required project fields before running calculations.            |
| **SYS.MISSING_NAME**           | On Validate                    | System name is empty.                                            | Enter a unique name for the system.                                         |
| **SYS.INVALID_CHARS**          | On Validate                    | System name contains invalid characters (`* ? : \ / [ ]`).       | Remove restricted characters.                                               |
| **SYS.NO_ZONES**               | On Validate                    | System has no zones.                                             | Add at least one zone to calculate or export.                               |
| **SYS.FM_TANK_REQ**            | On Validate                    | FM design method used with CE-only tank.                         | Change tank certification to an FM-approved option (ASME/FM or CE/ASME/FM). |
| **SYS.DUPLICATE_NAME**         | On Validate                    | Duplicate system names detected.                                 | Rename systems to be unique.                                                |
| **ZONE.INVALID_CHARS**         | On Validate                    | Zone name contains invalid characters.                           | Remove restricted characters.                                               |
| **ZONE.NO_ENCLOSURES**         | On Validate                    | Zone has no enclosures.                                          | Add at least one enclosure before calculating.                              |
| **ZONE.DUPLICATE_NAME**        | On Validate                    | Two zones share the same name.                                   | Rename one zone.                                                            |
| **ZONE.DM_MISMATCH**           | On Validate                    | Zone mixes incompatible design methods.                          | Split into separate zones or use only NFPA 770 Class A/C + B together.      |
| **ENC.INVALID_CHARS**          | On Validate                    | Enclosure name contains invalid characters.                      | Rename enclosure.                                                           |
| **ENC.TEMP_RANGE**             | On Validate                    | Temperature outside 40–130 °F (4.4–54.4 °C).                     | Adjust enclosure temperature.                                               |
| **ENC.VOLUME_EMPTY**           | On Validate                    | Enclosure volume or dimensions missing/zero.                     | Enter valid L×W×H or volume.                                                |
| **ENC.FMDC_VOLUME_LIMIT**      | On Validate                    | FM Data Centers volume > 31 350 ft³ / 2 912 m³.                  | Split zone or change method.                                                |
| **ENC.FM_VOLUME_LIMIT**        | On Validate                    | FM Turbines / Machine Spaces > 127 525 ft³ / 3 611 m³.           | Divide or adjust design method.                                             |
| **ENC.FMDC_MIN_DISCHARGE**     | On Calculate                   | FM Data Centers discharge time < 3.5 min.                        | Add cylinders or reduce flow until ≥ 3.5 min.                               |
| **ENC.CYL_LIMIT**              | On Calculate (Pre-Eng)         | > 8 × 80 L cylinders required.                                   | Split, switch to Engineered, or reduce volume.                              |
| **ENC.O2_HIGH**                | On Calculate (Pre-Eng)         | Final O₂ > 14.1 % — insufficient nitrogen.                       | Add or higher-pressure cylinders.                                           |
| **ENC.TIME_CONSTRAINT**        | On Calculate (Pre-Eng)         | No emitter/pressure combination meets discharge time.            | Try a different nozzle, style, or fill pressure.                            |
| **ENC.EMITTER_STYLE**          | On Calculate                   | Selected style not valid for nozzle/method.                      | Pick a compatible emitter style.                                            |
| **ENC.HEIGHT_LIMIT**           | On Calculate                   | Ceiling height exceeds FM limits (5/8" ≤ 24.5 ft; 3/8" ≤ 16 ft). | Lower ceiling or select smaller emitter.                                    |
| **ENC.FM_SPACING**             | On Calculate                   | Room violates FM emitter spacing.                                | Adjust spacing or increase emitters.                                        |
| **ENC.DISCHARGE_TIME_EXCEEDS** | On Calculate (Engineered)      | Estimated discharge time > 3 min (NFPA 770 limit).               | Increase emitters or use a smaller nozzle.                                  |

---

## 🟡 Warnings (Advisory)

Warnings will not block calculation or export but highlight non-ideal conditions.

| Code                      | Appears When              | Meaning                                                                   | Resolution                                           |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| **SYS.PANEL_MISMATCH**    | On Validate               | Multi-zone Engineered system uses AR panel.                               | Use a Dry Contact (DC) panel for multi-zone systems. |
| **SYS.TANK_CAPACITY**     | On Calculate              | Required tank capacity > available for selected certification.            | Choose larger or dual tanks.                         |
| **ZONE.CUSTOM_CYLINDERS** | On Calculate              | Custom cylinder override differs from recommended.                        | Verify N₂ requirement and O₂ level.                  |
| **ENC.CUSTOM_EMITTERS**   | On Calculate              | Custom emitter override differs from calculated minimum.                  | Verify discharge time and O₂ values.                 |
| **ENC.N2_NOT_MET**        | On Calculate (Engineered) | Delivered N₂ &lt; required or O₂ &gt; 13.36 %. Discharge time set to “-”. | Reduce nozzle size or increase cylinders.            |
| **ENC.O2_LOW_MOD**        | On Calculate (Pre-Eng)    | Final O₂ = 10–12 % — reduced occupancy time.                              | Warn occupants; review NFPA 770 exposure limits.     |
| **ENC.O2_LOW_SUB**        | On Calculate (Pre-Eng)    | Final O₂ = 8–10 % — substantially reduced occupancy.                      | Warn occupants; review NFPA 770 § 4.3.               |
| **ENC.O2_VERY_LOW**       | On Calculate (Pre-Eng)    | Final O₂ &lt; 8 % — occupancy not recommended.                            | Restrict access; review design.                      |

---

## 📘 Notes

- **Errors** = must fix before calculation/export.
- **Warnings** = calculation completes, but design should be reviewed.
- All codes are surfaced in the **Status Console** and exported in the workbook’s “System Warnings” sheet.

---
