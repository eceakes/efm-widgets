/* ============================================================
   EFM 2026 Schedule Portal — behavior
   Hosted externally and referenced from the portal page:
     <link rel="stylesheet" href=".../efm-portal.css">
     <div id="efm-portal" class="efmp"> ... </div>
     <script src=".../efm-portal.js"></script>

   Data source: the published "DRAFT Master Calendar" Google Sheet.
   Tabs are resolved by NAME from the published /pubhtml directory, so the
   widget keeps working after the sheet is rebuilt (gids change; names don't).

   ALL tab structure + routing lives here, in this hosted file — the spreadsheet
   stays plain, human-friendly tabs. The NAV array defines the tabs; the
   renderers distribute each row to the right view using the sheet's own columns.
   To change tabs: edit NAV / SOURCES here, push, then bump the @<sha> in the
   page's embed block.

   Tabs read (all optional except Master Calendar; missing/empty -> graceful):
     Master Calendar, Legend, Announcements, General Information, Staff List,
     Outreach Concerts
   ============================================================ */
(function () {
  var PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQg7mhQsWCaOdsg1k_z-TkSHRqNDTuAQE7NEXr6xzCBR-psxMoQGExmVlINpF-xu_3FIgbE4qSK1aAJ";
  var CSV = PUB + "/pub?output=csv";   // bare CSV = the document's first (left-most) tab
  var PUBHTML = PUB + "/pubhtml";       // published tab directory: maps tab name -> gid
  // Faculty-Portal workbook (same one the faculty portal reads). Its "FacultyContact"
  // tab (gid 0, leftmost) is the single source of truth for faculty emails; fetched
  // here so the student Faculty directory shows the same contacts with no duplicate sheet.
  var FP_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZk_YQ_WA4LsSFN_jv7HHlZwDS9UHrZvLrk7NoOV4czo6KBG_36pt0ymOUDwabyFhqXvX_GSXcgBDx/pub?single=true&output=csv&gid=";
  // 2026 Faculty roster (same sheet the public Faculty page + faculty portal use):
  // supplies headshots + section grouping. gviz primary (CORS-clean), publish-CSV fallback.
  var ROSTER_CSV = "https://docs.google.com/spreadsheets/d/1PuagTf2lB19eRNRmbaUdYzKytzoLCQ6PsRrgBAxvPTw/gviz/tq?tqx=out:csv&gid=1338599143";
  var ROSTER_CSV_FALLBACK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlBTW1VcRV6-cDZfm9ibRqo23_c1BAvMRfC3eoTj502VrUaxov7OsDY6anYA7a8akD8bz9IfCCDJ3i/pub?gid=1338599143&single=true&output=csv";
  // Faculty section heading order, mirroring the public Faculty page.
  var SECTION_ORDER = ["Conductors", "Flute", "Oboe", "Clarinet", "Bassoon", "French Horn", "Trumpet", "Trombone", "Tuba", "Percussion & Timpani", "Harp", "Piano", "Violin", "Viola", "Cello", "Double Bass"];
  var TAB_CALENDAR = "Master Calendar"; // looked up by NAME (gids change on rebuild)
  var TAB_LEGEND = "Legend";
  var YEAR = 2026;

  // Live subscribe feed (Google Apps Script web app; see efm-calendar-feed.gs).
  // Set to "" to hide the one-click Subscribe options and offer downloads only.
  var SUBSCRIBE_BASE = "https://script.google.com/macros/s/AKfycbz6fh9qP2zQnaRfzV2qW0dndtwUrhXahOLuxxDmibCxqPaQOlW-_D98EUpUlWkAY07tFA/exec";
  // portal ensemble code -> feed ?view= key (only these views have a live feed)
  var FEED_VIEWS = { ESO: "eso", GSO: "gso", EFO: "efo", REP: "rep", ECP: "ecp" };

  // Campus map assets sit next to this script in the repo. Derive the CDN base
  // from this script's own URL, so the map always matches the deployed commit
  // (no separate SHA to bump). Falls back to @main if loaded some other way.
  var CDN_BASE = (function () {
    var s = (document.currentScript && document.currentScript.src) || "";
    var m = s.match(/^(.*\/efm-widgets@[^/]+\/)/);
    return m ? m[1] : "https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@main/";
  })();
  var MAP_IMAGE_URL = CDN_BASE + "efm-campus-map.jpg";
  var MAP_PDF_URL = CDN_BASE + "efm-campus-map.pdf";

  // Student Handbook is hosted on the main EFM website's CDN (not this repo), so
  // it is an absolute URL rather than one derived from CDN_BASE. Update here if
  // the handbook is re-posted to a new URL.
  var HANDBOOK_URL = "https://irp.cdn-website.com/1e6f3c7e/files/uploaded/2026+Student+Handbook.pdf";

  // Tabs to fetch: key -> sheet tab name + known gid. calendar is required. gid is
  // tried first (fast path, keeps the directory round-trip off the critical path);
  // the name is the fallback when a sheet rebuild moves gids (resolved in run()).
  var SOURCES = [
    { key: "calendar", tab: TAB_CALENDAR, gid: "310873840", required: true },
    { key: "legend", tab: TAB_LEGEND, gid: "578774100" },
    { key: "announcements", tab: "Announcements", gid: "1387308195" },
    { key: "generalInfo", tab: "General Information", gid: "1031874194" },
    { key: "lessons", tab: "Faculty Lesson Locations", gid: "1473494961" },
    { key: "staff", tab: "Staff List", gid: "945898419" },
    { key: "placement", tab: "Placement Auditions", gid: "1024060038" },
    { key: "sectionals", tab: "Sectional Rehearsals", gid: "436439129" },
    { key: "studio", tab: "Faculty Studio Classes", gid: "166720750" },
    { key: "concerto", tab: "Concerto Competition", gid: "1210854934" },
    // Student-Rosters tab: per-ensemble seating-roster PDFs, gated by a Release? cell.
    { key: "rosters", tab: "Student-Rosters", gid: "2066588541" },
    // Dedicated ESO/GSO tabs (lean layout: Date, Day, Time, Room, Room Name,
    // Conductor / Soloist, Event, Details, [PDF Link]). The big "Master Calendar"
    // tab leaves Details/PDF blank for ESO/GSO rows, so we join them in by NAME
    // off these tabs (see parseEnsembleDetails + parseCalendar).
    { key: "esoDetails", tab: "ESO", gid: "1603346554" },
    { key: "gsoDetails", tab: "GSO", gid: "727646847" }
  ];

  // Fallback room names if the Legend sheet can't be fetched/parsed.
  var ROOM_NAMES = {
    C: "Choir Room", CC: "South Apt. Community Center", CO: "The Cottage",
    CR: "Carnegie Room (Hege Library)", HL: "Hege Library", D: "Dana Auditorium",
    MR: "Moon Room", S: "Sternberger Auditorium", Var: "Various Locations"
  };
  var ROOM_ORDER = ["D", "S", "MR", "CR", "C", "CC", "HL", "CO", "Var"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  // ---- navigation model -------------------------------------------------
  // Tab order (left -> right). NAV[0] is also the default tab shown on load.
  // NAV is rebuilt from this template at the start of every build() (cloneNav), so
  // the SWR cache->fresh double-build never duplicates appended room tabs.
  var NAV_TEMPLATE = [
    { id: "info", label: "General Information", subs: [
      { label: "Dining", kind: "dining" },
      { label: "Around Campus", kind: "aroundCampus" },
      { label: "People", kind: "people" },
      { label: "Student Handbook", kind: "handbook" } ] },
    { id: "calendar", label: "Calendar", subs: [
      { label: "Today", kind: "today", codes: ["ESO", "GSO"] },
      { label: "ESO Schedule", kind: "ensemble", code: "ESO", weeks: true },
      { label: "GSO Schedule", kind: "ensemble", code: "GSO", weeks: true },
      { label: "All Concerts", kind: "type", value: "Concert / Performance" } ] },
    // ESO/GSO Schedule carry weeks:true: when selected, the released seating-roster
    // weeks from the Student-Rosters sheet appear as a third-level subnav (renderNav),
    // and choosing one shows that week's roster (PDF + that cycle's services).
    // One grouped tab; the four info pages are sub-tab pills. A pill carrying
    // showWhen appears only if that tab's Show/Hide cell says "Yes" (build()).
    { id: "programs", label: "Auditions & Classes", subs: [
      { label: "Placement Auditions", kind: "infoTab", source: "placement", showWhen: "placement" },
      { label: "ESO Sectionals", kind: "sectional", code: "ESO" },
      { label: "GSO Sectionals", kind: "sectional", code: "GSO" },
      { label: "Studio Classes", kind: "infoTab", source: "studio" },
      { label: "Lessons", kind: "lessons" },
      { label: "Concerto Competition", kind: "infoTab", source: "concerto", showWhen: "concerto" } ] },
    { id: "map", label: "Campus Map", subs: [
      { label: "Map", kind: "map" } ] },
    { id: "rooms", label: "Room Schedule", subs: [
      { label: "Today", kind: "roomsToday" } ] }  // room tabs appended after data loads
  ];
  function cloneNav() { return JSON.parse(JSON.stringify(NAV_TEMPLATE)); }
  var NAV = cloneNav();

  // ---- helpers ------------------------------------------------------------
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else { field += c; }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  // Strip zero-width / bidi control chars Google Sheets sometimes injects, then trim.
  function clean(s) { return String(s == null ? "" : s).replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").trim(); }

  function tokens(s) {
    return s.split("/").map(function (t) { return t.trim(); }).filter(Boolean);
  }

  // First H:MM clock token, meridiem-agnostic. Joins the lean ESO/GSO tabs
  // (times read "2:00 – 5:00") onto Master Calendar rows ("2:00 PM - 5:00 PM"):
  // within a day+ensemble the start clock is unique, so AM/PM isn't needed.
  function clockKey(t) { var m = String(t == null ? "" : t).match(/(\d{1,2})(?::(\d{2}))?/); return m ? (m[1] + ":" + (m[2] || "00")) : ""; }

  // Scheme-safe URL gate for a sheet-supplied link (PDF program, etc.). Blocks
  // javascript:/data:/vbscript:; allows http(s)/mailto, relative, bare domains.
  function safeUrl(u) {
    u = clean(u);
    if (!u) return "";
    if (/^(javascript|data|vbscript):/i.test(u)) return "";
    if (/^(https?:|mailto:|\/|\.\/|\.\.\/|#)/i.test(u)) return u;
    if (/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://" + u;
    return "";
  }

  // Label for an event's attached PDF: concerts get a program, rehearsals get a
  // rehearsal order. Keys off the Master Calendar Type ("Concert / Performance"
  // vs "Rehearsal"), falling back to the event text and then a generic label.
  function pdfLabel(r) {
    var hay = ((r.type || "") + " " + (r.event || "")).toLowerCase();
    if (/concert|perform|recital/.test(hay)) return "View Program";
    if (/rehearsal|sectional/.test(hay)) return "View Rehearsal Order";
    return "View PDF";
  }

  // Parse a header-row table into objects keyed by header name.
  function tableObjects(rows) {
    if (!rows || !rows.length) return { headers: [], items: [] };
    var headers = rows[0].map(function (h) { return (h || "").trim(); });
    var items = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r.join("").trim()) continue;
      var o = {};
      headers.forEach(function (h, idx) { o[h] = (r[idx] || "").trim(); });
      items.push(o);
    }
    return { headers: headers, items: items };
  }

  var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  // Sortable key for "Jun 22" / "June 22" / "Jul 1" AND "6/27/2026" / "7/1".
  function dateKey(str) {
    var s = (str || "").trim();
    var m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})/);
    if (m) {
      var k3 = m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase();
      if (k3 in MONTHS) return (MONTHS[k3] + 1) * 100 + parseInt(m[2], 10);
    }
    var n = s.match(/^(\d{1,2})\/(\d{1,2})/);
    if (n) {
      var mo = parseInt(n[1], 10), d = parseInt(n[2], 10);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return mo * 100 + d;
    }
    return null;
  }
  function todayKey() {
    var now = new Date();
    if (now.getFullYear() !== YEAR) return null;  // outside festival year
    return (now.getMonth() + 1) * 100 + now.getDate();
  }
  function monthAbbr(key) { return key !== null ? MONTH_NAMES[Math.floor(key / 100) - 1].slice(0, 3) : ""; }
  function roomLabel(code) { return ROOM_NAMES[code] || code; }

  // Start time in minutes since midnight, for chronological sorting.
  // Handles the sheet's mixed formats: "8:00 AM", "7:30 - 8:30am",
  // "5:30:00 PM - 6:45 pm", "10:00-12:00", bare "7:30", etc.
  function startMinutes(time) {
    var s = (time || "").trim();
    var m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?:[:.]\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!m || !m[1]) return -1;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0;
    if (h > 23 || min > 59) return -1;
    var mer = m[3] ? m[3].charAt(0).toLowerCase() : null;
    if (!mer) {
      var em = s.slice(m[0].length).match(/(am|pm|a\.m\.|p\.m\.)/i);
      if (em) mer = em[1].charAt(0).toLowerCase();
      if (mer === "p" && h >= 8 && h <= 11) mer = "a";
    }
    if (!mer) mer = (h >= 8 && h <= 11) ? "a" : "p";  // festival-day heuristic
    if (h === 12) h = 0;
    return (h + (mer === "p" ? 12 : 0)) * 60 + min;
  }

  // ---- iCalendar (.ics) export -------------------------------------------
  // A snapshot download built entirely in the browser from the parsed rows.
  // Each export carries the events currently shown (tab + sub-tab + search);
  // each event modal can also download just that one event. Times are local
  // (floating, no timezone) so a calendar shows exactly the listed clock time.
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  // Sheet times are freeform: "8:00 AM", "7:30 - 8:30am", "10:00-12:00",
  // "5:30 PM - 6:45 pm", bare "7:30"; blank/garbage -> all-day.
  function timeRange(timeStr) {
    var s = (timeStr || "").trim();
    if (!s) return { allDay: true };
    var start = startMinutes(s);                 // full string -> robust meridiem
    if (start < 0) return { allDay: true };
    var end = null;
    var parts = s.split(/\s*(?:–|—|-|\bto\b)\s*/i);
    if (parts.length > 1) {
      var e = startMinutes(parts[parts.length - 1]);
      if (e >= 0) {
        end = e;
        // an end with no am/pm of its own that lands before the start -> next half-day
        if (end < start && !/[ap]\.?\s*m/i.test(parts[parts.length - 1])) end += 720;
        if (end > 1439) end = 1439;
      }
    }
    return { allDay: false, start: start, end: end };
  }
  function icsDate(dateStr) {
    var key = dateKey(dateStr);
    if (key === null) return null;
    return { y: YEAR, m: Math.floor(key / 100), d: key % 100 };
  }
  function icsFmtDate(p) { return "" + p.y + pad2(p.m) + pad2(p.d); }
  function icsFmtDateTime(p, min) {
    return icsFmtDate(p) + "T" + pad2(Math.floor(min / 60)) + pad2(min % 60) + "00";
  }
  function icsNextDay(p) {
    var dt = new Date(p.y, p.m - 1, p.d + 1);
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }
  function icsEsc(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }
  function icsUID(ev) {
    var basis = [ev.title, ev.dateStr, ev.timeStr, ev.location].join("|");
    var h = 0;
    for (var i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) | 0;
    return "efm-" + (h >>> 0).toString(36) + "@easternfestivalofmusic.org";
  }
  function icsStampUTC() {
    var d = new Date();
    return "" + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) +
      "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
  }
  function vevent(ev, stamp) {
    var p = icsDate(ev.dateStr);
    if (!p) return null;                          // unparseable date -> skip
    var t = timeRange(ev.timeStr), lines = ["BEGIN:VEVENT", "UID:" + icsUID(ev), "DTSTAMP:" + stamp];
    if (t.allDay) {
      lines.push("DTSTART;VALUE=DATE:" + icsFmtDate(p));
      lines.push("DTEND;VALUE=DATE:" + icsFmtDate(icsNextDay(p)));
    } else {
      var end = (t.end !== null && t.end > t.start) ? t.end : Math.min(t.start + 60, 1439);
      lines.push("DTSTART:" + icsFmtDateTime(p, t.start));
      lines.push("DTEND:" + icsFmtDateTime(p, end));
    }
    lines.push("SUMMARY:" + icsEsc(ev.title || "Event"));
    if (ev.location) lines.push("LOCATION:" + icsEsc(ev.location));
    if (ev.description) lines.push("DESCRIPTION:" + icsEsc(ev.description));
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  }
  function buildICS(events, calName) {
    var stamp = icsStampUTC();
    var body = events.map(function (e) { return vevent(e, stamp); }).filter(Boolean);
    if (!body.length) return null;
    return ["BEGIN:VCALENDAR", "VERSION:2.0",
      "PRODID:-//Eastern Festival of Music//Schedule Portal//EN",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:" + icsEsc(calName || "EFM Schedule")]
      .concat(body, ["END:VCALENDAR"]).join("\r\n") + "\r\n";
  }
  function icsSlug(s) {
    return (String(s || "schedule").replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 60)) || "schedule";
  }
  function downloadICS(events, label) {
    var text = buildICS(events, "EFM " + (label || "Schedule"));
    if (!text) return;
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "EFM-" + icsSlug(label) + ".ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  // Google Calendar "add event" template link (single event; Google has no
  // bulk-add URL). Times are sent as local with an explicit Eastern tz.
  function gcalUrl(ev) {
    var p = icsDate(ev.dateStr);
    if (!p) return null;
    var t = timeRange(ev.timeStr), dates;
    if (t.allDay) {
      dates = icsFmtDate(p) + "/" + icsFmtDate(icsNextDay(p));   // end exclusive
    } else {
      var end = (t.end !== null && t.end > t.start) ? t.end : Math.min(t.start + 60, 1439);
      dates = icsFmtDateTime(p, t.start) + "/" + icsFmtDateTime(p, end);
    }
    var q = ["action=TEMPLATE", "text=" + encodeURIComponent(ev.title || "Event"),
      "dates=" + dates, "ctz=America/New_York"];
    if (ev.location) q.push("location=" + encodeURIComponent(ev.location));
    if (ev.description) q.push("details=" + encodeURIComponent(ev.description));
    return "https://calendar.google.com/calendar/render?" + q.join("&");
  }
  // Live subscribe links (auto-updating) for a feed ?view= key.
  function feedUrl(viewKey) { return SUBSCRIBE_BASE + (viewKey ? "?view=" + encodeURIComponent(viewKey) : ""); }
  function webcalUrl(viewKey) { return feedUrl(viewKey).replace(/^https?:\/\//i, "webcal://"); }
  function gcalSubscribeUrl(viewKey) {
    return "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(webcalUrl(viewKey));
  }
  function updateICSButton() {
    if (icsBtn) icsBtn.hidden = viewEvents.length === 0;
  }

  // ---- state --------------------------------------------------------------
  var allRows = [];
  var built = false;       // true once the full build() has run (gates the early first-paint)
  var seenRooms = {};
  var announcements = [];  // { text, dateRaw, key, logic }
  var generalInfo = [];    // raw lines
  var lessons = [];        // [{ instrument, people:[{name, room}] }] from the "Faculty Lesson Locations" tab
  var staff = [];          // [{ dept, people:[{name,title,contact,office}] }] from the "Staff List" tab
  var facultyDir = [];     // [{name, last, instrument, email}] from the Faculty-Portal FacultyContact tab
  var modalData = [];      // rebuilt each renderList; index referenced by row data-mi
  var viewEvents = [];     // normalized {title,dateStr,timeStr,location,description} for the current view's .ics
  var viewLabel = "";      // label for the current view's .ics calendar name + filename
  var viewFeedKey = "";    // feed ?view= key for the current view ("" = no live subscribe feed)
  var infoTabs = {};       // source key -> raw rows for the info tabs (placement/sectionals/studio/concerto)
  var sectionalLocations = []; // [{section, room}] from the Sectional Rehearsals tab, piped into sectional event modals
  var sectionalData = null;    // parsed Sectional Rehearsals: { eso, gso, perc, locations, esoCoaches, gsoCoaches }
  var ensDetail = {};          // "dateKey|ENS|clock" -> { details, pdf } joined from the dedicated ESO/GSO tabs
  var rostersAll = [];         // [{title, link, release}] from the Student-Rosters tab
  var rosterWeeks = [];        // released, well-formed roster weeks: [{code, week, title, link}]
  var ensAnchors = {};         // ensemble code -> { cycleN: dateKey }, for roster service windows

  var topSel = NAV[0].id;
  var subSel = {};  // topId -> sub index
  NAV.forEach(function (t) { subSel[t.id] = 0; });
  var weekSel = null;  // selected roster-week index within the active ESO/GSO Schedule, or null = full schedule
  var peopleView = "faculty";   // People tab third-level view: "faculty" | "staff"
  var PEOPLE_VIEWS = [{ label: "Faculty", key: "faculty" }, { label: "Staff", key: "staff" }];

  var root, topnav, subnav, subnav2, list, status, banner, searchBox, controls, ticker, modal, icsBtn, srLive, lastFocus;

  function currentTop() {
    for (var i = 0; i < NAV.length; i++) if (NAV[i].id === topSel) return NAV[i];
    return NAV[0];
  }

  // ---- filtering (calendar / room views) ----------------------------------
  function todayRows(codes) {
    var tk = todayKey();
    var keys = allRows.map(function (r) { return r.key; });
    var bannerMsg = "";
    var useKey = tk;
    if (tk === null || keys.indexOf(tk) === -1) {
      var future = allRows.filter(function (r) { return tk !== null && r.key !== null && r.key >= tk; });
      useKey = future.length ? future[0].key : (allRows.length ? allRows[0].key : null);
      var sample = allRows.filter(function (r) { return r.key === useKey; })[0];
      if (sample) bannerMsg = "No events scheduled today. Showing the next scheduled day: " + sample.date + ".";
    }
    var rows = allRows.filter(function (r) {
      if (r.key !== useKey) return false;
      if (codes === null) return true;
      if (r.ensTokens.length === 0) return true;
      return r.ensTokens.some(function (t) { return codes.indexOf(t) !== -1; });
    });
    return { rows: rows, banner: bannerMsg, singleDay: true };
  }

  function rowsForSub(sub) {
    if (sub.kind === "today") return todayRows(sub.codes);
    if (sub.kind === "ensemble")
      return { rows: allRows.filter(function (r) { return r.ensTokens.indexOf(sub.code) !== -1; }), banner: "" };
    if (sub.kind === "allEnsembles")
      return { rows: allRows.filter(function (r) { return r.ensTokens.length > 0; }), banner: "" };
    if (sub.kind === "type")
      return { rows: allRows.filter(function (r) { return r.type === sub.value; }), banner: "" };
    if (sub.kind === "room")
      return { rows: allRows.filter(function (r) { return r.roomTokens.indexOf(sub.code) !== -1; }), banner: "" };
    if (sub.kind === "roomsToday") {
      var t = todayRows(null);
      var roomed = t.rows.filter(function (r) { return r.roomTokens.length > 0; });
      roomed.sort(function (a, b) {
        var ai = ROOM_ORDER.indexOf(a.roomTokens[0]), bi = ROOM_ORDER.indexOf(b.roomTokens[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.seq - b.seq;
      });
      return { rows: roomed, banner: t.banner, groupByRoom: true, singleDay: true };
    }
    return { rows: [], banner: "" };
  }

  // ---- rendering ------------------------------------------------------------
  // The released roster weeks for an ESO/GSO Schedule sub (weeks:true), sorted by
  // week number. Empty for any other sub, so the third-level nav stays hidden.
  function weeksFor(sub) {
    if (!sub || !sub.weeks || !sub.code) return [];
    return rosterWeeks.filter(function (w) { return w.code === sub.code; })
      .sort(function (a, b) { return a.week - b.week; });
  }

  function renderNav() {
    topnav.innerHTML = "";
    NAV.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t.label;
      var on = t.id === topSel;
      b.className = on ? "efmp-active" : "";
      if (on) b.setAttribute("aria-current", "true");   // announces the selected section to screen readers
      b.onclick = function () { topSel = t.id; renderNav(); renderList(); };
      topnav.appendChild(b);
    });
    var top = currentTop();
    subnav.innerHTML = "";
    top.subs.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      var on = (s.kind !== "jump" && i === subSel[top.id]);
      b.className = on ? "efmp-active" : "";
      if (on) b.setAttribute("aria-current", "true");
      b.onclick = function () {
        if (s.kind === "jump") { topSel = s.target; renderNav(); renderList(); return; }
        subSel[top.id] = i; weekSel = null; renderNav(); renderList();
      };
      subnav.appendChild(b);
    });
    // Third level: a selected ESO/GSO Schedule pill (weeks:true) reveals its
    // released roster weeks. Clicking a week shows that week's roster; clicking the
    // active week again toggles back to the full ensemble schedule.
    if (subnav2) {
      subnav2.innerHTML = "";
      var activeSub = top.subs[subSel[top.id]];
      var weeks = weeksFor(activeSub);
      if (weeks.length) {
        subnav2.hidden = false;
        weeks.forEach(function (w, i) {
          var b = document.createElement("button");
          b.type = "button"; b.textContent = "Week " + w.week;
          var on = i === weekSel; b.className = on ? "efmp-active" : "";
          if (on) b.setAttribute("aria-current", "true");
          b.onclick = function () { weekSel = (weekSel === i ? null : i); renderNav(); renderList(); };
          subnav2.appendChild(b);
        });
      } else if (activeSub && activeSub.kind === "people") {
        // People -> third-level Faculty | Staff pills.
        subnav2.hidden = false;
        PEOPLE_VIEWS.forEach(function (v) {
          var b = document.createElement("button");
          b.type = "button"; b.textContent = v.label;
          var on = v.key === peopleView; b.className = on ? "efmp-active" : "";
          if (on) b.setAttribute("aria-current", "true");
          b.onclick = function () { peopleView = v.key; renderNav(); renderList(); };
          subnav2.appendChild(b);
        });
      } else {
        subnav2.hidden = true;
      }
    }
  }

  // Build one agenda row. opts: { big, small, title, when:[], chips:[{label,ens}], modal }
  // Passing a modal object makes the row a focusable button that opens the modal.
  function agendaRowHTML(o) {
    var cls = "efmp-row", attrs = "";
    if (o.modal) {
      var idx = modalData.push(o.modal) - 1;
      cls += " efmp-row--clickable";
      attrs = ' data-mi="' + idx + '" role="button" tabindex="0" aria-haspopup="dialog"';
    }
    var dateBlock = (o.big || o.small)
      ? '<div class="efmp-row__date">' + (o.big ? "<b>" + esc(o.big) + "</b>" : "") +
          (o.small ? "<span>" + esc(o.small) + "</span>" : "") + "</div>"
      : "";
    var when = (o.when || []).filter(Boolean).map(esc).join(" &#183; ");
    var chips = (o.chips || []).map(function (c) {
      return '<span class="efmp-chip' + (c.ens ? " efmp-chip--ens" : "") + '">' + esc(c.label) + "</span>";
    }).join("");
    return '<div class="' + cls + '"' + attrs + ">" +
      dateBlock +
      '<div class="efmp-row__info"><div class="efmp-row__title">' + esc(o.title || "(untitled)") + "</div>" +
        (when ? '<div class="efmp-row__when">' + when + "</div>" : "") + "</div>" +
      (chips ? '<div class="efmp-row__meta">' + chips + "</div>" : "") +
      (o.modal ? '<span class="efmp-row__more" aria-hidden="true">…</span>' : "") +
    "</div>";
  }

  // Polite screen-reader announcement (debounced so fast typing doesn't chatter).
  var _annT;
  function announce(msg) {
    if (!srLive) return;
    clearTimeout(_annT);
    _annT = setTimeout(function () { srLive.textContent = ""; srLive.textContent = String(msg || ""); }, 300);
  }

  function finishList(html, shown, bannerMsg, emptyMsg) {
    banner.hidden = !bannerMsg;
    banner.textContent = bannerMsg || "";
    list.innerHTML = html;
    var msg = shown ? "" : (emptyMsg || "No events match this view.");
    status.textContent = msg;
    status.hidden = !!shown;
    // single, polite SR announcement: result count (or the empty message), plus any banner note
    var q = searchBox.value.trim();
    var ann = shown
      ? (shown + (shown === 1 ? " event" : " events") + (q ? " match your search." : " shown."))
      : msg;
    if (bannerMsg) ann = bannerMsg + " " + ann;
    announce(ann);
  }

  function calDateLabel(r) { return r.day ? (r.day + ", " + r.date) : r.date; }

  function renderAgenda(res) {
    var q = searchBox.value.trim().toLowerCase();
    var html = "", shown = 0, lastMonth = null, lastGroup = null;
    res.rows.forEach(function (r) {
      if (q && r.haystack.indexOf(q) === -1) return;
      if (res.groupByRoom) {
        var g = r.roomTokens.map(roomLabel).join(" / ");
        if (g !== lastGroup) { html += '<div class="efmp-group" role="heading" aria-level="3">' + esc(g) + "</div>"; lastGroup = g; }
      } else if (!res.singleDay && r.key !== null) {
        var mon = Math.floor(r.key / 100);
        if (mon !== lastMonth) { html += '<div class="efmp-month" role="heading" aria-level="3">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>"; lastMonth = mon; }
      }
      // Sectional events ("ESO sectionals", "GSO sectionals", ...) list "Various"
      // as their room because each section meets elsewhere. Pipe the per-section
      // location table from the Sectional Rehearsals tab into the modal + .ics.
      var det = r.details;
      if (/sectional/i.test(r.event) && sectionalLocations.length) {
        det = (det ? det + "\n\n" : "") + "Sectional locations:\n" +
          sectionalLocations.map(function (s) { return s.section + ": " + s.room; }).join("\n");
      }
      var ev = {
        title: r.event || "(untitled)", dateStr: r.date, timeStr: r.time, location: r.loc,
        description: [r.ensemble && ("Ensemble: " + r.ensemble),
          r.conductor && ("Conductor / Soloist: " + r.conductor),
          r.type && ("Type: " + r.type), det, r.pdf && ("PDF: " + r.pdf)].filter(Boolean).join("\n")
      };
      viewEvents.push(ev);
      html += agendaRowHTML({
        big: r.dayNum, small: r.day, title: r.event || "(untitled)",
        when: [r.time, r.loc, r.conductor],
        chips: [].concat(r.ensemble ? [{ label: r.ensemble, ens: true }] : [], r.type ? [{ label: r.type }] : []),
        modal: {
          title: r.event || "Event",
          fields: [["Date", calDateLabel(r)], ["Time", r.time], ["Location", r.loc],
            ["Ensemble", r.ensemble], ["Conductor / Soloist", r.conductor], ["Type", r.type]],
          details: det, pdf: r.pdf, pdfLabel: pdfLabel(r), ics: ev
        }
      });
      shown++;
    });
    finishList(html, shown, res.banner);
  }

  // General Information -> "Dining" pill: both the on-campus dining hall hours and
  // the "Off Campus Dining" block from the Master Calendar "General Information"
  // tab. The tab stacks three sections (dining hall hours, a "Chamber Music
  // Coaches" roster, then "Off Campus Dining"); this pill shows the first and last,
  // skipping the coaches roster (its own pill) in between.
  function renderDining() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var html = '<div class="efmp-info">';
    var all = generalInfo.filter(function (l) { return l !== ""; });
    // Dining hall block: from after the tab title down to the next section heading
    // (the coaches roster, or off-campus dining if the roster is absent).
    var hall = all.slice();
    if (hall.length && /^general information$/i.test(hall[0])) hall = hall.slice(1);
    for (var di = 0; di < hall.length; di++) { if (/^(student|building) access hours/i.test(hall[di]) || /^chamber music coaches/i.test(hall[di]) || /^off[\s-]*campus dining/i.test(hall[di])) { hall = hall.slice(0, di); break; } }
    // Off-campus dining block: from its heading to the end of the tab.
    var off = [];
    for (var oi = 0; oi < all.length; oi++) { if (/^off[\s-]*campus dining/i.test(all[oi])) { off = all.slice(oi); break; } }
    if (!hall.length && !off.length) html += "<p>Dining hours will appear here once posted.</p>";
    function renderLine(l) {
      // A line is a heading if it's ALL CAPS, a short label, or the dining title
      // (e.g. "Dining Hall Hours (Located in Founders Hall)") which is too long for
      // the short-label rule but should still read as a heading.
      var heading = (l === l.toUpperCase() && /[A-Z]/.test(l)) || (!/\d/.test(l) && l.length < 30) || /^dining (hall hours|schedule)\b/i.test(l);
      // role=heading DIV (not <h3>) so the site's global heading theme can't recolor it
      html += heading
        ? '<div class="efmp-info__head" role="heading" aria-level="3">' + esc(l) + "</div>"
        : "<p>" + esc(l) + "</p>";
    }
    hall.forEach(renderLine);
    off.forEach(renderLine);
    html += "</div>";
    list.innerHTML = html;
    announce("Dining information shown.");
  }

  // Staff directory cards grouped by department, each a tap-to-email / tap-to-call
  // target. Returns the section's inner HTML (with a "Staff Contacts" head), or ""
  // if absent. Used by the "People" pill.
  function staffListInner() {
    if (!staff.length) return "";
    var html = '<div class="efmp-info__head" role="heading" aria-level="3">Staff Contacts</div>';
    staff.forEach(function (g) {
      if (g.dept) html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(g.dept) + "</div>";
      html += '<div class="efmp-cards">';
      g.people.forEach(function (p) {
        // A contact makes the whole card a tap target: mailto: for an email,
        // tel: for a phone (so on a phone it opens mail / the dialer). The
        // action word is a visually-hidden prefix (not aria-label) so the link's
        // accessible name keeps the name + title + office a screen reader needs.
        var href = "", action = "", contact = (p.contact || "").trim();
        if (contact && /@/.test(contact)) { href = "mailto:" + contact; action = "Email"; }
        else if (contact && /\d/.test(contact)) { href = "tel:" + contact.replace(/[^\d+]/g, ""); action = "Call"; }
        var inner =
          (href ? '<span class="efmp__sr">' + action + " </span>" : "") +
          '<div class="efmp-card__name">' + esc(p.name) + "</div>" +
          (p.title ? '<div class="efmp-card__title">' + esc(p.title) + "</div>" : "") +
          (p.office ? '<div class="efmp-card__office">' + esc(p.office) + "</div>" : "") +
          (contact ? '<div class="efmp-card__contact">' + esc(contact) + "</div>" : "");
        html += href
          ? '<a class="efmp-card efmp-card--link" href="' + esc(href) + '">' + inner + "</a>"
          : '<div class="efmp-card">' + inner + "</div>";
      });
      html += "</div>";
    });
    return html;
  }

  // The chamber music coaches roster (instrument groups + names) that lives below
  // the dining hours on the General Information tab. Returns the section's inner
  // HTML, or "" if absent. Used by the "People" pill.
  function chamberCoachesInner() {
    var lines = generalInfo.filter(function (l) { return l !== ""; });
    var start = -1;
    for (var i = 0; i < lines.length; i++) { if (/^chamber music coaches/i.test(lines[i])) { start = i; break; } }
    if (start < 0) return "";
    // The "Off Campus Dining" section follows the roster on the same tab; stop the
    // roster before it so its text doesn't bleed in as coach names.
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (/^off[\s-]*campus dining/i.test(lines[e])) { end = e; break; } }
    var SECTIONS = { "violin": 1, "viola": 1, "cello": 1, "bass": 1, "double bass": 1, "woodwind": 1, "woodwinds": 1, "brass": 1, "harp": 1, "piano": 1, "harp/piano": 1, "percussion": 1, "string fellows coach": 1, "conducting": 1 };
    var html = '<div class="efmp-info__head" role="heading" aria-level="3">Chamber Music Coaches</div>';
    var curNames = [], curSec = null;
    function flush() {
      if (curSec) {
        html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(curSec) + "</div>";
        if (curNames.length) html += "<p>" + curNames.map(esc).join(", ") + "</p>";
      }
      curNames = [];
    }
    lines.slice(start + 1, end).forEach(function (l) {
      if (SECTIONS[l.toLowerCase().trim()]) { flush(); curSec = l; }
      else curNames.push(l);
    });
    flush();
    return html;
  }

  // The "Student Access Hours" section (building -> hours pairs, with a "PERCUSSION
  // ONLY:" sub-heading). Returns the section's inner HTML (head + rows), or "" if
  // absent. Used by the "Around Campus" pill.
  function buildingAccessInner() {
    var lines = generalInfo.filter(function (l) { return l !== ""; });
    var start = -1;
    for (var i = 0; i < lines.length; i++) { if (/^(student|building) access hours/i.test(lines[i])) { start = i; break; } }
    if (start < 0) return "";
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (giIsHeading(lines[e])) { end = e; break; } }
    var html = '<div class="efmp-info__head" role="heading" aria-level="3">Building Access Hours</div>';
    lines.slice(start + 1, end).forEach(function (l) {
      var ci = l.indexOf(":");
      var label = ci >= 0 ? l.slice(0, ci).trim() : l;
      var value = ci >= 0 ? l.slice(ci + 1).trim() : "";
      if (!value) {                                              // a bare label like "PERCUSSION ONLY:" -> sub-heading
        html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(label.replace(/:\s*$/, "")) + "</div>";
      } else {                                                   // "Building: hours" -> key/value row
        html += '<div class="efmp-kv"><b>' + esc(label) + "</b><span>" + esc(value) + "</span></div>";
      }
    });
    return html;
  }

  // Section headings on the Master Calendar "General Information" tab. A pill that
  // shows one section slices from its heading to the next heading in this list, so
  // a new section (maintenance, mail, ...) never bleeds into a neighboring pill.
  var GI_HEADINGS = [
    /^general information$/i, /^dining hall/i, /^(student|building) access hours/i,
    /^(urgent )?maintenance/i, /^mail\b/i, /^chamber music coaches/i, /^off[\s-]*campus dining/i
  ];
  function giIsHeading(l) { return GI_HEADINGS.some(function (re) { return re.test(l); }); }

  // Render one General Information cell, which may carry several newline-separated
  // lines (e.g. a "Maintenance Procedures" heading then paragraphs). A short line
  // becomes a sub-heading; a "Heading: text" line becomes a sub-heading + paragraph;
  // a sentence / long line becomes a paragraph. Shared by the Maintenance + Mail pills.
  function giCellHTML(cell) {
    var out = "";
    String(cell).split(/\r?\n/).forEach(function (raw) {
      var s = raw.trim();
      if (!s) return;
      var ci = s.indexOf(":");
      var label = ci >= 0 ? s.slice(0, ci).trim() : s;
      var value = ci >= 0 ? s.slice(ci + 1).trim() : "";
      var headish = label.split(/\s+/).length <= 4 && !/[.!?]$/.test(label);   // short, not a sentence
      if (ci >= 0 && value && headish) out += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(label) + "</div><p>" + esc(value) + "</p>";
      else if (ci >= 0 && !value && headish) out += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(label) + "</div>";
      else if (ci < 0 && headish) out += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(s) + "</div>";
      else out += "<p>" + esc(s) + "</p>";
    });
    return out;
  }

  // A General Information section (Maintenance, Mail) by start-heading regex +
  // display head. Returns the section's inner HTML (head + cells), or "" if absent.
  // Used by the "Around Campus" pill.
  function giSectionInner(matchRe, head) {
    var lines = generalInfo.filter(function (l) { return l !== ""; });
    var start = -1;
    for (var i = 0; i < lines.length; i++) { if (matchRe.test(lines[i])) { start = i; break; } }
    if (start < 0) return "";
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (giIsHeading(lines[e])) { end = e; break; } }
    var html = '<div class="efmp-info__head" role="heading" aria-level="3">' + esc(head) + "</div>";
    lines.slice(start, end).forEach(function (l) { html += giCellHTML(l); });
    return html;
  }

  // General Information -> "Around Campus" pill: building access hours + maintenance
  // + mail, stacked in one panel (each its own sub-section, in sheet order).
  function renderAroundCampus() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var inner = buildingAccessInner() +
      giSectionInner(/^(urgent )?maintenance/i, "Maintenance") +
      giSectionInner(/^mail\b/i, "Mail");
    if (!inner) { finishList("", 0, "", "Campus information will appear here once posted."); return; }
    list.innerHTML = '<div class="efmp-info">' + inner + "</div>";
    announce("Around campus information shown.");
  }

  // Parse the Master Calendar "Faculty Lesson Locations" tab (Name / Room /
  // Instrument) into instrument groups in first-seen order. Columns are matched
  // by header name so they can be reordered or renamed in the sheet.
  function parseLessons(rows) {
    if (!rows || !rows.length) return [];
    var ni = 0, ri = 1, ii = 2, si = -1, start = 0;
    for (var h = 0; h < rows.length; h++) {
      var lc = rows[h].map(function (c) { return (c || "").trim().toLowerCase(); });
      if (lc.indexOf("name") !== -1 && lc.indexOf("instrument") !== -1) {
        ni = lc.indexOf("name"); ii = lc.indexOf("instrument");
        ri = lc.indexOf("room"); if (ri === -1) ri = lc.indexOf("location"); if (ri === -1) ri = lc.indexOf("studio");
        si = lc.indexOf("students"); if (si === -1) si = lc.indexOf("student");
        start = h + 1; break;
      }
    }
    var order = [], byInst = {};
    rows.slice(start).forEach(function (r) {
      var name = (r[ni] || "").trim();
      var inst = (r[ii] || "").trim();
      var room = (ri >= 0 ? (r[ri] || "") : "").trim();
      if (!name) return;
      var students = si >= 0 ? (r[si] || "").split(/[,\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      var key = inst || "Other";
      if (!byInst[key]) { byInst[key] = []; order.push(key); }
      byInst[key].push({ name: name, room: room, students: students });
    });
    return order.map(function (k) { return { instrument: k, people: byInst[k] }; });
  }

  // Auditions & Classes -> "Lessons" pill: private-lesson assignments from the Faculty
  // Lesson Locations tab, grouped Instrument -> Faculty (+ room) -> students. Only
  // faculty who have students assigned are shown.
  function renderLessons() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var groups = lessons.map(function (g) {
      return { instrument: g.instrument, people: g.people.filter(function (p) { return p.students && p.students.length; }) };
    }).filter(function (g) { return g.people.length; });
    if (!groups.length) { finishList("", 0, "", "Lesson assignments will appear here once posted."); return; }
    var html = '<div class="efmp-info"><div class="efmp-info__head" role="heading" aria-level="3">Private Lessons</div>';
    groups.forEach(function (g) {
      html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(g.instrument) + '</div><div class="efmp-cards">';
      g.people.forEach(function (p) {
        html += '<div class="efmp-card">' +
          '<div class="efmp-card__name">' + esc(p.name) + '</div>' +
          (p.room ? '<div class="efmp-card__title">' + esc(p.room) + '</div>' : '') +
          '<div class="efmp-card__contact">' + esc(p.students.join(", ")) + '</div>' +
          '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
    announce("Private lessons shown.");
  }

  // Faculty private-lesson locations from the Master Calendar "Faculty Lesson
  // Locations" tab, grouped by instrument. Returns the section's inner HTML, or ""
  // if absent. Used by the "People" pill.
  function lessonsInner() {
    if (!lessons.length) return "";
    var html = '<div class="efmp-info__head" role="heading" aria-level="3">Faculty Lesson Locations</div>';
    lessons.forEach(function (g) {
      html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(g.instrument) + "</div>";
      g.people.forEach(function (p) {
        html += '<div class="efmp-kv"><b>' + esc(p.name) + "</b><span>" + esc(p.room || "Location to be announced") + "</span></div>";
      });
    });
    return html;
  }

  // People -> "Staff" view: the office/admin staff contacts (faculty + coaches live
  // under the "Faculty" view).
  function renderStaffView() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var inner = staffListInner();
    if (!inner) { finishList("", 0, "", "Staff contacts will appear here once posted."); return; }
    list.innerHTML = '<div class="efmp-info">' + inner + "</div>";
    announce("Staff contacts shown.");
  }

  // ---- faculty directory name-join helpers ------------------------------
  // Lesson studio + chamber-coach status live in their own sheets, keyed by name, so
  // we join them onto the FacultyContact rows. Names don't always match exactly across
  // sheets ("Cathy" vs "Catherine", "Dan" vs "Daniel"), so we key on BOTH the full
  // normalized name AND "lastname|first-initial".
  function normName(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function nameKeys(name) {
    var n = normName(name); if (!n) return [];
    var parts = n.split(" "), keys = [n];
    if (parts.length >= 2) keys.push(parts[parts.length - 1] + "|" + parts[0].charAt(0));
    return keys;
  }
  // Coach names from the General Information "Chamber Music Coaches" block (section
  // headings + names), returned flat. Mirrors chamberCoachesInner's parsing.
  function parseChamberCoachNames(infoLines) {
    var lines = (infoLines || []).filter(function (l) { return l !== ""; });
    var start = -1;
    for (var i = 0; i < lines.length; i++) { if (/^chamber music coaches/i.test(lines[i])) { start = i; break; } }
    if (start < 0) return [];
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (/^off[\s-]*campus dining/i.test(lines[e]) || /^(student|building) access hours/i.test(lines[e])) { end = e; break; } }
    var SECTIONS = { "violin": 1, "viola": 1, "cello": 1, "bass": 1, "double bass": 1, "woodwind": 1, "woodwinds": 1, "brass": 1, "harp": 1, "piano": 1, "harp/piano": 1, "percussion": 1, "string fellows coach": 1, "conducting": 1 };
    var out = [];
    lines.slice(start + 1, end).forEach(function (l) { if (!SECTIONS[l.toLowerCase().trim()]) out.push(l.trim()); });
    return out;
  }

  // Faculty contact directory from the Faculty-Portal "FacultyContact" tab. Header
  // -keyed (columns by name) so a sheet rename survives; keeps only rows with a real
  // email; sorted by last name. Powers the General Information -> "Faculty" pill.
  function parseFacultyDirectory(rows) {
    rows = rows || [];
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      var lc = rows[i].map(function (x) { return clean(x).toLowerCase(); });
      if (lc.indexOf("email address") !== -1 || lc.indexOf("email") !== -1 ||
          (lc.indexOf("first name") !== -1 && lc.indexOf("last name") !== -1)) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return [];
    var hdr = rows[headerIdx].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var x = hdr.indexOf(arguments[a]); if (x !== -1) return x; } return -1; }
    var iFirst = col("first name", "first"), iLast = col("last name", "last", "surname"),
        iName = col("name", "full name"), iInst = col("instrument", "section"),
        iEmail = col("email address", "email", "e-mail");
    if (iEmail === -1) return [];
    var out = [];
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j]; if (!c.join("").trim()) continue;
      var email = clean(c[iEmail]);
      if (!email || !/@/.test(email)) continue;   // skip rows with no real email
      var name = iName !== -1 ? clean(c[iName]) : "";
      if (!name) name = (clean(iFirst !== -1 ? c[iFirst] : "") + " " + clean(iLast !== -1 ? c[iLast] : "")).replace(/\s+/g, " ").trim();
      if (!name) continue;
      out.push({ name: name, last: iLast !== -1 ? clean(c[iLast]) : name, instrument: iInst !== -1 ? clean(c[iInst]) : "", email: email });
    }
    out.sort(function (a, b) { var x = (a.last || a.name).toLowerCase(), y = (b.last || b.name).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
    return out;
  }

  // Faculty roster sheet -> nameKey -> { section, photo, role }, for the headshot +
  // section-grouping join (the same roster the public Faculty page uses).
  function parseRoster(rows) {
    rows = rows || []; if (!rows.length) return {};
    var hdr = rows[0].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var x = hdr.indexOf(arguments[a]); if (x !== -1) return x; } return -1; }
    var iName = col("name", "full name"), iSec = col("section", "instrument"),
        iPhoto = col("photo", "image", "headshot", "picture", "img", "photo url", "portrait"),
        iRole = col("role", "title", "position");
    var map = {};
    for (var i = 1; i < rows.length; i++) {
      var c = rows[i]; var nm = clean(c[iName]); if (!nm) continue;
      var entry = { section: iSec >= 0 ? clean(c[iSec]) : "", photo: iPhoto >= 0 ? clean(c[iPhoto]) : "", role: iRole >= 0 ? clean(c[iRole]) : "" };
      nameKeys(nm).forEach(function (k) { if (!map[k]) map[k] = entry; });
    }
    return map;
  }
  function facultyInitials(name) {
    var p = String(name || "").split(/\s+/).filter(Boolean);
    return ((p[0] ? p[0].charAt(0) : "") + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase();
  }

  // People -> "Faculty" view: a faculty directory grouped by section (like the public
  // Faculty page), with headshots. Each card: avatar, name, role/instrument, a
  // "Chamber Coach" chip, lesson studio, and tap-to-email. Photo + section join from
  // the roster sheet; studio + coach status from the lesson + coaches sheets.
  function renderFacultyView() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    if (!facultyDir.length) { finishList("", 0, "", "The faculty directory will appear here once posted."); return; }
    var bySec = {}, seen = [];
    facultyDir.forEach(function (p) {
      var sec = p.section || p.instrument || "Faculty";
      if (!bySec[sec]) { bySec[sec] = []; seen.push(sec); }
      bySec[sec].push(p);
    });
    var ordered = SECTION_ORDER.filter(function (s) { return bySec[s]; })
      .concat(seen.filter(function (s) { return SECTION_ORDER.indexOf(s) === -1; }));
    var html = '<div class="efmp-info"><div class="efmp-info__head" role="heading" aria-level="3">Faculty Contacts</div>';
    ordered.forEach(function (sec) {
      html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(sec) + '</div><div class="efmp-cards">';
      bySec[sec].forEach(function (p) {
        var photo = safeUrl(p.photo);
        var avatar = '<span class="efmp-card__avatar">' + (photo
          ? '<img src="' + esc(photo) + '" alt="' + esc(p.name) + '" loading="lazy">'
          : '<span class="efmp-card__initials">' + esc(facultyInitials(p.name)) + "</span>") + "</span>";
        var body =
          '<span class="efmp__sr">Email </span>' +
          '<div class="efmp-card__name">' + esc(p.name) + "</div>" +
          '<div class="efmp-card__title">' + esc(p.roleTitle || p.instrument || "Faculty") + (p.isCoach ? ' <span class="efmp-chip">Chamber Coach</span>' : "") + "</div>" +
          (p.room ? '<div class="efmp-card__office">Lesson studio: ' + esc(p.room) + "</div>" : "") +
          '<div class="efmp-card__contact">' + esc(p.email) + "</div>";
        html += '<a class="efmp-card efmp-card--link efmp-card--person" href="mailto:' + esc(p.email) + '">' + avatar + '<div class="efmp-card__body">' + body + "</div></a>";
      });
      html += "</div>";
    });
    html += "</div>";
    list.innerHTML = html;
    // Broken headshot URL -> fall back to initials (also catches an already-failed load).
    Array.prototype.forEach.call(list.querySelectorAll(".efmp-card__avatar img"), function (img) {
      function fail() { var par = img.parentNode; if (!par) return; par.textContent = ""; var ph = document.createElement("span"); ph.className = "efmp-card__initials"; ph.textContent = facultyInitials(img.getAttribute("alt") || ""); par.appendChild(ph); }
      img.addEventListener("error", fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
    announce(facultyDir.length + " faculty contacts shown.");
  }

  function renderMap() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    list.innerHTML =
      '<div class="efmp-map">' +
        '<a class="efmp-map__frame" href="' + esc(MAP_IMAGE_URL) + '" target="_blank" rel="noopener noreferrer" ' +
          'aria-label="Open the full-size Guilford College campus map in a new tab">' +
          '<img src="' + esc(MAP_IMAGE_URL) + '" loading="lazy" ' +
            'alt="Guilford College campus map: an aerial view of campus buildings and parking lots, with a lettered building legend.">' +
        '</a>' +
        '<p class="efmp-map__hint">Tap the map to open it full size. EFM venues: <b>Dana Auditorium</b> (Q) holds the ' +
          'Choir Room and Moon Room; <b>Sternberger Auditorium</b> is in Founders Hall (I); the <b>Carnegie Room</b> ' +
          'is in Hege (C); <b>Ragan-Brown Field House</b> is L1.</p>' +
        '<a class="efmp-modal__cal efmp-map__pdf" href="' + esc(MAP_PDF_URL) + '" target="_blank" rel="noopener noreferrer">Download map (PDF)</a>' +
      '</div>';
    announce("Campus map shown.");
  }

  function renderHandbook() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    list.innerHTML =
      '<div class="efmp-handbook">' +
        '<p class="efmp-handbook__lead">The <b>2026 Student Handbook</b> is your guide to the festival &#8212; ' +
          'policies, daily life, contacts, and everything you need to know for your time at Eastern.</p>' +
        '<a class="efmp-modal__cal efmp-handbook__open" href="' + esc(HANDBOOK_URL) + '" target="_blank" rel="noopener noreferrer">Open the Student Handbook (PDF)</a>' +
        '<p class="efmp-handbook__hint">Opens in a new tab. You can read it online or download it to your phone.</p>' +
      '</div>';
    announce("Student handbook shown.");
  }

  // ---- info tabs (Placement Auditions / Sectionals / Studio Classes / Concerto) --
  // These tabs are informational (a title, some schedule lines, and an
  // instrument -> location table), not event calendars. Render them generically:
  // the first cell is the heading, single-cell label rows are sub-heads, single
  // -cell content rows are paragraphs, and label+value rows become key/value rows.
  function showHideCol(rows) {
    for (var i = 0; i < (rows || []).length; i++) {
      for (var j = 0; j < rows[i].length; j++) {
        if ((rows[i][j] || "").trim().toLowerCase() === "show/hide") return { row: i, col: j };
      }
    }
    return null;
  }
  // The Show/Hide value = the cell directly below the "Show/Hide" header cell.
  function showHideValue(rows) {
    var sh = showHideCol(rows);
    if (!sh) return "";
    var below = rows[sh.row + 1] && rows[sh.row + 1][sh.col];
    return (below || "").trim();
  }
  // Section -> room pairs from the Sectional Rehearsals tab's location table.
  function parseSectionalLocations(rows) {
    var out = [];
    (rows || []).forEach(function (r) {
      var a = (r[0] || "").trim(), b = (r[1] || "").trim();
      if (a && b && !/\d/.test(a) && a.split(/\s+/).length <= 3 && !/^locations?:?$/i.test(a)) out.push({ section: a, room: b });
    });
    return out;
  }

  // ---- Sectionals (Auditions & Classes -> ESO / GSO Sectionals) ----------
  // Parse the Sectional Rehearsals tab into { eso, gso, perc, locations,
  // esoCoaches, gsoCoaches }. ESO/GSO/Percussion schedule lines live under
  // "Week One Sectionals:" / "All other weeks:"; the shared location table under
  // "Locations:"; coaches in two columns under the "...Sectional Coaches" header
  // (ESO in column A, GSO in column C).
  function parseSectionals(rows) {
    var out = { eso: {}, gso: {}, perc: {}, locations: [], esoCoaches: {}, gsoCoaches: {} };
    var mode = "";
    (rows || []).forEach(function (r) {
      var a = clean(r[0]), b = clean(r[1]), c = clean(r[2]);
      if (/^week one/i.test(a)) { mode = "weekone"; return; }
      if (/^all other weeks/i.test(a)) { mode = "other"; return; }
      if (/^locations?:?$/i.test(a)) { mode = "loc"; return; }
      if (/sectional coaches/i.test(a) || /sectional coaches/i.test(c)) { mode = "coach"; return; }
      if (mode === "weekone" || mode === "other") {
        var m = a.match(/^(ESO|GSO|Percussion)\s*:\s*(.*)$/i);
        if (m) out[/^p/i.test(m[1]) ? "perc" : m[1].toLowerCase()][mode === "weekone" ? "weekOne" : "other"] = m[2].trim();
      } else if (mode === "loc") {
        if (a && b) out.locations.push({ section: a, room: b });
      } else if (mode === "coach") {
        var ea = a.match(/^([A-Za-z]+)\s*:\s*(.+)$/); if (ea) out.esoCoaches[ea[1].toLowerCase()] = ea[2].trim();
        var gc = c.match(/^([A-Za-z]+)\s*:\s*(.+)$/); if (gc) out.gsoCoaches[gc[1].toLowerCase()] = gc[2].trim();
      }
    });
    return out;
  }
  // This is the STUDENT portal, so faculty-oriented content is filtered out:
  // columns headed "Show/Hide" or "Personnel" are dropped, and rows flagged
  // "Faculty Only" or naming a coordinator/director role are skipped entirely.
  function dropCols(rows) {
    var drop = {};
    (rows || []).forEach(function (r) {
      r.forEach(function (c, ci) { var v = (c || "").trim().toLowerCase(); if (v === "show/hide" || v === "personnel") drop[ci] = true; });
    });
    return drop;
  }
  function isFacultyRow(r) {
    if (r.some(function (c) { return (c || "").trim().toLowerCase() === "faculty only"; })) return true;
    return /\b(coordinator|director)\b/i.test((r[0] || "").trim());
  }
  function renderInfoTab(sub) {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var rows = infoTabs[sub.source];
    if (!rows || !rows.length) { finishList("", 0, "", "This information will appear here once it is posted."); return; }
    var drop = dropCols(rows);
    var html = '<div class="efmp-info">', first = true;
    rows.forEach(function (r) {
      if (isFacultyRow(r)) return;                               // faculty-only content stays out of the student portal
      var a = (r[0] || "").trim();
      if (a.toLowerCase() === "instrument") return;              // the location-table column header row
      var rest = r.map(function (c, ci) { return (ci === 0 || drop[ci]) ? "" : (c || "").trim(); }).filter(Boolean);
      if (!a && !rest.length) return;                            // blank (or a dropped-cell) row
      if (!a) { html += "<p>" + rest.map(esc).join(" &#183; ") + "</p>"; return; }
      if (rest.length) {                                         // label + value -> key/value row
        html += '<div class="efmp-kv"><b>' + esc(a) + "</b><span>" + rest.map(esc).join(" &#183; ") + "</span></div>";
      } else if (first) {                                        // first cell = the tab title
        html += '<div class="efmp-info__head" role="heading" aria-level="3">' + esc(a) + "</div>";
      } else if (/:\s*$/.test(a) || (a.split(/\s+/).length <= 4 && !/\d/.test(a))) {   // a section label
        html += '<div class="efmp-info__dept" role="heading" aria-level="4">' + esc(a.replace(/:\s*$/, "")) + "</div>";
      } else {
        html += "<p>" + esc(a) + "</p>";                         // a schedule / content line
      }
      first = false;
    });
    html += "</div>";
    list.innerHTML = html;
    announce(sub.label + " shown.");
  }

  // Render one ensemble's sectionals: rehearsal times + a merged
  // Section / Location / Coach table (shared locations + that ensemble's coaches).
  // Percussion + Harp have no listed coach, so they show the location only.
  function renderSectional(ens) {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var s = sectionalData;
    if (!s || (!s.locations.length && !s.eso.weekOne && !s.gso.weekOne)) {
      list.innerHTML = '<div class="efmp-info"><p>This information will appear here once it is posted.</p></div>';
      announce(ens + " sectional information is not posted yet.");
      return;
    }
    var sched = ens === "GSO" ? s.gso : s.eso;
    var coaches = ens === "GSO" ? s.gsoCoaches : s.esoCoaches;
    var html = '<div class="efmp-info">' +
      '<div class="efmp-info__head" role="heading" aria-level="3">' + esc(ens) + ' Sectionals</div>' +
      '<div class="efmp-info__dept" role="heading" aria-level="4">Rehearsal Times</div>';
    if (sched.weekOne) html += "<p><b>Week One:</b> " + esc(sched.weekOne) + "</p>";
    if (sched.other) html += "<p><b>All other weeks:</b> " + esc(sched.other) + "</p>";
    var perc = [s.perc.weekOne, s.perc.other].filter(Boolean);
    if (perc.length) html += "<p><b>Percussion:</b> " + perc.map(esc).join(" &#183; ") + "</p>";
    html += '<div class="efmp-info__dept" role="heading" aria-level="4">Sections</div>';
    s.locations.forEach(function (loc) {
      var coach = coaches[loc.section.toLowerCase()] || "";
      html += '<div class="efmp-kv"><b>' + esc(loc.section) + "</b><span>" + esc(loc.room) +
        (coach ? " &#183; " + esc(coach) : "") + "</span></div>";
    });
    if (!s.locations.length) html += "<p>No sections posted yet.</p>";
    html += "</div>";
    list.innerHTML = html;
    announce(ens + " sectionals shown.");
  }

  // Rosters tab: a seating-roster PDF for ESO/GSO plus that concert cycle's
  // services. The services reuse renderAgenda (so search + the .ics export work)
  // by briefly pointing the shared list element at a sub-container, leaving the
  // PDF block above it untouched.
  function renderRoster(sub) {
    banner.hidden = true; banner.textContent = "";
    viewLabel = sub.title + " Services"; viewFeedKey = "";   // a single week is a subset, not the full live feed
    var link = safeUrl(sub.link);
    list.innerHTML = '<div class="efmp-roster">' +
      '<div class="efmp-roster__pdf"><div>' +
        '<div class="efmp-roster__pdf-name">' + esc(sub.title) + ' Roster</div>' +
        '<div class="efmp-roster__pdf-meta">' + (link ? "PDF document" : "PDF not posted yet") + '</div>' +
      '</div>' +
      (link ? '<a class="efmp-roster__btn" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">View / Download PDF</a>' : "") +
      '</div>' +
      '<div class="efmp-roster__svc-head" role="heading" aria-level="3">' + esc(sub.code) + ' Services</div>' +
      '<div id="efmp-roster-svc"></div>' +
      '</div>';
    var svcList = document.getElementById("efmp-roster-svc");
    var saved = list; list = svcList;
    renderAgenda({ rows: rosterServices(sub.code, sub.week), banner: "" });
    list = saved;
  }

  function renderList() {
    var top = currentTop();
    var sub = top.subs[subSel[top.id]] || top.subs[0];
    modalData = [];
    viewEvents = [];
    viewLabel = top.label + ((sub.label && sub.label !== top.label) ? " " + sub.label : "");
    viewFeedKey = (sub.kind === "ensemble" && sub.code && FEED_VIEWS[sub.code]) ? FEED_VIEWS[sub.code] : "";
    if (controls) controls.hidden = (sub.kind === "map" || sub.kind === "handbook" || sub.kind === "sectional" || sub.kind === "infoTab" || sub.kind === "dining" || sub.kind === "aroundCampus" || sub.kind === "people" || sub.kind === "lessons");   // no search/export on map + info views
    if (sub.kind === "map") renderMap();
    else if (sub.kind === "handbook") renderHandbook();
    else if (sub.kind === "sectional") renderSectional(sub.code);
    else if (sub.kind === "dining") renderDining();
    else if (sub.kind === "aroundCampus") renderAroundCampus();
    else if (sub.kind === "people") { if (peopleView === "staff") renderStaffView(); else renderFacultyView(); }
    else if (sub.kind === "infoTab") renderInfoTab(sub);
    else if (sub.kind === "lessons") renderLessons();
    else if (sub.weeks && weekSel != null && weeksFor(sub)[weekSel]) renderRoster(weeksFor(sub)[weekSel]);
    else renderAgenda(rowsForSub(sub));
    updateICSButton();
  }

  // ---- announcements ticker (side-scrolling, pinned under the search box) --
  // This portal's audience tag. A row shows here when its Audience cell is
  // blank / "All" or names this portal, so faculty-only rows stay out of the
  // student ticker (and vice-versa in the faculty portal).
  var PORTAL_AUDIENCE = "student";
  function audienceShows(aud) {
    var a = (aud || "").trim().toLowerCase();
    if (!a || a === "all" || a === "everyone" || a === "everybody" || a === "both") return true;
    return a.indexOf(PORTAL_AUDIENCE) !== -1;   // "students" contains "student"
  }
  function renderTicker() {
    if (!ticker) return;
    var tk = todayKey();
    var withText = announcements.filter(function (a) { return a.text && audienceShows(a.audience); });
    // Priority: any "Override" row wins and shows EXCLUSIVELY (multiple overrides
    // are shown together, in chronological order); else today's date-matched
    // rows; else fall forward to all upcoming announcements so the bar is never
    // blank when something is on the way.
    var overrides = withText.filter(function (a) { return /override/i.test(a.logic); });
    var items;
    if (overrides.length) {
      items = overrides.slice().sort(function (a, b) {
        return (a.key === null ? 99999 : a.key) - (b.key === null ? 99999 : b.key);
      });
    } else {
      var todays = withText.filter(function (a) { return a.key !== null && a.key === tk; });
      items = todays.length
        ? todays
        : withText.filter(function (a) { return a.key !== null && tk !== null && a.key >= tk; })
            .sort(function (a, b) { return a.key - b.key; });
    }
    if (!items.length) { ticker.hidden = true; ticker.innerHTML = ""; return; }
    var seq = items.map(function (a) {
      var chip = a.type ? '<span class="efmp-ticker__type">' + esc(a.type) + "</span> " : "";
      return '<span class="efmp-ticker__item">' + chip + esc(a.text) + "</span>";
    }).join("");
    // The track holds the sequence twice for a seamless marquee; the second copy
    // is aria-hidden so a screen reader reads each announcement only once.
    ticker.innerHTML =
      '<span class="efmp-ticker__label">Announcements</span>' +
      '<div class="efmp-ticker__viewport"><div class="efmp-ticker__track">' +
        '<span class="efmp-ticker__seq">' + seq + '</span>' +
        '<span class="efmp-ticker__seq" aria-hidden="true">' + seq + '</span>' +
      "</div></div>" +
      '<button type="button" class="efmp-ticker__pause" aria-pressed="false" aria-label="Pause announcements">∥</button>';
    ticker.hidden = false;
    var btn = ticker.querySelector(".efmp-ticker__pause");
    btn.addEventListener("click", function () {
      var paused = ticker.classList.toggle("efmp-paused");
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      btn.setAttribute("aria-label", paused ? "Play announcements" : "Pause announcements");
      btn.innerHTML = paused ? "▶" : "∥";
    });
  }

  // ---- details modal ------------------------------------------------------
  function openModal(d) {
    if (!d) return;
    lastFocus = document.activeElement;
    modal.querySelector(".efmp-modal__title").textContent = d.title || "Details";
    var content = modal.querySelector(".efmp-modal__content");
    var actions = modal.querySelector(".efmp-modal__actions");
    if (d.html != null) {
      // custom modal body (e.g. the "Add to calendar" chooser)
      content.innerHTML = d.html;
      actions.hidden = true;
    } else {
      var html = "";
      if (d.fields) {
        var dl = d.fields.filter(function (f) { return f[1]; })
          .map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("");
        if (dl) html += "<dl>" + dl + "</dl>";
      }
      if (d.details) html += '<div class="efmp-modal__details">' + esc(d.details) + "</div>";
      var pu = d.pdf ? safeUrl(d.pdf) : "";
      if (pu) html += '<div style="margin-top:12px;"><a class="efmp-modal__cal" href="' + esc(pu) + '" target="_blank" rel="noopener noreferrer">' + esc(d.pdfLabel || "View PDF") + "</a></div>";
      if (!html) html = '<p style="margin:0;color:#5b6473;">No additional details.</p>';
      content.innerHTML = html;
      // inline one-click "Add to calendar" for this single event
      if (d.ics) {
        actions.hidden = false;
        var g = actions.querySelector(".efmp-modal__cal--gcal");
        var gu = gcalUrl(d.ics);
        if (gu) { g.href = gu; g.hidden = false; } else { g.hidden = true; }
        actions.querySelector(".efmp-modal__cal--ics").onclick = function () { downloadICS([d.ics], d.ics.title); };
      } else {
        actions.hidden = true;
      }
    }
    modal.hidden = false;
    document.body.classList.add("efmp-modal-open");
    setBgInert(true);   // hide the rest of the widget from AT + tab order while the dialog is open
    if (d.afterRender) d.afterRender(content);
    modal.querySelector(".efmp-modal__close").focus();
  }
  // Make everything except the dialog inert (and aria-hidden as a fallback) so a
  // screen reader / keyboard can't wander into the background behind the modal.
  function setBgInert(on) {
    if (!root) return;
    var kids = root.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] === modal) continue;
      try { kids[i].inert = on; } catch (e) {}
      if (on) kids[i].setAttribute("aria-hidden", "true"); else kids[i].removeAttribute("aria-hidden");
    }
  }

  // The whole-view "Add to Calendar" chooser. Google has no bulk one-click add,
  // so for a batch we offer the .ics (Apple opens it directly; Google/Outlook
  // import it); a single-event view also gets a one-click Google link.
  function openAddToCalendar(events, label, feedKey) {
    if (!events || !events.length) return;
    var single = events.length === 1;
    var gUrl = single ? gcalUrl(events[0]) : null;
    var canSub = !!(SUBSCRIBE_BASE && feedKey);
    var fname = "EFM-" + icsSlug(label) + ".ics";
    // date span across the events, so it's obvious exactly what's being added
    var keys = events.map(function (e) { return icsDate(e.dateStr); }).filter(Boolean)
      .map(function (p) { return p.m * 100 + p.d; }).sort(function (a, b) { return a - b; });
    var span = "";
    if (keys.length) {
      var lo = keys[0], hi = keys[keys.length - 1];
      span = monthAbbr(lo) + " " + (lo % 100) +
        (hi !== lo ? " – " + monthAbbr(hi) + " " + (hi % 100) : "") + ", " + YEAR;
    }
    var html = '<div class="efmp-cal">' +
      '<div class="efmp-cal__what">' +
        '<div class="efmp-cal__what-label">You\'re adding</div>' +
        '<div class="efmp-cal__what-name">' + esc(label || "This schedule") + '</div>' +
        '<div class="efmp-cal__what-meta">' + events.length + ' event' + (single ? "" : "s") +
          (span ? " &#183; " + esc(span) : "") + '</div>' +
        '<div class="efmp-cal__what-file">Download file: ' + esc(fname) + '</div>' +
      '</div>' +
      // --- Google ---
      '<div class="efmp-cal__opt"><div class="efmp-cal__name">Google Calendar</div>' +
        (canSub
          ? '<a class="efmp-modal__cal" target="_blank" rel="noopener noreferrer" href="' + esc(gcalSubscribeUrl(feedKey)) + '">Subscribe (auto-updates)</a>' +
            '<button type="button" class="efmp-modal__cal efmp-modal__cal--ghost" data-cal-dl data-cal-gimport>Download .ics instead</button>' +
            '<p class="efmp-cal__hint">Subscribe keeps it in sync (refreshes every few hours). Or download a one-time copy.</p>'
          : (gUrl
            ? '<a class="efmp-modal__cal" target="_blank" rel="noopener noreferrer" href="' + esc(gUrl) + '">Add to Google Calendar</a>'
            : '<button type="button" class="efmp-modal__cal" data-cal-dl data-cal-gimport>Download .ics for Google</button>' +
              '<p class="efmp-cal__hint">Opens Google\'s import page in a new tab; choose the file we just downloaded.</p>')) +
      '</div>' +
      // --- Apple ---
      '<div class="efmp-cal__opt"><div class="efmp-cal__name">Apple Calendar</div>' +
        (canSub
          ? '<a class="efmp-modal__cal" href="' + esc(webcalUrl(feedKey)) + '">Subscribe (auto-updates)</a>' +
            '<button type="button" class="efmp-modal__cal efmp-modal__cal--ghost" data-cal-dl>Download .ics instead</button>'
          : '<button type="button" class="efmp-modal__cal" data-cal-dl>Open in Apple Calendar</button>' +
            '<p class="efmp-cal__hint">Opens the file in Apple Calendar, which asks to add ' + (single ? "it" : "them") + '. (On iPhone/iPad it opens straight from the tap.)</p>') +
      '</div>' +
      // --- everything else ---
      '<div class="efmp-cal__opt"><div class="efmp-cal__name">Other apps (Outlook, etc.)</div>' +
        '<button type="button" class="efmp-modal__cal' + (canSub ? " efmp-modal__cal--ghost" : "") + '" data-cal-dl>Download .ics</button>' +
        '<p class="efmp-cal__hint">Import the file in your calendar app.</p>' +
      '</div>' +
    '</div>';
    openModal({ title: "Add to calendar", html: html, afterRender: function (content) {
      Array.prototype.forEach.call(content.querySelectorAll("[data-cal-dl]"), function (b) {
        b.addEventListener("click", function () {
          downloadICS(events, label);
          if (b.hasAttribute("data-cal-gimport")) {
            try { window.open("https://calendar.google.com/calendar/r/settings/import", "_blank", "noopener"); } catch (e) {}
          }
        });
      });
    } });
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("efmp-modal-open");
    setBgInert(false);   // restore the background before returning focus to it
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function trapKey(e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.slice.call(
      modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---- legend ------------------------------------------------------------
  function applyLegend(rows) {
    var section = "";
    rows.forEach(function (r) {
      var a = (r[0] || "").trim(), b = (r[1] || "").trim();
      if (/^Rooms/i.test(a)) { section = "rooms"; return; }
      if (/^Ensembles/i.test(a)) { section = "ens"; return; }
      if (!a || !b) return;
      if (section === "rooms") ROOM_NAMES[a] = b;
    });
  }

  // ---- parsing ------------------------------------------------------------
  // Dedicated ESO/GSO tab -> details/PDF join map. These lean tabs (Date, Day,
  // Time, Room, Room Name, Conductor / Soloist, Event, Details, [PDF Link]) hold
  // the per-rehearsal Details + program PDF that the big Master Calendar tab
  // leaves blank. Header-keyed (column order/naming-robust); keyed by
  // dateKey|ENS|clock so parseCalendar can graft them onto matching rows.
  function parseEnsembleDetails(rows, code, map) {
    rows = rows || [];
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      var lc = rows[i].map(function (x) { return clean(x).toLowerCase(); });
      if (clean(rows[i][0]) === "Date" || (lc.indexOf("date") !== -1 && lc.indexOf("time") !== -1)) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return;
    var hdr = rows[headerIdx].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var idx = hdr.indexOf(arguments[a]); if (idx !== -1) return idx; } return -1; }
    var iDate = col("date"), iTime = col("time"), iDet = col("details", "notes"),
        iPdf = col("pdf link", "pdf", "pdf url", "program pdf", "program url");
    var lastDate = "";
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j]; if (!c.join("").trim()) continue;
      var date = clean(c[iDate]) || lastDate; lastDate = date;
      var det = iDet !== -1 ? clean(c[iDet]) : "", pdf = iPdf !== -1 ? safeUrl(c[iPdf]) : "";
      if (!det && !pdf) continue;
      var k = dateKey(date) + "|" + code + "|" + clockKey(iTime !== -1 ? c[iTime] : "");
      if (!map[k]) map[k] = {};
      if (det && !map[k].details) map[k].details = det;
      if (pdf && !map[k].pdf) map[k].pdf = pdf;
    }
  }

  function parseCalendar(rows) {
    rows = rows || [];
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i][0] || "").trim() === "Date") { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error("Header row not found");
    var lastDate = "", lastDay = "", seq = 0;
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j];
      if (!c.join("").trim()) continue;
      // Columns: Date, Day, Time, Room, Location, Ensemble, Conductor / Soloist, Type, Event, [Details]
      var date = (c[0] || "").trim() || lastDate;
      var day = (c[1] || "").trim() || ((c[0] || "").trim() ? "" : lastDay);
      lastDate = date; lastDay = day;
      var roomRaw = (c[3] || "").trim(), location = (c[4] || "").trim();
      var roomTokens = tokens(roomRaw);
      var roomFull = roomTokens.map(roomLabel).join(" / ");
      var loc = (location && location !== roomRaw) ? (roomFull ? roomFull + " - " + location : location) : roomFull;
      var key = dateKey(date);
      var ensVal = (c[5] || "").trim(), ensToks = tokens(ensVal);
      // The big Master Calendar tab leaves Details + PDF blank for ESO/GSO rows;
      // graft them in from the dedicated ESO/GSO tabs (joined by date+ensemble+clock).
      var det = (c[9] || "").trim(), pdf = "";
      var ek = ensToks.indexOf("ESO") !== -1 ? "ESO" : (ensToks.indexOf("GSO") !== -1 ? "GSO" : "");
      if (ek) {
        var hit = ensDetail[key + "|" + ek + "|" + clockKey((c[2] || "").trim())];
        if (hit) { if (!det && hit.details) det = hit.details; if (hit.pdf) pdf = hit.pdf; }
      }
      var entry = {
        seq: seq++, date: date, day: day, key: key,
        dayNum: key !== null ? String(key % 100) : "",
        time: (c[2] || "").trim(), startMin: startMinutes((c[2] || "").trim()), loc: loc,
        roomTokens: roomTokens,
        ensemble: ensVal, ensTokens: ensToks,
        conductor: (c[6] || "").trim(),
        type: (c[7] || "").trim(), event: (c[8] || "").trim(),
        details: det, pdf: pdf
      };
      entry.haystack = [entry.date, entry.day, entry.time, entry.loc, entry.ensemble,
        entry.conductor, entry.type, entry.event, entry.details].join(" ").toLowerCase();
      allRows.push(entry);
      roomTokens.forEach(function (t) { seenRooms[t] = true; });
    }
    allRows.sort(function (a, b) {
      var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key;
      return ka - kb || a.startMin - b.startMin || a.seq - b.seq;
    });
    allRows.forEach(function (r, i) { r.seq = i; });
  }

  // ---- rosters (Student-Rosters tab) -------------------------------------
  // Header-keyed parse of the Student-Rosters tab. Each row is a seating roster
  // for one ensemble-week ("Week N (ESO|GSO)") with a PDF link and a Release?
  // gate, mirroring the faculty portal's Rosters mechanism. Columns by name so
  // order/casing changes survive; falls back to the first column for the title.
  function parseRosters(rows) {
    rows = rows || [];
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      var lc = rows[i].map(function (x) { return clean(x).toLowerCase(); });
      if (lc.indexOf("week/title") !== -1 || lc.indexOf("week / title") !== -1 || lc.indexOf("title") !== -1 ||
          (lc.indexOf("week") !== -1 && lc.indexOf("link") !== -1)) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return [];
    var hdr = rows[headerIdx].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var x = hdr.indexOf(arguments[a]); if (x !== -1) return x; } return -1; }
    var iTitle = col("week/title", "week / title", "week", "title", "roster"); if (iTitle === -1) iTitle = 0;
    var iLink = col("link", "url", "pdf", "pdf link", "roster link");
    var iRel = col("release?", "release", "released", "publish", "show");
    var out = [];
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j]; if (!c.join("").trim()) continue;
      var title = clean(c[iTitle]); if (!title) continue;
      out.push({ title: title, link: iLink !== -1 ? safeUrl(c[iLink]) : "", release: iRel !== -1 ? clean(c[iRel]) : "" });
    }
    return out;
  }
  // "Week 1 (ESO)" -> { week: 1, code: "ESO" }. The parenthetical names the ensemble.
  function rosterMeta(title) {
    var w = clean(title).match(/week\s*0*(\d+)/i);
    var q = clean(title).match(/\(([^)]+)\)/);
    var code = "";
    if (q) { var u = q[1].trim().toUpperCase(); if (u === "ESO" || u === "GSO") code = u; }
    return { week: w ? parseInt(w[1], 10) : null, code: code };
  }
  // Concert-cycle anchors for an ensemble: cycle N -> the dateKey of that concert.
  // Cycles 2..N come from the numbered "ESO 2" / "GSO 5 / ESO 5" Concert rows;
  // cycle 1 is the combined opening gala (the earliest row whose Event names two
  // or more bare orchestra codes, e.g. "ESO/GSO/EFO"), which has no "ESO 1" row.
  function buildEnsAnchors(code) {
    var a = {};
    allRows.forEach(function (r) {
      if (r.key === null || r.ensTokens.indexOf(code) === -1) return;
      if (r.type === "Concert / Performance") {
        var m = clean(r.event).match(new RegExp(code + "\\s*0*(\\d+)", "i"));
        if (m) a[parseInt(m[1], 10)] = r.key;
      }
    });
    if (a[1] === undefined) {
      for (var i = 0; i < allRows.length; i++) {
        var r = allRows[i];
        if (r.key === null || r.ensTokens.indexOf(code) === -1) continue;
        var bare = clean(r.event).split("/").map(function (s) { return s.trim().toUpperCase(); })
          .filter(function (t) { return t === "ESO" || t === "GSO" || t === "EFO"; });
        if (bare.length >= 2) { a[1] = r.key; break; }
      }
    }
    return a;
  }
  // The ensemble's services for a roster week: every row tagged with that ensemble
  // from the previous cycle's concert (exclusive) through this cycle's concert.
  function rosterServices(code, week) {
    var a = ensAnchors[code] || {};
    var upper = a[week];
    if (upper === undefined) return [];               // that concert not in the calendar yet
    var lower = a[week - 1];                            // undefined for week 1
    return allRows.filter(function (r) {
      if (r.key === null || r.ensTokens.indexOf(code) === -1) return false;
      return lower === undefined ? r.key <= upper : (r.key > lower && r.key <= upper);
    });
  }

  // Announcements tab. Columns are resolved BY NAME from the header row, falling
  // back to the legacy positions (Text=0, Date=1, Logic=2) so an older sheet keeps
  // working. The optional Type column drives a category chip in the ticker; the
  // optional Audience column (All / Students / Faculty) gates which portal shows it.
  function parseAnnouncements(rows) {
    if (!rows || !rows.length) return [];
    var hdr = rows[0].map(function (c) { return (c || "").trim().toLowerCase(); });
    function col(names, dflt) { for (var n = 0; n < names.length; n++) { var x = hdr.indexOf(names[n]); if (x !== -1) return x; } return dflt; }
    var iText = col(["announcement text", "text", "announcement"], 0);
    var iDate = col(["date"], 1);
    var iLogic = col(["logic"], 2);
    var iType = col(["type", "category"], -1);
    var iAud = col(["audience", "portal", "who"], -1);
    var out = [];
    for (var i = 1; i < rows.length; i++) {  // skip header
      var r = rows[i];
      var text = (r[iText] || "").trim(), date = (r[iDate] || "").trim(), logic = (r[iLogic] || "").trim();
      if (!text && !date) continue;
      out.push({ text: text, dateRaw: date, key: dateKey(date), logic: logic,
        type: iType >= 0 ? (r[iType] || "").trim() : "",
        audience: iAud >= 0 ? (r[iAud] || "").trim() : "" });
    }
    return out;
  }

  // Parse the "Staff List" tab into department groups. Layout (by position, no
  // header row): col A = name (or a department name on a section row), B = title,
  // C = email or phone, D = office/location. A row is a DEPARTMENT header when its
  // last cell is "Office" (the sheet's section marker) and B/C are empty.
  function parseStaff(rows) {
    var groups = [], cur = null;
    (rows || []).forEach(function (r) {
      var a = (r[0] || "").trim(), b = (r[1] || "").replace(/\s+/g, " ").trim(),
          c = (r[2] || "").trim(), d = (r[3] || "").trim();
      if (!a && !b && !c && !d) return;                          // blank spacer row
      if (a && !b && !c && d.toLowerCase() === "office") {       // department header
        cur = { dept: a, people: [] }; groups.push(cur); return;
      }
      if (!a && !b && !c) return;                                // nothing useful
      if (!cur) { cur = { dept: "", people: [] }; groups.push(cur); }
      cur.people.push({ name: a, title: b, contact: c, office: d });
    });
    return groups.filter(function (g) { return g.people.length; });
  }

  function appendRoomTabs() {
    var roomsTab = null;
    for (var t = 0; t < NAV.length; t++) {
      if (NAV[t].subs.some(function (s) { return s.kind === "roomsToday"; })) { roomsTab = NAV[t]; break; }
    }
    if (!roomsTab) return;
    ROOM_ORDER.concat(Object.keys(seenRooms).filter(function (r) {
      return ROOM_ORDER.indexOf(r) === -1;
    })).forEach(function (code) {
      if (seenRooms[code]) roomsTab.subs.push({ label: roomLabel(code), kind: "room", code: code });
    });
  }

  // ---- load ------------------------------------------------------------
  function loadCSV(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(parseCSV);
  }

  // Resolve tab gids by NAME from the published directory (pubhtml). Google's
  // CSV endpoint ignores &sheet=NAME, so gid is the only per-tab selector, but
  // gids change on rebuild while names don't. pubhtml returns CORS for the
  // requesting origin, so this works from the live site.
  function resolveTabGids() {
    return fetch(PUBHTML, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (html) {
      var map = {};
      html.split("items.push(").forEach(function (chunk) {
        var n = chunk.match(/name:\s*"([^"]+)"/);
        var g = chunk.match(/gid:\s*"(\d+)"/);
        if (n && g) map[n[1]] = g[1];
      });
      return map;
    });
  }

  function build(data) {
    built = true;
    // Reset the accumulating state so build() is safe to run twice (SWR: paint
    // cached data, then re-render if the fresh fetch differs). cloneNav() gives a
    // pristine NAV; allRows/seenRooms are push-accumulated by parseCalendar.
    NAV = cloneNav();
    allRows = [];
    seenRooms = {};
    if (data.legend) applyLegend(data.legend);
    if (data.staff) staff = parseStaff(data.staff);
    facultyDir = data.facultyContacts ? parseFacultyDirectory(data.facultyContacts) : [];
    if (data.generalInfo) generalInfo = data.generalInfo.map(function (r) { return (r[0] || "").trim(); });
    if (data.lessons) lessons = parseLessons(data.lessons);
    // Enrich the faculty directory with lesson studio + chamber-coach status, joined
    // by name (full name OR lastname|first-initial, to bridge nicknames across sheets).
    (function () {
      var roomByKey = {}, coachKeys = {}, roster = parseRoster(data.facultyRoster);
      lessons.forEach(function (g) { (g.people || []).forEach(function (pp) { if (pp.name && pp.room) nameKeys(pp.name).forEach(function (k) { if (!roomByKey[k]) roomByKey[k] = pp.room; }); }); });
      parseChamberCoachNames(generalInfo).forEach(function (nm) { nameKeys(nm).forEach(function (k) { coachKeys[k] = true; }); });
      facultyDir.forEach(function (p) {
        nameKeys(p.name).forEach(function (k) {
          if (!p.room && roomByKey[k]) p.room = roomByKey[k];
          if (coachKeys[k]) p.isCoach = true;
          if (roster[k]) { if (!p.section) p.section = roster[k].section; if (!p.photo) p.photo = roster[k].photo; if (!p.roleTitle) p.roleTitle = roster[k].role; }
        });
      });
    })();
    if (data.announcements) announcements = parseAnnouncements(data.announcements);

    // Info tabs (raw rows) + the section -> room table used for sectional modals.
    ["placement", "sectionals", "studio", "concerto"].forEach(function (k) { infoTabs[k] = data[k] || null; });
    sectionalLocations = data.sectionals ? parseSectionalLocations(data.sectionals) : [];
    sectionalData = parseSectionals(data.sectionals);

    // Student-Rosters tab -> the released roster weeks, surfaced as a third-level
    // nav under ESO/GSO Schedule (renderNav -> weeksFor). Each title is
    // "Week N (ESO|GSO)"; rosterMeta pulls the ensemble + week.
    rostersAll = data.rosters ? parseRosters(data.rosters) : [];
    rosterWeeks = rostersAll
      .filter(function (o) { return /^y(es)?$/i.test(clean(o.release)); })
      .map(function (o) { var m = rosterMeta(o.title); return { code: m.code, week: m.week, title: o.title, link: o.link }; })
      .filter(function (s) { return s.code && s.week != null; });
    // Conditional sub-tabs (Placement Auditions, Concerto Competition) appear only
    // when their tab's Show/Hide cell reads "Yes"; drop any parent left with no subs.
    NAV.forEach(function (t) {
      t.subs = t.subs.filter(function (s) { return !s.showWhen || /^y(es)?$/i.test(showHideValue(infoTabs[s.showWhen] || [])); });
    });
    NAV = NAV.filter(function (t) { return t.subs.length; });
    NAV.forEach(function (t) { if (subSel[t.id] >= t.subs.length) subSel[t.id] = 0; });

    // ESO/GSO Details + program PDFs come from their dedicated tabs; build the
    // join map before parseCalendar so it can graft them onto matching rows.
    ensDetail = {};
    parseEnsembleDetails(data.esoDetails, "ESO", ensDetail);
    parseEnsembleDetails(data.gsoDetails, "GSO", ensDetail);
    parseCalendar(data.calendar);
    ensAnchors = { ESO: buildEnsAnchors("ESO"), GSO: buildEnsAnchors("GSO") };
    appendRoomTabs();
    renderTicker();

    renderNav();
    renderList();
  }

  function fail(err) {
    if (status) {
      status.textContent = "Could not load the schedule right now. Please refresh the page, or contact the EFM office.";
      status.hidden = false;
      announce(status.textContent);
    }
    console.error("EFM schedule load failed:", err);
  }

  // Load every source tab in parallel. Each tab fetches by its known gid FIRST
  // (fast path), so the ~0.5s directory round-trip stays off the critical path;
  // the directory is resolved in parallel and only consulted when a gid fetch
  // comes back empty (sheet rebuilt -> gids moved). calendar also falls back to
  // the bare CSV (first tab = Master Calendar) so the schedule still renders. (#1)
  // ---- SWR cache: instant repeat loads ----------------------------------
  // Paint the last-seen data immediately from localStorage, then revalidate in the
  // background and re-render only if the fresh fetch differs. (#4)
  var _generalInfoP = null;   // in-flight General Information fetch, for the early Dining paint
  var CACHE_KEY = "efmp-cache-v1", CACHE_MAX_AGE = 2 * 24 * 60 * 60 * 1000;   // paint cache up to 2 days old; always revalidate
  function _ls() { try { return window.localStorage; } catch (e) { return null; } }
  function readCache() {
    var ls = _ls(); if (!ls) return null;
    try {
      var o = JSON.parse(ls.getItem(CACHE_KEY) || "null");
      if (!o || !o.d) return null;
      if (typeof o.t === "number" && (Date.now() - o.t) > CACHE_MAX_AGE) return null;
      return o.d;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    var ls = _ls(); if (!ls) return;
    try { ls.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
  }

  // Kick off all source-tab fetches and resolve to the { key: rows } data object.
  // Touches no DOM, so it can run before DOMContentLoaded. (#2)
  function startFetches() {
    // Lazy directory: only fetch the published-tab directory if a known gid misses
    // (a sheet rebuild moved it), which never happens normally, so that ~1.2s fetch
    // stays off the wire entirely on a normal load. (#1)
    var _dir = null;
    function dir() { return _dir || (_dir = resolveTabGids().then(function (m) { return m; }, function () { return {}; })); }
    function fetchTab(s) {
      var firstUrl = s.gid ? (CSV + "&gid=" + s.gid) : (s.key === "calendar" ? CSV : null);
      var first = firstUrl
        ? loadCSV(firstUrl).then(function (rows) { return rows && rows.length ? rows : null; }, function () { return null; })
        : Promise.resolve(null);
      return first.then(function (rows) {
        if (rows) return rows;
        return dir().then(function (map) {
          var gid = map[s.tab];
          if (gid && gid !== s.gid) return loadCSV(CSV + "&gid=" + gid).then(function (r) { return r && r.length ? r : null; }, function () { return null; });
          if (s.key === "calendar") return loadCSV(CSV).then(function (r) { return r; }, function () { return null; });
          return null;
        });
      });
    }
    var jobs = {};
    SOURCES.forEach(function (s) { jobs[s.key] = fetchTab(s); });
    // Faculty emails: the Faculty-Portal workbook's FacultyContact tab (gid 0).
    jobs.facultyContacts = loadCSV(FP_CSV + "0").then(function (r) { return r && r.length ? r : null; }, function () { return null; });
    // Faculty headshots + section grouping from the public roster sheet (gviz, pub fallback).
    jobs.facultyRoster = loadCSV(ROSTER_CSV).then(function (r) { return r && r.length ? r : null; }, function () { return null; })
      .then(function (r) { return r || loadCSV(ROSTER_CSV_FALLBACK).then(function (r2) { return r2 && r2.length ? r2 : null; }, function () { return null; }); });
    _generalInfoP = jobs.generalInfo || null;
    var keys = Object.keys(jobs);
    return Promise.all(keys.map(function (k) { return jobs[k]; })).then(function (results) {
      var data = {}; keys.forEach(function (k, i) { data[k] = results[i]; });
      return data;
    });
  }

  // ---- boot --------------------------------------------------------------
  // Wrapped so block/script order never matters, and so the script no-ops on
  // any page that doesn't contain the widget.
  function boot() {
    root = document.getElementById("efm-portal");
    if (!root) return;
    topnav = document.getElementById("efmp-topnav");
    subnav = document.getElementById("efmp-subnav");
    // Third-level nav (roster weeks under ESO/GSO Schedule), injected so the pasted
    // embed markup never has to change.
    subnav2 = document.createElement("nav");
    subnav2.id = "efmp-subnav2";
    subnav2.className = "efmp__subtabs efmp__subtabs--week";
    subnav2.setAttribute("aria-label", "Roster week");
    subnav2.hidden = true;
    if (subnav && subnav.parentNode) subnav.parentNode.insertBefore(subnav2, subnav.nextSibling);
    list = document.getElementById("efmp-list");
    status = document.getElementById("efmp-status");
    banner = document.getElementById("efmp-banner");
    searchBox = document.getElementById("efmp-search");

    // Visually-hidden polite live region: the single announcer for loading /
    // result counts / empty / error states (so nothing is announced twice).
    srLive = document.createElement("div");
    srLive.className = "efmp__sr";
    srLive.setAttribute("aria-live", "polite");
    srLive.setAttribute("aria-atomic", "true");
    root.appendChild(srLive);
    announce("Loading the schedule…");

    // Announcements ticker, injected ABOVE the nav tabs (just under the title).
    // (The visible "Announcements" label inside it provides the name; no aria-label on the div.)
    ticker = document.createElement("div");
    ticker.className = "efmp__ticker";
    ticker.id = "efmp-ticker";
    ticker.hidden = true;
    controls = root.querySelector(".efmp__controls");
    var tabsEl = root.querySelector(".efmp__tabs");
    if (tabsEl && tabsEl.parentNode) tabsEl.parentNode.insertBefore(ticker, tabsEl);
    else if (controls && controls.parentNode) controls.parentNode.insertBefore(ticker, controls.nextSibling);

    // "Add to Calendar (.ics)" export button, beside the search box. Snapshot of
    // the events currently shown (tab + sub-tab + search). Injected here so the
    // pasted embed markup never has to change.
    icsBtn = document.createElement("button");
    icsBtn.type = "button";
    icsBtn.id = "efmp-ics";
    icsBtn.className = "efmp__ics";
    icsBtn.hidden = true;
    icsBtn.textContent = "Add to Calendar";
    icsBtn.title = "Add the events shown here to your calendar";
    icsBtn.setAttribute("aria-label", "Add the events shown here to your calendar");
    icsBtn.addEventListener("click", function () { if (viewEvents.length) openAddToCalendar(viewEvents, viewLabel, viewFeedKey); });
    if (controls) controls.appendChild(icsBtn);

    // Details modal, injected once.
    modal = document.createElement("div");
    modal.className = "efmp-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="efmp-modal__box" role="dialog" aria-modal="true" aria-labelledby="efmp-modal-title">' +
        '<button type="button" class="efmp-modal__close" aria-label="Close">×</button>' +
        '<div class="efmp-modal__title" id="efmp-modal-title" role="heading" aria-level="2"></div>' +
        '<div class="efmp-modal__content"></div>' +
        '<div class="efmp-modal__actions" hidden>' +
          '<span class="efmp-modal__addlabel">Add to calendar:</span>' +
          '<a class="efmp-modal__cal efmp-modal__cal--gcal" target="_blank" rel="noopener noreferrer" href="#">Google Calendar</a>' +
          '<button type="button" class="efmp-modal__cal efmp-modal__cal--ics">Apple Calendar (.ics)</button>' +
        '</div>' +
      '</div>';
    root.appendChild(modal);
    modal.querySelector(".efmp-modal__close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener("keydown", trapKey);

    // Delegated open-modal handlers on the list (rows carry data-mi).
    list.addEventListener("click", function (e) {
      var row = e.target.closest ? e.target.closest("[data-mi]") : null;
      if (row) openModal(modalData[+row.getAttribute("data-mi")]);
    });
    list.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest ? e.target.closest("[data-mi]") : null;
      if (row) { e.preventDefault(); openModal(modalData[+row.getAttribute("data-mi")]); }
    });

    searchBox.addEventListener("input", renderList);   // wired once (build() no longer re-adds it)
    if (!_dataPromise) _dataPromise = startFetches();  // host appeared after the script ran
    // SWR: paint the last-cached data instantly, then revalidate. With no usable
    // cache, fall back to the early Dining paint while the first fetch lands. (#2)(#4)
    var cacheStr = null;
    var cached = readCache();
    if (cached && !SOURCES.some(function (s) { return s.required && !cached[s.key]; })) {
      try { cacheStr = JSON.stringify(cached); } catch (e) { cacheStr = null; }
      build(cached);
    } else if (_generalInfoP) {
      _generalInfoP.then(function (rows) {
        if (built || !rows) return;
        generalInfo = rows.map(function (r) { return (r[0] || "").trim(); });
        var top = currentTop(), sub = top.subs[subSel[top.id]] || top.subs[0];
        if (sub && sub.kind === "dining") renderDining();
      });
    }
    _dataPromise.then(function (data) {
      if (SOURCES.some(function (s) { return s.required && !data[s.key]; })) { if (!built) fail(new Error("required tab unavailable")); return; }
      var freshStr; try { freshStr = JSON.stringify(data); } catch (e) { freshStr = null; }
      writeCache(data);
      if (!built || freshStr === null || freshStr !== cacheStr) build(data);   // first paint, or the data changed
      cacheStr = freshStr;
    }).catch(function (e) { if (!built) fail(e); });
  }
  // (#2) Kick the data fetch off the moment this script runs (the host div sits just
  // above this <script>), instead of waiting for the whole Duda page's DOMContentLoaded.
  var _dataPromise = document.getElementById("efm-portal") ? startFetches() : null;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
