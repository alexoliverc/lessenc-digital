-- AlterTable
ALTER TABLE `admin_sessions` ADD COLUMN `last_activity_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `admin_users` ADD COLUMN `role` ENUM('OWNER', 'ADMIN', 'SUPPORT') NOT NULL DEFAULT 'SUPPORT';

-- CreateTable
CREATE TABLE `admin_audit_events` (
    `id` CHAR(36) NOT NULL,
    `actor_admin_user_id` VARCHAR(64) NULL,
    `actor_role` ENUM('OWNER', 'ADMIN', 'SUPPORT') NULL,
    `action` VARCHAR(96) NOT NULL,
    `target_type` VARCHAR(64) NULL,
    `target_id` VARCHAR(128) NULL,
    `outcome` ENUM('SUCCEEDED', 'DENIED', 'FAILED') NOT NULL,
    `metadata` JSON NULL,
    `correlation_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_events_actor_admin_user_id_created_at_idx`(`actor_admin_user_id`, `created_at`),
    INDEX `admin_audit_events_action_created_at_idx`(`action`, `created_at`),
    INDEX `admin_audit_events_correlation_id_idx`(`correlation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_audit_events` ADD CONSTRAINT `admin_audit_events_actor_admin_user_id_fkey` FOREIGN KEY (`actor_admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
