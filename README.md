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
- **The Google Sheet stays a plain set of calendars/tables.** All tab structure
  and routing live in `efm-portal.js` (the `NAV` and `SOURCES` arrays). Tabs are
  resolved by **name** from the published `/pubhtml` directory, so the widget keeps
  working when the sheet is rebuilt (gids change; names don't).
- **A scrolling announcements banner** sits under the search box. It shows the
  announcement whose `Date` matches today; any row whose `Logic` = `Today Override`
  replaces it. Pause-on-hover + a pause button + a reduced-motion fallback.
- **Every schedule row opens an accessible details modal** (focus-trapped, Esc to
  close) showing its fields plus the `Details` column.

### Sheet tabs read (all optional except Master Calendar; missing/empty = graceful)
| Tab | Used for |
|-----|----------|
| `Master Calendar` | the schedule (add a rightmost `Details` column for modal text) |
| `Legend` | ensemble + room code names |
| `Announcements` | `Announcement Text · Date · Logic` (Logic dropdown incl. `Today Override`) → banner + Announcements tab |
| `General Information` | free-form text → General Information tab (rendered as headings/paragraphs) |
| `Counselors` | `Name · Title · Phone · Email` → listed on the General Information tab |
| `Outreach Concerts` | `Concert Title · Location · Date · Time · Details` → Fellows ▸ Outreach Concerts |
| `Student Chamber Rehearsal Schedules` | `Group Name · Date · Time · Location · Details` → Students ▸ Chamber Music |
| `Fellow Chamber Music Rehearsal Schedules` | same shape → Fellows ▸ Chamber Music |
| `Lesson Schedules` | `Faculty · Day · Time · Location · Details` → Lesson Schedules tab (grouped by faculty) |

### Editing
- **Content:** edit the relevant sheet tab — appears live.
- **Tabs / routing / styling:** edit `efm-portal.js` / `efm-portal.css`, push, then bump
  the two `@COMMIT` refs in the page's embed block to the new commit SHA.

## efm-faculty — faculty roster

`efm-faculty.css` + `efm-faculty.js`, referenced from the faculty page:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@COMMIT/efm-faculty.css">
<div id="efm-faculty" class="efmf">…markup…</div>
<script src="https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@COMMIT/efm-faculty.js"></script>
```

Reads the faculty Google Sheet (gviz CSV) by **header name** — each column is
matched against a wide alias list, so you can add / remove / reorder / rename
columns freely. Columns: `Name · Role · Section · Photo · Link · Bio ·
Affiliations · Website`. Falls back to a built-in roster if the sheet can't
load, so the page is never blank. Edit code → push → bump the two `@COMMIT`
refs in the embed.

jsDelivr URLs are pinned to an immutable commit SHA, so a bad edit can never
silently change the live page.
