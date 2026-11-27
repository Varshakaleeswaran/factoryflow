# FactoryFlow — Design Note

**Project:** Order-to-Audit Intelligence System for a Small Food Manufacturer  
**Architecture:** Next.js + Supabase (PostgreSQL, Auth and RLS)

## 1. Problem and objective
Small packaged-food manufacturers may manage sales orders, purchases, stock, production, dispatch and collections in separate registers or spreadsheets. This makes it difficult to trace material usage, reconcile finished stock, explain production loss and prepare month-end records.

FactoryFlow is a web prototype connecting these operational events through shared transaction records and stock movements for a single-factory food manufacturer.

## 2. Main workflows

**Sales loop:** Sales order → approval → invoice PDF → dispatch → finished-stock deduction → customer payment → outstanding balance.

**Procurement and production loop:** Supplier purchase → raw-material/packaging stock increase → BOM-based material issue → production run → finished-stock increase → yield and cost review.

Both loops converge on inventory and operational reports. Dispatch is intended to check for an invoice and sufficient finished stock before deducting stock.

## 3. High-level architecture
- **Presentation:** Next.js App Router pages and React components.
- **Application logic:** TypeScript client/server code and Supabase RPC calls for selected multi-step posting operations.
- **Identity:** Supabase Auth.
- **Data:** PostgreSQL tables for organizations, members, masters, stock movements, sales, invoices, purchases, BOMs, production, dispatch, payments and audit events.
- **Authorization:** PostgreSQL Row Level Security and role-aware policies.
- **Documents/exports:** jsPDF invoice generation and CSV report downloads.

The browser uses the Supabase publishable key with RLS. A service-role key must never be exposed to the browser.

## 4. Core data concepts

| Data group | Representative entities | Purpose |
|---|---|---|
| Organization/access | organizations, profiles, organization_members | Tenant and role context |
| Masters | items, units, customers, suppliers | Shared product and party references |
| Inventory | stock_movements | Operational stock ledger |
| Sales | sales_orders, sales_order_items | Customer demand and approval |
| Billing | invoices, invoice_items | Invoice header and item snapshots |
| Procurement | purchases, purchase_items | Supplier receipts and purchase costs |
| Production | boms, bom_items, production_runs, production_consumptions | Recipe/version, usage, output and cost |
| Dispatch | dispatches, dispatch_items | Fulfilment and finished-stock issue |
| Traceability | audit_logs | Selected operational action records |

Stock balances are derived from stock movement history. Movement types distinguish inbound events (such as purchase and production output) from outbound events (such as production issue and sale dispatch).

## 5. Controls and design decisions
- Organization membership and roles are checked at the database boundary using RLS and role helper functions.
- Selected multi-row posting operations are encapsulated in PostgreSQL RPC functions to validate and write related records together.
- Sales approval and invoice creation are separate steps; invoice generation requires an approved order.
- Dispatch requires an invoice and checks available finished stock.
- Production posting records component consumption, stock issues, finished output and run cost information.
- Purchase posting records purchase lines and corresponding stock movements.
- Invoice PDF output uses stored invoice/order details; legal GST correctness requires business-specific master data and accountant validation.
- CSV exports are operational extracts, not statutory GST returns.

## 6. Exception visibility
AuditIQ currently highlights selected conditions:
- Items at or below configured reorder levels.
- Production runs with output below planned output.
- Approved sales orders without invoices.

These are rule-based operational alerts, not a formal audit opinion. Staff should investigate each alert against the underlying transaction evidence.

## 7. Limitations and next steps
This is an assignment prototype, not a production ERP. Before deployment, it needs versioned Supabase migrations and seed scripts, systematic RLS tests for every role, server-side authorization review, idempotency for posting calls, concurrency tests, reversal workflows, unit-of-measure normalization, batch/expiry genealogy, automated tests, backups and monitoring. GST configuration and invoice formats must be validated by a qualified accountant.

**Reproducibility note:** The development Supabase database was configured in the SQL Editor. A fresh evaluator environment requires a reviewed schema/policy/function export and demo seed data; the frontend repository alone does not recreate the database.
