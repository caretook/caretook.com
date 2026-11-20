import { createContext, useContext } from "react";

/**
 * The document's Content-Security-Policy, from entry.server.tsx (quick-fixes
 * slice 22): the nonce for the inline scripts root.tsx renders, and the policy
 * as a `<meta>` for pages served as files (prerendered marketing pages, the
 * native SPA), where no response header carries it. Empty in the browser:
 * a nonce or a `<meta>` policy only matters in the HTML the server sends.
 */
export type DocumentCsp = { nonce?: string; policy?: string };

export const CspContext = createContext<DocumentCsp>({});

export const useDocumentCsp = () => useContext(CspContext);
