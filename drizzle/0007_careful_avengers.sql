CREATE INDEX `idx_contacts_sales_rep_id` ON `contacts` (`sales_rep_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_closed_by_sales_rep_id` ON `deals` (`closed_by_sales_rep_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assignee_sales_rep_id` ON `tasks` (`assignee_sales_rep_id`);