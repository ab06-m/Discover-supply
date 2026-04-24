# Discover Supply — Project Summary & System Vision

## What we're building

Discover Supply is a mobile-first distribution management app. The beta user is a small distributor who delivers goods to retail stores. Everything in the MVP is judged against a single question: does it make that workflow smoother on a phone, in the field?

## Core workflow (the 5 steps that matter)

1. **Check in inventory** — receive stock into the warehouse
2. **Place a sales order** — typically while visiting a store, on a phone
3. **Confirm the order** — lock quantities, reserve stock
4. **Invoice it** — generate an invoice for the store
5. **Deliver it** — dispatch with proof of delivery (photo + signature)

Anything outside this flow (generic POS, multi-location, PO approvals) is secondary until these five steps are tight.

## System vision

- **Mobile-first, field-ready.** The distributor works on a phone, often with poor connectivity. UI is thumb-friendly; every product search has a barcode scan button next to it.
- **One-tap configurable.** Stage names, invoice templates, currency, tax rate, logo — changeable without a developer. Power features (custom roles, webhooks) stay tucked in Settings.
- **Customers are stores, not consumers.** The customer list reads like a route book. Per-customer pricing is planned, not MVP.
- **Trust in the numbers.** Split stock accounting (`on_hand` vs `committed`) prevents two reps overselling the same unit.
- **Respect existing data.** The beta user has real Kyte exports and product images. Import tooling is a near-term need, not MVP, and must be preview-before-commit.

## Architectural pillars

### Inventory — split stock
- Products track `on_hand` (physical) and `committed` (reserved). `available = on_hand - committed`.
- Lifecycle: Draft = no effect · Confirmed = +committed · Packed = none · Delivered = −on_hand, −committed · Cancelled = release · Paid = none.
- UI rule: default display is `available`; only warehouse/receiving screens show `on_hand`.

### Customizable order pipeline
- Stages live in a per-org `order_stages` table with `sort_order`, `color`, and an `effect` flag (`none | commit | consume | release | mark_paid`).
- Seed defaults: Draft → Confirmed (commit) → Packed → Delivered (consume) → Paid.
- Business logic looks up stages **by effect, never by name**.

### Barcode scanning
- Web: `@zxing/browser`. Native (Capacitor): `@capacitor-mlkit/barcode-scanning`.
- Used in product lookup at check-in, order line entry, and pack verification.

### B2B storefront + customer portal
- Public storefront `/shop/[orgSlug]` — browse only, no auth. Checkout requires customer login.
- Customer portal `/portal/*` — view orders, invoices, track delivery.
- Customers auth via Supabase Auth, linked through `customer_contacts` (not `memberships`). Staff and customer auth spaces never mix.

### Tokenized public links
- `access_tokens` table (entity_type, entity_id, token, expires_at, max_uses).
- Emailed invoice/order links use `/i/<token>` — read-only, revocable. Never expose raw UUIDs in emails.

### Customizable invoice templates
- `invoice_templates` per org with JSON config (logo, colors, font, layout, footer, terms).
- 3 modern presets shipped (Clean, Bold, Minimal). PDF via print CSS first; puppeteer later if needed.
- Render is a pure function of `(invoice_data, template_config)`.

### Reports
- Sales over time, Top products, Top customers, Low stock, Committed vs on-hand, Delivery performance, A/R aging.
- Server-rendered pages with querystring filters. Charts via `recharts`. All reports export CSV.

### Roles (fixed, 5)
- `super_admin` — everything, incl. billing and org deletion. Auto-assigned to org creator.
- `admin` — full workspace control, minus super-admin-only destructive actions.
- `office` — customers, orders, invoices, reports. No stock ops, no delivery.
- `warehouse` — receive, adjust, pack, assign dispatches.
- `driver` — view assigned orders and mark delivered with proof.
- Checks go through `can(role, action)` in `lib/permissions.ts`. Never branch on role name directly.

## Repository layout

The project is organized into logical subdirectories for apps, tools, data, and documentation.

```
Discover Supply App/
├── apps/
│   ├── main/            # Primary distribution management app (Next.js)
│   │   ├── app/         # Next.js routes
│   │   ├── modules/     # Feature modules
│   │   ├── lib/         # Shared logic
│   │   └── ...
│   └── store/           # B2B Storefront app
├── tools/
│   ├── import-scripts/  # Data migration and import scripts
│   └── zoho-mcp/        # Zoho Inventory MCP server
├── data/
│   ├── imports/         # Raw CSV data (Kyte exports, etc.)
│   └── assets/          # Shared media assets and images
└── docs/
    └── PROJECT_VISION.md # This document
```

### Main App Structure (apps/main/)
Primary code follows a modular architecture:
- `app/`: Next.js routes — thin, delegate to modules.
- `modules/`: Self-contained feature slices (inventory, orders, etc.).
- `lib/`: Cross-module shared code (db, auth, permissions).
- `components/ui/`: UI primitives (shadcn).
- `drizzle/`: Migrations and RLS rules.

## Assets & Migration Data

Migration assets are located in the `data/` directory:

- `data/imports/`: `Products_...csv`, `Customers_...csv`, `Products_with_Images.csv`
- `data/assets/`: Shared images and processed photos.
- `tools/`: `import-scripts/`, `zoho-mcp/`, `scratch/`


Kyte → Discover Supply column mapping (for when we build import):
`Code → sku` · `Name → name` · `Current Stock → onHand` · `Minimum Stock → lowStockThreshold` · `Cost → cost` · `Price → price` · `Unit → unit` (normalize "pcs/each" → `each`) · `Image_Path → imageUrl` (upload to Supabase Storage, rewrite URL). `Category` creates categories on the fly. Historical sales aggregates are skipped unless reconstruction is requested.

## Guardrails

- Never scaffold files at the workspace root — always inside `apps/main/`.
- Never hardcode stage names in business logic.
- Never mix staff `memberships` with customer portal access.
- Never emit raw entity UUIDs in public links — always tokens.
- Never auto-import external data without a dry-run preview.
- Architecture decisions above are locked as of April 2026 and do not drift without explicit sign-off.
