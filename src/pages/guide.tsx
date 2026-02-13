/* eslint-disable react/jsx-no-undef */
import React from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "@/components/ui/NavBar";
import styles from "@/styles/guide.module.css";
import { ERROR_CODES, codeAnchorId } from "@/core/status/error-codes";

export default function Guide() {
  const clearBrowserData = React.useCallback(() => {
    try {
      // App autosave
      localStorage.removeItem("vortex:autosave");

      // Tutorial gating key (your tutorial file)
      localStorage.removeItem("vv_tutorial_seen_v1");

      // Optional: if you implement backup keys later
      localStorage.removeItem("vortex:tutorial_backup_v1");
      sessionStorage.removeItem("vortex:tutorial_backup_v1");
    } catch {
      /* ignore */
    }

    alert("Cleared autosave + tutorial state for this tool.");
  }, []);

  return (
    <>
      <Head>
        <title>Victaulic Vortex™ | Guide</title>
        <link rel="icon" href="/vx.ico" sizes="any" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="How to use the Victaulic Vortex™ Project Builder: features & functionality, Project workbook breakdown, design methods, and FAQ."
        />
      </Head>

      <Navbar />

      <div className={styles.body}>
        {/* ───────── TABLE OF CONTENTS ───────── */}
        <section className={`${styles.section} ${styles.dark}`}>
          <h1 className={styles.sectionHeading}>Builder Guide</h1>
          <p>
            This guide explains how the Victaulic Vortex™ Project Builder is
            structured and how to interpret its results. It describes how
            projects, systems, zones, and enclosures are organized; outlines
            design method differences; and explains validation messages and
            calculated outputs.
          </p>
          <p>
            For step-by-step interaction with the interface, use the in-builder
            tutorial.
          </p>
          {/* Unified Navigator */}
          <nav aria-label="Guide navigation" className={styles.guideNav}>
            {/* Primary CTA */}
            <Link
              href="/builder"
              className={`${styles.navCard} ${styles.navCardPrimary}`}
            >
              <div className={styles.navCardTitle}>Open Builder</div>
              <div className={styles.navCardDesc}>
                Start a new project or continue where you left off.
              </div>
            </Link>

            {/* Tutorial (PRIMARY) */}
            <Link
              href="/tutorial"
              className={`${styles.navCard} ${styles.navCardPrimary}`}
            >
              <div className={styles.navCardTitle}>Run Tutorial</div>
              <div className={styles.navCardDesc}>
                Launch the interactive walkthrough in a temporary workspace.
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                  Any existing progress will be restored automatically after the
                  tutorial.
                </div>
              </div>
            </Link>

            {/* Project Hierarchy (moved) */}
            <a href="#hierarchy" className={styles.navCard}>
              <div className={styles.navCardTitle}>Project Hierarchy</div>
              <div className={styles.navCardDesc}>
                Understand how Projects organize Systems, Zones, and Enclosures.
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

        <section id="hierarchy" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Project Hierarchy</h2>

          <p>
            A <strong>Project</strong> is the top-level container for all
            configuration data. Projects may include both{" "}
            <strong>Engineered</strong> and <strong>Pre-Engineered</strong>{" "}
            systems. Engineered Systems organize protection into{" "}
            <strong>Zones</strong> that each contain one or more{" "}
            <strong>Enclosures</strong>. Pre-Engineered Systems are intended to
            protect a single <strong>Enclosure</strong>.
          </p>

          <div className={styles.hierDiagram}>
            <div className={styles.hierProjectCard}>
              <div className={styles.hierProjectHeader}>
                <div className={styles.hierProjectTitle}>Project</div>
                <div className={styles.hierProjectMeta}>
                  Top-level container
                </div>
              </div>

              <div className={styles.hierProjectGrid}>
                {/* Engineered */}
                <div className={styles.hierOuter}>
                  <div className={styles.hierOuterHeader}>
                    <div className={styles.hierOuterTitle}>
                      Engineered System
                    </div>
                    <span className={styles.hierCount}>0..n</span>
                  </div>

                  <div className={styles.hierDef}>
                    A configurable system that may protect one or more zones
                    using a shared agent supply.
                  </div>

                  <div className={styles.hierInner}>
                    <div className={styles.hierInnerHeader}>
                      <div className={styles.hierInnerTitle}>Zone</div>
                      <span className={styles.hierCount}>1..n</span>
                    </div>
                    <div className={styles.hierDef}>
                      A grouping of one or more enclosures protected
                      simultaneously by a common nitrogen discharge group.
                    </div>
                    <div className={styles.hierLeaf}>
                      <div className={styles.hierLeafHeader}>
                        <div className={styles.hierLeafTitle}>Enclosure</div>
                        <span className={styles.hierCount}>1..n</span>
                      </div>

                      <p className={styles.hierDef}>
                        A defined or partially confined space within which
                        system performance is calculated.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pre-Engineered */}
                <div className={styles.hierOuter}>
                  <div className={styles.hierOuterHeader}>
                    <div className={styles.hierOuterTitle}>
                      Pre-Engineered System
                    </div>
                    <span className={styles.hierCount}>0..n</span>
                  </div>
                  <div className={styles.hierDef}>
                    A standardized system intended to protect a single enclosure
                    using predefined components and piping rules.
                  </div>
                  <div className={styles.hierLeaf}>
                    <div className={styles.hierLeafHeader}>
                      <div className={styles.hierLeafTitle}>Enclosure</div>
                      <span className={styles.hierCount}>1</span>
                    </div>

                    <p className={styles.hierDef}>
                      The single protected space used to size and configure the
                      system.
                    </p>
                  </div>{" "}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── METHOD DIFFERENCES ───────── */}
        <section id="methods" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Design Methods</h2>
          <p>
            Design Methods define the application type, hazard classification,
            and approval basis used to size and configure a Victaulic Vortex™
            system. Selecting the correct design method is a critical first
            step, as it determines which inputs, limits, and system options are
            applicable for a given enclosure.
          </p>
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
        <section id="workbook" className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Project Workbook Breakdown</h2>
          <p>
            When you save a project, the generated Excel workbook contains the
            following sheets:
          </p>

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
                    <strong>&lt;Project Name&gt; – Summary</strong>
                  </td>
                  <td>
                    One sheet per project. Provides a high-level overview
                    including project metadata (project name, currency, units,
                    elevation), a list of all systems with total estimated net
                    price, and a summarized view of calculated results for each
                    enclosure. This sheet is intended as a quick snapshot of the
                    overall configuration.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>&lt;System Name&gt; – Consolidated BOM</strong>
                  </td>
                  <td>
                    One sheet per system. Displays the full bill of materials
                    grouped into <em>Enclosure Supply</em>, <em>Zone Supply</em>
                    , and <em>System Supply</em>. Quantities are aggregated
                    across all enclosures and zones, providing a concise,
                    order-ready material summary for the system.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>&lt;System Name&gt; – Detailed BOM</strong>
                  </td>
                  <td>
                    One sheet per <strong>Engineered System</strong>. Breaks
                    down the bill of materials at the enclosure and zone level,
                    showing exactly where each component is applied. This sheet
                    is useful for design validation, internal review, and
                    cross-referencing enclosure configurations prior to
                    ordering.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>
                      &lt;System Name&gt; – Piping & Enclosure Req
                    </strong>
                  </td>
                  <td>
                    One sheet per <strong>Pre-Engineered System</strong>.
                    Provides pipe sizing and routing guidance derived from the
                    calculated nitrogen flow rate. Includes recommended pipe
                    diameters, allowable run lengths, and typical branch layouts
                    aligned with current pre-engineered standards.
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>FACP Monitor & Release Points</strong>
                  </td>
                  <td>
                    One sheet per project. Lists all monitor and release points
                    generated from system logic, nitrogen source grouping, and
                    design selections. Includes detection devices, solenoids,
                    abort switches, and supervision points grouped by system,
                    zone, and enclosure for integration into Fire Alarm Control
                    Panel (FACP) design.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>FAQ</h2>

          <div className={styles.faqGrid}>
            {/* ── Calculations & Technical ── */}
            <div id="faq-tech" className={styles.faqGroup}>
              <h3 className={styles.faqGroupTitle}>
                Calculations &amp; Technical
              </h3>

              <details className={styles.faqItem} open>
                <summary>How do Project Options affect my results?</summary>
                <div className={styles.faqBody}>
                  Project Options define project metadata and calculation
                  context. Currency determines pricing and part-code systems;
                  Units control whether results are shown in imperial or metric
                  values; and Project Elevation applies the Altitude Correction
                  Factor (ACF), which affects calculated oxygen concentration
                  and nitrogen flow.
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
                      ft
                      <sup>3</sup> / 888 m<sup>3</sup>
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
                  Available nozzle selections are determined by the selected
                  Design Method. Each design method permits a specific set of
                  nozzle types and styles based on application intent and
                  applicable approvals.
                </div>
              </details>

              <details className={styles.faqItem}>
                <summary>What is the Rundown Time used for?</summary>
                <div className={styles.faqBody}>
                  Rundown Time is an additional discharge time applied to{" "}
                  <strong>FM Turbine</strong> and{" "}
                  <strong>FM Machine Spaces</strong> design methods. The Rundown
                  Time is the required amount of time it takes for the turbine
                  to come to a complete stop, or the amount of discharge time
                  required to bring the present fuels and surfaces below the
                  auto-ignition temperature of the present fuels.
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
                      <strong>Victaulic Vortex™ Engineered Systems </strong>
                      support custom-designed, multi-zone and multi-enclosure
                      configurations using a shared agent supply.
                    </li>
                    <li>
                      <strong>
                        Victaulic Vortex™ Pre-Engineered Systems{" "}
                      </strong>
                      support standardized, single-enclosure applications using
                      predefined piping rules without hydraulic calculations.
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
                  The builder iterates through all of the zone calculations to
                  determine the zone with the highest required quantity of
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
                <summary>How can I save, load, or share my project?</summary>
                <div className={styles.faqBody}>
                  Use <em>Save</em> to download a JSON file containing all
                  project inputs and results. This file can be shared (e.g., via
                  email) and restored using <em>Load</em>. Note that saved
                  projects always capture the builder's current state — even if
                  errors are present — to help with troubleshooting or support
                  review.
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
                  calculation or save.
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
              <h3 className={styles.faqGroupTitle}>Review &amp; Ordering</h3>

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
                  Calculated nozzle and cylinder quantities may be manually
                  overridden by enabling the override control adjacent to each
                  value and recalculating the system. Additional calculated
                  items, such as hose counts and battery backups, may be edited
                  by enabling <em>Edit Values</em> in{" "}
                  <strong>System Options</strong>. Custom overrides are flagged
                  in the Status Console and documented in the exported project
                  workbook.
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

          <div className={styles.footer}>
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </div>
        </section>
      </div>
    </>
  );
}
