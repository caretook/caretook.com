import type { SessionUser } from "~/lib/auth/session";
import type { EasyModeState } from "~/lib/assistant/useEasyMode";

import type { Theme } from "~/lib/app-shell/theme";

import { LayoutGrid, LogOut, Monitor, Moon, Settings, ShieldCheck, Sun, Users } from "lucide-react";
import { useState } from "react";
import { useSubmit } from "react-router";
import { Menu, SEPARATOR, UserAvatar } from "~/components/ui";
import { adminLink } from "~/lib/admin/adminLink";
import { appUrls } from "~/lib/app-shell/appUrls";
import { readTheme, setTheme } from "~/lib/app-shell/theme";

const THEME_ITEMS = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
] as const satisfies readonly { id: Theme; label: string; icon: typeof Sun }[];

const isTheme = (id: string): id is Theme => THEME_ITEMS.some((t) => t.id === id);

/**
 * The header's `user` region: the signed-in user's avatar, opening their
 * account menu. The header (name, email) isn't an item, so it's never focused.
 * In easy mode (`easy`) it's reduced to Settings, "Your care groups"
 * (with `severalGroups`: easy mode has no group menu), "Full app" (unless
 * locked) and Sign out.
 */
export function UserMenu({
  user,
  easy,
  severalGroups,
}: {
  user: SessionUser;
  easy?: EasyModeState | null;
  severalGroups?: boolean;
}) {
  const submit = useSubmit();
  const who = user.name || user.email;
  const admin = adminLink(user.role, import.meta.env.VITE_API_ORIGIN);
  // Only read when the menu renders on the client (the popover is closed during SSR).
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "system" : readTheme(),
  );

  const signOut = {
    id: "sign-out",
    label: "Sign out",
    icon: LogOut,
    // POST, as the old header form did (a GET link could be triggered by any page).
    onAction: () => void submit(null, { method: "post", action: "/sign-out" }),
  };
  const settings = { id: "settings", label: "Settings", icon: Settings, href: appUrls.settings() };

  if (easy)
    return (
      <Menu
        label={`Account menu for ${who}`}
        menuLabel="Account"
        variant="ghost"
        shape="round"
        width="lg"
        items={[
          {
            type: "section",
            id: "account",
            header: { title: user.name || undefined, subtitle: user.email },
            items: [
              settings,
              ...(severalGroups
                ? [{ id: "groups", label: "Your care groups", icon: Users, href: appUrls.groupList() }]
                : []),
              ...(easy.canToggle
                ? [{ id: "full-app", label: "Full app", icon: LayoutGrid, onAction: easy.toggle }]
                : []),
            ],
          },
          SEPARATOR,
          signOut,
        ]}
      >
        <UserAvatar name={user.name} email={user.email} image={user.image} size="md" />
      </Menu>
    );

  return (
    <Menu
      label={`Account menu for ${who}`}
      menuLabel="Account"
      variant="ghost"
      size="sm"
      shape="round"
      width="lg"
      items={[
        {
          type: "section",
          id: "account",
          header: { title: user.name || undefined, subtitle: user.email },
          items: [
            settings,
            // Staff only. /admin is its own server-rendered frame: a full load on
            // the web, the system browser from the native build.
            ...(admin
              ? [
                  {
                    id: "admin",
                    label: "Admin",
                    icon: ShieldCheck,
                    onAction: () =>
                      admin.kind === "external"
                        ? void window.open(admin.href, "_blank", "noopener")
                        : window.location.assign(admin.href),
                  },
                ]
              : []),
          ],
        },
        SEPARATOR,
        // Theme: per device (lib/app-shell/theme.ts), never sent to the server.
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
        signOut,
      ]}
    >
      <UserAvatar name={user.name} email={user.email} image={user.image} size="md" />
    </Menu>
  );
}
