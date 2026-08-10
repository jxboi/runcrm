UPDATE `agents`
SET `capabilities` = json_set(
  CASE WHEN json_valid(`capabilities`) THEN `capabilities` ELSE '{}' END,
  '$.workflows',
  CASE WHEN `kind` = 'workflow' THEN 'write' ELSE 'none' END
);
--> statement-breakpoint
ALTER TABLE `agents` DROP COLUMN `kind`;
