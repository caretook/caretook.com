// The legal pages, linked from account settings (onboarding slice 2). They're
// web-only marketing routes, so the native build links them on the web origin
// (`VITE_API_ORIGIN`). Pure, and imports no marketing code.

const LEGAL_PAGES = [
  { label: "Terms", path: "/terms" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Consumer Health Data Privacy Policy", path: "/health-data-privacy" },
] as const;

export const legalLinks = (apiOrigin?: string | null) => {
  const origin = apiOrigin?.replace(/\/+$/, "") ?? "";
  return LEGAL_PAGES.map(({ label, path }) => ({ label, href: `${origin}${path}` }));
};
