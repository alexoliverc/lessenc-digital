-- CreateTable
CREATE TABLE `acquisition_journeys` (
    `id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `first_touch_id` CHAR(36) NULL,
    `last_touch_id` CHAR(36) NULL,
    `analytics_consent_state` ENUM('UNKNOWN', 'GRANTED', 'DENIED') NOT NULL DEFAULT 'UNKNOWN',
    `advertising_consent_state` ENUM('UNKNOWN', 'GRANTED', 'DENIED') NOT NULL DEFAULT 'UNKNOWN',
    `policy_version` VARCHAR(64) NOT NULL,

    INDEX `acquisition_journeys_last_seen_at_idx`(`last_seen_at`),
    INDEX `acquisition_journeys_expires_at_idx`(`expires_at`),
    INDEX `acquisition_journeys_first_touch_id_idx`(`first_touch_id`),
    INDEX `acquisition_journeys_last_touch_id_idx`(`last_touch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribution_touches` (
    `id` CHAR(36) NOT NULL,
    `journey_id` CHAR(36) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(96) NULL,
    `medium` VARCHAR(96) NULL,
    `campaign` VARCHAR(191) NULL,
    `content` VARCHAR(191) NULL,
    `term` VARCHAR(191) NULL,
    `referrer_host` VARCHAR(253) NULL,
    `landing_path` VARCHAR(1024) NULL,
    `touch_type` ENUM('CAMPAIGN', 'REFERRAL', 'DIRECT') NOT NULL,

    INDEX `attribution_touches_journey_id_occurred_at_idx`(`journey_id`, `occurred_at`),
    INDEX `attribution_touches_touch_type_occurred_at_idx`(`touch_type`, `occurred_at`),
    INDEX `attribution_touches_source_medium_campaign_idx`(`source`, `medium`, `campaign`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_attributions` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `journey_id` CHAR(36) NULL,
    `first_touch_id` CHAR(36) NULL,
    `last_touch_id` CHAR(36) NULL,
    `first_source` VARCHAR(96) NULL,
    `first_medium` VARCHAR(96) NULL,
    `first_campaign` VARCHAR(191) NULL,
    `first_content` VARCHAR(191) NULL,
    `first_term` VARCHAR(191) NULL,
    `last_source` VARCHAR(96) NULL,
    `last_medium` VARCHAR(96) NULL,
    `last_campaign` VARCHAR(191) NULL,
    `last_content` VARCHAR(191) NULL,
    `last_term` VARCHAR(191) NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_attributions_order_id_key`(`order_id`),
    INDEX `order_attributions_journey_id_idx`(`journey_id`),
    INDEX `order_attributions_first_touch_id_idx`(`first_touch_id`),
    INDEX `order_attributions_last_touch_id_idx`(`last_touch_id`),
    INDEX `order_attributions_captured_at_idx`(`captured_at`),
    INDEX `order_attributions_first_source_first_medium_idx`(`first_source`, `first_medium`),
    INDEX `order_attributions_last_source_last_medium_idx`(`last_source`, `last_medium`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_events` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('VIEW_CONTENT', 'INITIATE_CHECKOUT', 'PURCHASE') NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `journey_id` CHAR(36) NULL,
    `product_id` CHAR(36) NULL,
    `offer_id` CHAR(36) NULL,
    `order_id` CHAR(36) NULL,
    `amount_minor` INTEGER UNSIGNED NULL,
    `currency` CHAR(3) NULL,
    `attribution_state` VARCHAR(32) NOT NULL,
    `consent_snapshot` JSON NOT NULL,
    `schema_version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `purchase_order_key` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `analytics_events_purchase_order_key_key`(`purchase_order_key`),
    INDEX `analytics_events_type_occurred_at_idx`(`type`, `occurred_at`),
    INDEX `analytics_events_journey_id_occurred_at_idx`(`journey_id`, `occurred_at`),
    INDEX `analytics_events_order_id_idx`(`order_id`),
    INDEX `analytics_events_product_id_idx`(`product_id`),
    INDEX `analytics_events_offer_id_idx`(`offer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_dispatches` (
    `id` CHAR(36) NOT NULL,
    `analytics_event_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `channel` VARCHAR(32) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'RETRYABLE', 'SUCCEEDED', 'FAILED', 'SUPPRESSED') NOT NULL DEFAULT 'PENDING',
    `attempt_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(3) NULL,
    `last_attempt_at` DATETIME(3) NULL,
    `provider_event_id` VARCHAR(128) NULL,
    `last_error_code` VARCHAR(64) NULL,
    `last_error_class` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `analytics_dispatches_status_next_attempt_at_idx`(`status`, `next_attempt_at`),
    INDEX `analytics_dispatches_provider_status_next_attempt_at_idx`(`provider`, `status`, `next_attempt_at`),
    UNIQUE INDEX `analytics_dispatches_analytics_event_id_provider_channel_key`(`analytics_event_id`, `provider`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attribution_touches` ADD CONSTRAINT `attribution_touches_journey_id_fkey` FOREIGN KEY (`journey_id`) REFERENCES `acquisition_journeys`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `order_attributions` ADD CONSTRAINT `order_attributions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `analytics_dispatches` ADD CONSTRAINT `analytics_dispatches_analytics_event_id_fkey` FOREIGN KEY (`analytics_event_id`) REFERENCES `analytics_events`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
