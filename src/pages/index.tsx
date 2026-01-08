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
                src="/img/assets/cylinders.png"
                alt=""
                fill
                priority
                className={styles.heroImage}
              />
            </div>
          </div>
          <div className={styles.heroEdge} />
        </section>
        {/* ───────── CORE CAPABILITIES (light) ───────── */}
        <section
          id="learn-more"
          className={`${styles.section} ${styles.light}`}
        >
          <h2 className={styles.sectionHeading}>Core Capabilities</h2>

          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <h3>Design & Calculate</h3>
              <p>
                Build systems with zones and enclosures, select compatible
                nozzles and styles, and compute nozzle counts, discharge time,
                oxygen levels, and panel sizing—all with method-specific rules
                for NFPA 770, FM Data Centers, and FM Turbines/Machine Spaces.
              </p>
            </article>

            <article className={styles.card}>
              <h3>Validate & Export</h3>
              <p>
                Built-in validation flags incompatible pressures, design
                mismatches, and spacing violations before you export. Generate a
                polished Excel workbook with grouped BOM by zone/enclosure,
                warnings, and monitor/release points—with live pricing.
              </p>
            </article>

            <article className={styles.card}>
              <h3>Collaborate & Submit</h3>
              <p>
                Save and resume progress with project import/export for sharing
                and collaboration. When error-free, submit your complete
                configuration and BOM directly to Victaulic Customer Care for
                technical review and quotation.
              </p>
            </article>
          </div>
        </section>

        {/* ───────── DESIGN WITH CONFIDENCE (dark) ───────── */}
        <section className={`${styles.section} ${styles.dark}`}>
          <h2 className={styles.sectionHeading}>Design with Confidence</h2>
          <div className={styles.split}>
            <div className={styles.splitCol}>
              <p>
                The Victaulic Vortex Configurator unifies{" "}
                <strong>engineered</strong> and <strong>pre-engineered</strong>{" "}
                workflows into a single experience. Define zones and enclosures,
                apply the appropriate design method, and let the configurator
                guide nozzle selection, discharge timing, oxygen prediction, and
                panel requirements.
              </p>
              <p>
                Use <strong>Import/Export</strong> to save progress, clone
                scenarios, or collaborate with Application Engineering for
                support. Every output maps to specifications, ensuring your
                design meets all applicable codes, standards, and approvals.
              </p>
            </div>
            <div className={styles.splitCol}>
              <div className={styles.bulletColumns}>
                <ul className={styles.bullets}>
                  <li>NFPA 770 Class A/C and Class B</li>
                  <li>FM Data Centers approval</li>
                  <li>FM Turbines & Machine Spaces</li>
                  <li>Pre-Engineered systems</li>
                  <li>Zone-based results at a glance</li>
                </ul>
                <ul className={styles.bullets}>
                  <li>Panel sizing per zone</li>
                  <li>Oxygen & discharge time calcs</li>
                  <li>Water tank & accessory add-ons</li>
                  <li>Validation: pressures & spacing</li>
                  <li>Pipe guidance for pre-engineered</li>
                </ul>
              </div>
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

          <div className={styles.footer}>v2.1.1</div>
        </section>
      </div>
    </>
  );
}
