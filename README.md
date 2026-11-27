# FactoryFlow
### Order-to-Audit Intelligence System for a Small Food Manufacturer

**Tagline:** Every order connected. Every material accounted for. Every production variance explained. Every transaction audit-ready.

FactoryFlow is a web-based prototype connecting sales, purchasing, inventory, production, dispatch, payments and operational audit checks for a small packaged-food manufacturer.

## Project status
- Next.js production build: successful
- TypeScript checks: successful
- Main application routes: compiled
- GitHub: https://github.com/Varshakaleeswaran/factoryflow

> This is an internship-assignment prototype using demo data. It is not a certified accounting, GST-compliance, statutory-audit or production ERP system.

## Modules

| Module | Purpose |
|---|---|
| Dashboard | Navigation to operational modules |
| Sales & Orders | Create sales orders and support approval |
| Invoice PDF | Generate PDF from an approved order |
| Purchases | Record supplier purchases and update raw-material stock |
| Inventory | View item balances and stock movement ledger |
| Production | Maintain BOMs and post production runs with material consumption |
| Dispatch | Dispatch invoiced orders subject to available finished stock |
| Payments | Record customer receipts and monitor outstanding amounts |
| Reports | Operational summaries and CSV exports |
| AuditIQ | Flag low stock, production yield loss and approved orders without invoices |

## Technology
- Next.js App Router, React, TypeScript and Tailwind CSS
- Supabase PostgreSQL, Auth and Row Level Security
- `@supabase/supabase-js` and `@supabase/ssr`
- jsPDF for invoice PDF generation
- Recharts and Lucide React dependencies

## Run locally

### Requirements
Node.js (current LTS), npm and a Supabase project.

### Clone and install
```bash
git clone https://github.com/Varshakaleeswaran/factoryflow.git
cd factoryflow
npm install
```

### Environment
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```
Never commit `.env.local`, service-role keys, database passwords or other secrets. The repository ignores `.env*`.

### Supabase database setup
The prototype expects organization/profile/membership tables, units, items, customers, suppliers, stock movements, audit logs, sales orders, invoices, purchases, BOMs, production runs, dispatches and payment-related objects, plus RLS policies and RPC functions.

The development database was configured in the Supabase SQL Editor. To reproduce in a fresh Supabase project, export and apply the complete schema, policies, functions and demo seed data from the development project. The frontend repository alone does not create these database objects. A reviewed, versioned migration bundle should be added under `supabase/migrations/`, with non-sensitive demo seed data under `supabase/seed.sql`.

### Start
```bash
npm run dev
```
Open http://localhost:3000.

### Production build
```bash
npm run build
```

## Typical demo workflow
1. Sign in with a configured demo user.
2. Create a sales order.
3. Approve the order with an authorized role.
4. Generate the invoice PDF.
5. Record a supplier purchase and verify raw-material stock.
6. Review/create a BOM and post a production run.
7. Verify material consumption and finished-goods output.
8. Dispatch an invoiced order and verify finished-stock deduction.
9. Record a customer payment and inspect the outstanding balance.
10. Open Reports and AuditIQ.

Actual actions depend on seeded data and the signed-in user's role.

## Security and integrity notes
- Supabase Auth is used for identity.
- Database access is protected by Row Level Security policies.
- Never expose a service-role key in browser code or a `NEXT_PUBLIC_` variable.
- Review authorization, concurrency, duplicate requests and rollback behaviour before real deployment.
- Correct posted transactions through traceable reversals rather than silently editing history.
- Validate GST rates, HSN/SAC, GSTIN, invoice numbering and statutory formats with a qualified accountant before commercial use.

## Known prototype limitations
- The app has not been independently security-audited.
- Database setup is currently maintained in the development Supabase project; a clean, versioned migration bundle is still required for one-command reproduction.
- Demo invoice output is not represented as a legally validated GST tax invoice.
- Reports and AuditIQ are operational aids, not statutory filings or audit opinions.
- Role permissions, RLS, posting transactions, duplicate-submit protection and concurrent stock updates require further testing before production.
- Demo data and configuration may need to be seeded in a fresh environment.

## Repository
https://github.com/Varshakaleeswaran/factoryflow

See [LICENSE](./LICENSE).
