# TDD Plan

This project can use test-driven development now. Vitest is already configured, `npm run test` runs the suite, and there are existing tests for service helpers, navigation, and formatting.

The goal is not to test every line. The goal is to write tests first around the behavior that can break inventory, production, purchasing, shipping, and daily workflow decisions.

## Current Baseline

- Test runner: Vitest
- Test command: `npm run test`
- Watch command: `npm run test:watch`
- Test pattern: `src/**/*.test.js`
- Current test layer: unit tests for helpers and business rules
- Missing test layers: broader service transaction tests, route action tests, and browser workflow tests

## TDD Workflow

Use this loop for new behavior and bug fixes:

1. Write a small scenario in plain language.
2. Add or update the smallest useful test.
3. Run `npm run test` and confirm the new test fails for the expected reason.
4. Implement the smallest change that satisfies the test.
5. Run `npm run test`.
6. Run `npm run build` before closing the work.
7. For UI changes, verify the route in a browser at desktop and narrow widths.

## Scenario Format

```md
Scenario: Receive a PO line
Given an open PO line for a material SKU
When the user receives the line
Then a RECEIPT ledger transaction is created
And the PO line is marked received
And the PO status reflects the remaining open lines
```

## Test Layers

### 1. Unit and Helper Tests

Use these for pure business rules and data transforms:

- inventory ledger math
- matrix row ordering
- matrix running totals
- production square-foot calculations
- prorating shipped or unproduced rolls
- date and number formatting
- safe navigation and return links

These tests should be fast, isolated, and should not touch MySQL.

### 2. Service Transaction Tests

Use these for service functions that mutate the database:

- `receivePoLines()`
- `unreceivePoLines()`
- `scheduleRun()`
- `confirmRun()`
- `unproduceRun()`
- shipping confirmation and reversal logic

These tests should mock the DB connection and verify the important contract:

- transaction starts
- expected rows are selected or locked
- ledger transaction is inserted with the right type and quantity
- status rows are updated
- commit happens on success
- rollback happens on failure
- connection is released

### 3. Route Action Tests

Use these for form validation and user-facing responses:

- invalid form data returns `fail(400, ...)`
- service errors return `fail(500, ...)`
- successful actions redirect to the expected page
- filter and `returnTo` state is preserved

These are useful for routes with meaningful validation or navigation behavior.

### 4. Browser Workflow Tests

Add browser or end-to-end testing after the service layer is better covered.

Best first workflows:

- choose an app user and enter the app
- receive a purchase order line
- schedule and confirm production
- verify the matrix reflects the inventory change
- ship and unship produced rolls
- unreceive or unproduce an admin correction

These tests should cover the workflow a real user depends on, not implementation details.

## What To Test First

Start with purchasing service tests because PO receive and unreceive directly affect the inventory ledger.

Initial file:

```text
src/lib/services/purchasing.test.js
```

Initial coverage:

- `receivePoLines()` commits a receipt transaction and marks a line received
- `receivePoLines()` rolls back when the selected line is not open
- `unreceivePoLines()` rejects an empty selection
- `unreceivePoLines()` appends a receipt reversal and reopens the line

## Practical Rules

- Prefer tests around business behavior, not private implementation details.
- Keep tests narrow when the change is narrow.
- Broaden tests when touching shared services, route actions, ledger logic, or workflow navigation.
- Do not add browser tests for every small visual tweak.
- Keep MySQL out of fast unit tests unless a deliberate integration test layer is added later.
- Every inventory-affecting feature should have at least one test that proves the ledger effect.

