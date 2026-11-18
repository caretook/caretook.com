import type { SessionUser } from "~/lib/session";

import type { Theme } from "~/lib/theme";

import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useState } from "react";
import { useSubmit } from "react-router";
import { Menu, SEPARATOR, UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { readTheme, setTheme } from "~/lib/theme";

const THEME_ITEMS = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
] as const satisfies readonly { id: Theme; label: string; icon: typeof Sun }[];

const isTheme = (id: string): id is Theme => THEME_ITEMS.some((t) => t.id === id);

/**
 * The header's `user` region: the signed-in user's avatar, opening their
 * account menu. The header (name, email) isn't an item, so it's never focused.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const submit = useSubmit();
  const who = user.name || user.email;
  // Only read when the menu renders on the client (the popover is closed during SSR).
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "system" : readTheme(),
  );

  return (
    <Menu
      label={`Account menu for ${who}`}
      menuLabel="Account"
      className="btn btn-ghost btn-circle btn-sm"
      width="lg"
      items={[
        {
          type: "section",
          id: "account",
          header: { title: user.name || undefined, subtitle: user.email },
          items: [{ id: "settings", label: "Settings", icon: Settings, href: appUrls.settings() }],
        },
        SEPARATOR,
        // Theme: per device (lib/theme.ts), never sent to the server.
        {
          type: "section",
          id: "theme",
          title: "Theme",
          items: THEME_ITEMS,
          selection: {
            selected: theme,
            onChange: (next) => {
              if (!isTheme(next)) return;
              setTheme(next);
              setThemeState(next);
            },
          },
        },
        SEPARATOR,
        {
          id: "sign-out",
          label: "Sign out",
          icon: LogOut,
          // POST, as the old header form did (a GET link could be triggered by any page).
          onAction: () => void submit(null, { method: "post", action: "/sign-out" }),
        },
      ]}
    >
      <UserAvatar name={user.name} email={user.email} image={user.image} className="size-8 text-xs" />
    </Menu>
  );
}
