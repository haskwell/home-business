PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_businesses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rating` integer DEFAULT 0 NOT NULL,
	`logo` text,
	`banner` text,
	`instagram` text,
	`tiktok` text,
	`facebook` text,
	`business_link` text NOT NULL,
	`owner_contact` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_businesses`("id", "name", "description", "rating", "logo", "banner", "instagram", "tiktok", "facebook", "business_link", "owner_contact", "created_at") SELECT "id", "name", "description", "rating", "logo", "banner", "instagram", "tiktok", "facebook", "business_link", "owner_contact", "created_at" FROM `businesses`;--> statement-breakpoint
DROP TABLE `businesses`;--> statement-breakpoint
ALTER TABLE `__new_businesses` RENAME TO `businesses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_business_link_unique` ON `businesses` (`business_link`);