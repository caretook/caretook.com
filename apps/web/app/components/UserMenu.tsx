import type { SessionUser } from "~/lib/session";

import { LogOut, Settings } from "lucide-react";
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
import { UserAvatar } from "./UserAvatar";

const ITEM =
  "rounded-field flex cursor-pointer items-center gap-2 px-3 py-2 outline-none data-[focused]:bg-base-200";

/**
 * The header's `user` region: the signed-in user's avatar, opening their
 * account menu (React Aria: arrow keys, typeahead, Escape, focus return).
 * The header (name, email) isn't an item, so it's never focused.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const who = user.name || user.email;

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
            <MenuItem id="settings" onAction={() => void navigate("/app/settings")} className={ITEM}>
              <Settings aria-hidden="true" className="size-4" />
              Settings
            </MenuItem>
          </MenuSection>
          {/* Theme (System, Light, Dark) goes here: app-shell slice 2. */}
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
