-- Hand-written (data-rights, slice 1): a soft delete scrubs. Each
-- soft-delete table gets a BEFORE trigger that, when `deleted_at` is set,
-- clears the columns `SCRUB_SPECS` (`domain/sync/scrub.ts`) names, empties
-- the row's live document and strips the change entries that summarize it.
-- `scrub_entry_details` is `scrubEntryDetails`' twin. Tests tie these to the
-- spec (`scrub.int.test.ts`, drift). The triggers also fire on a write that
-- sets `deleted_at` again, so `scrub_deleted_rows()` (run at the end, kept)
-- scrubs every row already deleted.

-- The keys of an object that are listed, as they are (nulls too).
CREATE FUNCTION scrub_jsonb_pick(value jsonb, keys text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(value) AS e(key, value)
  WHERE e.key = ANY (keys)
$$;
--> statement-breakpoint
-- A timeline entry's details once scrubbed, by kind. `medication_live`: the
-- schedule history carve-out (a live medication's deleted doses keep their
-- slot, its deleted change lines their schedule and usual dose).
CREATE FUNCTION scrub_entry_details(kind text, details jsonb, medication_live boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN details IS NULL OR jsonb_typeof(details) <> 'object' THEN NULL
    WHEN kind = 'dose' AND medication_live
      THEN scrub_jsonb_pick(details, ARRAY['medicationId', 'status', 'scheduledFor', 'passId', 'passLogId'])
    WHEN kind = 'dose' THEN scrub_jsonb_pick(details, ARRAY['medicationId', 'status'])
    WHEN kind = 'medicationChange' AND details->>'change' = 'passMoved'
      THEN scrub_jsonb_pick(details, ARRAY['change', 'passId', 'beforeTime', 'afterTime', 'medicationIds'])
        || '{"passName": ""}'::jsonb
    WHEN kind = 'medicationChange' AND NOT medication_live
      THEN scrub_jsonb_pick(details, ARRAY['medicationId', 'change'])
    WHEN kind = 'medicationChange'
      THEN scrub_jsonb_pick(details, ARRAY['medicationId', 'change'])
        || CASE WHEN jsonb_typeof(details->'before') = 'object'
             THEN jsonb_build_object('before', scrub_jsonb_pick(details->'before', ARRAY['schedule', 'dose']))
             ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(details->'after') = 'object'
             THEN jsonb_build_object('after', scrub_jsonb_pick(details->'after', ARRAY['schedule', 'dose']))
             ELSE '{}'::jsonb END
    WHEN kind = 'conditionChange'
      THEN scrub_jsonb_pick(details, ARRAY['conditionId', 'change']) || '{"conditionName": ""}'::jsonb
    ELSE NULL
  END
$$;
--> statement-breakpoint
-- Whether the medication an entry's details name is live.
CREATE FUNCTION scrub_medication_live(details jsonb) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM medication
    WHERE id::text = lower(details->>'medicationId') AND deleted_at IS NULL
  )
$$;
--> statement-breakpoint
-- A row's live document emptied, its pending updates gone (its id is the row's).
CREATE FUNCTION scrub_document(owner_id uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE note_document SET snapshot = NULL, text = '', editors = '{}'::jsonb WHERE id = owner_id;
  DELETE FROM note_update WHERE document_id = owner_id;
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_timeline_entry() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.title := NULL;
  NEW.body := NULL;
  NEW.place := NULL;
  NEW.cancel_reason := NULL;
  NEW.details := scrub_entry_details(NEW.kind, NEW.details, scrub_medication_live(NEW.details));
  NEW.symptom_type_id := NULL;
  PERFORM scrub_document(NEW.id);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_provider() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.name := '';
  NEW.specialty := NULL;
  NEW.practice_id := NULL;
  NEW.email := NULL;
  NEW.address := NULL;
  NEW.website := NULL;
  NEW.phones := '[]'::jsonb;
  PERFORM scrub_document(NEW.id);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_medication() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.name := '';
  NEW.strength := NULL;
  NEW.form := NULL;
  NEW.dose := NULL;
  NEW.directions := NULL;
  NEW.reason := NULL;
  NEW.schedule := '{"type": "asNeeded"}'::jsonb;
  NEW.stop_reason := NULL;
  NEW.stop_note := NULL;
  NEW.prescriber_id := NULL;
  NEW.pharmacy_id := NULL;
  NEW.quantity := NULL;
  NEW.refills_left := NULL;
  NEW.rx_number := NULL;
  NEW.type := NULL;
  -- Its change entries lose their summaries, and its deleted doses their slots.
  UPDATE timeline_entry SET details = scrub_entry_details(kind, details, false)
  WHERE group_id = NEW.group_id
    AND details->>'medicationId' = NEW.id::text
    AND (kind = 'medicationChange' OR (kind = 'dose' AND deleted_at IS NOT NULL));
  PERFORM scrub_document(NEW.id);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_medication_pass() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.name := '';
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_recipient_allergy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.substance := '';
  NEW.reaction := NULL;
  NEW.severity := 'unknown';
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_recipient_condition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.name := '';
  NEW.note := NULL;
  NEW.diagnosed_by_id := NULL;
  NEW.since_year := NULL;
  NEW.since_month := NULL;
  -- Its change entries lose their summaries.
  UPDATE timeline_entry SET details = scrub_entry_details(kind, details, false)
  WHERE group_id = NEW.group_id
    AND kind = 'conditionChange'
    AND details->>'conditionId' = NEW.id::text;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_care_period() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.label := NULL;
  NEW.place_provider_id := NULL;
  NEW.place_detail := NULL;
  PERFORM scrub_document(NEW.id);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_todo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.title := '';
  NEW.assignee_id := NULL;
  NEW.assignee_name := NULL;
  NEW.provider_id := NULL;
  NEW.medication_id := NULL;
  NEW.event_id := NULL;
  PERFORM scrub_document(NEW.id);
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE FUNCTION scrub_appointment_series() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  NEW.title := NULL;
  NEW.place := NULL;
  NEW.provider_ids := '[]'::jsonb;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER timeline_entry_scrub BEFORE INSERT OR UPDATE OF deleted_at ON timeline_entry
  FOR EACH ROW EXECUTE FUNCTION scrub_timeline_entry();
--> statement-breakpoint
CREATE TRIGGER provider_scrub BEFORE INSERT OR UPDATE OF deleted_at ON provider
  FOR EACH ROW EXECUTE FUNCTION scrub_provider();
--> statement-breakpoint
CREATE TRIGGER medication_scrub BEFORE INSERT OR UPDATE OF deleted_at ON medication
  FOR EACH ROW EXECUTE FUNCTION scrub_medication();
--> statement-breakpoint
CREATE TRIGGER medication_pass_scrub BEFORE INSERT OR UPDATE OF deleted_at ON medication_pass
  FOR EACH ROW EXECUTE FUNCTION scrub_medication_pass();
--> statement-breakpoint
CREATE TRIGGER recipient_allergy_scrub BEFORE INSERT OR UPDATE OF deleted_at ON recipient_allergy
  FOR EACH ROW EXECUTE FUNCTION scrub_recipient_allergy();
--> statement-breakpoint
CREATE TRIGGER recipient_condition_scrub BEFORE INSERT OR UPDATE OF deleted_at ON recipient_condition
  FOR EACH ROW EXECUTE FUNCTION scrub_recipient_condition();
--> statement-breakpoint
CREATE TRIGGER care_period_scrub BEFORE INSERT OR UPDATE OF deleted_at ON care_period
  FOR EACH ROW EXECUTE FUNCTION scrub_care_period();
--> statement-breakpoint
CREATE TRIGGER todo_scrub BEFORE INSERT OR UPDATE OF deleted_at ON todo
  FOR EACH ROW EXECUTE FUNCTION scrub_todo();
--> statement-breakpoint
CREATE TRIGGER appointment_series_scrub BEFORE INSERT OR UPDATE OF deleted_at ON appointment_series
  FOR EACH ROW EXECUTE FUNCTION scrub_appointment_series();
--> statement-breakpoint
-- Every row deleted before this migration: setting `deleted_at` again fires
-- its trigger. Medications and conditions first (their entries' summaries),
-- then the rest. Kept, so a test can run it again.
CREATE FUNCTION scrub_deleted_rows() RETURNS void
LANGUAGE sql AS $$
  UPDATE medication SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE recipient_condition SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE timeline_entry SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE provider SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE medication_pass SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE recipient_allergy SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE care_period SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE todo SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
  UPDATE appointment_series SET deleted_at = deleted_at WHERE deleted_at IS NOT NULL;
$$;
--> statement-breakpoint
SELECT scrub_deleted_rows();
