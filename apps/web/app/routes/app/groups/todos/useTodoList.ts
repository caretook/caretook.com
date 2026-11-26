import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useGroupRecordTags, useGroupTags } from "~/components/tags";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { doneCountQuery, todosQuery, toTodos } from "~/lib/todos/todos.sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { matchesText, textTokens } from "~/lib/core/textFilter";
import { tagFilterOf } from "~/lib/tags/tagFilter";
import { showsTodo, todoSections, whoOf } from "~/lib/todos/todoList";

/** How many done todos a page of the Done list shows. */
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

export type TodoListRows = { openRows: TodoRow[]; doneRows: TodoRow[]; memberRows: MemberRow[] };
const NO_COUNT: { count: number }[] = [];

/**
 * The todo list's data, live: the open todos the filter shows, in sections
 * (in the recipient's zone), the Done page, members' names, the group's
 * tags and each todo's. The filter comes from `?who=`; with none it's
 * Everyone. `?tag=` keeps the todos with that tag (one the group has; any
 * other reads as no filter). `text` (the search box) keeps
 * the todos whose title or assignee has every word typed; with text, Done
 * reads every done todo and pages the matches, so older ones are found too.
 */
export function useTodoList(groupId: string, initial: TodoListRows, text = "") {
  const group = useGroup();
  const { search } = useLocation();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useMinuteClock();

  const openQuery = todosQuery(groupId);
  const openRows = useLiveQuery<TodoRow>(openQuery.sql, openQuery.params, initial.openRows);
  const open = useMemo(() => toTodos(openRows), [openRows]);

  const who = whoOf(search);
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
  const filtering = tokens.length > 0;

  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  // With text, every done todo is read and the matches paged here (a page of the table would miss older ones).
  const doneQuery = todosQuery(groupId, {
    done: true,
    who,
    userId: group.userId,
    tagId: tag?.id,
    ...(filtering ? {} : { limit: doneLimit }),
  });
  const doneRows = useLiveQuery<TodoRow>(doneQuery.sql, doneQuery.params, initial.doneRows);
  const doneAll = useMemo(() => toTodos(doneRows), [doneRows]);
  const doneMatching = useMemo(
    () => (filtering ? doneAll.filter(matches) : doneAll),
    [doneAll, filtering, matches],
  );
  const done = filtering ? doneMatching.slice(0, doneLimit) : doneMatching;
  const countQuery = doneCountQuery(groupId, { who, userId: group.userId, tagId: tag?.id });
  const [count] = useLiveQuery<{ count: number }>(countQuery.sql, countQuery.params, NO_COUNT);
  const moreDone = (filtering ? doneMatching.length : (count?.count ?? 0)) > done.length;
  // The React Compiler memoizes it.
  const showMoreDone = () => setDoneLimit((n) => n + DONE_PAGE);

  const sections = useMemo(
    () =>
      todoSections(
        open.filter(
          (t) =>
            showsTodo(who, t, group.userId) &&
            (!tag || !!tagsOf.get(t.id)?.some((l) => l.id === tag.id)) &&
            matches(t),
        ),
        now,
        timeZone,
      ),
    [open, who, tag, tagsOf, group.userId, now, timeZone, matches],
  );

  return {
    who,
    tags,
    tag,
    tagsOf,
    sections,
    done,
    moreDone,
    showMoreDone,
    nameOf,
    now,
    timeZone,
    total: open.length,
  };
}
