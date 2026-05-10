-- Raw roll lookup table, r_value on SKUs, raw roll columns on cut_downs.
-- Run after 009_consumption_reversal.sql on existing installs.

USE pands;

ALTER TABLE material_skus
  ADD COLUMN r_value VARCHAR(10) NULL AFTER width_in;

UPDATE material_skus SET r_value = 'R-7'  WHERE thickness_in = 2.5;
UPDATE material_skus SET r_value = 'R-10' WHERE thickness_in = 3.0;
UPDATE material_skus SET r_value = 'R-11' WHERE thickness_in = 3.5;
UPDATE material_skus SET r_value = 'R-13' WHERE thickness_in = 4.0;
UPDATE material_skus SET r_value = 'R-19' WHERE thickness_in = 6.0;
UPDATE material_skus SET r_value = 'R-25' WHERE thickness_in = 8.0;
UPDATE material_skus SET r_value = 'R-30' WHERE thickness_in = 9.5;

CREATE TABLE IF NOT EXISTS raw_roll_lookup (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  vendor         ENUM('Johns Manville','Certainteed') NOT NULL,
  r_value        VARCHAR(10) NOT NULL,
  thickness_in   DECIMAL(2,1) NOT NULL,
  width_in       INT NOT NULL,
  roll_length_ft INT NOT NULL,
  UNIQUE KEY uq_raw_roll (vendor, r_value, thickness_in, width_in)
);

INSERT INTO raw_roll_lookup (vendor, r_value, thickness_in, width_in, roll_length_ft) VALUES
  ('Johns Manville', 'R-7',  2.5, 48, 100), ('Johns Manville', 'R-7',  2.5, 72, 100),
  ('Certainteed',    'R-7',  2.5, 48, 100), ('Certainteed',    'R-7',  2.5, 72, 100),
  ('Johns Manville', 'R-10', 3.0, 36, 100), ('Johns Manville', 'R-10', 3.0, 48, 100),
  ('Johns Manville', 'R-10', 3.0, 60, 100), ('Johns Manville', 'R-10', 3.0, 72, 100),
  ('Certainteed',    'R-10', 3.0, 36, 100), ('Certainteed',    'R-10', 3.0, 48, 100),
  ('Certainteed',    'R-10', 3.0, 60, 100), ('Certainteed',    'R-10', 3.0, 72, 100),
  ('Johns Manville', 'R-11', 3.5, 48,  75), ('Johns Manville', 'R-11', 3.5, 60,  75),
  ('Johns Manville', 'R-11', 3.5, 72,  75),
  ('Certainteed',    'R-11', 3.5, 48, 100), ('Certainteed',    'R-11', 3.5, 60, 100),
  ('Certainteed',    'R-11', 3.5, 72, 100),
  ('Johns Manville', 'R-13', 4.0, 36,  75), ('Johns Manville', 'R-13', 4.0, 48,  75),
  ('Johns Manville', 'R-13', 4.0, 60,  75), ('Johns Manville', 'R-13', 4.0, 72,  75),
  ('Certainteed',    'R-13', 4.0, 36,  75), ('Certainteed',    'R-13', 4.0, 48,  75),
  ('Certainteed',    'R-13', 4.0, 60,  75), ('Certainteed',    'R-13', 4.0, 72,  75),
  ('Johns Manville', 'R-19', 6.0, 36,  50), ('Johns Manville', 'R-19', 6.0, 48,  50),
  ('Johns Manville', 'R-19', 6.0, 60,  50), ('Johns Manville', 'R-19', 6.0, 72,  50),
  ('Certainteed',    'R-19', 6.0, 36,  50), ('Certainteed',    'R-19', 6.0, 48,  50),
  ('Certainteed',    'R-19', 6.0, 60,  50), ('Certainteed',    'R-19', 6.0, 72,  50),
  ('Johns Manville', 'R-25', 8.0, 48,  30), ('Johns Manville', 'R-25', 8.0, 60,  30),
  ('Certainteed',    'R-25', 8.0, 48,  30), ('Certainteed',    'R-25', 8.0, 60,  30),
  ('Johns Manville', 'R-30', 9.5, 48,  27), ('Johns Manville', 'R-30', 9.5, 60,  27),
  ('Johns Manville', 'R-30', 9.5, 72,  27),
  ('Certainteed',    'R-30', 9.5, 48,  25), ('Certainteed',    'R-30', 9.5, 60,  25),
  ('Certainteed',    'R-30', 9.5, 72,  25)
ON DUPLICATE KEY UPDATE
  roll_length_ft = VALUES(roll_length_ft);

ALTER TABLE cut_downs
  ADD COLUMN raw_roll_lookup_id INT NULL AFTER rolls_scheduled,
  ADD COLUMN raw_vendor         ENUM('Johns Manville','Certainteed') NULL AFTER raw_roll_lookup_id,
  ADD COLUMN raw_roll_length_ft INT NULL AFTER raw_vendor,
  ADD COLUMN raw_roll_width_in  INT NULL AFTER raw_roll_length_ft,
  ADD CONSTRAINT fk_cd_raw_roll FOREIGN KEY (raw_roll_lookup_id) REFERENCES raw_roll_lookup(id);
