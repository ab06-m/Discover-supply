# Discover Supply — Main App UI Kit

## Overview
Interactive clickthrough prototype of the **Discover Supply** main distribution management app.

## Screens
| Screen | Description |
|--------|-------------|
| **Dashboard** | KPI stat cards + recent orders table |
| **Inventory** | Product table with stock status, low-stock alerts, category filter, tabs |
| **Orders** | Filterable order list + full order detail with stage pipeline, line items, totals |
| Placeholders | Check in, Invoices, Delivery, Stores, Reports, Settings |

## Usage
Open `index.html` in a browser. Navigate using the sidebar. Click any order row to see order detail; use the stage pipeline to transition stages.

## Components (in Shared.jsx)
`Btn` · `Card` · `Badge` · `StageBadge` · `StockBadge` · `Input` · `Select` · `PageHeader` · `EmptyState` · `StatCard` · `TabNav` · `Icons`

## Design Notes
- Font: DM Sans (Google Fonts) — substituting for system font
- Colors: pulled directly from `apps/main/app/globals.css`
- Icons: inline SVG matching Lucide React stroke style
- Sidebar: 220px, primary blue, white active state
- Cards: white, 10px radius, subtle shadow
