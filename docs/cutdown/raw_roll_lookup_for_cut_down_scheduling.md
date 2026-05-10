# Raw Roll Lookup for Cut-Down Scheduling

## Summary
Add a raw insulation roll lookup so cut-down scheduling calculates source raw rolls automatically. `cut_downs.sqft_scheduled` will mean **planned raw source sqft consumed**, so it may exceed the billing line sqft because whole raw rolls are required. The billing line sqft remains unchanged and continues to represent the ordered/invoiced sqft.

## Key Changes
- Add `r_value` to `material_skus` and seed existing SKUs by thickness:
  - 2.5" -> R-7
  - 3" -> R-10
  - 3.5" -> R-11
  - 4" -> R-13
  - 6" -> R-19
  - 8" -> R-25
  - 9.5" -> R-30
- Add a `raw_roll_lookup` table keyed by vendor, R-value, thickness, and width, with `roll_length_ft`.
- Seed lookup rows for all existing DB widths for each thickness/vendor:
  - R-7 / 2.5": JM 100 ft, CT 100 ft
  - R-10 / 3": JM 100 ft, CT 100 ft
  - R-11 / 3.5": JM 75 ft, CT 100 ft
  - R-13 / 4": JM 75 ft, CT 75 ft
  - R-19 / 6": JM 50 ft, CT 50 ft
  - R-25 / 8": JM 30 ft, CT 30 ft
  - R-30 / 9.5": JM 27 ft, CT 25 ft
- Extend `cut_downs` to store the selected raw-roll plan:
  - `raw_roll_lookup_id`
  - `raw_vendor`
  - `raw_roll_length_ft`
  - `raw_roll_width_in`
- Change scheduling so raw roll count is calculated, not manually entered:
  - Default vendor to Johns Manville.
  - Allow CertainTeed override with a warning that vendor mixing is discouraged.
  - Calculate `rolls_scheduled = ceil(billing_line.sqft / ((raw_width_in / 12) * raw_roll_length_ft))`.
  - Store `sqft_scheduled = rolls_scheduled * (raw_width_in / 12) * raw_roll_length_ft`.

## Cut-Down Accounting Rules
- `billing_line.sqft` remains the ordered/invoiced sqft and does not change.
- `cut_downs.sqft_scheduled` is planned raw source sqft consumed for inventory planning.
- At confirmation, inventory `CONSUMPTION` should use actual raw source sqft consumed.
- WIP `CUT_IN` should represent usable cut output for production children, not blindly prorate raw source overage into production lines.
- Any difference between raw source sqft consumed and usable cut output is waste/scrap, handled by existing scrap disposition fields and WIP ledger behavior.

## Test Plan
- Unit test raw roll calculation for all standard and exception lengths.
- Service test scheduling defaults to JM and stores calculated raw rolls/source sqft.
- Service test CT override stores CT lookup details and shows warning path.
- Service test missing lookup fails with a user-facing error.
- Service test confirmation keeps billing sqft unchanged while consuming raw source sqft.
- Service test WIP `CUT_IN` does not inflate production child sqft with raw roll overage.
- Run:
  - `npm run test`
  - `npm run lint`
  - `npm run build`

## Assumptions
- “All widths in database” means every existing `material_skus.width_in` for the matching thickness gets lookup rows for both JM and CT.
- Inventory remains vendor-agnostic; vendor affects planning math only.
- Vendor mixing is discouraged but allowed without admin override.
- `sqft_scheduled` intentionally represents planned raw source inventory consumption, not billing sqft.
