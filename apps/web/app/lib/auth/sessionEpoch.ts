// A count of sign-ins on this page, kept apart from `session.ts` so the
// sign-in pages can bump it without loading the /app session code.
//
// `requireSession`'s fresh path only reuses a session it checked in the
// current epoch, so the first navigation after a sign-in always asks the
// server who is signed in now.

let epoch = 0;

/** The current epoch. */
export const sessionEpoch = () => epoch;

/** Someone has just signed in on this page: the next session check waits for the server. */
export const sessionChanged = () => {
  epoch++;
};
