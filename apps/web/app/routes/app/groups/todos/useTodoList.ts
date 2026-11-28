import type { LocalTodo, SubtaskProgressRow, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useGroupRecordTags, useGroupTags } from "~/components/tags";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import {
  progressByParent,
  subtaskProgressQuery,
  todosQuery,
  todoTreesQuery,
  toTodos,
} from "~/lib/todos/todos.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { matchesText, textTokens } from "~/lib/core/textFilter";
import { tagFilterOf } from "~/lib/tags/tagFilter";
import { showsTodo, todoSections, whoOf } from "~/lib/todos/todoList";
import { doneTreePage, splitTrees, todoTrees } from "~/lib/todos/todoTreeView";
import { todoViewOf } from "~/lib/todos/todoView";

/** How many done trees a page of the Done list shows. */
export const DONE_PAGE = 20;

const MINUTE = 60_000;

/** Now, moving once a minute, so overdue and today follow the clock. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export type TodoListRows = {
  openRows: TodoRow[];
  doneRows: TodoRow[];
  memberRows: MemberRow[];
  progressRows: SubtaskProgressRow[];
};

/**
 * The todo list's data, live: the open trees the filter shows, in sections
 * (in the recipient's zone), the Done page, members' names, the group's
 * tags and each todo's. The filter comes from `?who=`; with none it's
 * Everyone. `?tag=` keeps the todos with that tag (one the group has; any
 * other reads as no filter). `text` (the search box) keeps
 * the todos whose title or assignee has every word typed.
 * The open list is trees (todo-subtasks-3): one query of the group's open
 * todos and the trees' done subtasks (`todoTreesQuery`), built here with the
 * filters (who, tag, text) as the match, so a match keeps its subtree and
 * its ancestors as context rows. Done is trees too (B-1016): one query of the
 * done todos Done lists (`doneListed`: a done subtask of an open tree is
 * struck in that tree instead), built with the same match and paged a whole
 * tree at a time (`doneTreePage`, newest completion first), so older matches
 * are found too. The group's one progress query gives parents' "n of m
 * done". With `?subtasks=own` (todo-links-2) each open matching todo is its
 * own row (`splitTrees`, no context rows), Done lists every done todo (no
 * `doneListed`) on its own row, and `parentOf` gives a subtask's "Part of"
 * from the open and done rows read.
 */
export function useTodoList(groupId: string, initial: TodoListRows, text = "") {
  const group = useGroup();
  const { search } = useLocation();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useMinuteClock();

  const openQuery = todoTreesQuery(groupId);
  const openRows = useLiveQuery<TodoRow>(openQuery.sql, openQuery.params, initial.openRows);
  const open = useMemo(() => toTodos(openRows), [openRows]);

  const progressQuery = subtaskProgressQuery(groupId);
  const progressRows = useLiveQuery<SubtaskProgressRow>(
    progressQuery.sql,
    progressQuery.params,
    initial.progressRows,
  );
  const progress = useMemo(() => progressByParent(progressRows), [progressRows]);
  const progressOf = useCallback((todoId: string) => progress.get(todoId), [progress]);

  const who = whoOf(search);
  const view = todoViewOf(search);
  const doneListed = view === "tree";
  const tags = useGroupTags(groupId);
  const tag = tagFilterOf(search, tags);
  const tagsOf = useGroupRecordTags(groupId, "todo");

  const memberQuery = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(memberQuery.sql, memberQuery.params, initial.memberRows);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );
  const tokens = useMemo(() => textTokens(text), [text]);
  const matches = useCallback(
    (todo: LocalTodo) =>
      matchesText(
        tokens,
        todo.title,
        todo.assigneeName,
        todo.assigneeId ? members.find((m) => m.user_id === todo.assigneeId)?.name : null,
      ),
    [tokens, members],
  );

  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  // Every done todo Done may list is read, and the trees built and paged here (who, tag and text
  // are the trees' match, as in the open list, so a page of the table would cut trees and miss matches).
  const doneQuery = todosQuery(groupId, { done: true, doneListed });
  const doneRows = useLiveQuery<TodoRow>(doneQuery.sql, doneQuery.params, initial.doneRows);
  const doneAll = useMemo(() => toTodos(doneRows), [doneRows]);
  const listMatches = useCallback(
    (t: LocalTodo) =>
      showsTodo(who, t, group.userId) &&
      (!tag || !!tagsOf.get(t.id)?.some((l) => l.id === tag.id)) &&
      matches(t),
    [who, group.userId, tag, tagsOf, matches],
  );
  const donePage = useMemo(
    () =>
      doneTreePage(doneAll, {
        now,
        timeZone,
        matches: listMatches,
        split: view === "own",
        limit: doneLimit,
      }),
    [doneAll, now, timeZone, listMatches, view, doneLimit],
  );
  // The React Compiler memoizes it.
  const showMoreDone = () => setDoneLimit((n) => n + DONE_PAGE);

  const sections = useMemo(
    () =>
      todoSections(
        (view === "own" ? splitTrees : todoTrees)(open, {
          now,
          timeZone,
          matches: listMatches,
        }),
        now,
        timeZone,
      ),
    [view, open, listMatches, now, timeZone],
  );

  // On their own, a subtask's "Part of": its parent among the rows read (a parent in neither shows no line).
  const parents = useMemo(
    () => (view === "own" ? new Map([...open, ...doneAll].map((t) => [t.id, t])) : null),
    [view, open, doneAll],
  );
  const parentOf = useMemo(
    () => (parents ? (parentId: string) => parents.get(parentId) : undefined),
    [parents],
  );

  return {
    who,
    view,
    tags,
    tag,
    tagsOf,
    sections,
    done: donePage.trees,
    moreDone: donePage.more,
    showMoreDone,
    nameOf,
    progressOf,
    parentOf,
    now,
    timeZone,
  };
}
