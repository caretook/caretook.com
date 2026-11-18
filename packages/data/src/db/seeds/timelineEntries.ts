import type { TimelineEntryDetails, TimelineEntryKind } from "../schema";

import { inArray } from "drizzle-orm";
import { getDb } from "../client";
import {
  encodeNoteDoc,
  noteDocFromText,
  noteDocumentSchema,
  noteText,
  timelineEntrySchema,
  userSchema,
} from "../schema";
import { DEV_GROUP_ID, DEV_RECIPIENT_ID } from "./careGroups";

const TIME_ZONE = "America/Los_Angeles";
const HOUR = 60 * 60 * 1000;

type SeedEntry = {
  /** Hours before seeding time, or `at`: a local time some days ago. */
  hoursAgo?: number;
  at?: { daysAgo: number; time: `${number}:${number}` };
  author: "member@example.com" | "caretaker@example.com";
  kind: TimelineEntryKind;
  title?: string;
  body?: string;
  details?: TimelineEntryDetails;
  deleted?: boolean;
};

// About a week of Grandma Pat's timeline, written by the owner and the caretaker.
const ENTRIES: SeedEntry[] = [
  { hoursAgo: 1, author: "caretaker@example.com", kind: "note", body: "Ate most of lunch. Good spirits." },
  {
    hoursAgo: 3,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Knee pain", severity: 4 },
    body: "Left knee, after the walk.",
  },
  {
    hoursAgo: 6,
    author: "member@example.com",
    kind: "event",
    title: "Physical therapy",
    body: "45 minutes.",
  },
  { hoursAgo: 20, author: "member@example.com", kind: "note", body: "Slept through the night." },
  {
    hoursAgo: 26,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Dizziness", severity: 2 },
  },
  { hoursAgo: 30, author: "caretaker@example.com", kind: "note", body: "Asked about the garden again." },
  { hoursAgo: 44, author: "member@example.com", kind: "event", title: "Pharmacy pickup" },
  { hoursAgo: 50, author: "caretaker@example.com", kind: "symptom", details: { name: "Fatigue" } },
  { hoursAgo: 52, author: "caretaker@example.com", kind: "note", body: "Wrong entry", deleted: true },
  { hoursAgo: 70, author: "member@example.com", kind: "note", body: "Called with Aunt June for an hour." },
  {
    hoursAgo: 75,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Knee pain", severity: 6 },
    body: "Iced it for 20 minutes.",
  },
  {
    hoursAgo: 96,
    author: "member@example.com",
    kind: "event",
    title: "Fall (no injury)",
    body: "In the hallway at night. Added a nightlight.",
  },
  { hoursAgo: 100, author: "caretaker@example.com", kind: "note", body: "Appetite low at dinner." },
  {
    hoursAgo: 120,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Headache", severity: 3 },
  },
  { hoursAgo: 125, author: "member@example.com", kind: "event", title: "Family visit" },
  { hoursAgo: 140, author: "caretaker@example.com", kind: "note", body: "Walked to the mailbox and back." },
  {
    hoursAgo: 150,
    author: "member@example.com",
    kind: "note",
    body: "Reorganized the pill organizer for the week.",
  },
  {
    hoursAgo: 165,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Shortness of breath", severity: 3 },
    body: "On the stairs.",
  },
  { hoursAgo: 170, author: "member@example.com", kind: "event", title: "Eye exam" },
  { hoursAgo: 190, author: "caretaker@example.com", kind: "note", body: "Started the new puzzle." },
  // Vitals (stored in canonical units: °C, kg, mg/dL, mL).
  {
    hoursAgo: 2,
    author: "caretaker@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "bloodPressure", systolic: 132, diastolic: 84 },
        { type: "heartRate", value: 74 },
        { type: "spo2", value: 96 },
      ],
    },
  },
  {
    hoursAgo: 8,
    author: "caretaker@example.com",
    kind: "vital",
    details: {
      readings: [{ type: "temperature", value: 37.4 }],
    },
    body: "Took it after the walk.",
  },
  {
    hoursAgo: 9,
    author: "caretaker@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "bowelMovement", bristol: 4 },
        { type: "urineOutput", value: 300 },
      ],
    },
  },
  {
    hoursAgo: 28,
    author: "member@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "weight", value: 61.7 },
        { type: "bloodGlucose", value: 112 },
      ],
    },
  },
  {
    hoursAgo: 32,
    author: "member@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "respiratoryRate", value: 18 },
        { type: "heartRate", value: 81 },
      ],
    },
  },
  {
    hoursAgo: 19,
    author: "member@example.com",
    kind: "vital",
    details: { readings: [{ type: "sleep", value: 7.5 }] },
  },
  // Longer entries, so the timeline has a realistic mix of lengths.
  {
    hoursAgo: 4,
    author: "member@example.com",
    kind: "note",
    title: "Phone call with Maria about today",
    body: [
      "Called Maria at 6:15 for the end-of-day rundown, about 25 minutes. Notes as we talked:",
      "",
      "Morning",
      '- Up at 7:40, a bit later than usual. Said she slept "in fits" and woke up around 3 to use the bathroom, then took a while to fall back asleep.',
      "- A little unsteady getting out of bed. Maria had her sit on the edge for a minute first like the PT showed us, and that helped.",
      "- Breakfast: half a bowl of oatmeal with banana, all of her coffee, a few bites of toast. Took morning pills with breakfast at 8:30, no trouble swallowing.",
      "- BP before breakfast was 132/84 sitting. Maria forgot the standing reading. I reminded her the nurse wants both, and she'll do it tomorrow.",
      "",
      "Midday",
      "- Did the crossword together for about 40 minutes. Sharp on the old movie clues, struggled with anything recent. Seemed to enjoy it.",
      "- Short walk to the end of the block and back with the walker. Stopped twice to rest. Knee was bothering her on the way back (she said about a 4). Iced it after for 15 minutes.",
      "- Lunch: most of a turkey sandwich, tomato soup, applesauce. Drank one full glass of water, but Maria had to remind her twice.",
      "- Napped from about 1:30 to 2:45 in the recliner.",
      "",
      "Afternoon",
      "- Around 4 she got confused again and asked when we were leaving for church. Maria didn't argue, put on her Sinatra playlist and made tea, and after about 20 minutes she was back to herself. Third afternoon like this in a week, always right around 4. Want to bring this up with Dr. Alvarez.",
      "- Aunt June called at 4:30. They talked for a while and that seemed to cheer her up.",
      "- Mentioned twice that she misses driving to the library. Maybe a library trip Saturday if the knee is okay.",
      "",
      "Evening",
      "- Dinner at 5:30: baked chicken, rice, green beans. Ate about two-thirds. No dessert, said she was full.",
      "- Evening pills at 6. Maria double-checked the organizer and all of today's slots are empty, so nothing missed.",
      "- Bowel movement this afternoon, normal. Urine looked fine, no complaints of burning.",
      "",
      "Things Maria noticed",
      "- Slight swelling in both ankles by the evening, which she hasn't seen before. Not painful. She propped her feet up after dinner. Keep an eye on it and mention it to the nurse if it's there again tomorrow.",
      "- The bathroom nightlight is out. I'll bring bulbs tomorrow.",
      "- We're low on the blood pressure pills, maybe 5 days left. I'll call the pharmacy for a refill in the morning.",
      "",
      "To do",
      "- Me: pharmacy refill, nightlight bulbs, add the afternoon confusion and ankle swelling to the question list for the next visit.",
      "- Maria: sitting AND standing BP morning and evening, more water during the day (try the marked bottle), note what time any confusion starts.",
      "",
      "Overall a pretty good day. Maria says she was in good spirits for most of it, apart from the 4 o'clock episode.",
    ].join("\n"),
  },
  {
    hoursAgo: 48,
    author: "caretaker@example.com",
    kind: "event",
    title: "Primary care visit: Dr. Alvarez",
    body: [
      "Routine 3-month check with Dr. Alvarez at Westside Family Medicine. Appointment was at 10:30, called back at 10:50, out by 11:45. Grandma was in good spirits and answered most questions herself. I took notes and filled in the gaps.",
      "",
      "Vitals at check-in",
      "- BP 138/86 (rechecked 134/84 at the end), HR 76, temp normal, weight 136 lb (down 2 lb since the last visit). O2 97%.",
      "",
      "Blood pressure",
      "- Dr. Alvarez is happy with the trend but wants it a bit lower. She's raising the evening dose slightly. The new prescription was sent to the pharmacy and should be ready tomorrow.",
      "- Asked us to take home readings twice a day for two weeks, sitting and then standing after a minute, and log them here. She's watching for a big drop when standing, since that could explain the dizziness.",
      "- Warning signs to call about: dizzy enough to sit down, fainting, or BP under 100 on top. Go to the ER for chest pain or trouble breathing.",
      "",
      "Dizziness",
      "- Told her about the dizziness when getting up, mostly in the morning. She thinks it's likely blood pressure dropping when standing (orthostatic), possibly made worse by not drinking enough.",
      "- Advice: sit on the edge of the bed for a minute before standing, get up slowly, and aim for about 6 glasses of fluid a day unless told otherwise. Keep the walker next to the bed at night.",
      "",
      "Knee",
      "- Examined the left knee. Some swelling and creaking but good range of motion. She thinks it's osteoarthritis flaring with the extra walking from PT.",
      "- Keep doing the PT exercises. Ice for 15 to 20 minutes after walks. Acetaminophen as needed is okay, up to the amount on the label. Avoid ibuprofen and naproxen because of the blood pressure and kidneys.",
      "- If it isn't better in 4 to 6 weeks, she'll consider an X-ray and possibly a steroid injection.",
      "",
      "Memory and afternoon confusion",
      "- Asked about the repeated questions and the late-afternoon confusion. She asked Grandma some memory questions (date, three words to remember, drawing a clock). Grandma got most of it but missed two of the three words.",
      "- She said afternoon confusion is common and can get worse with poor sleep, dehydration, infections or medication changes. She wants to rule out the simple causes first.",
      "- Ordered bloodwork: B12, thyroid, a basic metabolic panel, and a blood count. Plus a urine test to check for infection, since that can cause sudden confusion in older adults.",
      "- Depending on the results, she may refer us to a memory clinic for a fuller evaluation. She didn't want to label anything yet.",
      "- Suggestions in the meantime: keep a regular daily routine, get daylight in the morning, limit naps to under an hour, and keep notes of when confusion happens and what helped.",
      "",
      "Sleep",
      "- Grandma mentioned waking at night. Dr. Alvarez wants to slowly taper the over-the-counter sleep aid, because those can add to confusion and falls in older adults. Plan: half a tablet for a week, then stop. Call if sleep gets much worse.",
      "",
      "Medications reviewed",
      "- Went through the full list. Evening BP dose increased (above). Taper the sleep aid (above). Everything else stays the same.",
      "- She asked us to bring the actual bottles to the next visit, not just the list.",
      "",
      "Vaccines",
      "- Flu shot given today in the left arm. Arm may be sore for a day or two.",
      "- She recommended the updated COVID booster and the RSV vaccine. Both can be done at the pharmacy. We'll schedule them for next week.",
      "",
      "Questions we didn't get to",
      "- Whether she should keep taking the calcium supplement.",
      "- The eye exam results from last month (the office will request the records).",
      "- Whether it's okay for Grandma to have a glass of wine at family dinners with the new dose.",
      "",
      "Next steps",
      "- Lab order is in the blue folder. Walk-in lab on the first floor, no fasting needed. Goal is this week.",
      "- Pick up the new BP prescription tomorrow.",
      "- Start twice-daily BP log (sitting and standing).",
      "- Start the sleep aid taper tonight.",
      "- Book the COVID and RSV vaccines at the pharmacy.",
      "- The nurse will call with lab results. Follow-up visit in 3 months, or sooner if the labs show anything.",
      "",
      "Overall a reassuring visit. Dr. Alvarez was patient and talked directly to Grandma, which she appreciated.",
    ].join("\n"),
  },
  {
    hoursAgo: 12,
    author: "caretaker@example.com",
    kind: "note",
    body: "Quiet morning. Did the crossword together and she remembered most of the answers about old movies. Needed reminding twice to drink water. Mentioned she misses driving to the library, so maybe a trip this weekend.",
  },
  {
    hoursAgo: 58,
    author: "member@example.com",
    kind: "note",
    title: "Phone call with Aunt June",
    body: "June called to check in. She can cover Saturday afternoons starting next month, and wants to know if Grandma's still allowed to have sweets with the new meds (I said we'd ask at the next visit). She also offered to drive to the eye appointment.",
  },
  {
    hoursAgo: 80,
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Confusion", severity: 5 },
    body: "Late afternoon, around 4 PM. Thought it was morning and wanted to get ready for church. Calmed down after a snack and some music, and was back to herself by dinner. Second time this week at about the same time of day.",
  },
];

