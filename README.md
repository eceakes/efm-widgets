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

### Where things live
- **The Google Sheet stays a plain calendar.** It holds only the schedule
  (Date, Day, Time, Room, Location, Ensemble, Conductor/Soloist, Type, Event)
  plus a `Legend` tab. No config or logic in the sheet.
- **All tab structure and routing live in `efm-portal.js`** (this hosted file).
  The `NAV` array defines the tabs; the filtering distributes each calendar row
  to the right tab using the calendar's own `Ensemble` / `Type` / `Room` columns.
- Tabs are resolved by **name** from the published `/pubhtml` directory, so the
  widget keeps working when the sheet is rebuilt (tab gids change; names don't).

### Editing
- **Schedule content:** edit the calendar rows in the sheet — appears live.
- **Tabs / routing:** edit the `NAV` array in `efm-portal.js`, push, then bump
  the two `@COMMIT` refs in the page's embed block to the new commit SHA.

jsDelivr URLs are pinned to an immutable commit SHA, so a bad edit can never
silently change the live page.
