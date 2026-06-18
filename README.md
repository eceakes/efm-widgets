# EFM site widgets

Front-end widgets embedded on the Duda-hosted Eastern Festival of Music site,
served via jsDelivr so the per-page paste stays tiny.

## efm-portal — internal schedule portal (`/2026-portal`)

`efm-portal.css` + `efm-portal.js`, referenced from the portal page:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@COMMIT/efm-portal.css">
<div id="efm-portal" class="efmp">…markup…</div>
<script src="https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@COMMIT/efm-portal.js"></script>
```

Data loads live from the published "DRAFT Master Calendar" Google Sheet. Tabs are
resolved by **name** from the published `/pubhtml` directory, so the widget keeps
working when the sheet is rebuilt (tab gids change on rebuild; names don't).

### Optional `Config` tab (drives the audience tabs without code changes)

Add a tab named **Config** to the same spreadsheet. Header row, then one row per
sub-tab:

| TabId | TabLabel | SubLabel | Kind | Args |
|-------|----------|----------|------|------|
| students | Students | Today | today | ESO,GSO |
|  |  | ESO Schedule | ensemble | ESO |

- **TabId** — stable id for the top tab; leave blank to continue the previous tab.
- **TabLabel** — shown on the top tab (read from its first row).
- **SubLabel** — shown on the sub-tab.
- **Kind** — `today` | `ensemble` | `allEnsembles` | `type` | `jump` | `roomsToday`.
- **Args** — `today`: comma-separated ensemble codes (blank = everyone); `ensemble`:
  one code; `type`: the exact Type value; `jump`: the TabId to jump to. Blank for
  `allEnsembles` / `roomsToday`.

Per-room sub-tabs are appended automatically to whichever tab has a `roomsToday`
view. If the Config tab is absent or unparseable, the widget uses its built-in nav.

### Updating the code
jsDelivr URLs are pinned to a commit SHA (immutable). After pushing a change, bump
the `@COMMIT` in the embed to the new SHA. Schedule content and the nav (Config tab)
live in the sheet, so code edits should be rare.
