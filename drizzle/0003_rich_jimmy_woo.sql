CREATE TABLE `routine_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer,
	`run_key` text NOT NULL,
	`trigger` text NOT NULL,
	`scheduled_for` text,
	`status` text DEFAULT 'running' NOT NULL,
	`result` text,
	`error` text,
	`trigger_message_id` integer,
	`retried_from_run_id` integer,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trigger_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_routine_runs_key` ON `routine_runs` (`run_key`);--> statement-breakpoint
CREATE INDEX `idx_routine_runs_routine` ON `routine_runs` (`routine_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`instructions` text NOT NULL,
	`agent_id` integer,
	`schedule` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`archived_at` text,
	`next_run_at` text,
	`lock_token` text,
	`locked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_routines_due` ON `routines` (`enabled`,`archived_at`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `workspace_settings` (`id`, `timezone`) VALUES (1, 'UTC');
