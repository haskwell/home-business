PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
CREATE TABLE `__new_customer_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`payment_method` text,
	`address` text NOT NULL,
	`expected_delivery_time` integer,
	`tracking_link` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP TABLE `customer_orders`;--> statement-breakpoint
ALTER TABLE `__new_customer_orders` RENAME TO `customer_orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_orders_tracking_link_unique` ON `customer_orders` (`tracking_link`);--> statement-breakpoint
CREATE INDEX `customer_orders_business_id_idx` ON `customer_orders` (`business_id`);--> statement-breakpoint
ALTER TABLE `businesses` ADD `is_accepting_orders` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `categories_business_id_idx` ON `categories` (`business_id`);--> statement-breakpoint
CREATE INDEX `items_business_id_idx` ON `items` (`business_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);
