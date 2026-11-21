// The calendar feed's "Add to…" links (appointments-2, slice 5), made from
// the feed's https URL: Apple takes `webcal://`, Google its `render?cid=`
// page, Outlook its `addfromweb`. Pure; the URL (a secret) is never logged.

/** The feed URL with the calendar-subscription scheme (Apple Calendar, and Google's `cid`). */
export const webcalUrl = (url: string) => url.replace(/^https?:\/\//i, "webcal://");

export type FeedLinks = { apple: string; google: string; outlook: string };

/** Where each calendar app subscribes to `url`; `name` titles it in Outlook. */
export const feedLinks = (url: string, name: string): FeedLinks => ({
  apple: webcalUrl(url),
  google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(url))}`,
  outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`,
});
