# Caretook compared with Caring Village

Research note, 2026-11-28 (B-829). For positioning only: the site names no competitor ([marketing](../domain/marketing.md)). Caring Village's side is what its public pages said that day. Caretook's side cites an area doc for every claim (`docs/domain/`).

## Pages read

- Home: https://caringvillage.com/
- The app: https://caringvillage.com/app/
- Pricing: https://caringvillage.com/pricing/
- App Store listing: https://apps.apple.com/us/app/caring-village/id1093814557

## Features

| Feature                  | Caring Village                                                                                                                                                  | Caretook                                                                                                                                                                                                                                                | Verdict                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Price                    | Free: 1 village, 2 members. Circle $14.99/month (2 villages × 5 members), Village $24.99/month (5 × 50)                                                         | Free for families, one promise sentence on what stays free ([marketing](../domain/marketing.md))                                                                                                                                                        | Caretook ahead                                           |
| Who joins, roles         | Invite family, friends, paid carers; each has a login and a role                                                                                                | Owner, admin, caretaker, viewer, plus easy helper and easy viewer; email and link invites, join requests, access codes ([care-groups](../domain/care-groups.md))                                                                                        | Overlap (Caretook finer)                                 |
| Daily log                | Wellness journal: posts, check-ins, mood, symptoms, photos, likes and comments; export                                                                          | Timeline of notes, symptoms (0–10 severity), vitals with units, doses, medication changes ([timeline](../domain/timeline.md))                                                                                                                           | Overlap (they: photos, reactions; we: structured vitals) |
| Notes written together   | Not mentioned                                                                                                                                                   | Every note and event is a live document several people edit at once, merged offline ([live-notes](../domain/live-notes.md))                                                                                                                             | Caretook ahead                                           |
| Medications              | Current, past and today's lists; mark taken; missed-dose reminders; as-needed                                                                                   | Scheduled and as-needed, named Med times, doses given, skipped or refused, allergies, a change history ([medications](../domain/medications.md))                                                                                                        | Overlap; Caring Village ahead on dose reminders          |
| Calendar                 | Shared calendar; external sync (Google, Apple, Outlook) and a printable calendar on paid plans                                                                  | Events, repeating series, an iCal feed, two-way Google Calendar, reminder emails, with a generic-or-details sharing choice ([calendars](../domain/calendars.md), [appointments](../domain/appointments.md))                                             | Overlap; Caretook free where they charge                 |
| To-dos                   | Owner, "I'll do it" claim, "Need a volunteer", reminders                                                                                                        | Assignee, due day and time, notes, links to providers and medications, due emails; viewers tick their own ([todos](../domain/todos.md), [calendars](../domain/calendars.md))                                                                            | Overlap; Caring Village ahead on volunteering            |
| Care plans, checklists   | Daily and weekly routines with completion %; expert-built checklists (routines, emergency planning)                                                             | None                                                                                                                                                                                                                                                    | Caring Village ahead                                     |
| Messaging                | Group and one-to-one chat                                                                                                                                       | None                                                                                                                                                                                                                                                    | Caring Village ahead                                     |
| Documents                | Folders for medical, legal, insurance and ID files; scanning                                                                                                    | None (no file or photo upload)                                                                                                                                                                                                                          | Caring Village ahead                                     |
| Providers                | "Contacts" in the menu; no detail given                                                                                                                         | Clinicians, practices, pharmacies with phones and addresses, linked to notes, events and medications ([providers](../domain/providers.md))                                                                                                              | Caretook ahead                                           |
| Profile, emergency sheet | Not mentioned                                                                                                                                                   | Recipient profile (code status, blood type, insurance, conditions, outside contacts), an emergency order and a printable emergency sheet ([profiles](../domain/profiles.md))                                                                            | Caretook ahead                                           |
| Where they are           | Not mentioned                                                                                                                                                   | Care periods: home, hospital, rehab, hospice, with "Day N" ([care-periods](../domain/care-periods.md))                                                                                                                                                  | Caretook ahead                                           |
| Printouts                | Printable calendar (paid)                                                                                                                                       | Medication list, weekly bedside sheet, emergency sheet, any note or event ([medications](../domain/medications.md), [profiles](../domain/profiles.md), [live-notes](../domain/live-notes.md))                                                           | Caretook ahead                                           |
| Search, tags             | Not mentioned                                                                                                                                                   | Search across entries, providers, medications, todos; one colored tag list per group ([search](../domain/search.md), [tags](../domain/tags.md))                                                                                                         | Caretook ahead                                           |
| Offline                  | Not mentioned                                                                                                                                                   | Works offline on the device's copy, syncs on reconnect ([sync](../domain/sync.md))                                                                                                                                                                      | Caretook ahead                                           |
| AI                       | "Julia", a built-in assistant for caregiving questions and next steps                                                                                           | Quick entry parses typed text on the device, no AI vendor ([assistant](../domain/assistant.md)); members can connect their own Claude or ChatGPT ([connectors](../domain/connectors.md))                                                                | Different bets                                           |
| Platforms                | iPhone, Android, web                                                                                                                                            | Web (mobile first); native apps not yet built (AGENTS.md: Capacitor proposed)                                                                                                                                                                           | Caring Village ahead                                     |
| Privacy                  | "Bank-level encryption", data not sold. App Store labels list identifiers used to track across other companies' apps, and data used for marketing and analytics | No analytics or third-party requests on the site ([marketing](../domain/marketing.md)); calendar details leave only with member consent ([calendars](../domain/calendars.md)); owners can delete a care group ([care-groups](../domain/care-groups.md)) | Caretook ahead                                           |

Their pricing page lists external calendar integration under Free, while the app page puts it on paid plans; the table follows the app page.

## Where we already do better

- **Free without a member cap.** Their free plan stops at 2 members; a real family needs Circle or Village.
- **Clinical structure.** Vitals with units, symptom severity, dose outcomes, med times, allergies, conditions, providers and care periods, where theirs is a journal of posts.
- **Paper that helps at the bedside:** medication list, weekly sheet, emergency sheet, free.
- **Calendar out of the box:** iCal feed and two-way Google, free, with a details-or-generic choice per member.
- **Offline and live notes:** a hospital with poor signal still works; two people can write one note.
- **Privacy we can say plainly:** no ad or tracking tools, against their App Store tracking label.
- **Your own AI:** connect Claude or ChatGPT to one group, instead of a built-in bot.

## Where they do better

- **Native apps** on iPhone and Android, with push.
- **Messaging** in the app, group and private.
- **Documents and photos:** folders, scanning, photos in the journal.
- **Medication reminders** for missed doses.
- **Care plans and checklists** with progress the family sees.
- **Volunteering:** "Need a volunteer" and "I'll do it" make sharing chores social.
- **Proof:** 85,000+ family members claimed, a testimonial wall, App Store ratings (4.5 from 36).

## Ideas to pull ahead

- **Claim a todo:** an "I'll take it" action on unassigned todos, plus a "needs someone" filter, through the shared todo control.
- **Dose reminders** by email from Med times (missed or due), reusing the reminder sweep; push after Capacitor.
- **Routines as repeating todos** with a weekly done count, rather than a separate care-plan feature.
- **Starter checklists** (hospital discharge, hospice start, emergency kit) as todo templates.
- **Photos on entries** (a wound, a rash, a meal), encrypted, with deletion covered.
- **Documents** for insurance cards, POLST and power of attorney beside the profile and emergency sheet.
- **A comparison line on the site without naming anyone:** "Free for the whole family, however many of you there are", and the no-tracking promise.
- **A catch-up digest** email from the timeline for members who don't open the app daily.
