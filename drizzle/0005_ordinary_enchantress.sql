CREATE TABLE `workflow_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` integer NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`trigger` text DEFAULT 'test' NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`trace` text DEFAULT '[]' NOT NULL,
	`output` text,
	`error` text,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_workflow` ON `workflow_runs` (`workflow_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `workflow_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` integer NOT NULL,
	`version` integer NOT NULL,
	`definition` text NOT NULL,
	`change_summary` text DEFAULT 'Initial workflow' NOT NULL,
	`agent_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workflow_versions_number` ON `workflow_versions` (`workflow_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_workflow_versions_workflow` ON `workflow_versions` (`workflow_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`created_by_agent_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_workflows_status` ON `workflows` (`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `agents` ADD `kind` text DEFAULT 'general' NOT NULL;