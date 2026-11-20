import type { ReactNode } from "react";

import { Body, Button, Container, Head, Html, Preview, Section, Text } from "react-email";

// The building blocks every email template uses, on React Email's components
// (table-based markup and inline styles that mail clients understand),
// rendered by @react-email/render. Every template wraps its body in
// EmailLayout. No health details in any of them (see define.ts).

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EmailLayout = ({ preview, children }: { preview: string; children: ReactNode }) => (
  <Html lang="en">
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    {/* The inbox preview line; hidden in the message and left out of the plain text. */}
    <Preview>{preview}</Preview>
    <Body
      style={{
        margin: 0,
        padding: "24px 12px",
        backgroundColor: "#f6f6f4",
        fontFamily: FONT,
        color: "#1f2328",
      }}
    >
      <Container style={{ maxWidth: 520, backgroundColor: "#ffffff", borderRadius: 8, padding: 28 }}>
        <Text style={{ margin: "0 0 20px", fontSize: 18, lineHeight: "24px", fontWeight: 600 }}>
          Caretook
        </Text>
        {children}
      </Container>
    </Body>
  </Html>
);

export const Paragraph = ({ children }: { children: ReactNode }) => (
  <Text style={{ margin: "0 0 16px", fontSize: 16, lineHeight: "24px" }}>{children}</Text>
);

export const ButtonLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Section style={{ margin: "24px 0" }}>
    <Button
      href={href}
      style={{
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
    </Button>
  </Section>
);

/** A one-time code in large, spaced type (sign-in codes). */
export const Code = ({ children }: { children: ReactNode }) => (
  <Text
    style={{
      margin: "24px 0",
      fontSize: 32,
      lineHeight: "40px",
      fontWeight: 700,
      letterSpacing: 6,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    }}
  >
    {children}
  </Text>
);

export const Muted = ({ children }: { children: ReactNode }) => (
  <Text style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "20px", color: "#656d76" }}>{children}</Text>
);
