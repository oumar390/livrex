"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Bus,
  Package,
  Search,
  UserRound,
  Menu,
  X,
  ArrowUpRight,
  BriefcaseBusiness,
} from "lucide-react";
const links = [
  { href: "/", text: "Accueil", icon: Home },
  { href: "/voyager", text: "Voyager", icon: Bus },
  { href: "/envoyer", text: "Envoyer", icon: Package },
  { href: "/activites", text: "Mes activités", icon: Search },
  { href: "/compte", text: "Compte", icon: UserRound },
];
export default function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" className="wordmark" aria-label="LIVREX, accueil">
            <span className="brand-symbol">
              <Package size={23} />
            </span>
            <span>
              LIVREX<small>PAR LIFEKHALIFA</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Navigation principale">
            {links.slice(0, 4).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={path === l.href ? "page" : undefined}
              >
                {l.text}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="pro-link" href="/pro">
              <BriefcaseBusiness size={16} />
              Espace pro
              <ArrowUpRight size={14} />
            </Link>
            <Link
              className="account-link"
              href="/compte"
              aria-label="Mon compte"
            >
              <UserRound size={20} />
            </Link>
            <button
              className="menu-button"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            onClick={() => setOpen(false)}
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Menu"
          >
            {links.map((l) => (
              <Link href={l.href} key={l.href}>
                {l.text}
              </Link>
            ))}
            <Link href="/suivre">Suivre un envoi</Link>
            <Link href="/pro">Espace professionnel</Link>
          </nav>
        )}
      </header>
      <nav className="bottom-nav" aria-label="Navigation mobile">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={path === l.href ? "page" : undefined}
          >
            <l.icon size={21} />
            <span>{l.text}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
