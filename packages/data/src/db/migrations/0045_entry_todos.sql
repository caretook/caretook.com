CREATE TABLE "timeline_entry_todo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"todo_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	CONSTRAINT "timeline_entry_todo_entry_todo_unique" UNIQUE("entry_id","todo_id")
);
--> statement-breakpoint
ALTER TABLE "timeline_entry_todo" ADD CONSTRAINT "timeline_entry_todo_entry_fk" FOREIGN KEY ("group_id","entry_id") REFERENCES "public"."timeline_entry"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entry_todo" ADD CONSTRAINT "timeline_entry_todo_todo_fk" FOREIGN KEY ("group_id","todo_id") REFERENCES "public"."todo"("group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timeline_entry_todo_todo_idx" ON "timeline_entry_todo" USING btree ("todo_id");--> statement-breakpoint
-- Hand-written from here (not generated; keep when regenerating).
--
-- The backfill (planner-3): every todo's one event link (`todo.event_id`)
-- becomes a link row, with the id a device derives for the pair
-- (`entryTodoId`: the UUID v5 of "<entry id>:<todo id>", lowercase, in
-- ENTRY_TODO_NAMESPACE), so a link a device makes offline lands on the same
-- row. Postgres has no SHA-1 or v5 built in and no extension may be added,
-- so these two throwaway functions make it and are dropped again below.
-- The column stays until a contract migration drops it.
CREATE FUNCTION "planner3_sha1"(data bytea) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  mask constant bigint := 4294967295;
  h0 bigint := 1732584193;
  h1 bigint := 4023233417;
  h2 bigint := 2562383102;
  h3 bigint := 271733878;
  h4 bigint := 3285377520;
  a bigint; b bigint; c bigint; d bigint; e bigint; f bigint; k bigint; x bigint; temp bigint;
  w bigint[];
  padded bytea := data || '\x80'::bytea;
  base int;
BEGIN
  WHILE length(padded) % 64 <> 56 LOOP
    padded := padded || '\x00'::bytea;
  END LOOP;
  padded := padded || int8send(length(data)::bigint * 8);
  FOR chunk IN 0 .. length(padded) / 64 - 1 LOOP
    w := array_fill(0::bigint, ARRAY[80]);
    FOR i IN 0 .. 15 LOOP
      base := chunk * 64 + i * 4;
      w[i + 1] := (get_byte(padded, base)::bigint << 24) | (get_byte(padded, base + 1)::bigint << 16)
        | (get_byte(padded, base + 2)::bigint << 8) | get_byte(padded, base + 3)::bigint;
    END LOOP;
    FOR i IN 16 .. 79 LOOP
      x := w[i - 2] # w[i - 7] # w[i - 13] # w[i - 15];
      w[i + 1] := ((x << 1) | (x >> 31)) & mask;
    END LOOP;
    a := h0; b := h1; c := h2; d := h3; e := h4;
    FOR i IN 0 .. 79 LOOP
      IF i < 20 THEN
        f := (b & c) | ((~b & mask) & d); k := 1518500249;
      ELSIF i < 40 THEN
        f := b # c # d; k := 1859775393;
      ELSIF i < 60 THEN
        f := (b & c) | (b & d) | (c & d); k := 2400959708;
      ELSE
        f := b # c # d; k := 3395469782;
      END IF;
      temp := ((((a << 5) | (a >> 27)) & mask) + f + e + k + w[i + 1]) & mask;
      e := d;
      d := c;
      c := ((b << 30) | (b >> 2)) & mask;
      b := a;
      a := temp;
    END LOOP;
    h0 := (h0 + a) & mask;
    h1 := (h1 + b) & mask;
    h2 := (h2 + c) & mask;
    h3 := (h3 + d) & mask;
    h4 := (h4 + e) & mask;
  END LOOP;
  RETURN substring(int8send(h0) FROM 5) || substring(int8send(h1) FROM 5) || substring(int8send(h2) FROM 5)
    || substring(int8send(h3) FROM 5) || substring(int8send(h4) FROM 5);
END;
$$;--> statement-breakpoint
CREATE FUNCTION "planner3_uuid_v5"(name text, namespace uuid) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  hash bytea := substring(
    "planner3_sha1"(decode(replace(namespace::text, '-', ''), 'hex') || convert_to(name, 'UTF8')) FROM 1 FOR 16
  );
BEGIN
  hash := set_byte(hash, 6, (get_byte(hash, 6) & 15) | 80);
  hash := set_byte(hash, 8, (get_byte(hash, 8) & 63) | 128);
  RETURN encode(hash, 'hex')::uuid;
END;
$$;--> statement-breakpoint
-- One row per todo whose event exists (deleted todos and events included:
-- soft deletes keep link rows), its timestamps and audits the todo's.
INSERT INTO "timeline_entry_todo" ("id", "group_id", "entry_id", "todo_id", "created_at", "updated_at", "created_by", "updated_by")
SELECT
  "planner3_uuid_v5"(lower(t."event_id"::text) || ':' || lower(t."id"::text), '2fa00756-8b6f-4ca0-b198-c34baab5a7ce'),
  t."group_id", t."event_id", t."id", t."created_at", t."updated_at", t."created_by", t."updated_by"
FROM "todo" t
JOIN "timeline_entry" e ON e."group_id" = t."group_id" AND e."id" = t."event_id"
WHERE t."event_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP FUNCTION "planner3_uuid_v5"(text, uuid);--> statement-breakpoint
DROP FUNCTION "planner3_sha1"(bytea);--> statement-breakpoint
-- The links sync to every member of their group (powersync/sync-config.yaml;
-- `pnpm db:roles` sets the column lists).
ALTER PUBLICATION "powersync" ADD TABLE "timeline_entry_todo";
