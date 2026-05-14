# Work Order Line Paths

Last updated: 2026-05-13

This brief defines the four user-facing paths a work order line can take. Use these terms in UI copy and future planning; keep internal path codes hidden unless code needs them.

## Shared Rules

- **Workflow label** is stable for the line: `Laminate`, `Cut-Down + Laminate`, `Cut-Down Only`, or `Raw`.
- **Status label** changes as the line moves through work: `Open`, `Cut-Down Queue`, `Cut-Down Scheduled`, `Production Queue`, `Production Scheduled`, `Produced`, `Shipped`, or `Needs Review`.
- **Queue** means work exists but has no date. **Scheduled** means the work has a date.
- **Needs Review** overrides normal progress when a billing line has `reconciliation_status = STALE`.
- **Billing Line** is acceptable user-facing terminology. Avoid exposing `Branch`, `Standard`, `Direct Ship`, `CUT_SHIP`, `CUT_LAMINATE`, or `DIRECT_SHIP` to users.
- Qty and length on the cut-down setup page are fixed from the billing/source line; only cut-down widths are configured there.

## Path 1: Laminate

Internal path: `STANDARD`

Meaning: the line does not need cut-down and does not ship raw. It goes through normal laminate production.

Dependencies:

- A work order line with no child cut-down setup.
- A non-raw facing. Raw-facing values are currently `RAW` and `UNFACED`.
- A production run before the line can be produced.
- A shipment after production is complete.

Transition rules:

- `Production Queue` when no incomplete production run has a date.
- `Production Scheduled` when an incomplete production run exists with a date.
- `Produced` when produced rolls meet the line quantity.
- `Shipped` when the produced material is shipped.

Steps:

1. Create/import the work order line.
2. Schedule production.
3. Confirm production.
4. Create and confirm shipment.

## Path 2: Cut-Down + Laminate

Internal path: `CUT_LAMINATE`

Meaning: the billing line is cut down first, then the resulting child line(s) go through laminate production.

Dependencies:

- A billing/source line with cut-down width setup.
- One or more child work lines created from the billing line.
- A cut-down record for the billing line before production should be confirmed.
- A production run for each laminate child line.
- A shipment after laminate production is complete.

Transition rules:

- `Cut-Down Queue` when the line needs cut-down and no dated cut-down exists.
- `Cut-Down Scheduled` when an incomplete cut-down has a date.
- `Production Queue` when cut-down is complete and laminate production still has no date.
- `Production Scheduled` when laminate production has a date.
- `Produced` when produced child rolls meet the required quantity.
- `Shipped` when the produced material is shipped.

Steps:

1. Set cut-down widths from the billing/source line.
2. Schedule cut-down.
3. Confirm cut-down. This consumes source inventory and creates WIP.
4. Schedule laminate production for the child line(s).
5. Confirm laminate production. This consumes WIP, not inventory.
6. Create and confirm shipment.

## Path 3: Cut-Down Only

Internal path: `CUT_SHIP`

Meaning: the billing line is cut down and the cut output is ready to ship. It does not go through laminate production.

Dependencies:

- A billing/source line with cut-down width setup.
- One or more child lines whose facing is raw/unfaced.
- A cut-down record for the billing line.
- A shipment using the completed cut-down as the source.

Transition rules:

- `Cut-Down Queue` when the line needs cut-down and no dated cut-down exists.
- `Cut-Down Scheduled` when an incomplete cut-down has a date.
- `Produced` when cut-down is complete. For this path, produced means the cut material exists and is ready to ship.
- `Shipped` when the cut-down output is shipped.

Steps:

1. Set cut-down widths from the billing/source line.
2. Schedule cut-down.
3. Confirm cut-down. This consumes source inventory and creates cut output/WIP.
4. Create and confirm shipment from the completed cut-down.

## Path 4: Raw

Internal path: `DIRECT_SHIP`

Meaning: the line ships raw insulation as it comes from the vendor. It has no laminate step and no cut-down step. Cutting the only/final roll to length is a separate future concept and is not part of this path yet.

Dependencies:

- A raw/unfaced work order line with no child cut-down setup.
- Available raw inventory.
- A shipment using the work order line directly.

Transition rules:

- `Open` until shipped.
- `Shipped` when the raw line is shipped.

Steps:

1. Create/import the raw work order line.
2. Create and confirm shipment from raw inventory.

## Implementation Notes

- User-facing workflow labels are derived from internal path logic in `src/lib/services/line-paths.js` and displayed by the work order detail loader.
- Cut-down setup is a user-facing replacement for the old branch language. Existing service names may still use `branch` internally.
- Cut-down confirmation consumes source inventory. Laminate confirmation for cut-down children consumes WIP. Raw shipment consumes inventory.
- If future code changes add the final-roll cut-to-length concept, treat it as a separate operation and do not fold it into `Raw` without revisiting these labels.
