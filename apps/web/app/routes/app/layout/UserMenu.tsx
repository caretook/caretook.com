import type { SessionUser } from "~/lib/session";

import type { Theme } from "~/lib/theme";

import { Check, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
} from "react-aria-components";
import { useNavigate, useSubmit } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { readTheme, setTheme } from "~/lib/theme";
import { UserAvatar } from "~/components/UserAvatar";

const ITEM =
  "rounded-field flex cursor-pointer items-center gap-2 px-3 py-2 outline-none data-[focused]:bg-base-200";

const THEME_ITEMS = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] as const satisfies readonly { id: Theme; label: string; Icon: typeof Sun }[];

/**
 * The header's `user` region: the signed-in user's avatar, opening their
 * account menu (React Aria: arrow keys, typeahead, Escape, focus return).
 * The header (name, email) isn't an item, so it's never focused.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const who = user.name || user.email;
  // Only read when the menu renders on the client (the popover is closed during SSR).
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === "undefined" ? "system" : readTheme(),
  );

  return (
    <MenuTrigger>
      <Button aria-label={`Account menu for ${who}`} className="btn btn-ghost btn-circle btn-sm">
        <UserAvatar name={user.name} email={user.email} image={user.image} className="size-8 text-xs" />
      </Button>
      <Popover placement="bottom end" className="rounded-box border-base-300 bg-base-100 border shadow-lg">
        <Menu aria-label="Account" className="menu w-64 outline-none">
          <MenuSection>
            <Header className="min-w-0 px-3 py-2">
              {user.name && <span className="block truncate font-semibold">{user.name}</span>}
              <span className="text-base-content/70 block truncate text-sm">{user.email}</span>
            </Header>
            <MenuItem id="settings" onAction={() => void navigate(appUrls.settings())} className={ITEM}>
              <Settings aria-hidden="true" className="size-4" />
              Settings
            </MenuItem>
          </MenuSection>
          <Separator className="border-base-300 my-1 border-t" />
          {/* Theme: per device (lib/theme.ts), never sent to the server. */}
          <MenuSection
            aria-label="Theme"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[theme]}
            onSelectionChange={(keys) => {
              const [next] = keys === "all" ? [] : [...keys];
              if (next === "system" || next === "light" || next === "dark") {
                setTheme(next);
                setThemeState(next);
              }
            }}
          >
            <Header className="text-base-content/70 px-3 pt-1 text-xs font-semibold uppercase">Theme</Header>
            {THEME_ITEMS.map(({ id, label, Icon }) => (
              <MenuItem key={id} id={id} textValue={label} className={ITEM}>
                {({ isSelected }) => (
                  <>
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="flex-1">{label}</span>
                    {isSelected && <Check aria-hidden="true" className="size-4" />}
                  </>
                )}
              </MenuItem>
            ))}
          </MenuSection>
          <Separator className="border-base-300 my-1 border-t" />
          <MenuItem
            id="sign-out"
            // POST, as the old header form did (a GET link could be triggered by any page).
            onAction={() => void submit(null, { method: "post", action: "/sign-out" })}
            className={ITEM}
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
