CREATE TABLE `sales_reps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sales_reps_name` ON `sales_reps` (`name`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sales_rep_id` integer REFERENCES sales_reps(id);--> statement-breakpoint
ALTER TABLE `deals` ADD `closed_by_sales_rep_id` integer REFERENCES sales_reps(id);--> statement-breakpoint
ALTER TABLE `deals` ADD `closed_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignee_sales_rep_id` integer REFERENCES sales_reps(id);