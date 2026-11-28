import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink } from "react-router";

import { FullLogo } from "~/components/brand";
import { IconButton } from "~/components/ui/plain";
import { MARKETING_LINKS, MARKETING_PAGES } from "../site/pages";
import { layoutContent } from "./content";

const words = layoutContent.header;
const HEADER_PAGES = MARKETING_PAGES.filter((p) => "header" in p && p.header);

/**
 * The marketing header: the wordmark, the header pages, Sign in and Join the
 * waitlist. Below `md` the pages and Sign in move into a disclosure menu: a
 * button with `aria-expanded` that opens a panel under the header. It traps
 * nothing; Escape closes it and returns focus to the button, and choosing a
 * link closes it.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-field px-3 py-2 font-medium hover:bg-base-200 ${isActive ? "text-primary" : ""}`;

  return (
    <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link to="/" className="mr-auto rounded-field" aria-label={words.homeLabel}>
          <FullLogo />
        </Link>
        <nav aria-label={words.navLabel} className="hidden items-center gap-1 md:flex">
          {HEADER_PAGES.map((page) => (
            <NavLink key={page.id} to={page.path} className={navLink}>
              {page.label}
            </NavLink>
          ))}
          <Link to={MARKETING_LINKS.signIn} className="rounded-field px-3 py-2 font-medium hover:bg-base-200">
            {words.signIn}
          </Link>
        </nav>
        <Link to={MARKETING_LINKS.waitlist} onClick={close} className="btn btn-primary btn-sm sm:btn-md">
          {words.waitlist}
        </Link>
        <IconButton
          ref={buttonRef}
          label={words.menu}
          icon={open ? X : Menu}
          size="md"
          className="md:hidden"
          expanded={open}
          controls={menuId}
          onPress={() => setOpen((v) => !v)}
        />
      </div>
      <nav
        id={menuId}
        aria-label={words.navLabel}
        hidden={!open}
        className="border-t border-base-300 bg-base-100 md:hidden"
        data-marketing-menu
      >
        <ul className="mx-auto flex max-w-5xl flex-col px-4 py-2">
          {HEADER_PAGES.map((page) => (
            <li key={page.id}>
              <NavLink
                to={page.path}
                onClick={close}
                className={({ isActive }) => `block py-3 ${navLink({ isActive })}`}
              >
                {page.label}
              </NavLink>
            </li>
          ))}
          <li>
            <Link
              to={MARKETING_LINKS.signIn}
              onClick={close}
              className="block rounded-field px-3 py-3 font-medium hover:bg-base-200"
            >
              {words.signIn}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
