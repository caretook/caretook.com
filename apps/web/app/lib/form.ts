/** A text field's value, or "" when it's missing or a file. */
export const formString = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
