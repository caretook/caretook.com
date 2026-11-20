import type { EmergencyMemberRow } from "../../../../../lib/emergencyList";
import type {
  EmergencyDetailsInput,
  EmergencyMedicationInput,
  EmergencyProviderInput,
  EmergencyRecipientInput,
  EmergencySection,
} from "./emergencyPrintSheet";

import { describe, expect, it } from "vitest";
import { allergyState } from "../../../../../lib/allergies";
import { EMERGENCY_SECTION_ORDER, emergencySheet } from "./emergencyPrintSheet";

const ZONE = "America/Los_Angeles";
// 10:00 on Nov 18, 2026 in Los Angeles (18:00 UTC).
const NOW = new Date("2026-11-18T18:00:00Z");

const recipient: EmergencyRecipientInput = {
  name: "Pat Example",
  preferredName: "Grandma Pat",
  dateOfBirth: "1941-03-14",
  timeZone: ZONE,
  codeStatus: "dnrPolst",
  bloodType: "O+",
  primaryLanguage: "English",
  pronouns: "she/her",
  notes: "Hard of hearing on the left.",
};

const details: EmergencyDetailsInput = {
  phones: [{ label: "Home", number: "(555) 010-2231" }],
  address: "1428 Elm Street\nSpringfield, OR 97477",
  insurance: [
    {
      id: "i2",
      rank: "secondary",
      insurer: "Example Mutual",
      planName: "Plan G",
      memberId: "EM-1",
      groupNumber: "GRP-5",
      phone: "(555) 010-3310",
    },
    {
      id: "i1",
      rank: "primary",
      insurer: "Medicare",
      planName: null,
      memberId: "1EG4",
      groupNumber: null,
      phone: null,
    },
  ],
  outsideContacts: [
    { id: "o1", name: "Rosa Example", relationship: "Neighbour", phone: "(555) 010-4410", emergencyRank: 2 },
    { id: "o2", name: "Not listed", relationship: null, phone: "(555) 010-0000", emergencyRank: null },
  ],
};

const member = (
  patch: Partial<EmergencyMemberRow> & { user_id: string; name: string },
): EmergencyMemberRow => ({
  relationship: null,
  emergency_rank: null,
  is_primary_contact: 0,
  emergency_dropped_at: null,
  share_phones: null,
  ...patch,
});

const members: EmergencyMemberRow[] = [
  member({
    user_id: "u1",
    name: "Dev Member",
    relationship: "Daughter",
    emergency_rank: 1,
    share_phones: JSON.stringify([{ label: "Mobile", number: "(555) 010-1001" }]),
  }),
  member({
    user_id: "u2",
    name: "Dev Caretaker",
    emergency_rank: 3,
    is_primary_contact: 1,
    share_phones: JSON.stringify([{ label: "", number: "(555) 010-1002" }]),
  }),
  member({ user_id: "u3", name: "Dev Viewer" }),
];

let n = 0;
const med = (patch: Partial<EmergencyMedicationInput> & { name: string }): EmergencyMedicationInput => ({
  id: `m${++n}`,
  strength: null,
  dose: null,
  directions: null,
  schedule: { type: "asNeeded" },
  status: "current",
  pharmacyId: null,
  ...patch,
});

const provider = (
  patch: Partial<EmergencyProviderInput> & { id: string; name: string },
): EmergencyProviderInput => ({
  type: "clinician",
  specialty: null,
  phones: [],
  isPrimary: false,
  status: "current",
  ...patch,
});

const medications = [
  med({
    name: "Metformin",
    strength: "500 mg",
    dose: "1 tablet",
    schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
    pharmacyId: "ph1",
  }),
  med({ name: "Acetaminophen", strength: "500 mg", schedule: { type: "asNeeded", maxPerDay: 4 } }),
  med({ name: "Amoxicillin", status: "completed" }),
  med({ name: "Oxybutynin", status: "discontinued" }),
  med({ name: "Aspirin", deletedAt: "2026-11-01T00:00:00Z" }),
];

const providers = [
  provider({
    id: "p1",
    name: "Dr. Elena Alvarez",
    specialty: "Primary care",
    isPrimary: true,
    phones: [
      { label: "Office", number: "  " },
      { label: "Office", number: "(555) 010-2200" },
    ],
  }),
  provider({ id: "p2", name: "Westside Family Medicine", type: "practice", isPrimary: true }),
  provider({ id: "p3", name: "Dr. Samuel Patel", specialty: "Cardiology" }),
  provider({ id: "p4", name: "Dr. Gone", isPrimary: true, deletedAt: "2026-11-01T00:00:00Z" }),
  provider({ id: "p5", name: "Dr. Past", isPrimary: true, status: "past" }),
  provider({
    id: "ph1",
    name: "Cornerstone Pharmacy",
    type: "pharmacy",
    phones: [{ label: "", number: "(555) 010-4400" }],
  }),
  provider({ id: "ph2", name: "Unused Pharmacy", type: "pharmacy" }),
];

