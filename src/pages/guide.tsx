/* eslint-disable react/jsx-no-undef */
import Head from "next/head";
import Link from "next/link";
import Navbar from "@/components/ui/NavBar";
import styles from "@/styles/guide.module.css"; // reuse global page styles
import { ERROR_CODES, codeAnchorId } from "@/core/status/error-codes";

export default function Guide() {
  return (
    <>
      <Head>
        <title>Victaulic Vortex™ | Guide</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="How to use the Victaulic Vortex Configurator: features & functionality, Project workbook breakdown, design methods, and FAQ."
        />
      </Head>

      <Navbar />

      <div className={styles.body}>
        {/* ───────── TABLE OF CONTENTS ───────── */}
        <section className={`${styles.section} ${styles.light}`}>
          <h1 className={styles.sectionHeading}>Configurator Guide</h1>
          <p>
            This guide shows how to use the Victaulic Vortex Configurator
            end-to-end: set project options, build systems, and{" "}
            <strong>calculate</strong> results; then{" "}
            <strong>generate the BOM workbook</strong>,{" "}
            <strong>import/export</strong> projects for collaboration, and
            finally <strong>submit</strong> for technical review or ordering. It
            also outlines design method differences, explains error and warning
            messages, and maps each output to the Excel workbook so you know
            exactly what’s driving price and scope.
          </p>

          {/* Unified Navigator */}
          <nav aria-label="Guide navigation" className={styles.guideNav}>
            {/* Primary CTA */}
            <Link
              href="/configurator"
              className={`${styles.navCard} ${styles.navCardPrimary}`}
            >
              <div className={styles.navCardTitle}>Open Configurator</div>
              <div className={styles.navCardDesc}>
                Start a new project or continue where you left off.
              </div>
            </Link>

            <a href="#hierarchy" className={styles.navCard}>
              <div className={styles.navCardTitle}>Project Hierarchy</div>
              <div className={styles.navCardDesc}>
                Understand how Projects organize Systems, Zones, and Enclosures.
              </div>
            </a>
            <a href="#workflow" className={styles.navCard}>
              <div className={styles.navCardTitle}>Project Workflow</div>
              <div className={styles.navCardDesc}>
                Step-by-step walkthrough with annotated screenshots.
              </div>
            </a>

            <a href="#methods" className={styles.navCard}>
              <div className={styles.navCardTitle}>Design Methods</div>
              <div className={styles.navCardDesc}>
                NFPA 770, FM Data Centers, FM Turbines & Machine Spaces.
              </div>
            </a>
            <a href="#errors" className={styles.navCard}>
              <div className={styles.navCardTitle}>Error Codes</div>
              <div className={styles.navCardDesc}>
                Validation and calculation errors with resolutions.
              </div>
            </a>
            <a href="#workbook" className={styles.navCard}>
              <div className={styles.navCardTitle}>
                Project Workbook Breakdown
              </div>
              <div className={styles.navCardDesc}>
                Understand sheets, pricing columns, and BOM grouping.
              </div>
            </a>

            <a href="#faq" className={styles.navCard}>
              <div className={styles.navCardTitle}>FAQ</div>
              <div className={styles.navCardDesc}>
                Common questions about inputs, overrides, and pricing.
              </div>
            </a>

            <a href="#resources" className={styles.navCard}>
              <div className={styles.navCardTitle}>Resources</div>
              <div className={styles.navCardDesc}>
                Manuals and reference docs (VDM/IOM/DIOM).
              </div>
            </a>

            <a href="#support" className={styles.navCard}>
              <div className={styles.navCardTitle}>Support</div>
              <div className={styles.navCardDesc}>
                Contact Application Engineering or find a location.
              </div>
            </a>
          </nav>
        </section>

        <section id="hierarchy" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Project Hierarchy</h2>
          <p>
            A project is the top-level container for all system data. Engineered
            Systems organize protection into
            <strong> Zones</strong> that each contain{" "}
            <strong>Enclosures</strong>. Pre-Engineered Systems are intended to
            be installed to protect a single
            <strong> Enclosure</strong>.
          </p>

          <div className={styles.kb}>
            <div className={styles.kbItem}>
              <strong>System</strong>
              <span className={styles.kbDash}>—</span>
              The complete assembly of components—agent storage, distribution,
              and control equipment—arranged to deliver hybrid media from a
              common source to one or more zones.
            </div>
            <div className={styles.kbItem}>
              <strong>Zone</strong>
              <span className={styles.kbDash}>—</span>
              One or more enclosures or protection areas designated to be
              protected simultaneously.
            </div>
            <div className={styles.kbItem}>
              <strong>Enclosure</strong>
              <span className={styles.kbDash}>—</span>A confined or partially
              confined volume or defined space within which the system is
              intended to operate.
            </div>
          </div>

          <div className={styles.stackWrap}>
            {/* Project bar spans both columns */}
            <div
              className={`${styles.node} ${styles.nodePrimary} ${styles.projectBar}`}
            >
              Project
            </div>

            <div className={styles.stackGrid}>
              {/* Engineered stack */}
              <div className={styles.stack}>
                <div className={`${styles.step} ${styles.stepTop}`}>
                  <div className={`${styles.node} ${styles.nodeStrong}`}>
                    Engineered System{" "}
                    <span className={styles.badge}>[0…n]</span>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.node}>
                    Zone <span className={styles.badge}>[1…n]</span>
                  </div>
                </div>
                <div className={`${styles.step} ${styles.stepBottom}`}>
                  <div className={styles.node}>
                    Enclosure <span className={styles.badge}>[1…n]</span>
                  </div>
                </div>
              </div>

              {/* Pre-Engineered stack */}
              <div className={styles.stack}>
                <div className={`${styles.step} ${styles.stepTop}`}>
                  <div className={`${styles.node} ${styles.nodeStrong}`}>
                    Pre-Engineered System{" "}
                    <span className={styles.badge}>[0…n]</span>
                  </div>
                </div>
                <div className={`${styles.step} ${styles.stepBottom}`}>
                  <div className={styles.node}>
                    Zone/Enclosure <span className={styles.badge}>[1]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Project Workflow</h2>
          <p>
            The configurator follows a left-to-right workflow: set up your
            project, build systems, calculate, generate the BOM, then export or
            submit for review.
          </p>

          {/* ───────── STEP 1: Project Setup ───────── */}
          <div className={styles.workflowBlock}>
            <img
              src="/guide/step1.png"
              alt="Project Setup: Pricing & Project Options"
              className={styles.workflowImg}
            />
            <div className={styles.workflowCaption}>
              <h3>Project Setup</h3>
              <ol>
                <li>
                  <strong>Pricing Module</strong> — Displays <em>List</em> and{" "}
                  <em>Net </em>
                  prices; Net applies your <em>Customer Multiplier</em>.
                </li>
                <li>
                  <strong>Project Options</strong> — Define project metadata so
                  your order and workbook reflect the correct context.
                </li>
                <li>
                  <strong>Currency</strong> — Selects the appropriate price list
                  and part-code family (USD → BPCS; EUR/GBP → M3).
                </li>
                <li>
                  <strong>Units</strong> — Switch between Imperial and Metric;
                  affects inputs, calculations, and workbook formatting.
                </li>
                <li>
                  <strong>Elevation</strong> — Applies the Altitude Correction
                  Factor (ACF) for nitrogen flow and oxygen calculations.
                </li>
                <li>
                  <strong>Project Builder</strong> — Add an <em>Engineered</em>{" "}
                  or
                  <em> Pre-Engineered</em> system to begin configuration.
                </li>
                <li>
                  <strong>Import Project</strong> — Load a saved or shared JSON
                  file to continue progress or review another configuration.
                </li>
              </ol>
            </div>
          </div>

          {/* ───────── STEP 2: Engineered — Pre-Calculation ───────── */}
          <div className={styles.workflowBlock}>
            <img
              src="/guide/step2.png"
              alt="Engineered: Pre-Calculation"
              className={styles.workflowImg}
            />
            <div className={styles.workflowCaption}>
              <h3>Engineered — Pre-Calculation</h3>
              <ol>
                <li>
                  <strong>System Options</strong> — Configure cylinder fill
                  pressure, panel style, power supply, refill adapter, and other
                  system-level settings.
                </li>
                <li>
                  <strong>Add-Ons</strong> — Check optional components such as
                  flexible hoses or explosion-proof transducers. The{" "}
                  <em>Door Count</em> determines placard and signage quantities.
                </li>
                <li>
                  <strong>Add Zone</strong> — Create a protection group that
                  will discharge simultaneously.
                </li>
                <li>
                  <strong>Add Enclosure</strong> — Add one row per protected
                  space.
                </li>
                <li>
                  <strong>Enclosure Input</strong> — Enter the Enclosure Name,
                  Volume, Temperature, Design Method, Nozzle, and Style. These
                  determine nozzles, flow cartridges, and nitrogen demand.
                </li>
                <li>
                  <strong>Calculate</strong> — Validate all inputs and compute
                  nozzle quantity, discharge time, oxygen level, and panel
                  sizing.
                </li>
              </ol>
            </div>
          </div>

          {/* ───────── STEP 3: Engineered — Post-Calculation ───────── */}
          <div className={styles.workflowBlock}>
            <img
              src="/guide/step3.png"
              alt="Engineered: Post-Calculation"
              className={styles.workflowImg}
            />
            <div className={styles.workflowCaption}>
              <h3>Engineered — Post-Calculation</h3>
              <ol>
                <li>
                  <strong>Status</strong> — Resolve all errors before
                  proceeding; warnings are advisory. For details, see{" "}
                  <a href="#errors">Error Codes</a>.
                </li>
                <li>
                  <strong>Enclosure Results</strong> — Displays calculated
                  minimum nozzles, estimated discharge time, and final oxygen
                  level.
                </li>
                <li>
                  <strong>Zone Results</strong> — Shows total volume, nitrogen
                  requirement, and minimum total cylinders for the zone.
                </li>
                <li>
                  <strong>Custom Checkbox</strong> — Enable to override
                  calculated values. Re-run <em>Calculate</em> to refresh
                  results.
                </li>
                <li>
                  <strong>Generate BOM</strong> — Creates the Excel workbook for
                  review and ordering. See{" "}
                  <a href="#workbook">Project Workbook Breakdown</a>.
                </li>
                <li>
                  <strong>Export Project</strong> — Save a JSON snapshot (inputs
                  + results) at any time for sharing or support.
                </li>
                <li>
                  <strong>Submit Project</strong> — When error-free and a BOM is
                  generated, submit the workbook to Victaulic Customer Care for
                  quotation.
                </li>
              </ol>
            </div>
          </div>

          {/* ───────── STEP 4: Pre-Engineered — Pre-Calculation ───────── */}
          <div className={styles.workflowBlock}>
            <img
              src="/guide/step4.png"
              alt="Pre-Engineered: Pre-Calculation"
              className={styles.workflowImg}
            />
            <div className={styles.workflowCaption}>
              <h3>Pre-Engineered — Pre-Calculation</h3>
              <ol>
                <li>
                  <strong>System Options</strong> — Choose Design Method, refill
                  adapter, water tank certifications, and power supply.
                </li>
                <li>
                  <strong>Add-Ons</strong> — Select optional items such as the
                  explosion-proof pressure transducer.
                </li>
                <li>
                  <strong>Enclosure Input</strong> — Enter Enclosure Name,
                  Length, Width, Height, Temperature, Design Method, Nozzle, and
                  Style. These determine nozzle and flow-cartridge selection.
                </li>
                <li>
                  <strong>Calculate</strong> — Performs all pre-engineered
                  validations and computes nozzles, cylinders, discharge time,
                  and oxygen level for this single-zone, single-enclosure
                  system.
                </li>
              </ol>
            </div>
          </div>

          {/* ───────── STEP 5: Pre-Engineered — Post-Calculation ───────── */}
          <div className={styles.workflowBlock}>
            <img
              src="/guide/step5.png"
              alt="Pre-Engineered: Post-Calculation"
              className={styles.workflowImg}
            />
            <div className={styles.workflowCaption}>
              <h3>Pre-Engineered — Post-Calculation</h3>
              <ol>
                <li>
                  <strong>Status</strong> — Verify that no errors remain and
                  review any warnings. For details, see{" "}
                  <a href="#errors">Error Codes</a>.
                </li>
                <li>
                  <strong>Enclosure Requirements</strong> — Displays maximum and
                  minimum allowed openings (based on nozzle size and volume)
                  plus spacing and height limits per pre-engineered approval
                  tables.
                </li>
                <li>
                  <strong>System Results</strong> — Lists total volume, minimum
                  nozzles and cylinders, cylinder size @ fill pressure,
                  estimated discharge time, and final O₂. (USD uses filled 49L
                  and 80L cylinders for Pre-Engineered systems; non-USD uses
                  unfilled by default.)
                </li>
                <li>
                  <strong>Custom Checkbox</strong> — Enable to override FACP
                  counts.
                </li>
                <li>
                  <strong>Generate BOM</strong> — Produces the Excel workbook
                  including the
                  <em> Pipe Guidance</em> sheet unique to pre-engineered
                  systems. See{" "}
                  <a href="#workbook">Project Workbook Breakdown</a>.
                </li>
                <li>
                  <strong>Export Project</strong> — Save a JSON snapshot (inputs
                  + results) at any time for collaboration or support.
                </li>
                <li>
                  <strong>Submit Project</strong> — When error-free and a BOM is
                  generated, submit the workbook to Victaulic Customer Care for
                  quotation.
                </li>
              </ol>
            </div>
          </div>
        </section>
        {/* ───────── METHOD DIFFERENCES ───────── */}
        <section id="methods" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Design Methods</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Design Method</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Performance Based Class A/C</strong>
                  </td>
                  <td>
                    Limited to applications containing Class A materials where
                    combustibility is low, quantities of combustibles are
                    low-to-moderate, and fires with low-to-moderate heat release
                    rates are expected. Examples include data centers, museums,
                    cleanrooms, control rooms, cable trays, cable spreading
                    rooms, and switch gear rooms.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Performance Based Class B</strong>
                  </td>
                  <td>
                    Intended for the protection of machinery in enclosures and
                    similar spaces, where Class B fuels are present in moderate
                    quantities. Examples include enclosures with machinery
                    (internal combustion engines, oil pumps, oil tanks, fuel
                    filters, generators, transformer vaults, gear boxes, drive
                    shafts, lubrication skids, diesel engine-driven generators)
                    and other similar equipment using liquid hydrocarbon fuel,
                    hydraulic, heat transfer, and lubrication fluids with
                    volatility less than or equivalent to heptane.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>FM Data Centers</strong>
                  </td>
                  <td>
                    Intended for the protection of FM Approved data processing
                    rooms/halls above raised floors in enclosures and similar
                    spaces where Class A fuels are present. Examples include
                    enclosures with data processing equipment (data centers,
                    information technology equipment, telecommunication
                    facilities, cable spreading rooms) and other similar
                    equipment containing Class A fuels.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>FM Machine Spaces *</strong>
                  </td>
                  <td>
                    Intended for the protection of FM Approved machinery in
                    enclosures, and similar spaces where Class B fuels are
                    present in moderate quantities. Examples include enclosures
                    with machinery (internal combustion engines, oil pumps, oil
                    tanks, fuel filters, generators, transformer vaults, gear
                    boxes, drive shafts, lubrication skids, diesel engine-driven
                    generators) and other similar equipment using liquid
                    hydrocarbon fuel, hydraulic, heat transfer, and lubrication
                    fluids with volatility less than or equivalent to heptane.
                    These applications typically include a “Rundown Time”. The
                    Rundown Time is the required amount of time it takes for the
                    turbine to come to a complete stop, or the amount of
                    discharge time required to bring the present fuels and
                    surfaces below the auto-ignition temperature of the present
                    fuels.{" "}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>FM Turbines *</strong>
                  </td>
                  <td>
                    Intended for the protection of FM Approved turbines in
                    enclosures. Examples include enclosures with combustion
                    turbines, steam turbines, and hydro-electric turbines. These
                    applications typically include a “Rundown Time”. The Rundown
                    Time is the required amount of time it takes for the turbine
                    to come to a complete stop, or the amount of discharge time
                    required to bring the present fuels and surfaces below the
                    auto-ignition temperature of the present fuels.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 12 }}>
            Always reference the applicable Victaulic manuals, codes/standards,
            and listings/approvals when finalizing a design.
          </p>
          <p style={{ marginTop: 12 }}>
            * Not supported by Pre-Engineered systems.
          </p>
        </section>

        {/* ───────── ERROR CODES (Dedicated) ───────── */}
        {/* <section id="errors" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Error Codes</h2>
          <p>
            Use this reference when Status shows <strong>errors</strong>{" "}
            (blocking) or <strong>warnings</strong> (advisory).
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.tableLight}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Code</th>
                  <th>Appears When</th>
                  <th>Meaning</th>
                  <th>Resolution Steps</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <strong>Errors — Must Be Resolved</strong>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>PROJ.MISSING_FIELDS</code>
                  </td>
                  <td>On Validate / Before Calculate</td>
                  <td>
                    Project header fields are incomplete (name, contact, etc.).
                  </td>
                  <td>
                    <em>
                      Fill in all required project fields before running
                      calculations.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.MISSING_NAME</code>
                  </td>
                  <td>On Validate</td>
                  <td>System name is empty.</td>
                  <td>
                    <em>Enter a system name to identify this configuration.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.INVALID_CHARS</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    System name includes invalid characters (* ? : \ / [ ]).
                  </td>
                  <td>
                    <em>Remove restricted characters from the system name.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.NO_ZONES</code>
                  </td>
                  <td>On Validate</td>
                  <td>System has no zones.</td>
                  <td>
                    <em>Add at least one zone to calculate or export.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.FM_TANK_REQ</code>
                  </td>
                  <td>On Validate</td>
                  <td>FM method enclosure used with CE-only water tank.</td>
                  <td>
                    <em>
                      Change water tank certification to an FM-approved option
                      (ASME/FM or CE/ASME/FM).
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.DUPLICATE_NAME</code>
                  </td>
                  <td>On Validate</td>
                  <td>Duplicate system name in project.</td>
                  <td>
                    <em>Rename one of the systems so names are unique.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ZONE.INVALID_CHARS</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    Zone name includes invalid characters (* ? : \ / [ ]).
                  </td>
                  <td>
                    <em>Remove restricted characters from the zone name.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ZONE.NO_ENCLOSURES</code>
                  </td>
                  <td>On Validate</td>
                  <td>No enclosures in this zone.</td>
                  <td>
                    <em>
                      Add at least one enclosure before running calculations.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ZONE.DUPLICATE_NAME</code>
                  </td>
                  <td>On Validate</td>
                  <td>Two zones share the same name within a system.</td>
                  <td>
                    <em>Rename zones to ensure each has a unique name.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ZONE.DM_MISMATCH</code>
                  </td>
                  <td>On Validate</td>
                  <td>Zone mixes incompatible design methods.</td>
                  <td>
                    <em>
                      Split the zone or use only NFPA 770 Class A/C + B methods
                      together.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.INVALID_CHARS</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    Enclosure name includes invalid characters (* ? : \ / [ ]).
                  </td>
                  <td>
                    <em>Rename enclosure to remove restricted characters.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.TEMP_RANGE</code>
                  </td>
                  <td>On Validate</td>
                  <td>Temperature outside 40–130°F (4.4–54.4°C) range.</td>
                  <td>
                    <em>Adjust enclosure temperature to valid range.</em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.VOLUME_EMPTY</code>
                  </td>
                  <td>On Validate</td>
                  <td>Volume or dimensions are zero or missing.</td>
                  <td>
                    <em>
                      Enter valid enclosure dimensions (L×W×H) or volume before
                      calculation.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.FMDC_VOLUME_LIMIT</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    FM Data Centers volume exceeds 31,350 ft³ / 2,912 m³ limit.
                  </td>
                  <td>
                    <em>
                      Split into smaller zones or change method to reduce
                      volume.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.FM_VOLUME_LIMIT</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    FM Turbines or FM Machine Spaces volume exceeds 127,525 ft³
                    / 3,611 m³.
                  </td>
                  <td>
                    <em>Divide the enclosure or adjust design method.</em>
                  </td>
                </tr>

                <tr>
                  <td>
                    <code>ENC.FMDC_MIN_DISCHARGE</code>
                  </td>
                  <td>On Calculate</td>
                  <td>FM Data Centers discharge time &lt; 3.5 min.</td>
                  <td>
                    <em>
                      Add cylinders or lower flow (smaller nozzle or fewer
                      nozzles) until discharge time ≥ 3.5 min.
                    </em>
                  </td>
                </tr>

                <tr>
                  <td>
                    <code>ENC.CYL_LIMIT</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    More than 8 × 80 L cylinders required (exceeds pre-eng
                    limits).
                  </td>
                  <td>
                    <em>
                      Split the enclosure, switch to engineered, or reduce
                      volume.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.O2_HIGH</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Calculated O₂ &gt; 14.1 % — insufficient nitrogen for
                    extinguishment.
                  </td>
                  <td>
                    <em>
                      Add cylinders or use higher-pressure cylinders to lower
                      final O₂ below 14.1 %.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.TIME_CONSTRAINT</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    No valid nozzle/pressure combination meets discharge time.
                  </td>
                  <td>
                    <em>
                      Try different nozzle size, nozzle style, or fill
                      pressure; if limits persist, switch to engineered mode.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.EMITTER_STYLE</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Selected nozzle style not compatible with nozzle/method.
                  </td>
                  <td>
                    <em>
                      Select an allowed style for that nozzle and method (see
                      nozzle catalog).
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.HEIGHT_LIMIT</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Ceiling height exceeds FM limits (5/8&quot; ≤ 24.5 ft;
                    3/8&quot; ≤ 16 ft).
                  </td>
                  <td>
                    <em>
                      Lower ceiling height, pick smaller nozzle, or redesign
                      layout per FM table.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.FM_SPACING</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Room dimensions violate FM nozzle spacing requirements.
                  </td>
                  <td>
                    <em>
                      Increase nozzle count, change nozzle size, or divide
                      room to meet spacing table.
                    </em>
                  </td>
                </tr>

                <tr>
                  <td colSpan={4}>
                    <strong>Warnings — Advisory Only</strong>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.PANEL_MISMATCH</code>
                  </td>
                  <td>On Validate</td>
                  <td>
                    Multi-zone engineered system uses AR panel; DC recommended.
                  </td>
                  <td>
                    <em>
                      Switch panel style to Dry Contact for multi-zone systems.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>SYS.TANK_CAPACITY</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Required water tank size exceeds available capacity for
                    selected certification.
                  </td>
                  <td>
                    <em>
                      Select a larger or dual tank configuration, or change
                      certification.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ZONE.CUSTOM_CYLINDERS</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    User override of cylinder count differs from recommended
                    minimum.
                  </td>
                  <td>
                    <em>
                      Verify nitrogen requirement and O₂ level before
                      proceeding.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.CUSTOM_EMITTERS</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    User override of nozzle count differs from calculated
                    minimum.
                  </td>
                  <td>
                    <em>
                      Verify per-enclosure discharge time and oxygen values.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.DISCHARGE_TIME_EXCEEDS</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Estimated discharge time &gt; 3 minutes (NFPA 770 limit).
                  </td>
                  <td>
                    <em>
                      Increase nozzle count or use a smaller nozzle to raise
                      flow and shorten time.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.N2_NOT_MET</code>
                  </td>
                  <td>On Calculate</td>
                  <td>
                    Delivered nitrogen &lt; required or O₂ &gt; 13.36 %.
                    Discharge time is set to “-”.
                  </td>
                  <td>
                    <em>
                      Reduce enclosure nozzle size or increase cylinder count to
                      meet nitrogen requirement.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.O2_LOW_MOD</code>
                  </td>
                  <td>On Calculate (Pre-Eng)</td>
                  <td>Final O₂ between 10–12 % — reduced occupancy time.</td>
                  <td>
                    <em>
                      Warn personnel; review occupancy limits per NFPA 770.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.O2_LOW_SUB</code>
                  </td>
                  <td>On Calculate (Pre-Eng)</td>
                  <td>
                    Final O₂ between 8–10 % — substantially reduced occupancy
                    time.
                  </td>
                  <td>
                    <em>
                      Warn personnel; review occupancy limits per NFPA 770.
                    </em>
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ENC.O2_VERY_LOW</code>
                  </td>
                  <td>On Calculate (Pre-Eng)</td>
                  <td>Final O₂ below 8 % — occupancy not recommended.</td>
                  <td>
                    <em>Restrict access and review the design.</em>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="workbook" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Project Workbook Breakdown</h2>
          <p>When you export, the excel workbook includes these sheets:</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>What it shows</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>&lt;Project Name&gt; Overview</strong>
                  </td>
                  <td>
                    One sheet per project — Provides a top-level summary of the
                    project, including metadata (project name, currency, units,
                    elevation), a list of systems with their total net price,
                    and a summary of each enclosure’s calculated results. Use
                    this as your quick snapshot of the overall configuration.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>&lt;System Name&gt; – Consolidated BOM</strong>
                  </td>
                  <td>
                    One sheet per system — Displays the complete bill of
                    materials (BOM) organized into three main sections:
                    <em> Enclosure Supply</em>, <em>Zone Supply</em>, and{" "}
                    <em>System Supply</em>. Each section aggregates quantities
                    across enclosures and zones, giving you a single-line view
                    of all components required for that system.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>&lt;System Name&gt; – Detailed BOM</strong>
                  </td>
                  <td>
                    One sheet per <strong>Engineered System</strong> — Expands
                    on the Consolidated BOM by listing each component at the
                    enclosure and zone-supply level. This sheet shows exactly
                    where each part is used and allows cross-checking against
                    zone configurations for traceability during design review or
                    ordering.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>&lt;System Name&gt; – Pipe Guidance</strong>
                  </td>
                  <td>
                    One sheet per <strong>Pre-Engineered System</strong> —
                    Provides reference pipe routing and sizing guidance based on
                    the computed nitrogen flow rate. Includes recommended pipe
                    diameters, run lengths, and connection layouts for each
                    nozzle branch, aligned with current pre-engineered
                    standards.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>FACP Monitor & Release Points</strong>
                  </td>
                  <td>
                    One sheet per project — Lists all monitor and release points
                    derived from system logic, panel requirements, and design
                    selections. This includes detection devices, solenoids,
                    abort switches, and supervision points grouped by zone and
                    enclosure, suitable for integration with the Fire Alarm
                    Control Panel (FACP) design.
                  </td>
                </tr>
              </tbody>{" "}
            </table>
          </div>
        </section> */}

        <section id="errors" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Error Codes</h2>
          <p>
            Use this reference when Status shows <strong>errors</strong>{" "}
            (blocking) or <strong>warnings</strong> (advisory).
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.tableLight}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Code</th>
                  <th>Appears When</th>
                  <th>Meaning</th>
                  <th>Resolution Steps</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ERROR_CODES).map(([code, doc]) => (
                  <tr key={code} id={codeAnchorId(code as any)}>
                    <td>
                      <code>{code}</code>
                    </td>
                    <td>{doc.appearsWhen}</td>
                    <td>{doc.meaning}</td>
                    <td>
                      <em>{doc.resolution}</em>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>FAQ</h2>

          <div className={styles.faqGrid}>
            {/* ── Calculations & Technical ── */}
            <div id="faq-tech" className={styles.faqGroup}>
              <h3 className={styles.faqGroupTitle}>Calculations & Technical</h3>

              <details className={styles.faqItem} open>
                <summary>How do Project Options affect my results?</summary>
                <div className={styles.faqBody}>
                  Project Options define project metadata and adjust calculation
                  inputs to your regional and environmental parameters. Currency
                  sets pricing and part-code systems; Units switch between
                  imperial and metric; and Elevation applies the Altitude
                  Correction Factor (ACF) to ensure accurate oxygen and flow
                  results.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>Are there temperature and volume limitations?</summary>
                <div className={styles.faqBody}>
                  Hybrid fire extinguishing systems are intended for use in
                  ambient temperatrues between 40&deg;F and 130&deg;F /
                  4.4&deg;C and 54.5&deg;C. Volume limitations depend on the
                  design method chosen.
                  <ul style={{ marginTop: 6 }}>
                    <li>
                      FM Data Centers are limited to a maximum volume of 31,350
                      ft<sup>3</sup> / 888 m<sup>3</sup>
                    </li>
                    <li>
                      FM Turbines / Machine Spaces are limited to a maximum
                      volume of 127,525 ft<sup>3</sup> / 3600 m<sup>3</sup>
                    </li>
                    <li>
                      Pre-Engineered Systems are limited to a maximum volume of
                      10,000 ft<sup>3</sup> / 283 m<sup>3</sup>
                    </li>
                  </ul>
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>
                  What determines my available nozzle selections?
                </summary>
                <div className={styles.faqBody}>
                  Nozzle options are determined by the selected Design Method.
                  Each method enables a specific set of nozzle styles based on
                  the system’s application type and approval category.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>What is the Rundown Time used for?</summary>
                <div className={styles.faqBody}>
                  “Rundown Time” refers to the additional discharge time
                  required to be added to the minimum design discharge time for
                  <strong> FM Turbine </strong> and
                  <strong> FM Machine Spaces </strong>design methods. The
                  Rundown Time is the required amount of time it takes for the
                  turbine to come to a complete stop, or the amount of discharge
                  time required to bring the present fuels and surfaces below
                  the auto-ignition temperature of the present fuels.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>How do I select the correct cylinder adapter?</summary>
                <div className={styles.faqBody}>
                  The proper refill adapter is selected based on the local
                  nitrogen gas supplier requirements for your region. North and
                  South America typically use the CGA-580 adapter, however, the
                  local gas supplier shall be consulted to ensure the proper
                  adapter is chosen.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>
                  What’s the difference between Engineered and Pre-Engineered
                  systems?
                </summary>
                <div className={styles.faqBody}>
                  <ul>
                    <li>
                      <strong>Victaulic Vortex Engineered Systems </strong>allow
                      for the custom design of large-scale, multi zone, and
                      multi-enclosure systems protecting multiple types of
                      hazards using a common agent source.
                    </li>
                    <li>
                      <strong>Victaulic Vortex Pre-Engineered Systems </strong>
                      provide the ability to specify cost-efficient,
                      space-efficient, small and medium-scale systems quickly,
                      and easily, without the need to perform hydraulic
                      calculations by following pre-engineered piping rules.
                    </li>
                  </ul>
                </div>
              </details>
              <details className={styles.faqItem}>
                <summary>
                  How is the water tank/number of cylinders determined for a
                  system?
                </summary>
                <div className={styles.faqBody}>
                  The configurator iterates through all of the zone calculations
                  to determine the zone with the highest required quantity of
                  nitrogen and the zone with the highest required quantity of
                  water. The system storage is then sized to meet the
                  requirements of these zones.
                </div>
              </details>
            </div>

            {/* ── Workflow ── */}
            <div id="faq-workflow" className={styles.faqGroup}>
              <h3 className={styles.faqGroupTitle}>Workflow</h3>

              <details className={styles.faqItem}>
                <summary>How can I save, import, or share my project?</summary>
                <div className={styles.faqBody}>
                  Use <em>Export Project</em> to download a JSON file containing
                  all project inputs and results. This file can be shared (e.g.,
                  via email) and restored using <em>Import Project</em>. Note
                  that exports always capture the project’s current state — even
                  if errors are present — to help with troubleshooting or
                  support review.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>Why can’t I Generate BOM or Submit Project?</summary>
                <div className={styles.faqBody}>
                  The Bill of Materials (BOM) can only be generated once all
                  calculation errors are resolved. Click <em>Calculate</em>,
                  address any issues shown in the Status Console, and
                  recalculate. Once no errors remain, <em>Generate BOM</em> and{" "}
                  <em>Submit Project</em> will become available.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>
                  What’s the difference between errors and warnings?
                </summary>
                <div className={styles.faqBody}>
                  <strong>Errors</strong> indicate missing or invalid inputs and
                  rule conflicts that must be corrected before calculation or
                  BOM generation.
                  <strong> Warnings</strong> provide advisory information (e.g.,
                  low O₂ levels or large tank sizes) but do not block
                  calculation or export.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>How is pricing determined?</summary>
                <div className={styles.faqBody}>
                  The Excel generator calculates total pricing from all part
                  codes in the BOM using the most up-to-date Victaulic Vortex
                  Price List. It applies your project’s customer multiplier to
                  display a Net Price that reflects your actual purchasing cost.
                </div>
              </details>

              {/* ── Review & Ordering ── */}
              <br />
              <h3 className={styles.faqGroupTitle}>Review & Ordering</h3>

              <details className={styles.faqItem}>
                <summary>
                  How do I submit my project for review or ordering?
                </summary>
                <div className={styles.faqBody}>
                  After resolving all errors and generating the project
                  workbook, click <em>Submit Project</em> to package the
                  configuration file and BOM for Victaulic technical review and
                  quotation.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>Can I manually override calculated values?</summary>
                <div className={styles.faqBody}>
                  By checking the box adjacent to the nozzle and cylinder
                  quantities, the user can manually override the calculated
                  values and recalculate the system based on these inputs.
                  Additionally, the user can edit the calculated primaries,
                  double stacked rack hoses, adjacent rack hoses, and battery
                  backups by enabling "Edit Values" in
                  <strong> System Options</strong>. Custom configurations will
                  be denoted in the status bar as well as the project
                  workbook.{" "}
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* ───────── RESOURCES (table) ───────── */}
        <section id="resources" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Resources</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>System Type</th>
                  <th>Title</th>
                  <th>Download Link</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>General Design Manual for Performance Based Design</td>
                  <td>Engineered</td>
                  <td>VDM-VORTEX.01</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/VDM-VORTEX-01.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Design Manual for FM Approved Data Processing</td>
                  <td>Engineered</td>
                  <td>VDM-VORTEX.02</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/VDM-VORTEX-02.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    Design Manual for Combustion Turbines &amp; Machinery Spaces
                  </td>
                  <td>Engineered</td>
                  <td>VDM-VORTEX.03</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/VDM-VORTEX-03.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Design Manual for Wet Bench Applications</td>
                  <td>Engineered</td>
                  <td>VDM-VORTEX.04</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/VDM-VORTEX-04.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Installation, Operation, and Maintenance Manual</td>
                  <td>Engineered</td>
                  <td>I-VORTEX-IOM</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/I-VORTEX-IOM.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    Design, Installation, Operation, and Maintenance Manual
                  </td>
                  <td>Pre-Engineered</td>
                  <td>I-VORTEX/PE.DIOM</td>
                  <td>
                    <a
                      className={styles.link}
                      target="_blank"
                      href="https://assets.victaulic.com/assets/uploads/literature/I-VORTEX-PE-DIOM.pdf"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ───────── CONTACT & SUPPORT (black) ───────── */}
        <section id="support" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Contact & Support</h2>

          <div className={styles.contactGrid}>
            <div>
              <h3 className={styles.contactHeading}>Corporate Headquarters</h3>
              <p className={styles.kv}>
                <span>Address</span>
                <span>4901 Kesslersville Road, Easton, PA 18040</span>
              </p>
              <p className={styles.kv}>
                <span>Phone</span>
                <span>(610)-559-3502</span>
              </p>
            </div>

            <div>
              <h3 className={styles.contactHeading}>Application Engineering</h3>
              <p className={styles.kv}>
                <span>Email</span>
                <span>
                  <a
                    className={styles.link}
                    href="mailto:Applications.Engineering@victaulic.com"
                  >
                    Applications.Engineering@victaulic.com
                  </a>
                </span>
              </p>

              <p className={styles.kv}>
                <span>Global Support</span>
                <span>
                  <a
                    className={styles.link}
                    href="https://www.victaulic.com/find-location/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Find a Location ↗
                  </a>
                </span>
              </p>
            </div>
          </div>

          <div className={styles.footer}>v2.1.1</div>
        </section>
      </div>
    </>
  );
}
