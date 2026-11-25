# PRD: Marketing site up to date (today's features and the new language)

Backlog: B-417 (marketing content pass for the new features), its copy part only. Topic `marketing-2`. Follows [`marketing-prd.md`](marketing-prd.md), whose _Messaging update (2026-11-25)_ this carries out. Web build only; it touches only the marketing routes, the share image and the brand alt text, so it runs beside any other PRD.

## Decisions

Costliest to change first.

| Decision                                                                                                                                                                                                                                                                                                 | Why                                                                                                | Source                     | Cost to change later      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------- |
| Copy only: no visual refresh, no new section designs beyond what a new feature block needs, reusing the existing section components                                                                                                                                                                      | The user wants a light wave before sharing the link with friends and family                        | asked: as recommended      | low: a later design topic |
| Out: privacy policy and terms review (B-54), screenshots (B-40), the accessibility statement (B-563), the demo site (B-561)                                                                                                                                                                              | The user's scope for this wave                                                                     | asked (2026-11-25)         | none                      |
| "Free for families" replaces "Free while in early access" everywhere outside the legal pages, with the essentials-free-always line in the price band and the FAQ; never "free forever" unqualified, never future features promised free                                                                  | _Messaging update_, price promise                                                                  | preference (marketing PRD) | low: copy                 |
| The hero lockup is **Caretook**, **_Care, taken._**, then the descriptor "The free care notebook for families."; "built by caregivers who've been there" is added in slice 4, with the founder story that backs it                                                                                       | _Messaging update_: the claim must be backed by a real story                                       | preference (marketing PRD) | low: copy                 |
| Claims are checked against the area docs and the app before they're written: only what it does today (named printouts: the medication list, the weekly bedside sheet and the profile); no "HIPAA", no bare "secure", no competitor named, no "export anytime" until B-52 (download all your data) exists | _Messaging update_, claims discipline                                                              | preference (marketing PRD) | low: copy                 |
| Medications leaves "Coming soon" and becomes a main feature; the "Coming soon" band is removed unless something planned is worth naming without a date                                                                                                                                                   | Medications is built; nothing else is promised                                                     | assumed                    | low                       |
| New feature blocks on `/features`: medications, todos, the planner and calendars (iCal feed, Google Calendar, reminder emails), quick entry, printable sheets, care periods, search, the profile, and connecting your own Claude or ChatGPT                                                              | Everything built since the first site, plus the user's 2026-11-22 note on connectors               | assumed                    | low                       |
| Feature blocks without a placeholder image show none (or an existing icon); no new screenshots or illustrations                                                                                                                                                                                          | B-40 waits on the launch map                                                                       | preference                 | low                       |
| The share image is re-rendered from SVG with the lockup; it's a brand graphic, not a screenshot                                                                                                                                                                                                          | _Messaging update_: the tagline in the share image and titles                                      | assumed                    | low                       |
| The founder story and two short bios go on About as the user approved them (2026-11-25), word for word, in the same wave; Tedder reads them before landing                                                                                                                                               | The user wrote and approved the text with the agents; agents never invent or rewrite founder facts | asked (2026-11-25)         | low                       |

## Problem

caretook.com still describes the app as it was at the first launch: medications "coming soon", no todos, planner, calendar feeds, quick entry, printouts, care periods, search or connectors, and "Free while in early access". The user is about to share the link with friends and family, who would see an older, smaller product, and price wording the user has since replaced.

## Solution

One copy pass, page by page, so a visitor sees what Caretook does today in the new voice: the "Care, taken." lockup, "Free for families" with an honest promise about what stays free, and concrete claims only. The pages, layout and components stay as they are; new feature blocks reuse the existing sections. An About founder story, in the founders' own words, backs the descriptor.

## User stories

1. As a family member sent the link, I want the home page to say in a glance what Caretook is and that it's free for families, so that I know it's for me and costs nothing.
2. As a visitor, I want the price promise to say plainly what stays free, so that I trust "free" isn't a trial.
3. As a visitor, I want the features page to show everything the app does today, including medications, todos, the planner and calendars, quick entry, printouts, care periods, search and the profile, so that I see the real product.
4. As a visitor who uses Claude or ChatGPT, I want to read that I can connect my own assistant to my care group, so that I know it fits how I work.
5. As a visitor, I want the FAQ's answers (cost, security, what's coming) to match the app today, so that nothing on the site is out of date.
6. As someone sharing the link in a message, I want the share preview and page titles to carry the tagline, so that the link looks finished.
7. As a visitor, I want the About page to tell who built Caretook and why, in their words, so that it feels human (slice 4, the user's approved text).

## Implementation decisions

- **Content modules stay the only source of page text** (each page's content module, including its `meta` titles and description; the shared meta module for the share image and its alt). Pages and section components change only where a new block needs an existing section type; no new section components.
- **The lockup** is a content field the home hero renders: name, tagline, descriptor, then the old heading as supporting copy. Titles use the tagline (home "Caretook: Care, taken.", other pages "<Page> · Caretook" as today, the description carrying the descriptor).
- **The price band and FAQ answer** share one sentence of copy from one place so they can't drift.
- **The share image** keeps its size and path; its PNG is re-rendered from an SVG source with the lockup, and its alt text changes with it. The brand mark and wordmark don't change.
- **Feature blocks** are written from the area docs (_Area index_), each claim checked against them; a doubtful one is left out, not hedged.
- **The founder story** is a content block on About with two short bios below it, the user's approved text verbatim (in the plan's slice 4), with "built by caregivers who've been there" added to the descriptor in the same slice.

## Testing decisions

- The pages' content tests (unit) follow the new copy: the lockup fields, no "early access", "HIPAA" or "free forever" on home, features, FAQ, About or in the meta module (the legal pages are untouched), the price sentence shared by the band and the FAQ, every feature block with a heading and body.
- The existing pages and layout component tests keep passing; no new component tests unless a section type gains a variant.
- The `marketing` browser check runs at each merge (headings and links it checks are updated with the copy).

## Out of scope

The visual refresh B-417 also asks for (B-836 (marketing visual refresh) under `marketing`), legal pages (B-54), screenshots and videos (B-40), the accessibility statement (B-563), the demo site (B-561), a partners page, sample printables, caretook.org, the waitlist and contact forms (unchanged).

## Notes

- **Until B-54 (privacy policy and terms):** the terms page still says Caretook is "free while in early access", and the privacy pages keep their early-access and HIPAA sections. Visitors who open the legal pages will see the older price wording.

- The messaging update's five-caregiver test of the lockup is the user's, after this lands.
- The founder text names the co-founder Tedder, gives no pronouns for Tedder, and keeps medical detail to the two illnesses and hospice; no family dynamics.
