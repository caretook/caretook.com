// Which columns `powersync/sync-config.yaml` reads, per table (hosting PRD):
// the replication role's column grants and the `powersync` publication's
// column lists are generated from this, never written by hand. Pure, so it's
// unit-tested; `rolesSql` uses it.
//
// The file is read with a small YAML reader that knows only what sync
// configs use (block mappings and sequences, plain and quoted one-line
// scalars, `>`/`|` block scalars, comments), and each query with a small SQL
// reader that knows only what Sync Streams allow (SELECT columns FROM a
// table, JOINs, WHERE). Anything else fails loudly, never silently granting
// too much or too little.

/** `table → columns` in the database schema, to resolve the config's columns against. */
export type SchemaTables = Readonly<Record<string, readonly string[]>>;

/** One table's synced columns, in the schema's column order. */
export type TableColumns = { table: string; columns: string[] };

export class SyncConfigError extends Error {
  override name = "SyncConfigError";
}

// ---------------------------------------------------------------------------
// YAML (the subset sync configs use)

type YamlValue = string | null | YamlValue[] | { [key: string]: YamlValue };
type Line = { indent: number; text: string; no: number };

const BLOCK_SCALAR = /^[>|][-+]?$/;
const KEY_LINE = /^([A-Za-z0-9_.-]+|"[^"]*"|'[^']*'):(?:\s+(.*))?$/;

/** A line's text without a trailing ` # comment` (outside quotes). */
const stripComment = (text: string) => {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(text[i - 1] ?? ""))) {
      return text.slice(0, i).trimEnd();
    }
  }
  return text;
};

