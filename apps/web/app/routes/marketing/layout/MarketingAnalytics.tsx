/**
 * The marketing site's one analytics hook point: deliberately empty (no
 * analytics in v1, PRD decision). A cookieless counter may be added here
 * later, on marketing pages only, never in `/app`, and only together with an
 * update to the privacy policy (the site promises no trackers).
 */
export function MarketingAnalytics() {
  return null;
}
