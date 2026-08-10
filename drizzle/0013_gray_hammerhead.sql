ALTER TABLE `threads` ADD `last_read_message_id` integer;--> statement-breakpoint
ALTER TABLE `threads` ADD `memory` text;--> statement-breakpoint
ALTER TABLE `threads` ADD `continued_from_thread_id` integer REFERENCES threads(id) ON DELETE SET NULL;
