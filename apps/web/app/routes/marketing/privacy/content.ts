import type { LegalPageContent } from "../sections/legal";

/**
 * Privacy policy (DRAFT for legal review: the user edits it). Written to
 * AGENTS.md's _Compliance_ section. Words in square brackets without a link,
 * such as [privacy email], are placeholders to fill before review.
 *
 * Keep it true: describe only what the product does today. The marketing
 * site's promises (no ads, no trackers, deletion) live here too, so a change
 * to them, such as adding analytics, updates this page in the same change.
 */
export const content = {
  meta: {
    title: "Privacy policy",
    description:
      "How Caretook collects, uses and protects your information and your family's health information, and the choices you have.",
  },
  heading: "Privacy policy",
  lastUpdated: "2026-11-20",
  draft: true,
  intro: [
    "Caretook helps a family keep track of someone's care. That means you trust us with health information about a person you love. This policy explains what we collect, why, who can see it, and what you can do about it.",
    "Each section starts with a short summary in plain words, followed by the formal text. If the two ever seem to differ, the formal text applies. If you live in Washington State, or anywhere with a similar health data law, our [Consumer health data notice](/health-data-privacy) also applies to you.",
  ],
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      summary:
        "Caretook is run by [Company legal name]. You can reach us about privacy at [privacy email] or through our [contact page](/contact).",
      formal: [
        'This privacy policy describes how [Company legal name] ("Caretook", "we", "us") collects, uses, discloses and protects personal information through the website at caretook.com, the Caretook web app and any Caretook mobile app (together, the "Service").',
        "Our mailing address is [mailing address]. Questions about this policy can be sent to [privacy email] or through the [contact page](/contact).",
      ],
    },
    {
      id: "hipaa",
      heading: "Caretook and HIPAA",
      summary:
        "Caretook is a tool for families, not for doctors, hospitals or insurers. HIPAA doesn't apply to us, so we protect your information under this policy, the FTC's rules and state health privacy laws instead.",
      formal: [
        'Caretook is a consumer service. We are not a "covered entity" or a "business associate" under the Health Insurance Portability and Accountability Act (HIPAA). We do not provide the Service on behalf of health care providers, health plans or health care clearinghouses, and we do not enter into business associate agreements.',
        "Because HIPAA does not apply, the information you put into Caretook is protected by this policy, by the Federal Trade Commission Act, by the FTC Health Breach Notification Rule (16 CFR Part 318), and by applicable state laws, including Washington's My Health My Data Act (see our [Consumer health data notice](/health-data-privacy)).",
        "If you copy information from a doctor's records into Caretook, the copy in Caretook is covered by this policy, not by your doctor's HIPAA notice.",
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      summary:
        "Your account details, the care information you and your family add (notes, symptoms, vitals, events, providers), and the small amount of technical information needed to sign you in and keep everyone's copy in sync.",
      formal: [
        { subheading: "Information you give us" },
        {
          list: [
            "Account information: your name, email address, password (stored only as a one-way hash) and, if you add one, a profile picture.",
            "Settings: your preferred units and display choices.",
            "Care group information: the care group's name, its members and their roles, and the profile of the person being cared for (name, preferred name and date of birth).",
            "Care records: timeline entries (notes, symptoms and severity, vital sign readings, events), the text of notes written together, who edited them and when, and the care providers you list (names, specialties, phone numbers, addresses and notes).",
            "If you join our waitlist or write to us: your email address, first name, who you care for and how you heard about us (all optional except email), or your name, email and message.",
          ],
        },
        { subheading: "Information collected automatically" },
        {
          list: [
            "Sign-in cookies and tokens that keep you signed in. These are strictly necessary for the Service.",
            "Basic technical information our hosting providers record when your device connects (such as IP address, browser type and request times), used for security and to keep the Service running. [Retention period for server logs.]",
            "On your device, the app keeps a copy of your care groups' records so it works offline, and remembers small preferences (such as light or dark theme). Signing out deletes the offline copy from that device.",
          ],
        },
        "We do not use advertising cookies, tracking pixels, cross-site trackers or third-party analytics on the website or in the app.",
      ],
    },
    {
      id: "how-we-use-it",
      heading: "How we use it",
      summary:
        "Only to run Caretook for you and your care group: to show your family the same records, sync them across devices, keep the service secure, and answer you when you write to us. Never for ads.",
      formal: [
        "We use personal information to:",
        {
          list: [
            "provide the Service, including showing care records to the members of the care group they belong to and syncing them between devices;",
            "create and secure accounts, prevent abuse and investigate security incidents;",
            "respond to your messages and requests, and send you service messages (such as sign-in or invitation emails);",
            "manage the waitlist and tell you when you can start using Caretook, if you asked us to;",
            "comply with law and enforce our [Terms](/terms).",
          ],
        },
        "We do not use health information for advertising, marketing to you on behalf of others, or building profiles for anyone else. Caretook staff do not browse care records. If support needs to look at a care group's records to help you, we will do so only with the family's permission, and the access is recorded. Disclosures the law requires are described under [Who can see your information](#sharing).",
      ],
    },
    {
      id: "sharing",
      heading: "Who can see your information",
      summary:
        "The people in your care group, the service providers that run Caretook for us, and no one else unless the law requires it. We never sell your information.",
      formal: [
        { subheading: "Your care group" },
        "Care records are shared with the members of the care group they belong to, according to each member's role (owner, admin, caretaker or viewer). Co-members can see your name and profile picture. Care groups are invitation-only, and an invitation is how information in a group is shared with a new person. Please see [Consent before sharing](#consent).",
        { subheading: "An AI assistant you connect" },
        "If you choose to connect your own AI assistant, the information you can see in that group is sent to the AI vendor you chose. See [Connecting your own AI assistant](#own-assistant).",
        { subheading: "Service providers" },
        "We use service providers to host the Service, store and sync data, and send email. They process information only on our instructions, under written contracts that require them to protect it and not use it for their own purposes. Our current service providers are: [list of service providers and what each does].",
        { subheading: "Legal reasons" },
        "We may disclose information if required by law, subpoena or court order, or when we believe in good faith that disclosure is necessary to protect someone's safety. Where the law allows, we will tell you first.",
        { subheading: "Business transfers" },
        "If Caretook is involved in a merger, acquisition or sale of assets, personal information may be transferred as part of that deal, subject to this policy. We will notify you before your information becomes subject to a different privacy policy.",
        { subheading: "What we never do" },
        {
          list: [
            "We never sell personal information or health information.",
            "We never share it with advertisers or data brokers.",
            "We never allow advertising or analytics tools to access health information.",
          ],
        },
      ],
    },
    {
      id: "consent",
      heading: "Consent before sharing",
      summary:
        "A care group holds information about someone else's health. Only invite people the person you care for (or their legal representative) agrees to share with. We ask for consent before health information is collected or shared.",
      formal: [
        "We collect and share consumer health data only with consent, or where it is necessary to provide the Service you asked for. When you create a care group or add care records, you confirm that you have the authority of the person being cared for, or of their legal representative, to record that information and share it with the members of the group.",
        "Inviting someone to a care group shares the group's records with them. Before a person joins a care group, they are asked to agree to how the group's information is shared. You can withdraw consent at any time by leaving the group, removing a member (if your role allows), or asking us to delete information (see [Deleting your information](#deletion)).",
      ],
    },
    {
      id: "ai",
      heading: "AI features",
      summary:
        "Caretook itself doesn't use AI on your information today (connecting your own assistant is your choice: see the next section). If we add AI features of our own, we'll only use AI providers that don't keep your data or train on it, and we'll update this policy first.",
      formal: [
        "The Service does not currently send care records to artificial intelligence (AI) providers. If we offer AI features in the future (for example, summarizing a timeline), we will use only AI providers that are contractually prohibited from retaining the information we send beyond what is needed to process the request and from using it to train or improve their models. We will update this policy, and ask for your consent where the law requires it, before any such feature processes your information.",
      ],
    },
    {
      id: "own-assistant",
      heading: "Connecting your own AI assistant",
      summary:
        "If you choose to connect Claude, ChatGPT or another AI assistant you already use, what that group's members can see goes to the vendor you picked, under that vendor's terms. It's off for every group until an owner turns it on. You can disconnect any time in Settings, Devices.",
      formal: [
        "A member can connect an AI assistant they already use (for example Claude or ChatGPT) to one care group. This is optional and separate from anything Caretook does itself. It is off for every care group until an owner of the group turns it on, and the owner can turn it off again at any time.",
        { subheading: "What is sent, and to whom" },
        "When the assistant asks, we send it the care group's information that the connecting member can see: the timeline, notes and events, vitals, medications and what is due, appointments, todos, providers (including the phone numbers, addresses and websites of clinicians, practices and pharmacies, but never a provider's email), the group's tags and what each is on, the names and roles of members, and the care recipient's name, age, allergies and medical conditions (with the names of the providers who diagnosed or manage them). We do not send personal contact details: members' email addresses, phone numbers and addresses, the care recipient's, emergency contacts', or those of providers listed as “other” (such as a neighbor or a private aide). The information goes to the AI vendor the member chose. Caretook is not that vendor's processor and does not control it: the vendor's own terms and privacy settings apply to what it receives, including whether it keeps the conversation or uses it to train its models. Check those settings before you connect.",
        "Before connecting, the member must tick a statement agreeing that the group's information goes to their chosen vendor. If the member allows it, the assistant can also add entries and todos for them, such as a dose, a note or an appointment, and add or remove tags. Each entry and todo is recorded as the member's own and marked as made through the assistant.",
        { subheading: "What we keep" },
        {
          list: [
            "The member's consent: which statement they agreed to, and when.",
            "The connection: the assistant's name, the group, whether it may read or also write, when it was connected, and when it was last used.",
          ],
        },
        "We do not keep a record of what the assistant asked for or read.",
        { subheading: "How to stop" },
        "A member can disconnect any of their assistants in Settings, Devices. A group's owners and admins can see the group's connected assistants and disconnect any of them, and an owner can turn the group's switch off, which disconnects every member's assistant at once. Turning the switch back on does not reconnect anyone. A member who leaves the group, or is removed from it, is disconnected from it too. Disconnecting stops further access, but cannot recall what the vendor has already received: to have that removed, use the vendor's own controls. See also [Consent before sharing](#consent).",
      ],
    },
    {
      id: "security",
      heading: "How we protect it",
      summary:
        "Information is encrypted in transit and at rest on our servers, access is limited by role, and staff see care records only with your family's permission, with that access recorded. No system is perfect, so we also plan for what happens if something goes wrong.",
      formal: [
        "We use administrative, technical and physical safeguards appropriate to the sensitivity of health information, including encryption in transit (TLS) and encryption at rest for our databases and backups, role-based access controls checked on our servers for every read and every change, hashed passwords and short-lived access tokens. Staff access to care records requires the family's permission and is recorded.",
        "The offline copy on your device is protected by your device's own security (such as its passcode and storage protections). Signing out deletes it. Please keep your device locked and sign out of shared devices.",
        "No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
      ],
    },
    {
      id: "breach",
      heading: "If there's a breach",
      summary:
        "If health information is accessed or shared without authorization, we'll tell the people affected, and the FTC and others the law requires, quickly and within the legal deadlines.",
      formal: [
        "Caretook complies with the FTC Health Breach Notification Rule. If we discover a breach of security of unsecured personal health records, which includes an unauthorized acquisition or disclosure of identifiable health information, we will notify affected individuals without unreasonable delay and no later than 60 calendar days after discovery, notify the Federal Trade Commission, and notify the media where the Rule requires it. We will also give any notices required by state law.",
        "Notices will describe what happened, what information was involved, what we are doing about it, and what you can do to protect yourself.",
      ],
    },
    {
      id: "deletion",
      heading: "Deleting your information",
      summary:
        "While Caretook is in early access, deleting your data means writing to us at [privacy email] or through the contact page. We'll delete your account and what's tied to it, and confirm when it's done. In the app you can already delete entries, leave a group, or remove members.",
      formal: [
        "You may ask us to delete your account and personal information by writing to [privacy email] or using the [contact page](/contact). During early access, this is the way to delete your data; there is no self-service account deletion yet. We will verify your request, respond within 45 days (see the [Consumer health data notice](/health-data-privacy) for details), and confirm when the deletion is done.",
        "In the app, writers can delete timeline entries, which hides them from everyone in the group, and any member can leave a care group. A deleted entry is permanently removed from our systems when deletion is requested, and from backups within [backup retention period].",
        "Care records belong to a care group, and other members rely on them. When you delete your account, entries you added to a care group stay with that group unless you ask us to delete them too, or the group's owner asks us to delete the whole group. [Review: confirm this rule and the handling of a group whose last owner deletes their account.]",
        "We may keep limited information where the law requires it, and we will tell you if we do.",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep it",
      summary: "As long as your account or care group is active, and then only as long as the law requires.",
      formal: [
        "We keep personal information for as long as your account is active or as needed to provide the Service. Waitlist entries are kept until you start using Caretook or ask us to remove them. Contact messages are kept for [retention period]. Backups are overwritten within [backup retention period].",
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights and choices",
      summary:
        "You can see, correct, download or delete your information, and withdraw consent. We give these rights to everyone, wherever you live, and we won't treat you differently for using them.",
      formal: [
        "Subject to verification, you may ask to access, correct, delete or receive a copy of your personal information, to learn which third parties it has been shared with, and to withdraw consent. Depending on where you live, you may have additional rights under laws such as Washington's My Health My Data Act or the California Consumer Privacy Act. We honor these requests for all users.",
        "To make a request, write to [privacy email] or use the [contact page](/contact). If we decline a request, you may appeal (see the [Consumer health data notice](/health-data-privacy#appeals)). We will not discriminate against you for exercising your rights.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      summary:
        "Accounts are for adults. A family may keep records about a child they care for, but children shouldn't sign up themselves.",
      formal: [
        "The Service is not directed to children, and you must be at least 18 years old to create an account. A parent or legal guardian may record care information about a child in their care. If you believe a child has created an account, contact us and we will delete it.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      summary:
        "If we change this policy, we'll update the date at the top. For important changes we'll tell you first, and ask again where the law requires.",
      formal: [
        'We may update this policy. The "last updated" date shows when it last changed. If we make material changes, especially to how we use or share health information, we will notify you in the Service or by email before the change takes effect, and obtain your consent where required.',
      ],
    },
    {
      id: "contact",
      heading: "Contact us",
      summary: "Questions or requests about privacy: [privacy email], or our contact page.",
      formal: [
        "[Company legal name], [mailing address]. Email: [privacy email]. You can also reach us through the [contact page](/contact).",
      ],
    },
  ],
} satisfies LegalPageContent;
