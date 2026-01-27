// src/components/ui/NavBar.tsx
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import clsx from "clsx";
import styles from "@/styles/navbar.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/configurator", label: "Configurator" },
  { href: "/guide", label: "Guide" },
  // { href: "/contact-us", label: "Contact Us" },
];

// Boundary-aware route matcher:
// - Home ('/') is active ONLY on exact '/'
// - Other routes are active on exact match OR when the path starts with 'href + /'
function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavBar() {
  const { pathname } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false); // optional: shrink on scroll
  const navRef = useRef<HTMLElement | null>(null);

  // Optional: shrink nav after 24px scroll
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const set = () => {
      const h = nav.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--nav-height", `${h}px`);
    };

    set();

    // tracks image/font/compact changes automatically
    const ro = new ResizeObserver(set);
    ro.observe(nav);

    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className={clsx(styles.navBar, compact && styles.compact)}
      data-nav="1"
    >
      {/* Logo */}
      <div className={styles.navLogo}>
        <Link href="/" aria-label="Go to Home">
          <Image
            src="/img/assets/Vortex-Logo-Black.png"
            alt="Victaulic Vortex Logo"
            width={384 * 1.8}
            height={49.5 * 1.8}
            priority
          />
        </Link>
      </div>

      {/* Desktop links */}
      <div className={styles.navOptions} role="menubar" aria-label="Primary">
        {links.map((l) => {
          const active = isActiveRoute(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(styles.navTitle, active && styles.active)}
              aria-current={active ? "page" : undefined}
              role="menuitem"
            >
              {l.label}
            </Link>
          );
        })}

        <a
          href="https://victauliccompany2ndorg.my.site.com/s/"
          className={styles.navTitle}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          Vortex Portal
          <span className={styles.extIcon} aria-hidden>
            ↗
          </span>
        </a>
        <a
          href="https://www.victaulic.com/"
          className={styles.navTitle}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          Victaulic
          <span className={styles.extIcon} aria-hidden>
            ↗
          </span>
        </a>
      </div>

      {/* Mobile toggle */}
      <button
        className={styles.menuToggle}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        aria-controls="mobile-menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className={styles.burger} />
      </button>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={clsx(styles.mobileMenu, menuOpen && styles.mobileMenuOpen)}
      >
        {links.map((l) => {
          const active = isActiveRoute(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(styles.mobileItem, active && styles.active)}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          );
        })}
        <a
          href="https://victauliccompany2ndorg.my.site.com/s/"
          className={styles.mobileItem}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMenuOpen(false)}
        >
          Vortex Portal{" "}
          <span className={styles.extIcon} aria-hidden>
            ↗
          </span>
        </a>
        <a
          href="https://www.victaulic.com/"
          className={styles.mobileItem}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMenuOpen(false)}
        >
          Victaulic
          <span className={styles.extIcon} aria-hidden>
            ↗
          </span>
        </a>
      </div>
    </nav>
  );
}
