-- Allow ship_date to be null and add ship_asap priority flag.

USE pands;

ALTER TABLE work_orders
  MODIFY COLUMN ship_date DATE NULL;

ALTER TABLE work_orders
  ADD COLUMN ship_asap TINYINT(1) NOT NULL DEFAULT 0 AFTER ship_date;
