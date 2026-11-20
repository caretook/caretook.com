import type { Device, DeviceOptions, DeviceRoute } from "../../../../../test/device";
import type { Fixtures, GroupRole } from "../../../../../test/fixtures";

import * as timeline from "~/routes/app/groups/timeline/route";
import * as basics from "./basics/route";
import * as contact from "./contact/route";
import * as emergency from "./emergency/route";
import * as insurance from "./insurance/route";
import * as print from "./print/route";
import * as profile from "./route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import {
  contactShare,
  fx,
  recipientDetails,
  TEST_GROUP,
  TEST_RECIPIENT,
  TEST_USER,
} from "../../../../../test/fixtures";

// The profile's component tests share one fictional recipient, like the
// seeds' Grandma Pat (profiles.mjs used her): Grandma June's basics and note,
// her writers-only details (a home phone, email, address, two plans), and an
// emergency list across members who share a phone and an outside contact.
// The server is a small in-memory stand-in: each save updates it and syncs
// the changed rows back, as the real sync would, so a sheet closes the way it
// does on a phone. Only `*.browser.test.tsx` files import it.

const GROUP = TEST_GROUP.id;
export const PROFILE_URL = `/app/groups/${GROUP}/profile`;
export const sheetUrl = (sheet: "basics" | "contact" | "insurance" | "emergency") =>
  `${PROFILE_URL}/${sheet}`;
export const PRINT_URL = `${PROFILE_URL}/print`;
export const TIMELINE_URL = `/app/groups/${GROUP}/timeline`;

const P = "/app/groups/:groupId/profile";
/** The profile with its sheets, the emergency sheet's page and the timeline (as routes.ts nests them). */
export const PROFILE_ROUTES: DeviceRoute[] = [
  {
    path: P,
    module: profile,
    children: [
      { path: `${P}/basics`, module: basics },
      { path: `${P}/contact`, module: contact },
      { path: `${P}/insurance`, module: insurance },
      { path: `${P}/emergency`, module: emergency },
    ],
  },
  { path: `${P}/print`, module: print },
  { path: "/app/groups/:groupId/timeline", module: timeline },
];

export const SAM = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a02", name: "Sam Okafor" };
export const RITA = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a03", name: "Rita Okafor" };
const MEMBERSHIP = {
  me: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1d01",
  sam: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1d02",
  rita: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1d03",
};
export const NORA_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1e01";

/** Grandma June's profile row's fields. */
export const JUNE = {
  name: TEST_RECIPIENT.name,
  preferredName: TEST_RECIPIENT.preferredName,
  dateOfBirth: "1940-06-02",
  codeStatus: "dnr",
  bloodType: "A+",
  primaryLanguage: "English",
  pronouns: "she/her",
  notes: "Hard of hearing on the right: sit on her left. Uses a cane outdoors.",
};

/** Her age today in her zone (America/Los_Angeles, the test browser's too), as the page says it. */
export const juneAge = () => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return `Age ${y - 1940 - (m < 6 || (m === 6 && d < 2) ? 1 : 0)}`;
};

export const DETAILS = {
  phones: [{ label: "Home", number: "(555) 010-7100" }],
  email: "june.moreno@example.com",
  address: "22 Birch Road\nSpringfield, OR 97477",
  insurance: [
    {
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1f01",
      rank: "primary",
      insurer: "Medicare",
      planName: "Part A and B",
      memberId: "1EG4-TE5-MK99",
      groupNumber: null,
      phone: "(555) 010-7300",
    },
    {
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1f02",
      rank: "secondary",
      insurer: "Example Mutual Health",
      planName: "Medigap Plan G",
      memberId: "EMH-100200-01",
      groupNumber: "GRP-77001",
      phone: "(555) 010-7310",
    },
  ] as Record<string, unknown>[],
  outsideContacts: [
    {
      id: NORA_ID,
      name: "Nora Example",
      phone: "(555) 010-7044",
      relationship: "Neighbour",
      emergencyRank: 3,
    },
  ] as Record<string, unknown>[],
};

type MemberState = {
  membershipId: string;
  userId: string;
  name: string;
  role: GroupRole;
  relationship: string | null;
  phone: string | null;
  rank: number | null;
  primary: boolean;
  droppedAt: string | null;
};

/** What the stand-in server holds: it starts as the world and follows every save. */
export type ProfileServer = {
  recipient: typeof JUNE & Record<string, unknown>;
  details: typeof DETAILS & Record<string, unknown>;
  members: MemberState[];
};

const startingServer = (role: GroupRole): ProfileServer => ({
  recipient: { ...JUNE },
  details: structuredClone(DETAILS),
  members: [
    {
      membershipId: MEMBERSHIP.me,
      userId: TEST_USER.id,
      name: TEST_USER.name,
      role,
      relationship: "Grandson",
      phone: "(555) 010-7001",
      rank: 1,
      primary: true,
      droppedAt: null,
    },
    {
      membershipId: MEMBERSHIP.sam,
      userId: SAM.id,
      name: SAM.name,
      role: "caretaker",
      relationship: "Aide from Brightside Care",
      phone: "(555) 010-7002",
      rank: 2,
      primary: false,
      droppedAt: null,
    },
    {
      membershipId: MEMBERSHIP.rita,
      userId: RITA.id,
      name: RITA.name,
      role: "viewer",
      relationship: null,
      phone: null,
      rank: null,
      primary: false,
      droppedAt: null,
    },
  ],
});

