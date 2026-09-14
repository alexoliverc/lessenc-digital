-- CreateTable
CREATE TABLE `buyer_access_rate_limit_buckets` (
    `scope` VARCHAR(32) NOT NULL,
    `bucket_hash` CHAR(64) NOT NULL,
    `window_start` DATETIME(3) NOT NULL,
    `request_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `buyer_access_rate_limit_buckets_window_start_idx`(`window_start`),
    PRIMARY KEY (`scope`, `bucket_hash`, `window_start`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
