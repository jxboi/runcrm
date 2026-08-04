CREATE TABLE `threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`account_name` text COLLATE NOCASE,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `threads_account_name_unique` ON `threads` (`account_name`);--> statement-breakpoint
INSERT OR IGNORE INTO `threads` (`id`, `title`, `account_name`) VALUES (1, 'Home', NULL);--> statement-breakpoint
ALTER TABLE `messages` ADD `thread_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_messages_thread_id` ON `messages` (`thread_id`,`id`);
