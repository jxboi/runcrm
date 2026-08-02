CREATE TABLE `mutations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer,
	`agent_id` integer,
	`tool` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`before` text,
	`after` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`undone_at` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_mutations_message_id` ON `mutations` (`message_id`);