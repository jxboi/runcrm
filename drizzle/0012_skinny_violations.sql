ALTER TABLE `threads` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `threads` ADD `archived_at` text;
