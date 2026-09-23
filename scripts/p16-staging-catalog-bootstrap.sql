-- L'ESSENC DIGITAL - P16 STAGING CATALOG BOOTSTRAP
-- Canonical product: Cronograma Capilar Inteligente
-- Canonical offer: 2990 BRL / active
--
-- STAGING ONLY / TRANSACTIONAL / IDEMPOTENT / FAIL CLOSED

DELIMITER $$

BEGIN NOT ATOMIC
    DECLARE v_lock INT DEFAULT 0;
    DECLARE v_product_count BIGINT DEFAULT 0;
    DECLARE v_total_products BIGINT DEFAULT 0;
    DECLARE v_total_offers BIGINT DEFAULT 0;
    DECLARE v_product_id CHAR(36) DEFAULT NULL;
    DECLARE v_product_status VARCHAR(32) DEFAULT NULL;
    DECLARE v_offer_count BIGINT DEFAULT 0;
    DECLARE v_exact_offer_count BIGINT DEFAULT 0;
    DECLARE v_offer_id CHAR(36) DEFAULT NULL;
    DECLARE v_action VARCHAR(16) DEFAULT NULL;
    DECLARE v_postcondition_count BIGINT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DO RELEASE_LOCK('lessenc:p16:catalog-bootstrap');
        RESIGNAL;
    END;

    SELECT GET_LOCK('lessenc:p16:catalog-bootstrap', 30)
    INTO v_lock;

    IF COALESCE(v_lock, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'P16_CATALOG_LOCK_UNAVAILABLE';
    END IF;

    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    START TRANSACTION;

    SELECT COUNT(*)
    INTO v_product_count
    FROM products
    WHERE name = 'Cronograma Capilar Inteligente';

    IF v_product_count = 0 THEN

        SELECT COUNT(*) INTO v_total_products FROM products;
        SELECT COUNT(*) INTO v_total_offers FROM offers;

        IF v_total_products <> 0 OR v_total_offers <> 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'P16_CATALOG_NONEMPTY_WITHOUT_CANONICAL_PRODUCT';
        END IF;

        SET v_product_id = UUID_v4();
        SET v_offer_id = UUID_v4();

        INSERT INTO products (
            id, name, description, status, created_at, updated_at
        ) VALUES (
            v_product_id,
            'Cronograma Capilar Inteligente',
            NULL,
            'ACTIVE',
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
        );

        INSERT INTO offers (
            id, product_id, price_minor, currency, is_active, created_at, updated_at
        ) VALUES (
            v_offer_id,
            v_product_id,
            2990,
            'BRL',
            TRUE,
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
        );

        SET v_action = 'CREATED';

    ELSEIF v_product_count = 1 THEN

        SELECT id, status
        INTO v_product_id, v_product_status
        FROM products
        WHERE name = 'Cronograma Capilar Inteligente'
        LIMIT 1;

        SELECT COUNT(*)
        INTO v_offer_count
        FROM offers
        WHERE product_id = v_product_id;

        SELECT COUNT(*)
        INTO v_exact_offer_count
        FROM offers
        WHERE product_id = v_product_id
          AND price_minor = 2990
          AND currency = 'BRL'
          AND is_active = TRUE;

        IF v_product_status <> 'ACTIVE'
           OR v_offer_count <> 1
           OR v_exact_offer_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'P16_CATALOG_CANONICAL_STATE_CONFLICT';
        END IF;

        SELECT id
        INTO v_offer_id
        FROM offers
        WHERE product_id = v_product_id
          AND price_minor = 2990
          AND currency = 'BRL'
          AND is_active = TRUE
        LIMIT 1;

        SET v_action = 'NOOP';

    ELSE

        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'P16_CATALOG_DUPLICATE_CANONICAL_PRODUCTS';

    END IF;

    SELECT COUNT(*)
    INTO v_postcondition_count
    FROM products AS p
    INNER JOIN offers AS o
        ON o.product_id = p.id
    WHERE p.id = v_product_id
      AND o.id = v_offer_id
      AND p.name = 'Cronograma Capilar Inteligente'
      AND p.status = 'ACTIVE'
      AND o.price_minor = 2990
      AND o.currency = 'BRL'
      AND o.is_active = TRUE;

    IF v_postcondition_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'P16_CATALOG_POSTCONDITION_FAILED';
    END IF;

    COMMIT;

    DO RELEASE_LOCK('lessenc:p16:catalog-bootstrap');

    SELECT
        'P16_CATALOG_BOOTSTRAP' AS marker,
        v_action AS action,
        v_product_id AS product_id,
        v_offer_id AS offer_id;

END$$

DELIMITER ;
