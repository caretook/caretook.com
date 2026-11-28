import type { FilterSection } from "../../components/ui/filterModel";

// The todo lists' view option (todo-links-2; pure, web:unit tests it):
// subtasks in their tree (the default, no parameter) or on their own
// (`?subtasks=own`: each open todo its own row, placed by its own due). The
// choice rides in the URL like the Filter menu's other sections, so a reload
// keeps it and the Planner's tabs carry it. No screen reads the parameter
// itself: they go through `todoViewOf` and build the menu's one section here.

/** The view's URL param. */
export const SUBTASKS_PARAM = "subtasks";

/** `tree`: subtasks in their tree (the default). `own`: every todo its own row. */
export type TodoView = "tree" | "own";

export const DEFAULT_TODO_VIEW: TodoView = "tree";

const VIEW_LABELS: Record<TodoView, string> = {
  tree: "In their tree",
  own: "On their own",
};

/** The view a search string asks for: `own` for `?subtasks=own`, anything else `tree`. */
export const todoViewOf = (search: string): TodoView =>
  new URLSearchParams(search).get(SUBTASKS_PARAM) === "own" ? "own" : "tree";

/** `search` with the view set (`tree` drops the param), the rest kept. */
export const setTodoView = (search: string, view: TodoView) => {
  const params = new URLSearchParams(search);
  if (view === "own") params.set(SUBTASKS_PARAM, view);
  else params.delete(SUBTASKS_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
};

/**
 * The Filter menu's "Subtasks" section, the same on every list that has it:
 * In their tree (the default: no count, no chip) and On their own (chip
 * "Subtasks on their own").
 */
export const todoViewSection = (search: string, view: TodoView = todoViewOf(search)): FilterSection => ({
  id: SUBTASKS_PARAM,
  title: "Subtasks",
  current: view,
  defaultId: DEFAULT_TODO_VIEW,
  chipLabel: view === "own" ? "Subtasks on their own" : undefined,
  options: (["tree", "own"] as const).map((id) => ({
    id,
    label: VIEW_LABELS[id],
    search: setTodoView(search, id),
  })),
});
