/**
 * The order of the timeline loader's reads. The first round is what the
 * entries read needs first (the search index status and the care periods for
 * `?q=`); the second is the entries and settings. The group's tags only feed
 * the entries read under `?tag=` (whether it's one of the group's tags), so
 * they join the first round then, and otherwise start with the second round
 * instead of adding a round of their own before it. No React or database here.
 */
export async function inRounds<First, Tags, Second>(reads: {
  /** True under `?tag=`: the entries read waits for the tags. */
  tagFilter: boolean;
  first: () => Promise<First>;
  tags: () => Promise<Tags>;
  /** The second round; `tags` is null when no tag filter needs them. */
  second: (first: First, tags: Tags | null) => Promise<Second>;
}): Promise<{ first: First; tags: Tags; second: Second }> {
  if (reads.tagFilter) {
    const [first, tags] = await Promise.all([reads.first(), reads.tags()]);
    return { first, tags, second: await reads.second(first, tags) };
  }
  const first = await reads.first();
  const [tags, second] = await Promise.all([reads.tags(), reads.second(first, null)]);
  return { first, tags, second };
}
