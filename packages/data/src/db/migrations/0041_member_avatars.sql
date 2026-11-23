ALTER TABLE "user" ADD COLUMN "avatar_color" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_icon" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_color_check" CHECK ("user"."avatar_color" IN ('coral', 'ochre', 'moss', 'fern', 'jade', 'sky', 'blue', 'violet', 'orchid', 'rose'));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_icon_check" CHECK ("user"."avatar_icon" IN ('flower', 'leaf', 'tree', 'sun', 'moon', 'star', 'cloud', 'mountain', 'bird', 'cat', 'dog', 'fish', 'coffee', 'music', 'anchor', 'feather'));--> statement-breakpoint
-- Co-members see the two avatar ids: `user` leaves and rejoins the publication
-- with its new column list. Never SET TABLE here: it would remove every other table.
ALTER PUBLICATION "powersync" DROP TABLE "user";--> statement-breakpoint
ALTER PUBLICATION "powersync" ADD TABLE "user" ("id", "name", "image", "avatar_color", "avatar_icon");
