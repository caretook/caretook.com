import type { LegalPageContent } from "../sections/legal";

/**
 * Consumer health data privacy notice (DRAFT for legal review: the user edits
 * it), for Washington's My Health My Data Act and similar state laws. It must
 * say what consumer health data is collected, why, from where, who it's
 * shared with, and how to exercise rights. Placeholders are in square
 * brackets, such as [privacy email].
 */
export const content = {
  meta: {
    title: "Consumer health data notice",
    description:
      "What consumer health data Caretook collects, why, who it's shared with, and how to use your rights under Washington's My Health My Data Act.",
  },
  heading: "Consumer health data privacy notice",
  lastUpdated: "2026-11-20",
  draft: true,
  intro: [
    "Caretook is built to hold health information about someone you care for. Washington's My Health My Data Act, and similar laws in other states, give people specific rights over that kind of information. This notice explains how those rights work at Caretook.",
    "It adds to our [Privacy policy](/privacy), which covers everything else. We apply this notice to everyone who uses Caretook, wherever they live.",
  ],
  sections: [
    {
      id: "what-it-covers",
      heading: "What this notice covers",
      summary:
        '"Consumer health data" means information that identifies a person and is about their physical or mental health. In Caretook, that\'s most of what a care group records.',
      formal: [
        'This notice applies to "consumer health data" as defined in the Washington My Health My Data Act (RCW 19.373) and similar laws: personal information that is linked or reasonably linkable to a consumer and that identifies the consumer\'s past, present or future physical or mental health status. It applies to [Company legal name] ("Caretook", "we", "us").',
        "In a care group, consumer health data is usually about the person being cared for, and is entered by family members or other caretakers in the group.",
      ],
    },
    {
      id: "data-we-collect",
      heading: "Health data we collect",
      summary:
        "What your care group writes down: symptoms, vital signs, notes about the day, events such as visits or falls, and the care providers you list.",
      formal: [
        "Categories of consumer health data we collect:",
        {
          list: [
            "Symptoms and their severity, as described by caretakers.",
            "Vital sign and body measurements: blood pressure, heart rate, temperature, oxygen saturation, respiratory rate, weight, blood glucose, bowel movements, urine output and sleep.",
            "Notes and events about health and care, such as daily notes, appointments, visits and falls, including the free text written in them.",
            "Information about health care providers, such as clinicians, practices and pharmacies, and notes about them.",
            "The care recipient's profile (name, preferred name and date of birth), and the fact that a person is receiving care.",
            "Health information inferred from the above only as shown back to your care group (for example, the latest readings). We do not create health inferences for any other purpose.",
          ],
        },
      ],
    },
    {
      id: "sources",
      heading: "Where it comes from",
      summary:
        "From you and the other members of your care group. We don't buy health data or get it from anyone else.",
      formal: [
        "We collect consumer health data directly from the users who enter it: you and the other members of your care group. We do not obtain consumer health data from data brokers, advertisers or other third parties.",
      ],
    },
    {
      id: "why",
      heading: "Why we collect and use it",
      summary:
        "Only to give your care group the service it asked for: keeping, showing and syncing its records, and keeping them secure.",
      formal: [
        "We collect and use consumer health data only with consent, or as necessary to provide the Service you requested, for these purposes:",
        {
          list: [
            "storing care records and showing them to the members of the care group they belong to;",
            "syncing records between members' devices, including for offline use;",
            "securing the Service, preventing fraud and abuse, and responding to security incidents;",
            "complying with law.",
          ],
        },
        "We do not use consumer health data for advertising, and no advertising or analytics tool has access to it.",
      ],
    },
    {
      id: "sharing",
      heading: "Who we share it with",
      summary:
        "With the members of your care group, and with the service providers that run Caretook for us. We never sell health data.",
      formal: [
        "Categories of recipients with whom we share consumer health data:",
        {
          list: [
            "Members of the care group the data belongs to, according to their role, with consent (see [Consent](#consent)).",
            "Processors that host, store, sync or back up the Service on our behalf, under contracts that limit their use to providing services to us: [list of processors].",
            "Government authorities, where required by law (for example, a valid court order).",
          ],
        },
        "We do not have affiliates that receive consumer health data. [Review: confirm.] We do not sell consumer health data, and we do not use geofencing around health care facilities.",
      ],
    },
    {
      id: "own-assistant",
      heading: "Connecting your own AI assistant",
      summary:
        "If you connect an AI assistant you already use, the health data you can see in that care group goes to the vendor you chose, under its terms. Personal contact details (members', the care recipient's, emergency contacts') are left out. It's off until a group owner turns it on, and you can disconnect in Settings, Devices.",
      formal: [
        "A care group member can choose to connect an AI assistant (for example Claude or ChatGPT) to one care group, but only if an owner of the group has turned this on; it is off by default. When connected, the assistant can read the consumer health data in that group that the member can see, and, if the member allows it, add entries and tasks. We do not send personal contact details: members', the care recipient's or emergency contacts' (a provider's business phone, address and website can be sent). The data goes to the AI vendor the member chose, under that vendor's terms, not ours. Before connecting, the member agrees to this in a separate statement, and we keep a record of that consent, the connection, and when it was last used. We do not keep a record of what the assistant read.",
        "You can withdraw consent by disconnecting the assistant in Settings, Devices; a group's owners and admins can disconnect any member's assistant, and an owner can turn the feature off for the whole group. This stops further access but does not delete what the vendor already received: use the vendor's own controls for that. See [Consent](#consent) and our [Privacy policy](/privacy#own-assistant).",
      ],
    },
    {
      id: "security",
      heading: "How we protect it",
      summary:
        "Health data is encrypted in transit and where it's stored. Caretook staff see a care group's records only with the family's permission, and that access is recorded.",
      formal: [
        "We encrypt consumer health data in transit and at rest, and check access on our servers for every read and every change, so each member gets only what their role allows. Caretook staff do not browse care records; if support needs to view them to help you, it is only with the family's permission, and the access is recorded. More detail is in the [Privacy policy](/privacy#security).",
      ],
    },
    {
      id: "consent",
      heading: "Consent",
      summary:
        "We ask before collecting health data beyond what the service needs, and before sharing it with anyone new. You can withdraw consent at any time.",
      formal: [
        "We collect consumer health data with your consent, or where collection is necessary to provide the Service you asked for. Sharing data with a new member of a care group happens through an invitation, and the person joining is asked to agree to how the group's information is shared before they can see it. We will ask for separate consent before sharing consumer health data for any purpose other than providing the Service.",
        "You may withdraw consent at any time by leaving a care group, removing members (if your role allows it), or writing to [privacy email]. Withdrawing consent may mean we can no longer provide parts of the Service.",
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      summary:
        "You can ask whether we hold your health data and see it, learn who it's been shared with, have it deleted, and withdraw consent. We won't treat you differently for asking.",
      formal: [
        "You have the right to:",
        {
          list: [
            "confirm whether we collect, share or sell your consumer health data, and access that data;",
            "receive a list of all third parties and affiliates with whom we have shared or sold it, and an active email address or other contact for each;",
            "withdraw consent to our collection and sharing of it;",
            "have it deleted. During early access, deletion is by request (see [How to make a request](#requests)); we will delete it from our records, including archives and backups (within [backup retention period]), and tell our processors to delete it too;",
            "not be discriminated against for exercising these rights.",
          ],
        },
      ],
    },
    {
      id: "requests",
      heading: "How to make a request",
      summary:
        "Email [privacy email] or use our contact page. We'll check it's you, then answer within 45 days.",
      formal: [
        "Send requests to [privacy email] or through the [contact page](/contact) (choose the privacy topic). You may also use an authorized agent. We will verify your identity using information associated with your account, and will respond within 45 days of receiving your request. If we need more time (up to 45 additional days), we will tell you why. Requests are free up to twice a year.",
        "Because a care group's records describe the person being cared for, requests about those records may come from that person, their legal representative, or the care group's owner. [Review: how requests about a care recipient's data are verified and who may make them.]",
      ],
    },
    {
      id: "appeals",
      heading: "Appeals",
      summary:
        "If we turn down your request, you can ask us to look again. If you're still not satisfied, you can complain to your state's attorney general.",
      formal: [
        'If we decline to act on your request, we will explain why and how to appeal. To appeal, reply to our decision or write to [privacy email] with "Appeal" in the subject. We will respond in writing within 45 days, explaining any action taken. If your appeal is denied, you may contact the Washington State Attorney General at www.atg.wa.gov/file-complaint, or the attorney general of your state.',
      ],
    },
    {
      id: "contact",
      heading: "Contact us",
      summary: "Questions about this notice: [privacy email], or our contact page.",
      formal: [
        "[Company legal name], [mailing address]. Email: [privacy email]. You can also reach us through the [contact page](/contact).",
      ],
    },
  ],
} satisfies LegalPageContent;
