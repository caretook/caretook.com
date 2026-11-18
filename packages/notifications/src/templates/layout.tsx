import type { ReactNode } from "react";

// Small, dependency-free building blocks for email templates: plain HTML with
// inline styles (mail clients ignore stylesheets), rendered by
// @react-email/render. Every template wraps its body in EmailLayout.

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EmailLayout = ({ preview, children }: { preview: string; children: ReactNode }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body style={{ margin: 0, padding: 0, backgroundColor: "#f6f6f4", fontFamily: FONT, color: "#1f2328" }}>
      {/* The inbox preview line; hidden in the message itself. */}
      <div data-skip-in-text="true" style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
        {preview}
      </div>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ padding: "24px 12px" }}
      >
        <tbody>
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ maxWidth: 520, backgroundColor: "#ffffff", borderRadius: 8, padding: 28 }}
              >
                <tbody>
                  <tr>
                    <td>
                      <p style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>Caretook</p>
                      {children}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
);

export const Paragraph = ({ children }: { children: ReactNode }) => (
  <p style={{ margin: "0 0 16px", fontSize: 16, lineHeight: "24px" }}>{children}</p>
);

export const ButtonLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <p style={{ margin: "24px 0" }}>
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: "#2f6f5e",
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: 6,
        fontSize: 16,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  </p>
);

export const Muted = ({ children }: { children: ReactNode }) => (
  <p style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "20px", color: "#656d76" }}>{children}</p>
);
