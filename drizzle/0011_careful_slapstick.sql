ALTER TABLE `messages` ADD `reaction` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `starred` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `feedback` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `reply_to_id` integer REFERENCES messages(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `forwarded_from_id` integer REFERENCES messages(id) ON DELETE SET NULL;
