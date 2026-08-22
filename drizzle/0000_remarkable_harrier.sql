CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`company_inn` text DEFAULT '' NOT NULL,
	`file_name` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`score` integer NOT NULL,
	`grade` text NOT NULL,
	`readiness` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`company_name` text NOT NULL,
	`product` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Новая' NOT NULL,
	`owner` text DEFAULT 'Не назначен' NOT NULL,
	`next_action` text DEFAULT 'Связаться с клиентом' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
