// src/pages/contact-us.tsx
import React from "react";
import Head from "next/head";
import Navbar from "@/components/ui/NavBar";
import styles from "@/styles/configurator.module.css";
import navStyles from "@/styles/navbar.module.css";

export default function ContactUsPage() {
  return (
    <>
      <Head>
        <title>Victaulic Vortex™ | Contact Us</title>
      </Head>
      <Navbar />
      <div className={navStyles.navSpacer} />

      <main className={styles.container}>
        <section className={styles.section}>
          <h1 style={{ marginTop: 0 }}>Contact Us</h1>

          <div style={{ lineHeight: 1.6 }}>
            <h3>CORPORATE HEADQUARTERS</h3>
            <p>
              <strong>Address:</strong> 4901 Kesslersville Road, Easton, PA
              18040
              <br />
              <strong>Phone:</strong> (610)-559-3502
            </p>

            <h3>APPLICATIONS ENGINEERING</h3>
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:Applications.Engineering@victaulic.com">
                Applications.Engineering@victaulic.com
              </a>
            </p>

            <h3>GLOBAL SUPPORT</h3>
            <p>
              For worldwide contacts, please visit{" "}
              <a
                href="https://www.victaulic.com/find-location/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Victaulic Find a Location
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
