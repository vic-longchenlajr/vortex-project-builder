/* eslint-disable react/jsx-no-undef */
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/ui/NavBar";
import styles from "@/styles/index.module.css";

export default function Home() {
  return (
    <>
      <Head>
        <title>Victaulic Vortex™ | Home</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <Navbar />

      {/* Main scroll container (accounts for fixed navbar height) */}
      <div className={styles.body}>
        {/* ───────── HERO (black, image blends) ───────── */}
        <section className={`${styles.hero} ${styles.sectionFull}`}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>
                DESIGN, ESTIMATE &amp; ORDER
                <br />
                IN ONE WORKFLOW
              </h1>
              <p className={styles.heroSub}>
                Configure <strong>engineered</strong> and{" "}
                <strong>pre-engineered</strong> Victaulic Vortex™ systems,{" "}
                calculate performance results, generate a complete{" "}
                <strong>BOM workbook</strong>, and use{" "}
                <strong>import/export</strong> to save or share project
                data—then <strong>submit for review or ordering</strong> in one
                streamlined process.
              </p>
              <div className={styles.ctaRow}>
                <Link href="/configurator" className={styles.btnPrimary}>
                  Open Configurator
                </Link>
                <a href="#learn-more" className={styles.btnGhost}>
                  Learn More
                </a>
              </div>
            </div>

            <div className={styles.heroImageWrap} aria-hidden>
              <Image
                src="/cylinders.png"
                alt=""
                fill
                priority
                className={styles.heroImage}
              />
            </div>
          </div>
          <div className={styles.heroEdge} />
        </section>

        {/* ───────── FEATURES (light) ───────── */}
        <section
          id="learn-more"
          className={`${styles.section} ${styles.light}`}
        >
          <h2 className={styles.sectionHeading}>Why Use the Configurator</h2>

          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <h3>Purpose-Built Configuration</h3>
              <p>
                Build systems with zones and enclosures, select compatible
                nozzles/styles, and apply method-specific rules (NFPA&nbsp;770,
                FM Data Centers, and FM Turbines/Machine Spaces).
              </p>
            </article>

            <article className={styles.card}>
              <h3>Accurate Sizing</h3>
              <p>
                Compute emitter counts, discharge time, oxygen level, water
                requirements, and <strong>panel sizing per zone</strong> where
                applicable—mirroring real design practice.
              </p>
            </article>

            <article className={styles.card}>
              <h3>Smart Validation</h3>
              <p>
                Built-in checks flag issues like incompatible pressures, design
                time mismatches across shared zones, spacing limits, and
                method-specific eligibility warnings—before you export.
              </p>
            </article>

            <article className={styles.card}>
              <h3>BOM, Import &amp; Export</h3>
              <p>
                Save and resume progress with{" "}
                <strong>project import/export</strong>. Generate a polished
                Excel workbook with a{" "}
                <strong>grouped BOM by zone/enclosure</strong>, warnings, and
                monitor/release points—<strong>with live price import</strong>.
              </p>
            </article>
          </div>
        </section>

        {/* ───────── ABOUT (dark) ───────── */}
        <section className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>About the Tool</h2>
          <div className={styles.split}>
            <div className={styles.splitCol}>
              <p>
                The Victaulic Vortex Configurator unifies{" "}
                <strong>engineered</strong> and <strong>pre-engineered</strong>{" "}
                workflows into a single experience. Start a project, define{" "}
                <strong>zones</strong> and enclosures, apply the appropriate
                design method, and let the app guide emitter selection,
                discharge timing, oxygen prediction, and panel requirements.
              </p>
              <p>
                Use <strong>Import/Export</strong> to save progress, clone
                scenarios, or send configurations to Application Engineering for
                support. Always reference the applicable Victaulic manuals,
                codes/standards, and listings/approvals.
              </p>
            </div>
            <div className={styles.splitCol}>
              <ul className={styles.bullets}>
                <li>
                  Supports NFPA&nbsp;770, FM Data Centers, and FM
                  Turbines/Machine Spaces design methods, plus Pre-Engineered
                </li>
                <li>Nozzle &amp; style compatibility built in</li>
                <li>Zone-based results at a glance</li>
                <li>Panel sizing per zone (where applicable)</li>
                <li>Oxygen prediction &amp; discharge time calculations</li>
                <li>Water/tank and accessory add-ons where applicable</li>
                <li>
                  Validation: pressure/design mismatches &amp; spacing rules
                </li>
                <li>Excel export with pricing and grouped BOM</li>
                <li>Import/Export projects to save, share, and get support</li>
                <li>Optional pipe guidance for pre-engineered systems</li>
              </ul>
            </div>
          </div>
        </section>
        {/* ───────── CONTACT & SUPPORT (black) ───────── */}
        <section className={`${styles.section} ${styles.light}`}>
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

          <div className={styles.footer}>v2.1.0</div>
        </section>
      </div>
    </>
  );
}
