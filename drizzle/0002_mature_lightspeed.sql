CREATE TABLE `proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` integer NOT NULL,
	`message_id` integer,
	`tool` text NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_proposals_status` ON `proposals` (`status`);--> statement-breakpoint
ALTER TABLE `agents` ADD `autonomy` text DEFAULT 'auto' NOT NULL;