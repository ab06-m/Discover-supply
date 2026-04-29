# Discover Supply — Design System

## Overview

**Discover Supply** is a mobile-first distribution management platform for small distributors who deliver goods to retail stores. It covers the full operational cycle: inventory check-in → sales orders → invoicing → delivery dispatch.

The product is built with a field-first philosophy — distributors work on phones, sometimes with poor connectivity, and the UI must be thumb-friendly and fast.

## Products

| Product | Path | Description |
|---------|------|-------------|
| **Main App** | `apps/main/` | Primary distribution management app (Next.js). Inventory, orders, invoices, delivery, reports, settings. Used by admin, office, warehouse, and driver roles. |
| **B2B Storefront** | `apps/store/` | Public storefront at `/shop/[orgSlug]` — browse catalog, checkout with customer login. |
| **Customer Portal** | `apps/main/app/portal/` | Customer-facing portal at `/portal/*` — view orders, invoices, delivery tracking. |

## Sources

- **Codebase**: `Discover Supply App/Discover Supply App/` (mounted local folder)
  - Main app: `apps/main/`
  - Store: `apps/store/`
  - Docs: `docs/PROJECT_VISION.md`
- **No Figma link provided**
- **No logo/brand image assets found** in `data/assets/` (empty) or `apps/main/public/` (only manifest)

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Direct and operational.** Copy is concise, action-oriented, and avoids fluff. Think field worker reading a phone screen in a warehouse.
- **Sentence case** everywhere — labels, buttons, page titles. "New order", not "New Order" or "NEW ORDER".
- **First person (we/you) rarely used** — labels speak to the task: "Create order", "Filter", "Back to orders".
- **No emoji** in the UI. The interface is a working tool, not a social product.
- **Numeric precision matters** — stock counts, prices, and dates are always shown; "—" (em-dash) is used as a null placeholder, never "N/A".
- **Error messages are explanatory**: "Add at least one line item." not "Error 400."
- **Confirmations are honest**: "Move to 'Delivered'? This will remove items from inventory (shipped)."

### Casing Examples
| Context | Example |
|---------|---------|
| Page title | "Orders", "Dashboard", "Check in" |
| Button | "New order", "Create order", "Browse products" |
| Table header | "Store", "Stage", "Date", "Total" |
| Empty state | "No orders yet" / "Create an order to reserve inventory…" |
| Status label | "Draft", "Confirmed", "Packed", "Delivered", "Paid" |

### Terminology
- Customers are called **Stores** in nav (retail stores, not consumers)
- Inventory is called **Inventory** in nav but the check-in action is **Check in**
- Stages are user-customizable; copy never hardcodes stage names in logic

---

## VISUAL FOUNDATIONS

### Colors

**Primary** — Blue `hsl(221 83% 53%)` ≈ `#2563eb`
Used for: sidebar background, primary buttons, links, icon badges, active states.

**Background** — Light gray `hsl(220 14% 96%)` ≈ `#f1f2f5`
Used for: page background, muted areas, table headers.

**Card** — White `#ffffff`
Used for: all card surfaces, modal backgrounds.

**Foreground** — Dark navy `hsl(222 47% 11%)` ≈ `#0f172a`
Used for: primary text.

**Muted foreground** — Medium gray `hsl(220 9% 46%)` ≈ `#6b7280`
Used for: secondary labels, hints, table cell text.

**Accent** — Light blue `hsl(217 91% 96%)` ≈ `#eff6ff`
Used for: hover backgrounds, icon container backgrounds.

**Semantic colors**:
- Success: `hsl(142 71% 45%)` — green, for in-stock, positive trends
- Warning: `hsl(38 92% 50%)` — amber, for low stock alerts
- Destructive: `hsl(0 84% 60%)` — red, for out-of-stock, errors, delete actions
- Border: `hsl(220 13% 91%)` — light gray divider

**Sidebar** — Shares primary blue. Active item: `hsl(221 83% 45%)` (slightly darker). Inactive text: `rgba(255,255,255,0.85)`. Muted text: `hsl(215 90% 75%)`.

### Typography
- **No custom font defined** in codebase — falls back to Tailwind's system font stack (SF Pro / Segoe UI / Roboto / Helvetica Neue).
- This design system substitutes **DM Sans** (Google Fonts) as the primary display + body face — it's clean, geometric, and legible at small sizes. **⚠️ Flag: provide a brand font file if one exists.**
- Type scale follows Tailwind defaults: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px), `text-2xl` (24px).
- Font weights used: 400 (body), 500 (medium/label), 600 (semibold/heading), 700 (bold/stat value).
- `font-feature-settings: "rlig" 1, "calt" 1` is set globally — ligatures on.
- `tabular-nums` class applied to prices and numeric data.

