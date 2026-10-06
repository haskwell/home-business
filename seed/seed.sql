-- Test data for the menu item endpoints.
--
-- BEFORE RUNNING: register this account on the Auth tab of the test page
-- (or change the email below in all places to the one you registered).
-- Registering creates the account's business; this file fills that business.
--
--   email: test@example.com
--
-- Safe to run more than once: every insert skips rows that already exist.
-- If the account is not registered yet, the account's inserts add nothing.

-- ---------------------------------------------------------------
-- 1. Categories for the test account's business
-- ---------------------------------------------------------------
INSERT INTO categories (name, business_id)
SELECT 'Cakes', u.business_id FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.name = 'Cakes' AND c.business_id = u.business_id
  );

INSERT INTO categories (name, business_id)
SELECT 'Bread', u.business_id FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.name = 'Bread' AND c.business_id = u.business_id
  );

-- ---------------------------------------------------------------
-- 2. Items for the test account's business
--    (name, description, category, price, is_listed, in_stock, priority)
-- ---------------------------------------------------------------

-- Listed, in stock, in a category
INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Chocolate Cake', 'Dark chocolate, serves 8', u.business_id,
       (SELECT c.id FROM categories c WHERE c.name = 'Cakes' AND c.business_id = u.business_id),
       2500, 1, 1, 10
FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Chocolate Cake' AND i.business_id = u.business_id
  );

-- Listed, in stock, in a category
INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Vanilla Cupcake Box', 'Box of 6', u.business_id,
       (SELECT c.id FROM categories c WHERE c.name = 'Cakes' AND c.business_id = u.business_id),
       1800, 1, 1, 5
FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Vanilla Cupcake Box' AND i.business_id = u.business_id
  );

-- Listed but OUT of stock (try editing in_stock back to true)
INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Sourdough Loaf', 'Baked fresh in the morning', u.business_id,
       (SELECT c.id FROM categories c WHERE c.name = 'Bread' AND c.business_id = u.business_id),
       900, 1, 0, 0
FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Sourdough Loaf' AND i.business_id = u.business_id
  );

-- Listed, NO category (try editing it into a category, or clearing one)
INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Gift Card', NULL, u.business_id, NULL, 5000, 1, 1, 0
FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Gift Card' AND i.business_id = u.business_id
  );

-- Already UNLISTED (try unlisting it again, and editing an unlisted item)
INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Old Seasonal Special', 'No longer sold', u.business_id, NULL, 3200, 0, 1, 0
FROM "user" u
WHERE u.email = 'test@example.com' AND u.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Old Seasonal Special' AND i.business_id = u.business_id
  );

-- ---------------------------------------------------------------
-- 3. A DIFFERENT business that the test account does not own.
--    Editing / unlisting its items, or using its category, must fail.
-- ---------------------------------------------------------------
INSERT INTO businesses (name, description)
SELECT 'Seed: Other Bakery', 'Belongs to nobody you can log in as'
WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE name = 'Seed: Other Bakery');

INSERT INTO categories (name, business_id)
SELECT 'Other Pastries', b.id FROM businesses b
WHERE b.name = 'Seed: Other Bakery'
  AND NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.name = 'Other Pastries' AND c.business_id = b.id
  );

INSERT INTO items (name, description, business_id, category_id, price, is_listed, in_stock, priority)
SELECT 'Other Bakery Croissant', 'Not yours', b.id,
       (SELECT c.id FROM categories c WHERE c.name = 'Other Pastries' AND c.business_id = b.id),
       700, 1, 1, 0
FROM businesses b
WHERE b.name = 'Seed: Other Bakery'
  AND NOT EXISTS (
    SELECT 1 FROM items i WHERE i.name = 'Other Bakery Croissant' AND i.business_id = b.id
  );

-- ---------------------------------------------------------------
-- 4. Print what was created, so you can read the ids
-- ---------------------------------------------------------------
SELECT i.id AS item_id, i.name, i.business_id, i.category_id, i.price, i.is_listed, i.in_stock
FROM items i ORDER BY i.business_id, i.id;