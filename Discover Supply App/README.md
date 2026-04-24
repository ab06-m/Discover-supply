# Discover Supply App — Project Workspace

This is the central workspace for Discover Supply development.

## Project Structure

- **[apps/](apps/)**: Contains the main applications.
  - **[main/](apps/main/)**: The primary Next.js distribution management app.
  - **[store/](apps/store/)**: The B2B storefront application.
- **[tools/](tools/)**: Helper utilities and scripts.
  - **[import-scripts/](tools/import-scripts/)**: Data migration tools.
  - **[zoho-mcp/](tools/zoho-mcp/)**: Zoho Inventory MCP integration.
- **[data/](data/)**: Raw and processed project data.
  - **[imports/](data/imports/)**: Kyte CSV exports and other import sources.
  - **[assets/](data/assets/)**: Product images and other media.
- **[docs/](docs/)**: Documentation and architectural vision.
  - **[PROJECT_VISION.md](docs/PROJECT_VISION.md)**: The core system vision.

## Getting Started

To start the main application:
1. Navigate to `apps/main/`
2. Run `npm install`
3. Run `npm run dev`

Refer to the documentation in `docs/` for detailed architectural guidance.
