-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(64) NOT NULL,
    `name` TEXT NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `image` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `two_factor_enabled` BOOLEAN NULL DEFAULT false,

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_sessions` (
    `id` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `ip_address` TEXT NULL,
    `user_agent` TEXT NULL,
    `user_id` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `admin_sessions_token_key`(`token`),
    INDEX `admin_sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_accounts` (
    `id` VARCHAR(64) NOT NULL,
    `account_id` TEXT NOT NULL,
    `provider_id` TEXT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NULL,
    `id_token` TEXT NULL,
    `access_token_expires_at` DATETIME(3) NULL,
    `refresh_token_expires_at` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admin_accounts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_verifications` (
    `id` VARCHAR(64) NOT NULL,
    `identifier` TEXT NOT NULL,
    `value` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `admin_verifications_identifier_idx`(`identifier`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_two_factors` (
    `id` VARCHAR(64) NOT NULL,
    `secret` TEXT NOT NULL,
    `backup_codes` TEXT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `verified` BOOLEAN NULL DEFAULT true,
    `failed_verification_count` INTEGER NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,

    INDEX `admin_two_factors_secret_idx`(`secret`(191)),
    INDEX `admin_two_factors_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_auth_rate_limit_buckets` (
    `id` VARCHAR(64) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `count` INTEGER NOT NULL,
    `last_request` BIGINT NOT NULL,

    UNIQUE INDEX `admin_auth_rate_limit_buckets_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `admin_accounts` ADD CONSTRAINT `admin_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `admin_two_factors` ADD CONSTRAINT `admin_two_factors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