### Spacing
- Base radius: `0.625rem` (10px). `md` = 8px, `sm` = 6px, `lg` = 10px.
- Standard card padding: `p-5` (20px) or `p-6` (24px).
- Grid gap: `gap-4` (16px) for cards, `gap-2` (8px) for inline controls.
- Page content top-level spacing: `space-y-6` (24px between sections).

### Shadows
- `shadow-card`: `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)` — very subtle, used on all cards.
- `shadow-card-hover`: `0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.06)` — slightly elevated, used on dropdowns/modals.
- No inner shadows. No colored shadows.

### Cards
- `rounded-lg` (10px), `border border-border`, `bg-card` (white), `shadow-card`.
- Hover: shadow upgrades to `shadow-card-hover`, no color change.
- No colored left-border accents. Cards are clean white with thin border.

### Backgrounds
- Page background: solid `hsl(220 14% 96%)` — no textures, patterns, or gradients.
- No background images or illustrations in the app shell.
- Full-bleed sections: only the sidebar uses a solid-color fill (primary blue).

### Animations & Transitions
- `transition-colors` on nav items and buttons — instant to ~150ms color transitions.
- `tailwindcss-animate` in use for accordion/collapse (Details element in order form).
- `animate-spin` for loading spinners (Loader2 icon).
- No page-transition animations. No bounce. No parallax. Functional minimalism.

### Hover / Press States
- Buttons: `hover:bg-primary/90` (slightly darker), `disabled:opacity-50`.
- Nav items: `hover:bg-white/10` (subtle white overlay on blue sidebar).
- Table rows: `hover:bg-accent` (light blue tint).
- Ghost/outline: `hover:bg-accent hover:text-accent-foreground`.
- No shrink/scale effects on press. Color change only.

### Borders
- Border color: `hsl(220 13% 91%)` (consistent throughout).
- `rounded-md` (8px) for inputs, `rounded-lg` (10px) for cards.
- `rounded-full` for status pills, stage chips, badges.
- Dashed border used only for empty drop zones / empty line items.

### Iconography
- **Lucide React** icon set — stroke style, 1.5px stroke weight, consistent sizing.
- Default size: `h-4 w-4` (16px) in most contexts; `h-5 w-5` (20px) for toolbar/mobile.
- Icons are never used standalone for navigation — always paired with a text label.
- Icon containers in stat cards: `h-8 w-8`, `rounded-md`, `bg-primary/10`, `text-primary`.
- No PNG icons, no emoji, no unicode symbols as icons, no custom SVG illustrations.

### Layout Rules
- Sidebar: fixed width `w-56` (224px) on desktop, hidden on mobile (full-screen slide-in drawer).
- Page content: `space-y-6` with `PageHeader` component at top (title + subtitle + actions row).
- Max content width: `2xl: 1400px` (Tailwind container).
- Mobile-first breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).
- Sticky right rail pattern on forms: `lg:sticky lg:top-20` for summary cards.

### Imagery
- Product images: square thumbnails, `rounded-md`, `object-cover`, fallback to `ImageIcon` icon in muted bg.
- No hero images, no full-bleed photography in the main app.
- Color vibe of imagery: neutral/product photos (inventory items).

---

## ICONOGRAPHY

The codebase uses **Lucide React** (`lucide-react@^0.451.0`) exclusively. This is a CDN-available icon set.
CDN: `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js` or via React: `lucide-react`.

No custom SVG files, icon sprites, or icon fonts exist in the project. No PNG icon files found.

**Nav icons used**:
`BarChart3` (Reports), `FileText` (Invoices), `LayoutDashboard` (Dashboard), `Menu`, `Package` (Inventory), `PackagePlus` (Check In), `Settings`, `ShoppingCart` (Orders), `Store` (Stores/Customers), `Truck` (Delivery), `Upload` (Import), `X`

**Functional icons used**:
`AlertTriangle`, `Check`, `ChevronRight`, `ImageIcon`, `Loader2`, `Plus`, `Search`, `Wallet`, `ListChecks`

---

## FILE INDEX

```
/
├── README.md                    ← This file
├── SKILL.md                     ← Skill definition for Claude Code
├── colors_and_type.css          ← CSS custom properties (colors + typography)
├── assets/                      ← Logos, icons, brand assets (none available from source)
├── preview/                     ← Design system preview cards (registered in Design System tab)
│   ├── colors-primary.html
│   ├── colors-semantic.html
│   ├── colors-sidebar.html
│   ├── type-scale.html
│   ├── type-specimens.html
│   ├── spacing-tokens.html
│   ├── shadows-radii.html
│   ├── components-buttons.html
│   ├── components-badges.html
│   ├── components-cards.html
│   ├── components-inputs.html
│   ├── components-status-pill.html
│   ├── components-stage-pipeline.html
│   ├── components-stat-card.html
│   ├── components-table.html
│   ├── components-sidebar.html
│   └── components-empty-state.html
└── ui_kits/
    └── main-app/
        ├── README.md
        └── index.html           ← Interactive prototype: Dashboard → Orders → Order Detail
```