const isWriter = (role: GroupRole) => role !== "viewer";

/** The device's rows for what the server holds (a viewer's device has no details row). */
export const rowsFor = (server: ProfileServer, role: GroupRole): Fixtures => [
  fx.group(),
  fx.recipient(server.recipient),
  server.members.map((m) => [
    m.userId !== TEST_USER.id && fx.user({ id: m.userId, name: m.name }),
    fx.member({
      id: m.membershipId,
      userId: m.userId,
      role: m.role,
      relationship: m.relationship,
      emergencyRank: m.rank,
      isPrimaryContact: m.primary ? 1 : 0,
      emergencyDroppedAt: m.droppedAt,
    }),
    m.phone !== null &&
      contactShare({
        memberId: m.membershipId,
        userId: m.userId,
        phones: [{ label: "Mobile", number: m.phone }],
      }),
  ]),
  isWriter(role) && recipientDetails(server.details),
];

type Input = Record<string, unknown> & { groupId: string };

export type ProfileDevice = Device & {
  server: ProfileServer;
  /** Every call the screen made, by procedure. */
  calls: ReturnType<typeof apiCalls>;
};

/**
 * Open a screen in Grandma June's world as `role`, connected (online) by
 * default. Saves go to the stand-in server and sync back.
 */
export const openProfile = async ({
  role = "owner",
  url = PROFILE_URL,
  connected = true,
  routes = [],
  ...options
}: Omit<DeviceOptions, "route" | "role" | "bareDevice"> & {
  role?: GroupRole;
  /** More routes beside the profile's (the Members page). */
  routes?: DeviceRoute[];
} = {}) => {
  const server = startingServer(role);
  const calls = apiCalls();
  let device: Device | null = null;
  const push = () => device!.sync(rowsFor(server, role));

  const api = calls.record({
    "careGroup.updateRecipient": async (input) => {
      const { groupId: _, ...fields } = input as Input;
      server.recipient = { ...server.recipient, ...fields };
      await push();
      return null;
    },
    "careGroup.updateRecipientDetails": async (input) => {
      const { groupId: _, ...fields } = input as Input;
      server.details = { ...server.details, ...fields };
      await push();
      return null;
    },
    "careGroup.updateOutsideContacts": async (input) => {
      const { contacts } = input as Input & { contacts: { id: string }[] };
      const ranks = new Map(server.details.outsideContacts.map((c) => [c.id, c.emergencyRank]));
      server.details.outsideContacts = contacts.map((c) => ({
        ...c,
        emergencyRank: ranks.get(c.id) ?? null,
      }));
      await push();
      return null;
    },
    "careGroup.setEmergencyContacts": async (input) => {
      const { contacts } = input as Input & { contacts: ({ userId: string } | { id: string })[] };
      const rank = (key: string) => {
        const i = contacts.findIndex((r) => ("userId" in r ? r.userId : r.id) === key);
        return i < 0 ? null : i + 1;
      };
      for (const m of server.members) {
        m.rank = rank(m.userId);
        if (m.rank != null) m.droppedAt = null;
      }
      for (const c of server.details.outsideContacts) c.emergencyRank = rank(c.id as string);
      await push();
      return null;
    },
    "careGroup.setPrimaryContact": async (input) => {
      const { userId } = input as Input & { userId: string | null };
      for (const m of server.members) m.primary = m.userId === userId;
      await push();
      return null;
    },
    ...options.api,
  });

  device = await renderWithDevice({
    route: [...PROFILE_ROUTES, ...routes],
    url,
    role,
    bareDevice: true,
    connected,
    ...options,
    api,
    fixtures: [rowsFor(server, role), options.fixtures],
  });
  return { ...device, server, calls } satisfies ProfileDevice;
};

// --- DOM helpers (profiles.mjs's selectors) ----------------------------------

export const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

/** The page's sections, in order. */
export const sections = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-section]")].map((s) => s.dataset.section);

/** The Basics card's lines, by field. */
export const basicsLines = (): Record<string, string | undefined> =>
  Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>("main [data-basic]")].map(
      (el): [string, string | undefined] => [
        el.dataset.basic ?? "",
        el.querySelector("dd")?.textContent?.trim(),
      ],
    ),
  );

/** A control's error: the text of its `-error` description. */
export const errorOf = (el: Element | null) => {
  const id = (el?.getAttribute("aria-describedby") ?? "").split(" ").find((d) => d.endsWith("-error"));
  return id ? (document.getElementById(id)?.textContent?.trim() ?? "") : "";
};

/** The emergency card's names in order, the primary contact marked "*". */
export const emergencyNames = () =>
  [...document.querySelectorAll("main [data-section=emergency] li[data-emergency-entry]")].map(
    (li) =>
      (li.querySelector("[data-emergency-name]")?.textContent?.trim() ?? "") +
      (li.hasAttribute("data-primary") ? "*" : ""),
  );
