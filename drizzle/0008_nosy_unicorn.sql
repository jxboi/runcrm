PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT 'bot' NOT NULL,
	`kind` text DEFAULT 'general' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`capabilities` text DEFAULT '{}' NOT NULL,
	`autonomy` text DEFAULT 'auto' NOT NULL,
	`model` text DEFAULT 'claude-opus-5' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_agents`("id", "name", "emoji", "kind", "instructions", "capabilities", "autonomy", "model", "created_at") SELECT "id", "name", "emoji", "kind", "instructions", "capabilities", "autonomy", "model", "created_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
UPDATE `agents`
SET `emoji` = CASE
	WHEN `emoji` IN ('bot', 'briefcase', 'chart', 'brain', 'zap', 'search', 'megaphone', 'wrench', 'receipt', 'sprout', 'workflow', 'compass', 'trash', 'clock', 'user') THEN `emoji`
	WHEN lower(`name`) LIKE '%workflow%' OR lower(`name`) LIKE '%architect%' THEN 'workflow'
	WHEN lower(`name`) LIKE '%analyst%' OR lower(`name`) LIKE '%data%' THEN 'chart'
	WHEN lower(`name`) LIKE '%sales%' THEN 'briefcase'
	WHEN lower(`name`) LIKE '%research%' THEN 'search'
	WHEN lower(`name`) LIKE '%janitor%' OR lower(`name`) LIKE '%cleanup%' THEN 'trash'
	WHEN lower(`name`) LIKE '%renewal%' OR lower(`name`) LIKE '%watchdog%' THEN 'clock'
	WHEN lower(`name`) LIKE '%coordinator%' THEN 'compass'
	ELSE 'bot'
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
