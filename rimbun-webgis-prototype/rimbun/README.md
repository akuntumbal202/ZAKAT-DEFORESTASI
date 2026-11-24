# Rimbun — Reforestation Crowdfunding WebGIS (Phase 1 prototype)

> Explore Deforestation. Fund Restoration. Measure Environmental Impact.

Frontend prototype only. **All programs, figures, transactions and impact numbers are mock/illustrative.** There is no backend, no payment gateway and no spatial data yet. The map area is an intentional placeholder.

"Rimbun" is a working name; change it in `src/config/site.ts`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
```

Demo account: click **"Coba akun demo"** on the login page (`demo@rimbun.id` / `demo1234`). The demo account comes with sample donation history.
State (accounts, donations, favourites) is stored in `localStorage` (key `rimbun.v1`). Use **Footer → Reset data simulasi** to clear it.

## Stack & rationale

| Choice | Why |
|---|---|
| React 19 + TypeScript + Vite | Fast dev server, simple static deploy, easy to move to Next.js later if SSR/SEO is needed |
| Plain CSS + design tokens (`src/styles/tokens.css`) | Full visual control, no utility-class noise, zero runtime deps |
| Custom SVG icons & charts | Runtime deps are only `react` + `react-dom`; swap in `lucide-react` / Recharts later without changing call sites |
| Tiny hash router (`src/router`) | Works on any static host; replace with react-router when needed |

Typography: **Fraunces** (display) + **Geist** (UI, body, numbers with tabular figures).
Palette: forest greens, warm paper neutrals, clay (urgency) and ochre (funding/simulation markers).

## Structure

```
src/
  config/        site name, quick amounts, projection periods
  types/         domain types (RestorationProject, SiteAttributes, Donation, …)
  data/mock/     ← the ONLY place mock data lives
    projects.ts        program/funding info (fictional)
    siteAttributes.ts  stand-in for the SHP/GPKG attribute table (no geometry)
    species.ts, transparency.ts, users.ts
  services/      data access layer (swap mock → API/Supabase here)
    projectService.ts  builds ProjectView = program + live funding + site attributes
    siteService.ts     site attributes by project_id (setSiteAttributeSource for real data)
    donationService.ts / authService.ts  simulated, clearly labelled
    statsService.ts    platform + transparency aggregates (always derived)
  lib/impact/    impact model — pure functions, separate from UI
    assumptions.ts     PLACEHOLDER coefficients + method notes
    impactModel.ts     donationToImpact(), impactToDonation()
  map/           future map integration
    MapView.tsx        props already shaped for GeoJSON + polygon click
    MapPlaceholder.tsx empty canvas, legend & controls (disabled)
    types.ts           GeoJSON types, FEATURE_JOIN_KEY = 'project_id', MapEngineAdapter
    joinFeatures.ts    checkJoin() to validate ids between polygons and programs
    README.md          MapLibre wiring plan
  store/         AppStore (context + reducer + localStorage), auth-gated actions
  router/        hash router, typed path builders `to.*`
  components/    ui/ (Button, Field, Modal, Tabs, Badge, Feedback, Icon), charts/,
                 project/ (ProjectCard, ProjectDetailSidebar, DonationProgress, SpeciesCard, SiteVisual),
                 donation/DonationModal, impact/EnvironmentalImpactCalculator, StatisticsCard
  layouts/       PublicLayout (nav/footer), DashboardLayout, AuthLayout
  pages/         Home, ExploreMap, Programs, ProjectDetail, Calculator, Transparency, About,
                 Auth (login/register/forgot), DonationSuccess, dashboard/*, NotFound
  styles/        tokens → base → components → domain → pages
```

## Data architecture

Two sources, one join key:

```
SHP/GPKG feature ──properties.project_id──┐
                                          ├──► ProjectView ──► UI
RestorationProject (program, funding) ─id─┘
```

- Spatial attributes (`SiteAttributes`) and program/funding info (`RestorationProject`) are kept apart. Funding never needs geometry, and the map never needs funding.
- Every program has a unique `id` (e.g. `RB-001`) that matches `project_id` on the polygon.
- Clicking a polygon will call the same `onSelect(projectId)` that the mock list on Explore Map uses today, so `ProjectDetailSidebar` is already wired.

## Plugging in real data (Phase 2)

1. Convert: `ogr2ogr -f GeoJSON -t_srs EPSG:4326 sites.geojson sites.gpkg`. Each feature needs `properties.project_id`.
2. Map the attribute columns to `SiteAttributes` and call `setSiteAttributeSource(rows)`. Delete `data/mock/siteAttributes.ts`.
3. `npm i maplibre-gl`, implement `MapEngineAdapter` (see `src/map/README.md`), and render it in `MapView` when `features` is non-null.
4. Replace `lib/impact/assumptions.ts` (or the whole `impactModel.ts`) with a validated methodology. The UI does not change.
5. Replace simulated services with real ones (e.g. Supabase auth/DB, payment through the ZISWAF partner).

## Not included (by design)

Backend/database, real auth, payment gateway, admin dashboard, spatial processing, external APIs.
