CREATE TABLE `agent_partners` (
	`agent_code` text PRIMARY KEY NOT NULL,
	`curator_code` text NOT NULL,
	`name` text NOT NULL,
	`agency` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Активен' NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