// About eight weeks before that: getting help in place, a home safety visit,
// physical therapy, a urine infection that showed up as sudden confusion (an
// ER visit logged as it happened), and the everyday admin of caregiving.
const at = (daysAgo: number, time: `${number}:${number}`) => ({ daysAgo, time });
const MORE_ENTRIES: SeedEntry[] = [
  {
    at: at(62, "19:30"),
    author: "member@example.com",
    kind: "note",
    title: "Questions for home care agencies",
    body: [
      "- Same aide every visit, or whoever is free?",
      "- Minimum hours per visit, and the hourly rate for 4 hours vs 8?",
      "- Are aides trained for transfers and showers, and for memory problems?",
      "- What happens if the aide is sick: backup, and how much notice?",
      "- Can they help with medication reminders (not giving meds)?",
      "- Light housekeeping, meals, driving to appointments?",
      "- Can we meet the aide before the first visit?",
    ].join("\n"),
  },
  {
    at: at(60, "16:10"),
    author: "member@example.com",
    kind: "note",
    title: "Home care agency calls",
    body: "Three agencies called back. Rates were $32 to $38 an hour with a 4-hour minimum. Two can send the same aide every visit, which matters for her. Going with the one that offered a meet-and-greet before the first visit.",
  },
  {
    at: at(57, "10:00"),
    author: "member@example.com",
    kind: "event",
    title: "Meet-and-greet with Maria (aide)",
    body: "About 30 minutes. Grandma showed her the garden photos and they talked about cooking. Maria starts Tuesday and Thursday mornings, 9 to 1: help with the shower, breakfast, light housekeeping, and a short walk if the knee allows.",
  },
  {
    at: at(56, "14:00"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Physical therapy evaluation",
    body: [
      "Devon (PT) did balance and strength tests. Timed up-and-go was 19 seconds, which puts her at higher risk of falling.",
      "",
      "Plan: twice a week for 8 weeks. Home exercises every day:",
      "- Sit-to-stands from a kitchen chair, 2 sets of 8",
      "- Heel raises holding the counter",
      "- Marching in place, 1 minute",
      "",
      "Walker for anything longer than walking around the house.",
    ].join("\n"),
  },
  {
    at: at(55, "13:20"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Maria's first morning. Grandma was shy for the first hour and then fine. I got the groceries done and had coffee somewhere by myself for 40 minutes.",
  },
  {
    at: at(50, "09:40"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Did the home exercises together after breakfast. She counts out loud and pretends to hate it.",
  },
  {
    at: at(48, "11:00"),
    author: "caretaker@example.com",
    kind: "event",
    title: "OT home safety visit",
    body: [
      "The occupational therapist walked through the house with us. Suggestions:",
      "- Grab bars by the toilet and in the shower",
      "- Shower chair and a handheld shower head",
      "- Raised toilet seat with arms",
      "- Take up the hallway runner (trip hazard)",
      "- Nightlights from the bedroom to the bathroom",
      "- Move everyday dishes to the lower shelves",
      "",
      "She also showed Grandma how to get out of bed in steps: roll to her side, sit up, wait a moment, then stand.",
    ].join("\n"),
  },
  {
    at: at(45, "20:15"),
    author: "member@example.com",
    kind: "note",
    body: "Ordered a shower chair, handheld shower head and raised toilet seat with arms. Insurance doesn't cover bathroom equipment, so about $140 total. Handyman booked for the grab bars next Tuesday.",
  },
  {
    at: at(43, "10:30"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Rough night. Up three times to use the bathroom, the last time unsteady. Keeping the walker by the bed and the bathroom light on from now on. Both of us tired today; she napped twice.",
  },
  {
    at: at(41, "15:00"),
    author: "member@example.com",
    kind: "event",
    title: "Grab bars installed",
    body: "Two by the toilet, one long one in the shower. The handyman also took up the hallway runner. She grumbled about the runner but used the bar right away.",
  },
  {
    at: at(40, "10:15"),
    author: "caretaker@example.com",
    kind: "note",
    body: "First shower with the new chair and handheld shower head. Much less nervous, and she took her time. Still needs help with her back and feet.",
  },
  {
    at: at(38, "12:05"),
    author: "member@example.com",
    kind: "note",
    title: "Pharmacy refill mix-up",
    body: 'The mail-order pharmacy canceled the blood pressure refill as "too early to fill". On the phone: the new 90-day supply was sent before the old one ran out, so their system rejected it. The pharmacist will reprocess it next week. She has 12 days left, so no gap. Added a reminder to check refills two weeks before they run out.',
  },
  {
    at: at(36, "18:00"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Set up a new weekly pill organizer with morning and evening rows. Moved the evening pills to 6 PM instead of bedtime, so they don't get missed when she falls asleep in her chair.",
  },
  {
    at: at(34, "11:30"),
    author: "member@example.com",
    kind: "note",
    title: "PT visits approved",
    body: "Insurance needed prior authorization for PT after the first six visits. Two calls later: approved for 10 more visits through the end of next month.",
  },
  {
    at: at(32, "16:00"),
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Low mood", severity: 4 },
    body: "Quiet and teary in the afternoon. Said she feels like a burden. We looked at old photos together, and she brightened up when Aunt June called.",
  },
  // The urine infection.
  {
    at: at(30, "15:10"),
    author: "caretaker@example.com",
    kind: "symptom",
    details: { name: "Sudden confusion", severity: 7 },
    body: "After her nap she didn't recognize the house and kept asking for her mother. Much worse than her usual late-afternoon muddle. No fever on the forehead thermometer, and no pain she can describe. Calling the nurse line.",
  },
  {
    at: at(30, "15:25"),
    author: "caretaker@example.com",
    kind: "note",
    title: "Nurse line call",
    body: "The nurse said sudden confusion in an older adult is often an infection, most often a urine infection, even without fever or burning. Go to urgent care today. Go to the ER instead if she gets very drowsy, can't stay awake, or has a fever over 101.",
  },
  {
    at: at(30, "16:40"),
    author: "caretaker@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "temperature", value: 37.9 },
        { type: "heartRate", value: 96 },
        { type: "bloodPressure", systolic: 148, diastolic: 88 },
      ],
    },
    body: "At urgent care check-in.",
  },
  {
    at: at(30, "17:30"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Urgent care, sent on to the ER",
    body: "The urine dipstick shows an infection. They want bloodwork and a culture they can't do here, and with the confusion they'd rather she be seen in the ER. Driving over now. Called the family.",
  },
  {
    at: at(30, "19:05"),
    author: "caretaker@example.com",
    kind: "note",
    body: "In a room at last. Blood drawn and IV fluids started. She's calmer with the lights dimmed and someone holding her hand.",
  },
  {
    at: at(30, "20:40"),
    author: "caretaker@example.com",
    kind: "note",
    body: "The doctor came back: urine infection confirmed, kidney numbers fine, and no sign it has spread to her blood. First antibiotic dose by IV. They want to watch her for a few hours before deciding about going home.",
  },
  {
    at: at(30, "23:15"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Discharged from the ER",
    body: [
      "Home just before midnight. Instructions:",
      "- Antibiotic twice a day with food for 7 days. Finish it even if she seems better.",
      "- Push fluids through the day.",
      "- The confusion can take a few days to clear.",
      "- Come back for a fever over 101, vomiting that means she can't keep pills down, or if she gets more confused.",
      "- See Dr. Alvarez within a week. The ER will send the culture results.",
    ].join("\n"),
  },
  {
    at: at(29, "09:30"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Slept until 9. Still foggy but knew where she was. Took the antibiotic with breakfast and drank four glasses of water by lunch, with a lot of encouragement.",
  },
  {
    at: at(29, "14:00"),
    author: "caretaker@example.com",
    kind: "vital",
    details: { readings: [{ type: "temperature", value: 37.2 }] },
  },
  {
    at: at(27, "11:45"),
    author: "member@example.com",
    kind: "note",
    title: "Culture results",
    body: "The ER called: the antibiotic she's on works against this bacteria, so no change. Finish all 7 days.",
  },
  {
    at: at(26, "15:30"),
    author: "caretaker@example.com",
    kind: "note",
    body: "Much more herself today. Did the crossword and argued with the game show on TV, which is a good sign.",
  },
  {
    at: at(24, "10:30"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Follow-up with Dr. Alvarez",
    body: "The confusion has cleared. Urine recheck once the antibiotic is done. Prevention: spread fluids through the day, and treat a sudden change in behavior as the first sign of infection. Dr. Alvarez suggested writing down what's normal for her, so anyone helping can tell when she's off.",
  },
  {
    at: at(23, "20:00"),
    author: "member@example.com",
    kind: "note",
    title: "Her usual baseline (for anyone helping)",
    body: [
      "So we can all tell when something's off:",
      "- Knows everyone in the family and where she is.",
      "- A little muddled late in the afternoon, better after a snack or music.",
      "- Walks around the house with the walker; needs a hand on stairs.",
      "- Eats about half of most meals; drinks well only when reminded.",
      "- Sleeps around 7 hours and is usually up once in the night.",
      "",
      "Call the nurse line if: she's suddenly more confused, much sleepier than usual, has a fever, or stops eating or drinking.",
    ].join("\n"),
  },
  {
    at: at(20, "21:10"),
    author: "member@example.com",
    kind: "note",
    title: "Respite options",
    body: "Looked into short breaks for the family. The assisted living place nearby does respite stays of 3 to 14 nights, around $250 a night, and needs a recent doctor's form and TB test. The adult day program at the senior center is $85 a day, 9 to 3, with lunch and activities, and offers a free trial day.",
  },
  {
    at: at(18, "19:30"),
    author: "member@example.com",
    kind: "note",
    title: "Family check-in call",
    body: "Agreed on a rotation: I take Saturdays, Aunt June the first Sunday of each month, and Maria Tuesday and Thursday mornings. Everyone writes anything worth knowing here, especially changes in confusion, falls, or new medications.",
  },
  {
    at: at(16, "09:00"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Dentist cleaning",
    body: "No new cavities. Gums a little inflamed; the hygienist recommended an electric toothbrush. She needs help reaching her back teeth.",
  },
  {
    at: at(13, "14:45"),
    author: "caretaker@example.com",
    kind: "event",
    title: "Adult day program trial",
    body: 'She went from 9 to 2. Staff said she joined the music group and ate all of her lunch. Her verdict: "fine, a bit loud". Signing up for Wednesdays to start.',
  },
  {
    at: at(10, "11:20"),
    author: "member@example.com",
    kind: "event",
    title: "Hearing aid check",
    body: "The audiologist cleaned both aids and replaced the left tube. Batteries are size 312; she goes through a pack about every 3 weeks.",
  },
  // After today's nurse call: sitting and standing blood pressure.
  {
    hoursAgo: 2.5,
    author: "caretaker@example.com",
    kind: "vital",
    details: { readings: [{ type: "bloodPressure", systolic: 131, diastolic: 82 }] },
    body: "Sitting.",
  },
  {
    hoursAgo: 2.45,
    author: "caretaker@example.com",
    kind: "vital",
    details: {
      readings: [
        { type: "bloodPressure", systolic: 114, diastolic: 72 },
        { type: "heartRate", value: 84 },
      ],
    },
    body: "Standing, after 1 minute. Said she felt a little lightheaded.",
  },
];

// Routine readings over the same eight weeks: sleep each morning, bowel
// movements, morning blood pressure every few days, and a weekly weight.
// A fixed pseudo-random sequence keeps the values the same on every seed.
const routineVitals = (): SeedEntry[] => {
  let state = 20261117;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (min: number, max: number) => min + rand() * (max - min);
  const quarter = (n: number) => Math.round(n * 4) / 4;
  const out: SeedEntry[] = [];
  const author = "caretaker@example.com" as const;
  for (let day = 2; day <= 56; day++) {
    // Short nights around the ER visit and the rough night.
    const sleep = day === 30 ? 4.5 : day === 43 ? 4.75 : quarter(pick(5.75, 8.25));
    out.push({
      at: at(day, "07:45"),
      author,
      kind: "vital",
      details: { readings: [{ type: "sleep", value: sleep }] },
    });
    if (day % 3 !== 1) {
      // Looser while on the antibiotic.
      const bristol = day >= 23 && day <= 29 ? 6 : Math.round(pick(3, 5));
      out.push({
        at: at(day, "10:15"),
        author,
        kind: "vital",
        details: { readings: [{ type: "bowelMovement", bristol }] },
      });
    }
    if (day % 3 === 0 && day !== 30) {
      out.push({
        at: at(day, "08:20"),
        author,
        kind: "vital",
        details: {
          readings: [
            {
              type: "bloodPressure",
              systolic: Math.round(pick(134, 148)),
              diastolic: Math.round(pick(80, 90)),
            },
            { type: "heartRate", value: Math.round(pick(66, 80)) },
          ],
        },
      });
    }
    if (day % 7 === 0) {
      // Slowly down from 63.5 kg to about 62 kg (140 → 137 lb).
      const kg = Math.round((61.9 + (day / 56) * 1.6 + pick(-0.2, 0.2)) * 10) / 10;
      out.push({
        at: at(day, "08:05"),
        author,
        kind: "vital",
        details: { readings: [{ type: "weight", value: kg }] },
      });
    }
  }
  return out;
};

/** Every Dev Family entry. New entries go at the end, so existing ids don't move. */
export const SEED_ENTRIES: SeedEntry[] = [...ENTRIES, ...MORE_ENTRIES, ...routineVitals()];

/** The UTC instant of a wall-clock time in `timeZone` (two passes, so DST edges land right). */
const zonedToUtc = (y: number, m: number, d: number, minutes: number, timeZone: string) => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(format.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - t;
  };
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
};

/** When an entry happened: `hoursAgo` before now, or `at` (a local time `daysAgo` days back). */
export const occurredAtOf = (entry: SeedEntry, now: number) => {
  if (!entry.at) return new Date(now - (entry.hoursAgo ?? 0) * HOUR);
  const today = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(new Date(now))
      .map((x) => [x.type, x.value]),
  );
  const day = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day)));
  day.setUTCDate(day.getUTCDate() - entry.at.daysAgo);
  const [h, m] = entry.at.time.split(":").map(Number);
  return zonedToUtc(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
    (h ?? 0) * 60 + (m ?? 0),
    TIME_ZONE,
  );
};

// Fixed ids keep the seed idempotent: ...c1001, ...c1002, … They follow
// list order, so add new entries at the end.
const entryId = (index: number) => `0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c${String(1001 + index).padStart(4, "0")}`;

/** Kinds whose text lives in their live document. A seed's `body` is that document's text. */
const DOCUMENT_KINDS: readonly TimelineEntryKind[] = ["note", "event"];

/**
 * What a seed entry stores: its content columns, and for notes and events
 * the text of its live document (the entry's `body` is then null; an event
 * without one gets an empty document).
 */
export const seedContentOf = (entry: SeedEntry) => {
  const hasDocument = DOCUMENT_KINDS.includes(entry.kind);
  return {
    title: entry.title ?? null,
    body: hasDocument ? null : (entry.body ?? null),
    details: entry.details ?? null,
    documentText: hasDocument ? (entry.body ?? "") : null,
  };
};

export const seed = async () => {
  const db = getDb();

  const authors = [...new Set(SEED_ENTRIES.map((e) => e.author))];
  const users = await db
    .select({ id: userSchema.id, email: userSchema.email })
    .from(userSchema)
    .where(inArray(userSchema.email, authors));
  const idByEmail = new Map(users.map((u) => [u.email, u.id]));

  const now = Date.now();
  const rows = SEED_ENTRIES.flatMap((entry, index) => {
    const authorId = idByEmail.get(entry.author);
    if (!authorId) return [];
    const occurredAt = occurredAtOf(entry, now).toISOString();
    const { documentText, ...content } = seedContentOf(entry);
    return [
      {
        id: entryId(index),
        groupId: DEV_GROUP_ID,
        recipientId: DEV_RECIPIENT_ID,
        kind: entry.kind,
        occurredAt,
        timeZone: TIME_ZONE,
        ...content,
        deletedAt: entry.deleted ? occurredAt : null,
        createdBy: authorId,
        updatedBy: authorId,
        documentText,
      },
    ];
  });

  // Every note and event gets its live document, already compacted (no pending updates).
  const documents = rows.flatMap(({ id, groupId, occurredAt, createdBy, documentText }) => {
    if (documentText === null) return [];
    const doc = noteDocFromText(documentText);
    const document = {
      id,
      groupId,
      snapshot: encodeNoteDoc(doc),
      text: noteText(doc),
      editors: { [createdBy]: occurredAt },
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy,
      updatedBy: createdBy,
    };
    doc.destroy();
    return [document];
  });

  // In batches, well under Postgres's limit on query parameters.
  const entries = rows.map(({ documentText: _text, ...row }) => row);
  for (let i = 0; i < entries.length; i += 200) {
    await db
      .insert(timelineEntrySchema)
      .values(entries.slice(i, i + 200))
      .onConflictDoNothing({ target: timelineEntrySchema.id });
  }
  for (let i = 0; i < documents.length; i += 200) {
    await db
      .insert(noteDocumentSchema)
      .values(documents.slice(i, i + 200))
      .onConflictDoNothing({ target: noteDocumentSchema.id });
  }
};
