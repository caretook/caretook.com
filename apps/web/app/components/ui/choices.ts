/** One option in a `ChoiceGroup`: what it posts, and what it's called. */
export type ChoiceOption<T extends string = string> = { value: T; label: string };
