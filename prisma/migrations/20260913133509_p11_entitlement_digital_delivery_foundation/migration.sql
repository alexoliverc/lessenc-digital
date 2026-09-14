-- AlterTable
ALTER TABLE `entitlements` ADD COLUMN `source_outbox_event_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `buyer_access_credentials` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `secret_hash` CHAR(64) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `active_order_key` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `buyer_access_credentials_secret_hash_key`(`secret_hash`),
    UNIQUE INDEX `buyer_access_credentials_active_order_key_key`(`active_order_key`),
    INDEX `buyer_access_credentials_order_id_created_at_idx`(`order_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_resources` (
    `id` CHAR(36) NOT NULL,
    `logical_key` VARCHAR(160) NOT NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `storage_key` VARCHAR(512) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `media_type` VARCHAR(127) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `digital_resources_storage_key_key`(`storage_key`),
    UNIQUE INDEX `digital_resources_logical_key_version_key`(`logical_key`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_digital_resources` (
    `product_id` CHAR(36) NOT NULL,
    `resource_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_digital_resources_resource_id_idx`(`resource_id`),
    PRIMARY KEY (`product_id`, `resource_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entitlement_digital_resources` (
    `entitlement_id` CHAR(36) NOT NULL,
    `resource_id` CHAR(36) NOT NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `entitlement_digital_resources_resource_id_idx`(`resource_id`),
    PRIMARY KEY (`entitlement_id`, `resource_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_delivery_events` (
    `id` CHAR(36) NOT NULL,
    `entitlement_id` CHAR(36) NOT NULL,
    `resource_id` CHAR(36) NOT NULL,
    `buyer_access_credential_id` CHAR(36) NOT NULL,
    `outcome` ENUM('SUCCEEDED', 'FAILED') NOT NULL,
    `failure_code` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `digital_delivery_events_entitlement_id_resource_id_idx`(`entitlement_id`, `resource_id`),
    INDEX `digital_delivery_events_entitlement_id_created_at_idx`(`entitlement_id`, `created_at`),
    INDEX `digital_delivery_events_resource_id_created_at_idx`(`resource_id`, `created_at`),
    INDEX `digital_delivery_events_buyer_access_credential_id_created_a_idx`(`buyer_access_credential_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `entitlements_source_outbox_event_id_idx` ON `entitlements`(`source_outbox_event_id`);

-- AddForeignKey
ALTER TABLE `entitlements` ADD CONSTRAINT `entitlements_source_outbox_event_id_fkey` FOREIGN KEY (`source_outbox_event_id`) REFERENCES `outbox_events`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `buyer_access_credentials` ADD CONSTRAINT `buyer_access_credentials_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `product_digital_resources` ADD CONSTRAINT `product_digital_resources_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `product_digital_resources` ADD CONSTRAINT `product_digital_resources_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `digital_resources`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `entitlement_digital_resources` ADD CONSTRAINT `entitlement_digital_resources_entitlement_id_fkey` FOREIGN KEY (`entitlement_id`) REFERENCES `entitlements`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `entitlement_digital_resources` ADD CONSTRAINT `entitlement_digital_resources_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `digital_resources`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `digital_delivery_events` ADD CONSTRAINT `digital_delivery_events_entitlement_id_resource_id_fkey` FOREIGN KEY (`entitlement_id`, `resource_id`) REFERENCES `entitlement_digital_resources`(`entitlement_id`, `resource_id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `digital_delivery_events` ADD CONSTRAINT `digital_delivery_events_buyer_access_credential_id_fkey` FOREIGN KEY (`buyer_access_credential_id`) REFERENCES `buyer_access_credentials`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
