-- AlterTable
ALTER TABLE `payments` ADD COLUMN `active_attempt_key` CHAR(36) NULL,
    ADD COLUMN `attempt_number` INTEGER UNSIGNED NULL,
    ADD COLUMN `last_provider_sync_at` DATETIME(3) NULL,
    ADD COLUMN `operation_fingerprint` CHAR(64) NULL,
    ADD COLUMN `payment_method` VARCHAR(16) NULL,
    ADD COLUMN `provider` VARCHAR(32) NULL,
    ADD COLUMN `provider_order_id` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    ADD COLUMN `provider_payment_id` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    ADD COLUMN `provider_status` VARCHAR(64) NULL,
    ADD COLUMN `provider_status_detail` VARCHAR(128) NULL,
    ADD COLUMN `requires_review` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `review_reason` VARCHAR(96) NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `payment_events` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `source` VARCHAR(24) NOT NULL,
    `provider_order_id` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    `provider_payment_id` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    `provider_event_id` VARCHAR(64) NULL,
    `provider_status` VARCHAR(64) NOT NULL,
    `provider_status_detail` VARCHAR(128) NULL,
    `amount_minor` INTEGER UNSIGNED NULL,
    `currency` CHAR(3) NULL,
    `deduplication_key` VARCHAR(160) NOT NULL,
    `snapshot_hash` CHAR(64) NOT NULL,
    `application_result` VARCHAR(16) NOT NULL,
    `observed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `provider_occurred_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_events_deduplication_key_key`(`deduplication_key`),
    INDEX `payment_events_payment_id_observed_at_idx`(`payment_id`, `observed_at`),
    INDEX `payment_events_provider_order_id_idx`(`provider_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `payments_provider_order_id_key` ON `payments`(`provider_order_id`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_provider_payment_id_key` ON `payments`(`provider_payment_id`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_active_attempt_key_key` ON `payments`(`active_attempt_key`);

-- CreateIndex
CREATE UNIQUE INDEX `payments_order_id_attempt_number_key` ON `payments`(`order_id`, `attempt_number`);

-- AddForeignKey
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
