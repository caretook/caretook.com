-- The easy roles replace the easy-mode lock (simple-mode PRD, slice 3): a locked caretaker becomes an Easy
-- helper and a locked viewer an Easy viewer; locked owners and admins keep their role, unlocked. The two
-- member columns are no longer read, written or synced; a later contract migration drops them.
UPDATE "care_group_member" SET "role" = 'easy_helper' WHERE "simple_mode_locked" AND "role" = 'caretaker';--> statement-breakpoint
UPDATE "care_group_member" SET "role" = 'easy_viewer' WHERE "simple_mode_locked" AND "role" = 'viewer';--> statement-breakpoint
-- "Follow the group" is gone: a stored `group` reads as full, so drop it.
UPDATE "user" SET "preferences" = "preferences" - 'easyMode' WHERE "preferences" ->> 'easyMode' = 'group';
