-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `product_description_snapshot` TEXT NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `description` TEXT NULL;