const full = () =>
  emergencySheet({
    recipient,
    details,
    members,
    medications,
    providers,
    allergies: allergyState(
      [
        { id: "a1", substance: "Sulfa", reaction: "rash", severity: "mild" },
        { id: "a2", substance: "Penicillin", reaction: "hives", severity: "severe" },
      ],
      null,
    ),
    now: NOW,
    locale: "en-US",
  });

const section = <K extends EmergencySection["id"]>(sheet: ReturnType<typeof full>, id: K) =>
  sheet.sections.find((s): s is Extract<EmergencySection, { id: K }> => s.id === id);

const EMPTY_DETAILS: EmergencyDetailsInput = {
  phones: [],
  address: null,
  insurance: [],
  outsideContacts: [],
};

describe("emergencySheet", () => {
  it("puts every section in order", () => {
    expect(full().sections.map((s) => s.id)).toEqual(EMERGENCY_SECTION_ORDER);
    expect(EMERGENCY_SECTION_ORDER).toEqual([
      "basics",
      "note",
      "contact",
      "insurance",
      "emergency",
      "medications",
      "allergies",
      "careTeam",
    ]);
  });

  it("names the recipient, with the birthday, the age and the day printed in the recipient's zone", () => {
    expect(full().recipient).toEqual({
      name: "Pat Example (Grandma Pat)",
      born: "March 14, 1941",
      age: "Age 85",
    });
    expect(full().printedOn).toBe("Nov 18, 2026");
  });

  it("counts the age and the date on the recipient's day, not the device's", () => {
    // 07:30 UTC on Mar 14, 2027 is still Mar 13 in Los Angeles, already Mar 14 in Tokyo.
    const now = new Date("2027-03-14T07:30:00Z");
    const at = (timeZone: string) =>
      emergencySheet({
        recipient: { ...recipient, timeZone },
        details: EMPTY_DETAILS,
        members: [],
        medications: [],
        providers: [],
        now,
        locale: "en-US",
      });
    expect(at(ZONE).recipient.age).toBe("Age 85");
    expect(at(ZONE).printedOn).toBe("Mar 13, 2027");
    expect(at("Asia/Tokyo").recipient.age).toBe("Age 86");
    expect(at("Asia/Tokyo").printedOn).toBe("Mar 14, 2027");
  });

  it("shows the basics with code status first, and the note", () => {
    const sheet = full();
    expect(section(sheet, "basics")?.lines.map((l) => [l.label, l.value])).toEqual([
      ["Code status", "DNR/POLST"],
      ["Blood type", "O+"],
      ["Primary language", "English"],
      ["Pronouns", "she/her"],
    ]);
    expect(section(sheet, "note")?.text).toBe("Hard of hearing on the left.");
  });

  it("lists the address and phones, and insurance by rank", () => {
    const sheet = full();
    expect(section(sheet, "contact")).toMatchObject({
      address: "1428 Elm Street\nSpringfield, OR 97477",
      phones: [{ label: "Home", number: "(555) 010-2231" }],
    });
    expect(section(sheet, "insurance")?.plans).toEqual([
      { id: "i1", rank: "Primary", title: "Medicare", memberId: "1EG4", groupNumber: null, phone: null },
      {
        id: "i2",
        rank: "Secondary",
        title: "Example Mutual · Plan G",
        memberId: "EM-1",
        groupNumber: "GRP-5",
        phone: "(555) 010-3310",
      },
    ]);
  });

  it("lists emergency contacts in the one order across members and outside contacts, the primary marked", () => {
    const contacts = section(full(), "emergency")!.contacts;
    expect(contacts.map((c) => [c.position, c.name, c.isPrimary])).toEqual([
      [1, "Dev Member", false],
      [2, "Rosa Example", false],
      [3, "Dev Caretaker", true],
    ]);
    expect(contacts[0]).toMatchObject({
      relationship: "Daughter",
      phones: [{ label: "Mobile", number: "(555) 010-1001" }],
    });
    expect(contacts[1]!.phones).toEqual([{ label: null, number: "(555) 010-4410" }]);
    // Not on the list: an unranked outside contact and a member with no place.
    expect(contacts.map((c) => c.name)).not.toContain("Not listed");
    expect(contacts.map((c) => c.name)).not.toContain("Dev Viewer");
  });

  it("lists current medications only, by name, with dose and schedule", () => {
    expect(section(full(), "medications")?.medications.map((m) => [m.title, m.howTaken])).toEqual([
      ["Acetaminophen 500 mg", "As needed, up to 4 a day"],
      ["Metformin 500 mg", "1 tablet · 8:00 and 20:00"],
    ]);
  });

  it("names the passes a schedule uses, as the medication screens do", () => {
    const passes = [
      { id: "pe", name: "Evening", time: "20:00", sortOrder: 2 },
      { id: "pm", name: "Morning", time: "08:00", sortOrder: 1 },
    ];
    const metformin = med({
      name: "Metformin",
      strength: "500 mg",
      dose: "1 tablet",
      schedule: { type: "scheduled", slots: [{ passId: "pe" }, { passId: "pm", amount: "2 tablets" }] },
    });
    const sheet = emergencySheet({
      recipient,
      details,
      members,
      medications: [metformin],
      providers,
      passes,
      now: NOW,
    });
    expect(section(sheet, "medications")?.medications.map((m) => m.howTaken)).toEqual([
      "1 tablet · Morning (2 tablets) and Evening",
    ]);
  });

  it("lists the allergies on file most severe first, says when there are none, and leaves them out without a recipient", () => {
    expect(section(full(), "allergies")).toMatchObject({
      allergies: [
        { id: "a2", text: "Penicillin (hives, severe)", severe: true },
        { id: "a1", text: "Sulfa (rash, mild)", severe: false },
      ],
      empty: null,
    });
    const sheet = (allergies?: ReturnType<typeof allergyState> | null) =>
      emergencySheet({ recipient, details, members, medications, providers, allergies, now: NOW });
    expect(section(sheet(allergyState([], "2026-11-01 10:00:00")), "allergies")).toMatchObject({
      allergies: [],
      empty: "No known allergies",
    });
    expect(section(sheet(allergyState([], null)), "allergies")).toMatchObject({
      allergies: [],
      empty: "Allergies not recorded",
    });
    expect(section(sheet(), "allergies")).toBeUndefined();
    expect(section(sheet(null), "allergies")).toBeUndefined();
  });

  it("lists the primary providers and the pharmacy current medications are filled at, with a phone each", () => {
    expect(section(full(), "careTeam")?.providers).toEqual([
      {
        id: "p1",
        name: "Dr. Elena Alvarez",
        role: "Primary care",
        phone: { label: "Office", number: "(555) 010-2200" },
      },
      { id: "p2", name: "Westside Family Medicine", role: "Practice", phone: null },
      {
        id: "ph1",
        name: "Cornerstone Pharmacy",
        role: "Pharmacy",
        phone: { label: null, number: "(555) 010-4400" },
      },
    ]);
  });

  it("prefers a primary pharmacy over the medications' pharmacies", () => {
    const sheet = emergencySheet({
      recipient,
      details,
      members,
      medications,
      providers: [
        ...providers,
        provider({ id: "ph3", name: "Main Street Pharmacy", type: "pharmacy", isPrimary: true }),
      ],
      now: NOW,
    });
    expect(section(sheet, "careTeam")?.providers.map((p) => p.name)).toEqual([
      "Dr. Elena Alvarez",
      "Westside Family Medicine",
      "Main Street Pharmacy",
    ]);
  });

  it("leaves out every empty section, so a half-filled profile prints clean", () => {
    const sheet = emergencySheet({
      recipient: {
        ...recipient,
        preferredName: null,
        dateOfBirth: null,
        codeStatus: null,
        bloodType: null,
        primaryLanguage: " ",
        pronouns: null,
        notes: "  ",
      },
      details: EMPTY_DETAILS,
      members: [member({ user_id: "u3", name: "Dev Viewer" })],
      medications: [med({ name: "Amoxicillin", status: "completed" })],
      providers: [provider({ id: "p3", name: "Dr. Samuel Patel" })],
      now: NOW,
    });
    expect(sheet.sections).toEqual([]);
    expect(sheet.recipient).toEqual({ name: "Pat Example", born: null, age: null });
  });

  it("keeps only the sections that have something: a note and one medication", () => {
    const sheet = emergencySheet({
      recipient: { ...recipient, codeStatus: null, bloodType: null, primaryLanguage: null, pronouns: null },
      details: EMPTY_DETAILS,
      members: [],
      medications: [med({ name: "Lisinopril", strength: "10 mg" })],
      providers: [],
      now: NOW,
    });
    expect(sheet.sections.map((s) => s.id)).toEqual(["note", "medications"]);
  });
});
