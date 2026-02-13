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
        <link rel="icon" href="/vx.ico" sizes="any" />
      </Head>

      <Navbar />

      {/* Main scroll container (accounts for fixed navbar height) */}
      <div className={styles.body}>
        {/* ───────── HERO (black, image blends) ───────── */}
        <section className={`${styles.hero} ${styles.sectionFull}`}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>
                DESIGN, ESTIMATE, AND ORDER
                <br />
                IN ONE WORKFLOW
              </h1>

              <p className={styles.heroSub}>
                A unified project builder for engineered and pre-engineered
                Victaulic Vortex™ systems, built around approved design
                methodologies and validation rules.Ad
              </p>

              <div className={styles.ctaRow}>
                <Link href="/builder" className={styles.btnPrimary}>
                  Open Builder
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
              <h3>Design &amp; Calculate</h3>
              <p>
                Structure systems by zone and enclosure, apply the appropriate
                design method, and calculate nozzle quantities, estimated design
                discharge time, oxygen concentration, and panel sizing. All
                calculations follow method-specific rules for NFPA 770, FM Data
                Centers, and FM Turbines and Machine Spaces.
              </p>
            </article>

            <article className={styles.card}>
              <h3>Validate &amp; Export</h3>
              <p>
                Built-in validation evaluates project structure, design method
                compatibility, and system performance prior to export. Generate
                an Excel workbook with zone- and enclosure-grouped bills of
                material, warnings, monitor and release points, and live
                pricing.
              </p>
            </article>

            <article className={styles.card}>
              <h3>Collaborate &amp; Submit</h3>
              <p>
                Use project load and save to share configurations and support
                collaboration across teams. Once validation is complete, submit
                the full configuration and bill of materials to Victaulic
                Customer Care for technical review and quotation.
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
                The Victaulic Vortex Project Builder supports engineered and
                pre-engineered systems within a single, structured design
                environment. Systems are organized by zone and enclosure, with
                calculations and constraints driven by the selected design
                method.
              </p>

              <p>
                Throughout the configuration process, the builder applies design
                guardrails that reflect applicable standards and approval
                requirements. Validation is applied at the project, system,
                zone, and enclosure levels to help identify incompatible
                configurations and performance limitations before designs are
                exported or submitted for review.
              </p>
            </div>

            <div className={styles.splitCol}>
              <div className={styles.bulletColumns}>
                <ul className={styles.bullets}>
                  <li>NFPA 770 Class A/C and Class B design methods</li>
                  <li>FM Data Centers approval criteria</li>
                  <li>FM Turbines and Machine Spaces requirements</li>
                  <li>Pre-engineered system limitations and applicability</li>
                  <li>Zone- and enclosure-based system structure</li>
                </ul>

                <ul className={styles.bullets}>
                  <li>Discharge group–based panel sizing</li>
                  <li>
                    Estimated design discharge time and oxygen concentration
                  </li>
                  <li>Nitrogen supply and capacity sufficiency</li>
                  <li>Pressure, spacing, and component compatibility</li>
                  <li>Pre-engineered nozzle and piping layout constraints</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── CONTACT & SUPPORT (light) ───────── */}
        <section className={`${styles.section} ${styles.light}`}>
          <h2 className={styles.sectionHeading}>Contact &amp; Support</h2>

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
