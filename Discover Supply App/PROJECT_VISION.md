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

All code lives under `Claude system/` inside this workspace. The outer folder holds non-code assets and docs only.

```
Claude system/
├── app/                 # Next.js routes — thin, delegate to modules
│   ├── (staff)/         # Staff app
│   ├── (auth)/
│   ├── portal/          # Customer portal (separate auth)
│   ├── shop/            # Public B2B storefront
│   ├── i/[token]/       # Tokenized public invoice links
│   ├── api/
│   └── onboarding/
├── modules/             # Self-contained feature slices
│   ├── inventory/       # Products, stock, check-in, barcode
│   ├── orders/          # Sales orders, pipeline stages
│   ├── invoices/        # Invoices + templates + merge fields
│   ├── dispatch/        # Delivery, proof of delivery
│   ├── customers/       # Stores/contacts
│   ├── storefront/      # B2B shop pages + cart
│   ├── portal/          # Customer portal views
│   ├── reports/
│   └── settings/
├── lib/                 # Cross-module shared code
│   ├── db/              # Drizzle schema
│   ├── supabase/        # SSR/browser clients + middleware
│   ├── auth.ts
│   ├── permissions.ts
│   └── utils.ts
├── components/ui/       # shadcn primitives
└── drizzle/             # Migrations + hand-written RLS
```

**Module contract:** each `modules/<name>/` may contain `schema.ts`, `actions.ts`, `queries.ts`, `components/`, `lib/`, `types.ts`. New features land as new modules — never bolted directly into `app/`. Routes stay under ~30 lines and import from `@/modules/<name>/…`.

## Migration assets (parent folder)

The parent `Discover Supply/` folder contains real data from the beta user's Kyte account:

- `Products_20260120_20260420.csv`, `Products_with_Images.csv`
- `Customers_20260120_20260420.csv`
- `kyte_images/`, `kyte_images_ai_up/`, `kyte_images_optimized/` — product photos
- `import-scripts/`, `discover-store/`, `zoho-inventory-mcp/`, `scratch/`

Kyte → Discover Supply column mapping (for when we build import):
`Code → sku` · `Name → name` · `Current Stock → onHand` · `Minimum Stock → lowStockThreshold` · `Cost → cost` · `Price → price` · `Unit → unit` (normalize "pcs/each" → `each`) · `Image_Path → imageUrl` (upload to Supabase Storage, rewrite URL). `Category` creates categories on the fly. Historical sales aggregates are skipped unless reconstruction is requested.

## Guardrails

- Never scaffold files at the workspace root — always inside `Claude system/`.
- Never hardcode stage names in business logic.
- Never mix staff `memberships` with customer portal access.
- Never emit raw entity UUIDs in public links — always tokens.
- Never auto-import external data without a dry-run preview.
- Architecture decisions above are locked as of April 2026 and do not drift without explicit sign-off.
