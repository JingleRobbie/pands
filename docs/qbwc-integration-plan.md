# QBWC Integration — Incremental Implementation Plan

## Overview

The goal is to incrementally pull QuickBooks Desktop data into a web-accessible MySQL database, starting with the lowest-risk, highest-value data and building the infrastructure only once.

The architecture is:

```
[SvelteKit UI]  ←→  [Node/Express REST API]  ←→  [MySQL]
                                                      ↑
                                              [Node SOAP Server]
                                                      ↑  (HTTPS polls)
                                              [QBWC on Windows Server]
                                                      ↑  (COM)
                                              [QuickBooks Desktop]
```

The **SOAP server** and the **REST API** can be the same Node process. MySQL is the shared state between them — QBWC writes into it; your UI reads from it.

---

## Phase 0 — Infrastructure (Do This Once)

**Goal:** Get QBWC talking to a Node SOAP server, confirmed working, before touching any real data.

### Tasks

1. **Install QBWC on the Windows Server**
   - Download from Intuit Developer site (free)
   - Install on the same machine as QuickBooks

2. **Stand up a Node/Express SOAP server**
   - Use the [`quickbooks-js`](https://www.npmjs.com/package/quickbooks-js) npm package as your scaffold — it handles the QBWC SOAP handshake boilerplate
   - Implement the 6 required SOAP methods: `serverVersion`, `clientVersion`, `authenticate`, `sendRequestXML`, `receiveResponseXML`, `closeConnection`
   - For now, have `sendRequestXML` return an empty string (tells QBWC "nothing to do")

3. **Create your `.QWC` file**
   ```xml
   <?xml version="1.0"?>
   <QBWCXML>
     <AppName>MyIntegration</AppName>
     <AppID></AppID>
     <AppURL>https://yourserver.com/soap</AppURL>
     <AppDescription>QB Data Sync</AppDescription>
     <AppSupport>https://yourserver.com</AppSupport>
     <UserName>qbsync</UserName>
     <OwnerID>{YOUR-GUID}</OwnerID>
     <FileID>{YOUR-GUID}</FileID>
     <QBType>QBFS</QBType>
     <Scheduler>
       <RunEveryNMinutes>30</RunEveryNMinutes>
     </Scheduler>
   </QBWCXML>
   ```

4. **Create your MySQL schema shell**
   ```sql
   CREATE DATABASE qb_sync;
   -- sync log table used in every phase
   CREATE TABLE sync_log (
     id INT AUTO_INCREMENT PRIMARY KEY,
     sync_type VARCHAR(50),
     started_at DATETIME,
     completed_at DATETIME,
     records_processed INT DEFAULT 0,
     status ENUM('running','success','error') DEFAULT 'running',
     error_message TEXT
   );
   ```

5. **Load the `.QWC` into QBWC**, authorize it in QuickBooks, confirm handshake succeeds in QBWC logs

### Milestone: QBWC connects, authenticates, and gets an empty response — no errors in the log.

### Devil's Advocate
> Your SOAP server needs an HTTPS endpoint reachable from the Windows Server. If your Node server is on a different machine than QBWC, you need a real hostname and a valid TLS cert — a self-signed cert will cause `QBWC 1048` errors. Plan for this before you write a single qbXML query. If you're running Node locally during development, you'll need a tunnel (ngrok or Cloudflare Tunnel) just to test.

---

## Phase 1 — Customers Sync

**Goal:** Pull the active customer list from QB into MySQL so your web app can reference real customer names/IDs without touching QB.

**Why first:** Customers are a list, not a transaction. They change infrequently, the qbXML is simple, and they're referenced by every other phase. Getting this right first means your later phases can foreign-key against real QB data.

### MySQL Table

```sql
CREATE TABLE customers (
  list_id VARCHAR(50) PRIMARY KEY,       -- QB's internal ListID
  full_name VARCHAR(200),                -- includes parent hierarchy e.g. "Acme:Job1"
  company_name VARCHAR(200),
  is_active TINYINT(1) DEFAULT 1,
  phone VARCHAR(50),
  email VARCHAR(200),
  last_synced_at DATETIME,
  INDEX idx_full_name (full_name)
);
```

### qbXML Query

```xml
<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq requestID="1">
      <ActiveStatus>ActiveOnly</ActiveStatus>
      <OwnerID>0</OwnerID>
    </CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>
```

### Sync Strategy

- **Full refresh** on first run: truncate and reload
- **Incremental** on subsequent runs: use `<ModifiedDateRangeFilter>` with the last `sync_log` timestamp
- Run every 60 minutes (customers don't change often)

### Devil's Advocate
> QuickBooks "customers" include jobs (sub-customers). `FullName` returns hierarchical names like `Acme Corp:Roof Job 2024`. If your web app displays these flat, it will look confusing. Decide now whether you want to store the full hierarchy or just top-level customers — changing this later means a schema migration.

---

## Phase 2 — Item/SKU Sync

**Goal:** Pull inventory and non-inventory items (parts/SKUs) from QB into MySQL for work order lookups.

**Why second:** Items are also a list, simpler than transactions. Your work orders need to reference real QB SKUs — having this in MySQL before you tackle POs means your PO line items in Phase 3 can already resolve against real item records.

### MySQL Table

```sql
CREATE TABLE items (
  list_id VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(200),               -- the SKU / item code
  description TEXT,
  item_type VARCHAR(50),                -- Inventory, NonInventory, Service, etc.
  purchase_cost DECIMAL(10,2),
  sales_price DECIMAL(10,2),
  is_active TINYINT(1) DEFAULT 1,
  manufacturer_part_number VARCHAR(100),
  last_synced_at DATETIME,
  INDEX idx_full_name (full_name)
);
```

### qbXML Query

```xml
<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <ItemQueryRq requestID="2">
      <ActiveStatus>ActiveOnly</ActiveStatus>
      <OwnerID>0</OwnerID>
    </ItemQueryRq>
  </QBXMLMsgsRq>
</QBXML>
```

> **Note:** `ItemQueryRq` returns ALL item types in one call. You'll filter by `<Type>` in the response handler.

### Sync Strategy

- Full refresh weekly (items change rarely)
- Incremental daily using `ModifiedDateRangeFilter`

### Devil's Advocate
> If you have thousands of items, the response will be very large and QBWC may time out. The `iterator="Start"` / `iteratorRemainingCount` pattern handles pagination — you'll need to implement this or you'll silently get partial data and never know. Don't skip this even if your item list seems small today.

---

## Phase 3 — Open Purchase Orders by Class

**Goal:** Pull open POs filtered by QB Class and store them with their line items for web display.

**Why third:** POs are transactions (more complex than lists), have line items, and depend on both customer and item data already being in MySQL from Phases 1–2.

### MySQL Tables

```sql
CREATE TABLE purchase_orders (
  txn_id VARCHAR(50) PRIMARY KEY,       -- QB TxnID
  txn_number INT,
  po_date DATE,
  vendor_list_id VARCHAR(50),
  vendor_name VARCHAR(200),
  ship_to_customer_list_id VARCHAR(50), -- FK → customers.list_id
  class_full_name VARCHAR(200),         -- the QB Class
  memo TEXT,
  is_fully_received TINYINT(1) DEFAULT 0,
  is_manually_closed TINYINT(1) DEFAULT 0,
  total_amount DECIMAL(12,2),
  last_synced_at DATETIME,
  INDEX idx_class (class_full_name),
  INDEX idx_open (is_fully_received, is_manually_closed)
);

CREATE TABLE purchase_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_id VARCHAR(50),                   -- FK → purchase_orders.txn_id
  line_seq_number INT,
  item_list_id VARCHAR(50),             -- FK → items.list_id
  item_full_name VARCHAR(200),
  description TEXT,
  quantity DECIMAL(10,4),
  unit_of_measure VARCHAR(50),
  rate DECIMAL(10,4),
  amount DECIMAL(12,2),
  qty_received DECIMAL(10,4) DEFAULT 0,
  is_closed TINYINT(1) DEFAULT 0,
  INDEX idx_txn (txn_id)
);
```

### qbXML Query

```xml
<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <PurchaseOrderQueryRq requestID="3" iterator="Start">
      <MaxReturned>50</MaxReturned>
      <OpenStatus>Open</OpenStatus>
      <IncludeLineItems>true</IncludeLineItems>
      <OwnerID>0</OwnerID>
    </PurchaseOrderQueryRq>
  </QBXMLMsgsRq>
</QBXML>
```

> **Important:** QB's `PurchaseOrderQueryRq` does **not** have a native `ClassFilter`. You pull all open POs and filter by `<ClassRef><FullName>` in your Node response handler before writing to MySQL. Do not assume the XML will do this filtering for you.

### Sync Strategy

- Run every 30 minutes
- Use `ModifiedDateRangeFilter` for incremental: only fetch POs changed since last sync
- On each sync, upsert POs (`INSERT ... ON DUPLICATE KEY UPDATE`) — don't truncate, since closed POs should be marked not deleted

### Devil's Advocate
> "Open" in QB is not a simple boolean. A PO can be partially received. `IsManuallyClosed` and `IsFullyReceived` are separate flags and a line can be individually closed while the PO header is still open. If you display "open POs" without handling this at the line level, you'll show POs that are effectively done. Plan your UI filtering logic before you write the first query.

---

## Phase 4 — Work Order / Web Table Integration

**Goal:** Your application creates work orders outside of QB. Those work orders need to reference real QB customers and items from MySQL, and optionally write back to QB (e.g., create a Sales Order or custom transaction).

This phase is **read-only from QB's perspective** initially — your app just consumes the synced MySQL data.

### Work Orders Table (your app's data, not from QB)

```sql
CREATE TABLE work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wo_number VARCHAR(50) UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  customer_list_id VARCHAR(50),         -- FK → customers.list_id
  related_po_txn_id VARCHAR(50),        -- FK → purchase_orders.txn_id (optional)
  status ENUM('draft','open','in_progress','completed','cancelled') DEFAULT 'draft',
  description TEXT,
  notes TEXT,
  INDEX idx_customer (customer_list_id),
  INDEX idx_po (related_po_txn_id)
);

CREATE TABLE work_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT,                    -- FK → work_orders.id
  item_list_id VARCHAR(50),             -- FK → items.list_id (resolved SKU)
  item_full_name VARCHAR(200),          -- denormalized for safety
  quantity DECIMAL(10,4),
  notes TEXT
);
```

### Devil's Advocate
> You're storing `item_full_name` as a denormalized copy — that's correct, because if the item name changes in QB, you don't want historical work orders to silently update. But this means you need a deliberate policy: when an item is updated in QB and re-synced, do you update work orders that reference it or leave them frozen? Decide this before Phase 4 goes live.

---

## Sequencing Summary

| Phase | What | QB Query | Dependency | Risk |
|-------|------|----------|------------|------|
| 0 | SOAP scaffold + QBWC handshake | None | None | Medium (infra) |
| 1 | Customer list | `CustomerQueryRq` | Phase 0 | Low |
| 2 | Item/SKU list | `ItemQueryRq` | Phase 0 | Low |
| 3 | Open POs by class | `PurchaseOrderQueryRq` | Phases 1, 2 | Medium |
| 4 | Work orders (app data) | None (reads MySQL) | Phases 1, 2, 3 | Low |

---

## Sync Job Design Pattern (All Phases)

Your Node SOAP handler maintains a **request queue** in MySQL:

```sql
CREATE TABLE sync_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_type VARCHAR(50),             -- 'CustomerQuery', 'ItemQuery', etc.
  qbxml_request TEXT,                   -- the actual XML to send
  status ENUM('pending','sent','done','error') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  error_message TEXT
);
```

**Flow:**
1. A cron job (or QBWC's own schedule) triggers `sendRequestXML`
2. Your handler reads the next `pending` row from `sync_queue`, marks it `sent`, returns the XML
3. QBWC sends it to QB, returns the response to `receiveResponseXML`
4. Your handler parses the XML response, writes to the appropriate table, marks the queue row `done`
5. Return `100` to close the session, or `< 100` to signal more requests remain

---

## Technology Decisions

| Concern | Recommendation | Why |
|---------|---------------|-----|
| SOAP scaffold | `quickbooks-js` npm | Pre-built QBWC handshake, saves days |
| XML parsing | `fast-xml-parser` | Fast, actively maintained |
| MySQL client | `mysql2` with promise API | Standard, supports connection pooling |
| Scheduling | `node-cron` | Queue population, not QBWC polling (QBWC handles its own timing) |
| UI | SvelteKit | Fine for read-only display of synced data |
| REST API | Express routes in the same Node process | Keep it simple until you need to scale |

### Devil's Advocate on SvelteKit
> SvelteKit's server routes *can* serve as your REST API, but you'd then be mixing your SOAP server process with your UI server. These have different uptime requirements — the SOAP server needs to be always-on and respond within QBWC's timeout window even if no one is using the UI. Keep them as separate processes (or at minimum separate entry points) so a SvelteKit crash doesn't break your QB sync.