const unquoteKey = (key: string) => (/^["'].*["']$/.test(key) ? key.slice(1, -1) : key);

const fail = (no: number, message: string): never => {
  throw new SyncConfigError(`sync config line ${no}: ${message}`);
};

class YamlReader {
  private pos = 0;
  constructor(
    private readonly lines: Line[],
    private readonly raw: string[],
  ) {}

  parse(): YamlValue {
    const first = this.lines[0];
    if (!first) return null;
    const value = this.block(first.indent);
    const extra = this.lines[this.pos];
    if (extra) fail(extra.no, "unexpected indentation");
    return value;
  }

  private block(indent: number): YamlValue {
    const line = this.lines[this.pos];
    if (!line) return null;
    return line.text.startsWith("- ") || line.text === "-" ? this.sequence(indent) : this.mapping(indent);
  }

  private mapping(indent: number): YamlValue {
    const out: Record<string, YamlValue> = {};
    for (let line = this.lines[this.pos]; line && line.indent === indent; line = this.lines[this.pos]) {
      const m = KEY_LINE.exec(line.text);
      if (!m) return fail(line.no, `expected "key: value", got "${line.text}"`);
      const key = unquoteKey(m[1] ?? "");
      if (key in out) fail(line.no, `duplicate key "${key}"`);
      this.pos++;
      out[key] = this.value(line, m[2] ?? "");
    }
    return out;
  }

  private sequence(indent: number): YamlValue {
    const out: YamlValue[] = [];
    for (let line = this.lines[this.pos]; line && line.indent === indent; line = this.lines[this.pos]) {
      if (!(line.text.startsWith("- ") || line.text === "-")) fail(line.no, "expected a list item");
      const rest = line.text.slice(1).trimStart();
      if (KEY_LINE.test(rest)) {
        // `- key: value`: a mapping that starts on the dash's line.
        this.lines[this.pos] = { indent: indent + 2, text: rest, no: line.no };
        out.push(this.mapping(indent + 2));
      } else {
        this.pos++;
        out.push(this.value(line, rest));
      }
    }
    return out;
  }

  /** The value after `key:` or `-` on `line`, plus anything indented below it. */
  private value(line: Line, rest: string): YamlValue {
    if (BLOCK_SCALAR.test(rest)) return this.blockScalar(line);
    if (rest === "") {
      const next = this.lines[this.pos];
      return next && next.indent > line.indent ? this.block(next.indent) : null;
    }
    if (/^[[{&*!@`%]/.test(rest)) return fail(line.no, `unsupported YAML syntax "${rest}"`);
    if (/^["']/.test(rest)) {
      const q = rest[0];
      if (rest.length < 2 || !rest.endsWith(q ?? "")) return fail(line.no, "unterminated quoted scalar");
      return rest.slice(1, -1);
    }
    // A plain scalar, folded over any more-indented lines below it.
    const parts = [rest];
    for (let next = this.lines[this.pos]; next && next.indent > line.indent; next = this.lines[this.pos]) {
      parts.push(next.text);
      this.pos++;
    }
    return parts.join(" ");
  }

  /** A `>`/`|` scalar: the raw lines indented below `line` (comments are content here). */
  private blockScalar(line: Line): string {
    const parts: string[] = [];
    let rawNo = line.no; // 1-based: raw[rawNo] is the next raw line
    for (; rawNo < this.raw.length; rawNo++) {
      const text = this.raw[rawNo] ?? "";
      if (text.trim() === "") continue;
      const indent = text.length - text.trimStart().length;
      if (indent <= line.indent) break;
      parts.push(text.trim());
    }
    // Skip the parsed lines that belong to this scalar.
    while ((this.lines[this.pos]?.no ?? Infinity) <= rawNo) this.pos++;
    return parts.join("\n");
  }
}

/** Parse the YAML subset sync configs use. Throws a SyncConfigError on anything else. */
export const parseYaml = (text: string): YamlValue => {
  const raw = text.split(/\r?\n/);
  const lines: Line[] = [];
  raw.forEach((full, i) => {
    if (full.includes("\t") && /^\s*\t/.test(full)) fail(i + 1, "tabs can't indent YAML");
    if (/^\s*(#|$)/.test(full)) return;
    if (/^(---|\.\.\.)\s*$/.test(full)) fail(i + 1, "multiple YAML documents aren't supported");
    const indent = full.length - full.trimStart().length;
    lines.push({ indent, text: stripComment(full.trim()), no: i + 1 });
  });
  return new YamlReader(lines, raw).parse();
};

// ---------------------------------------------------------------------------
// SQL (the subset Sync Streams allow)

type Token = { kind: "ident" | "quoted" | "string" | "number" | "punct" | "op"; value: string };

const tokenize = (sql: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i] ?? "";
    if (/\s/.test(c)) {
      i++;
    } else if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (c === '"') {
      const end = sql.indexOf('"', i + 1);
      if (end < 0) throw new SyncConfigError(`unterminated quoted identifier in: ${sql}`);
      tokens.push({ kind: "quoted", value: sql.slice(i + 1, end) });
      i = end + 1;
    } else if (c === "'") {
      let j = i + 1;
      for (; j < sql.length; j++) {
        if (sql[j] === "'" && sql[j + 1] === "'") j++;
        else if (sql[j] === "'") break;
      }
      if (j >= sql.length) throw new SyncConfigError(`unterminated string in: ${sql}`);
      tokens.push({ kind: "string", value: sql.slice(i + 1, j) });
      i = j + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_$]/.test(sql[j] ?? "")) j++;
      tokens.push({ kind: "ident", value: sql.slice(i, j) });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[0-9.eE]/.test(sql[j] ?? "")) j++;
      tokens.push({ kind: "number", value: sql.slice(i, j) });
      i = j;
    } else if ("(),.*".includes(c)) {
      tokens.push({ kind: "punct", value: c });
      i++;
    } else if (/[<>=!|&+\-/%~^:@#?]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /[<>=!|&+\-/%~^:@#?]/.test(sql[j] ?? "")) j++;
      tokens.push({ kind: "op", value: sql.slice(i, j) });
      i = j;
    } else {
      throw new SyncConfigError(`unexpected "${c}" in: ${sql}`);
    }
  }
  return tokens;
};

const isWord = (t: Token | undefined, word: string) => t?.kind === "ident" && t.value.toUpperCase() === word;
const isPunct = (t: Token | undefined, p: string) => t?.kind === "punct" && t.value === p;
const isName = (t: Token | undefined): t is Token => t?.kind === "ident" || t?.kind === "quoted";
/** Bare identifiers fold to lower case; quoted ones keep their case. */
const nameOf = (t: Token) => (t.kind === "quoted" ? t.value : t.value.toLowerCase());

const EXPRESSION_WORDS = new Set([
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",
  "LIKE",
  "ILIKE",
  "BETWEEN",
  "CAST",
  "AS",
]);
const CLAUSE_WORDS = new Set(["FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "ON"]);

type ColumnRef = { qualifier: string | null; column: string };

/** One stream query's column references, resolved to `table → columns`. */
const queryColumns = (sql: string, cteNames: ReadonlySet<string>, tables: SchemaTables) => {
  const tokens = tokenize(sql);
  let pos = 0;
  const peek = (ahead = 0) => tokens[pos + ahead];
  const bad = (message: string): never => {
    throw new SyncConfigError(`${message} in: ${sql}`);
  };

  if (!isWord(peek(), "SELECT")) bad("expected SELECT");
  pos++;
  if (isWord(peek(), "DISTINCT")) bad("DISTINCT isn't supported");

  // The select list: plain or qualified column names, each optionally aliased.
  const selected: ColumnRef[] = [];
  for (;;) {
    const t = peek();
    if (isPunct(t, "*") || (isName(t) && isPunct(peek(1), ".") && isPunct(peek(2), "*")))
      bad("a sync stream must list its columns, not *");
    if (
      !isName(t) ||
      (t.kind === "ident" && (EXPRESSION_WORDS.has(t.value.toUpperCase()) || isWord(t, "FROM")))
    )
      return bad(`can't resolve select item "${t?.value ?? "end of query"}" to a column`);
    pos++;
    let ref: ColumnRef = { qualifier: null, column: nameOf(t) };
    if (isPunct(peek(), ".")) {
      const col = peek(1);
      if (!isName(col)) return bad("expected a column after .");
      ref = { qualifier: nameOf(t), column: nameOf(col) };
      pos += 2;
    }
    if (isPunct(peek(), "(")) bad(`can't resolve "${ref.column}(…)" to a column`);
    selected.push(ref);
    if (isWord(peek(), "AS")) {
      pos++;
      if (!isName(peek())) bad("expected an alias after AS");
      pos++;
    } else if (isName(peek()) && !isWord(peek(), "FROM")) {
      pos++; // a bare alias
    }
    if (isPunct(peek(), ",")) {
      pos++;
      continue;
    }
    if (isWord(peek(), "FROM")) break;
    bad(`can't resolve select item near "${peek()?.value ?? "end of query"}" to a column`);
  }
  pos++; // FROM

  // FROM table [alias] { [INNER|LEFT] JOIN table [alias] ON … }
  const aliases = new Map<string, string>();
  const readTable = () => {
    const t = peek();
    if (!isName(t)) return bad("expected a table name");
    pos++;
    let table = nameOf(t);
    if (isPunct(peek(), ".")) {
      // schema.table: only public is synced.
      if (table !== "public") bad(`only tables in the public schema can sync (got ${table})`);
      const name = peek(1);
      if (!isName(name)) return bad("expected a table name after the schema");
      table = nameOf(name);
      pos += 2;
    }
    if (!(table in tables)) bad(`unknown table "${table}"`);
    aliases.set(table, table);
    if (isWord(peek(), "AS")) pos++;
    const alias = peek();
    if (isName(alias) && !(alias.kind === "ident" && CLAUSE_WORDS.has(alias.value.toUpperCase()))) {
      aliases.set(nameOf(alias), table);
      pos++;
    }
    return table;
  };
  const fromTables = [readTable()];

  // Everything after the first table: JOINs, ON and WHERE expressions.
  const expressionRefs: ColumnRef[] = [];
  while (pos < tokens.length) {
    const t = peek();
    if (isWord(t, "JOIN")) {
      pos++;
      fromTables.push(readTable());
      continue;
    }
    if (isWord(t, "SELECT")) bad("subqueries aren't supported");
    if (
      t &&
      t.kind === "ident" &&
      ["GROUP", "ORDER", "LIMIT", "HAVING", "UNION", "OFFSET"].includes(t.value.toUpperCase())
    )
      bad(`${t.value.toUpperCase()} isn't supported`);
    if (!isName(t)) {
      pos++;
      continue;
    }
    // A type name (`x::text`, `CAST(x AS text)`) isn't a column.
    const prev = tokens[pos - 1];
    if ((prev?.kind === "op" && prev.value === "::") || isWord(prev, "AS")) {
      pos++;
      continue;
    }
    // A dotted chain: a.b(…) is a function (auth.user_id()), a.b a qualified column.
    const chain = [t];
    let end = pos + 1;
    while (isPunct(tokens[end], ".") && isName(tokens[end + 1])) {
      chain.push(tokens[end + 1] as Token);
      end += 2;
    }
    const isCall = isPunct(tokens[end], "(");
    pos = end;
    if (isCall) continue;
    if (chain.length === 1) {
      const word = t.kind === "ident" ? t.value.toUpperCase() : "";
      if (EXPRESSION_WORDS.has(word) || CLAUSE_WORDS.has(word)) continue;
      if (cteNames.has(nameOf(t))) continue;
      expressionRefs.push({ qualifier: null, column: nameOf(t) });
    } else if (chain.length === 2) {
      expressionRefs.push({ qualifier: nameOf(chain[0] as Token), column: nameOf(chain[1] as Token) });
    } else {
      bad(`can't resolve "${chain.map((c) => c.value).join(".")}"`);
    }
  }

  const resolved = new Map<string, Set<string>>();
  for (const ref of [...selected, ...expressionRefs]) {
    let table: string | undefined;
    if (ref.qualifier) {
      table = aliases.get(ref.qualifier);
      if (!table) bad(`unknown table or alias "${ref.qualifier}"`);
    } else if (fromTables.length === 1) {
      table = fromTables[0];
    } else {
      bad(`qualify "${ref.column}" with its table (the query joins several)`);
    }
    const name = table as string;
    if (!tables[name]?.includes(ref.column)) bad(`unknown column "${name}.${ref.column}"`);
    let set = resolved.get(name);
    if (!set) resolved.set(name, (set = new Set()));
    set.add(ref.column);
  }
  return resolved;
};

// ---------------------------------------------------------------------------
// The config

const isMap = (v: YamlValue | undefined): v is { [key: string]: YamlValue } =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Every column the sync config reads, per table: each stream's query select
 * lists, plus the columns its `with` (parameter) queries, joins and filters
 * use, since PowerSync evaluates those on its replicated copy too. The union
 * across streams; tables in no stream aren't listed. Throws a SyncConfigError
 * on `*`, an unknown table or column, or anything it can't read.
 */
export const syncedColumns = (configText: string, tables: SchemaTables): TableColumns[] => {
  const root = parseYaml(configText);
  if (!isMap(root)) throw new SyncConfigError("the sync config isn't a mapping");
  if ("bucket_definitions" in root)
    throw new SyncConfigError("Sync Rules (bucket_definitions) aren't supported: use Sync Streams");
  const streams = root.streams;
  if (!isMap(streams)) throw new SyncConfigError("the sync config has no streams");

  const all = new Map<string, Set<string>>();
  for (const [streamName, stream] of Object.entries(streams)) {
    if (!isMap(stream)) throw new SyncConfigError(`stream ${streamName} isn't a mapping`);
    const ctes = isMap(stream.with) ? stream.with : {};
    if (stream.with !== undefined && !isMap(stream.with))
      throw new SyncConfigError(`stream ${streamName}: "with" isn't a mapping`);
    const cteNames = new Set(Object.keys(ctes).map((k) => k.toLowerCase()));

    const queries: string[] = [];
    for (const [name, q] of Object.entries(ctes)) {
      if (typeof q !== "string")
        throw new SyncConfigError(`stream ${streamName}: with.${name} isn't a query`);
      queries.push(q);
    }
    if (typeof stream.query === "string") queries.push(stream.query);
    else if (stream.query !== undefined)
      throw new SyncConfigError(`stream ${streamName}: query isn't a string`);
    if (Array.isArray(stream.queries)) {
      for (const q of stream.queries) {
        if (typeof q !== "string") throw new SyncConfigError(`stream ${streamName}: a query isn't a string`);
        queries.push(q);
      }
    } else if (stream.queries !== undefined) {
      throw new SyncConfigError(`stream ${streamName}: queries isn't a list`);
    }
    if (stream.query === undefined && stream.queries === undefined)
      throw new SyncConfigError(`stream ${streamName} has no query`);

    for (const q of queries) {
      let found: Map<string, Set<string>>;
      try {
        found = queryColumns(q, cteNames, tables);
      } catch (e) {
        if (e instanceof SyncConfigError) throw new SyncConfigError(`stream ${streamName}: ${e.message}`);
        throw e;
      }
      for (const [table, cols] of found) {
        let set = all.get(table);
        if (!set) all.set(table, (set = new Set()));
        for (const c of cols) set.add(c);
      }
    }
  }

  return [...all.keys()].sort().map((table) => ({
    table,
    columns: (tables[table] ?? []).filter((c) => all.get(table)?.has(c)),
  }));
};
