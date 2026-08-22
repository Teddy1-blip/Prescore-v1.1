CREATE TABLE `agent_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_code` text NOT NULL,
	`lead_id` text NOT NULL,
	`analysis_id` text DEFAULT '' NOT NULL,
	`company_name` text NOT NULL,
	`bank` text NOT NULL,
	`product` text NOT NULL,
	`requested_amount` integer DEFAULT 0 NOT NULL,
	`calculated_limit` integer DEFAULT 0 NOT NULL,
	`reward_rate_bps` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Подготовка' NOT NULL,
	`next_action` text DEFAULT 'Проверить комплект документов' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_code` text NOT NULL,
	`company_name` text NOT NULL,
	`company_inn` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'Реферальная ссылка' NOT NULL,
	`status` text DEFAULT 'Новый клиент' NOT NULL,
	`subscription_status` text DEFAULT 'Ожидает оплаты' NOT NULL,
	`consent_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
