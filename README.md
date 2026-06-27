# Antigravity Stock Portfolio Analytics

A client-side, sandboxed personal stock portfolio tracker built with **Astro**, **React**, and **TailwindCSS**. It parses transaction files (CSV, Excel) completely in-browser and connects to active financial indexes to aggregate real-time metrics, platform allocations, and exposure diagnostics.

---

## 🎨 Design & Aesthetics
The application features a premium **Raspberry & Midnight** style:
* **Midnight Base Background**: Obsidian-charcoal grid layout (`#08090B` / `#0E1015`) framed by fine vertical hairline guidelines (`border-white/[0.025]`).
* **Active Neon Highlights**: High-saturation Neon Raspberry Hot Pink (`#FF0055`) accents representing active pills, button states, warning alerts, and graph trend lines.
* **Animated Backdrop**: A subtle, vector stock market graph SVG drawn dynamically onto the background backdrop when the page mounts.
* **Staggered Widget Entrances**: Staggered transition delays (`animate-slide-up`) applied to headings and panel sections so widgets float cleanly into view.
* **Glow Hover Cards**: Micro-interactions that scale visual hotspots (`+` indicators) and throw custom hot-pink border glows on `.cyber-card` or `.stone-card` panels when hovered.

---

## 🚀 Key Features
1. **In-Browser File Parsing**: Custom CSV and spreadsheet loaders mapping arbitrary columns (Ticker, Shares, Purchase Cost, Brokerage Platform) directly into React local states.
2. **Index Scrapers**: Dynamic price telemetry fetching real-time feeds directly from Google Finance endpoints or via Yahoo Finance CORS proxies.
3. **Exposure Diagnostics Console**: Real-time AI risk insights warning against high concentration index weights (exceeding 20% on any single asset) or platform custodial imbalances.
4. **Interactive Visualizations**: Beautiful Chart.js canvas elements displaying platform allocations (custodian share doughnut charts), portfolio weight limits (bar charts), and overall historical performance timelines.
5. **State-Based Double Confirmation Danger Zone**: A safe, two-step database purge control button that bypasses native sandboxed iframe dialog blocks (`window.confirm`) by prompting for clicks twice before cleaning browser state.

---

## 🛠️ Dev Setup & Commands

All standard commands are run from the project root directory:

| Command | Action |
| :--- | :--- |
| `npm install` | Installs dependencies |
| `npm run dev` | Boots up the Astro development server locally (defaults to `http://localhost:3001`) |
| `npm run build` | Bundles and builds static Astro assets into `./dist/` |
| `npm run preview` | Runs a local preview server targeting the build output |

### 🐳 Running with Docker
The app includes a fully configured `Dockerfile` and `docker-compose.yml` to build and serve the application within an isolated container:

1. **Build and Run Containers**:
   ```bash
   docker-compose up --build -d
   ```
2. **Stop Containers**:
   ```bash
   docker-compose down
   ```

---

## 📖 Step-by-Step Usage Guide

### Step 1: Onboarding Welcome Screen
1. When you first open the app (`http://localhost:3001/`), you'll land on the Onboarding Welcome Screen.
2. **Options to Initialize Data**:
   * **Explore with Demo Data**: Click **Run Seed Demo Data** to quickly pre-populate the dashboard with Apple (AAPL), Nvidia (NVDA), Tesla (TSLA), Reliance (RELIANCE.NS), and TCS (TCS.NS).
   * **Upload CSV / Spreadsheet**: Drag and drop your transaction manifest sheet or click **Drag File Here or Click to Mount** to upload `.csv` or `.xlsx` sheets from Groww, Zerodha, or other custodians.

### Step 2: Mapping Columns & finalization
1. If uploading custom sheets, map the parsed columns to the required attributes:
   * **Symbol / Ticker** (e.g., AAPL)
   * **Shares / Quantity** (e.g., 25)
   * **Purchase Price / Average Cost**
   * **Custodian / Platform** (e.g., Groww)
2. Review mapped data validation warnings, specify whether to **overwrite** or **merge** with existing caches, type an optional username, and click **Finalize & Open Dashboard**.

### Step 3: Navigating the HUD Dashboard
Once active, the dashboard page displays:
* **Hero Overview Panels**: View Total Invested Value, Live Present Value (synced to real-time price scrapers), Total P&L percentages, and Today's aggregate market change.
* **Holdings Ledger Table**: Expand asset ledger rows to reveal additional drawer metrics (Average Cost vs. Live price comparison gauges, total allocation weights, and platform tags).
* **Platform Custodian Allocations**: Visual cards listing total values and top assets grouped per broker/custodian.
* **Allocation Analytics**: Use the tabs at the bottom to toggle between **Custodian Doughnut Charts**, **Asset Concentration Bar charts**, and **Historical timelines**.

### Step 4: Settings & Database Purge
1. Click the **Gear icon** in the navigation bar to customize settings (Base currency formatting, precision decimal digits, colorblind palettes, or table grid density).
2. **Purging Data**:
   * To delete all uploaded transaction entries and reset client settings, click the **PURGE ACTIVE DATABASE** button in the Danger Zone.
   * The button will turn bright neon pink and request confirmation (`CONFIRM PURGE (CLICK AGAIN)`). Click it a second time within 4 seconds to finalize deletion.
