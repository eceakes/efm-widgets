/* ============================================================
   EFM Faculty Portal — behavior
   Hosted on eceakes/efm-widgets, served by jsDelivr, referenced from the
   password-protected /faculty-portal page:
     <link rel="stylesheet" href=".../efm-facultyportal.css">
     <div id="efm-faculty-portal" class="efmfp"> ... </div>
     <script src=".../efm-facultyportal.js"></script>

   Tabs:
     General Information  — Dining (from the Master Calendar "General
                            Information" tab) + Dress Code (Faculty-Portal sheet)
     Calendar             — EFO / ECP / REP (Master Calendar ensemble tabs, live;
                            search + one-click Add to Calendar, like 2026-portal)
     Rosters              — one sub-tab per Rosters-sheet week marked Release=Yes;
                            each shows the roster PDF + that week's EFO services,
                            inferred from the master calendar's EFO concert cycles
     Faculty Contact      — Faculty (headshot cards), Subs (cards), Orchestral
                            Fellows (headshot cards). Photos joined live by name.
     Staff Contact        — table from the Faculty-Portal "Staff" tab

   All section headings are role=heading DIVs (never real <h2>/<h3>): the EFM
   Duda site theme recolors any real heading, so we dodge it.
   ============================================================ */
(function () {
  "use strict";

  /* ---- data sources ---------------------------------------------------- */
  // The Faculty-Portal spreadsheet (the one Eric shared): all contact + dress +
  // roster + staff content. Read as published CSV per tab (gid).
  var FP_PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZk_YQ_WA4LsSFN_jv7HHlZwDS9UHrZvLrk7NoOV4czo6KBG_36pt0ymOUDwabyFhqXvX_GSXcgBDx";
  var FP_CSV = FP_PUB + "/pub?single=true&output=csv&gid=";
  var FP_PUBHTML = FP_PUB + "/pubhtml";
  // Known gids (fallback). Tab names are looked up by name first when the
  // published directory is readable, so a sheet rebuild that changes gids still
  // works; if the directory can't be read, these gids are used directly.
  // Tab names match the published directory (so a rebuild that changes gids still
  // resolves by name); gids are the fallback. The "General-Information" tab holds
  // the Dress Code + Library Documents sections (dining comes from the calendar).
  var FP_TABS = {
    faculty: { name: "FacultyContact", gid: "0" },
    info:    { name: "General-Information", gid: "1025224143" },
    rosters: { name: "Rosters", gid: "1681602909" },
    staff:   { name: "Staff", gid: "1949353186" },
    fellows: { name: "Orchestral-Fellows", gid: "752003554" },
    tickets: { name: "Friends-Family-Discounts", gid: "1079241752" }
  };

  // The Master Calendar (same document that feeds the 2026 portal). EFO/ECP/REP are
  // dedicated, pre-filtered ensemble tabs; "General Information" holds dining.
  // Resolved by NAME (gids change when the calendar is rebuilt); gids are fallback.
  var MC_PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQg7mhQsWCaOdsg1k_z-TkSHRqNDTuAQE7NEXr6xzCBR-psxMoQGExmVlINpF-xu_3FIgbE4qSK1aAJ";
  var MC_CSV = MC_PUB + "/pub?single=true&output=csv&gid=";
  var MC_PUBHTML = MC_PUB + "/pubhtml";
  var MC_TABS = {
    EFO:         { name: "EFO", gid: "1438770792" },
    ECP:         { name: "ECP", gid: "518713173" },
    REP:         { name: "REP", gid: "112601993" },
    OUT:         { name: "Outreach Concerts", gid: "1962241618" },
    // Student-orchestra tabs: not shown as their own pills, but their Details +
    // program PDF are grafted onto the ESO/GSO rows in All Events / Room Schedule
    // (the big Master Calendar tab leaves those columns blank). See build().
    ESO:         { name: "ESO", gid: "1603346554" },
    GSO:         { name: "GSO", gid: "727646847" },
    // Shared student-orchestra seating rosters (same tab the 2026 portal reads):
    // "Week N (ESO|GSO)" rows gated by a Release? cell.
    studentRosters: { name: "Student-Rosters", gid: "2066588541" },
    generalInfo: { name: "General Information", gid: "1031874194" },
    announcements: { name: "Announcements", gid: "1387308195" },
    // Full master calendar + Legend -> the Room Schedule tab (today + per-room).
    master:      { name: "Master Calendar", gid: "310873840" },
    legend:      { name: "Legend", gid: "578774100" },
    // Classes & Assignments info tabs (same source the 2026 portal uses).
    placement:   { name: "Placement Auditions", gid: "1024060038" },
    sectionals:  { name: "Sectional Rehearsals", gid: "436439129" },
    studio:      { name: "Faculty Studio Classes", gid: "166720750" },
    concerto:    { name: "Concerto Competition", gid: "1210854934" },
    lessons:     { name: "Faculty Lesson Locations", gid: "1473494961" }
  };

  // Headshots. Faculty photos come from the same roster sheet the public Faculty
  // page uses; fellow photos from the same sheet the school "2026 Fellows" tab
  // uses. Both: gviz primary (CORS-clean from the live site) + publish fallback.
  var FACULTY_PHOTO_URLS = [
    "https://docs.google.com/spreadsheets/d/1PuagTf2lB19eRNRmbaUdYzKytzoLCQ6PsRrgBAxvPTw/gviz/tq?tqx=out:csv&gid=1338599143",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlBTW1VcRV6-cDZfm9ibRqo23_c1BAvMRfC3eoTj502VrUaxov7OsDY6anYA7a8akD8bz9IfCCDJ3i/pub?gid=1338599143&single=true&output=csv"
  ];
  var FELLOW_PHOTO_URLS = [
    "https://docs.google.com/spreadsheets/d/13-BoGp6mgwtO4Dik00yL8GtBCNJxGF5R6dWfS3LnF6Q/gviz/tq?tqx=out:csv&gid=0",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwqLaKpbTcG97P3JqEynwskulE7oxMaRAb2KfBKZjPtRu7P53IiZ2tUwtnu7rVPcVHcyaemFUduaqV/pub?gid=0&single=true&output=csv"
  ];

  // Live subscribe feed (same Apps Script web app as the 2026 portal).
  var SUBSCRIBE_BASE = "https://script.google.com/macros/s/AKfycbz6fh9qP2zQnaRfzV2qW0dndtwUrhXahOLuxxDmibCxqPaQOlW-_D98EUpUlWkAY07tFA/exec";
  var FEED_VIEWS = { EFO: "efo", ECP: "ecp", ESO: "eso", GSO: "gso" };   // Outreach + REP have no live feed (.ics export only)
  var YEAR = 2026;

  // Campus map assets sit next to this script in the repo. Derive the CDN base
  // from this script's own URL so the map always matches the deployed commit
  // (falls back to @main if loaded some other way, e.g. a local test page).
  var CDN_BASE = (function () {
    var s = (document.currentScript && document.currentScript.src) || "";
    var m = s.match(/^(.*\/efm-widgets@[^/]+\/)/);
    return m ? m[1] : "https://cdn.jsdelivr.net/gh/eceakes/efm-widgets@main/";
  })();
  var MAP_IMAGE_URL = CDN_BASE + "efm-campus-map.jpg";
  var MAP_PDF_URL = CDN_BASE + "efm-campus-map.pdf";

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  // Room code -> full name (the Legend tab overrides these once loaded); ROOM_ORDER
  // fixes the Room Schedule pill order. Both feed the Room Schedule tab.
  var ROOM_NAMES = {
    C: "Choir Room", CC: "South Apt. Community Center", CO: "The Cottage",
    CR: "Carnegie Room (Hege Library)", HL: "Hege Library", D: "Dana Auditorium",
    MR: "Moon Room", S: "Sternberger Auditorium", Var: "Various Locations"
  };
  var ROOM_ORDER = ["D", "S", "MR", "CR", "C", "CC", "HL", "CO", "Var"];

  // Faculty section order (mirrors the public Faculty page).
  var SECTION_ORDER = ["Conductors", "Flute", "Oboe", "Clarinet", "Bassoon",
    "French Horn", "Trumpet", "Trombone", "Tuba", "Percussion & Timpani",
    "Harp", "Piano", "Violin", "Viola", "Cello", "Double Bass"];

  /* ---- navigation model ------------------------------------------------ */
  // NAV[0] is the default tab on load. Tab order left -> right; mirrors the 2026
  // portal (General Information | Calendar | Classes & Assignments | … | Campus Map
  // | Room Schedule) with the faculty-only Contact tabs kept together.
  var NAV = [
    // General Information is now pill-split (like the 2026 portal). "Dining" is the
    // Master Calendar dining block (on-campus hours + off-campus options); the rest
    // are major sections pulled from the Faculty-Portal "General-Information" tab,
    // matched by heading text.
    { id: "info", label: "General Information", subs: [
      { label: "Dining", kind: "dining" },
      { label: "Around Campus", kind: "aroundCampus" },
      { label: "Dress Code", kind: "infoSection", match: ["dress"] },
      { label: "Documents", kind: "infoSection", match: ["document"], all: true },
      { label: "Tickets", kind: "tickets" } ] },
    // Calendar: ensemble schedules + Outreach + All Events (the whole festival).
    // The EFO, ESO and GSO pills (weeks: true) reveal a 3rd-level week nav of the
    // released roster weeks (EFO from the Faculty-Portal Rosters tab; ESO/GSO from
    // the Master Calendar Student-Rosters tab). With no week chosen the pill shows
    // the full ensemble schedule; a week shows that week's roster + services.
    { id: "calendar", label: "Calendar", subs: [
      { label: "EFO", kind: "ensemble", code: "EFO", weeks: true },
      { label: "ECP", kind: "ensemble", code: "ECP" },
      { label: "REP", kind: "ensemble", code: "REP" },
      { label: "ESO", kind: "ensemble", code: "ESO", weeks: true },
      { label: "GSO", kind: "ensemble", code: "GSO", weeks: true },
      { label: "Outreach", kind: "ensemble", code: "OUT" },
      { label: "All Events", kind: "allEvents" } ] },
    // One grouped tab; the class + assignment pages are sub-tab pills. A pill
    // carrying showWhen appears only if that tab's Show/Hide cell reads "Yes"
    // (build()) — e.g. Placement Auditions hides when its sheet cell reads "No".
    { id: "programs", label: "Classes & Assignments", subs: [
      { label: "Placement Auditions", kind: "infoTab", source: "placement", showWhen: "placement" },
      { label: "Sectionals", kind: "sectional", sectionals: true },
      { label: "Studio Classes", kind: "infoTab", source: "studio" },
      { label: "Chamber Coaches", kind: "chamberCoaches" },
      { label: "Lessons", kind: "lessons" },
      { label: "Concerto Competition", kind: "infoTab", source: "concerto", showWhen: "concerto" } ] },
    { id: "contacts", label: "Contacts", subs: [
      { label: "Faculty", kind: "facultyCards" },
      { label: "Orchestral Fellows", kind: "fellowCards" },
      { label: "Staff", kind: "staffCards" } ] },
    { id: "map", label: "Campus Map", subs: [
      { label: "Map", kind: "map" } ] },
    { id: "rooms", label: "Room Schedule", subs: [
      { label: "Today", kind: "roomsToday" } ] }  // per-room pills appended after data loads
  ];

  /* ---- small inline icons --------------------------------------------- */
  var PHONE_ICO = '<svg class="efmfp-card__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var MAIL_ICO = '<svg class="efmfp-card__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>';

  /* ---- helpers --------------------------------------------------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false;
    text = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; } }
        else { field += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else { field += c; }
    }
    row.push(field); rows.push(row);
    if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
    return rows;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  // Strip zero-width / bidi control characters that sometimes ride along in
  // copy-pasted phone numbers, then trim.
  function clean(s) { return String(s == null ? "" : s).replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").trim(); }

  // Accent-folded, lowercased name key. first|last so middle names and accents
  // never block a match (e.g. "Christian Alejandro Cherubini Suárez" -> christian|suarez).
  function normName(s) {
    s = clean(s).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function nameKeys(full) {
    var n = normName(full);
    if (!n) return [];
    var t = n.split(" ");
    var keys = [n];
    if (t.length > 1) keys.push(t[0] + "|" + t[t.length - 1]);
    return keys;
  }
  function initials(name) {
    var p = clean(name).split(/\s+/).filter(Boolean);
    return ((p[0] ? p[0][0] : "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }

  // tel: href from the first phone number in a (possibly multi-number) cell.
  function telHref(raw) {
    var s = clean(raw);
    if (!s) return "";
    var first = s.split(/[;\/]|\bor\b/i)[0];
    var digits = first.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 7) return "";
    return "tel:" + digits;
  }
  function isEmail(s) { return /@/.test(clean(s)); }

  // Scheme-safe URL gate for any sheet-supplied URL that ends up in an href or
  // img src. Blocks javascript:/data:/vbscript:; allows http(s), mailto, tel,
  // relative paths, and bare domains (auto-https). Returns "" when unsafe.
  function safeUrl(u) {
    u = clean(u);
    if (!u) return "";
    if (/^(javascript|data|vbscript):/i.test(u)) return "";
    if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(u)) return u;
    if (/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://" + u;
    return "";
  }

  // Header-keyed table objects + an alias getter (column order/naming-robust).
  function tableObjects(rows) {
    if (!rows || !rows.length) return { headers: [], items: [] };
    var headers = rows[0].map(function (h) { return clean(h); });
    var items = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r.join("").trim()) continue;
      var o = {};
      headers.forEach(function (h, idx) { o[h] = clean(r[idx]); });
      items.push(o);
    }
    return { headers: headers, items: items };
  }
  function field(o, aliases) {
    for (var k in o) {
      if (!o.hasOwnProperty(k)) continue;
      var lk = k.toLowerCase();
      for (var i = 0; i < aliases.length; i++) if (lk === aliases[i]) return o[k];
    }
    return "";
  }

  var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function dateKey(str) {
    var s = clean(str);
    var m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})/);
    if (m) {
      var k3 = m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase();
      if (k3 in MONTHS) return (MONTHS[k3] + 1) * 100 + parseInt(m[2], 10);
    }
    var n = s.match(/^(\d{1,2})\/(\d{1,2})/);
    if (n) { var mo = parseInt(n[1], 10), d = parseInt(n[2], 10); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return mo * 100 + d; }
    return null;
  }
  function monthAbbr(key) { return key !== null ? MONTH_NAMES[Math.floor(key / 100) - 1].slice(0, 3) : ""; }
  function tokens(s) { return clean(s).split("/").map(function (t) { return t.trim(); }).filter(Boolean); }
  function roomLabel(code) { return ROOM_NAMES[code] || code; }
  // First H:MM clock token, meridiem-agnostic: joins the lean ESO/GSO tabs (times
  // read "2:00 – 5:00") onto Master Calendar rows ("2:00 PM - 5:00 PM").
  function clockKey(t) { var m = String(t == null ? "" : t).match(/(\d{1,2})(?::(\d{2}))?/); return m ? (m[1] + ":" + (m[2] || "00")) : ""; }
  // Label for an event's attached PDF: concerts get a program, rehearsals get a
  // rehearsal order. Keys off the Master Calendar Type ("Concert / Performance"
  // vs "Rehearsal"), falling back to event text and then a generic label.
  function pdfLabel(r) {
    var hay = ((r.type || "") + " " + (r.event || "")).toLowerCase();
    if (/concert|perform|recital/.test(hay)) return "View Program";
    if (/rehearsal|sectional/.test(hay)) return "View Rehearsal Order";
    return "View PDF";
  }
  function todayKey() { var now = new Date(); if (now.getFullYear() !== YEAR) return null; return (now.getMonth() + 1) * 100 + now.getDate(); }

  function startMinutes(time) {
    var s = clean(time);
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
    if (!mer) mer = (h >= 8 && h <= 11) ? "a" : "p";
    if (h === 12) h = 0;
    return (h + (mer === "p" ? 12 : 0)) * 60 + min;
  }

  /* ---- iCalendar (.ics) export + subscribe links (from 2026-portal) ---- */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function timeRange(timeStr) {
    var s = clean(timeStr);
    if (!s) return { allDay: true };
    var start = startMinutes(s);
    if (start < 0) return { allDay: true };
    var end = null;
    var parts = s.split(/\s*(?:–|—|-|\bto\b)\s*/i);
    if (parts.length > 1) {
      var e = startMinutes(parts[parts.length - 1]);
      if (e >= 0) { end = e; if (end < start && !/[ap]\.?\s*m/i.test(parts[parts.length - 1])) end += 720; if (end > 1439) end = 1439; }
    }
    return { allDay: false, start: start, end: end };
  }
  function icsDate(dateStr) { var key = dateKey(dateStr); if (key === null) return null; return { y: YEAR, m: Math.floor(key / 100), d: key % 100 }; }
  function icsFmtDate(p) { return "" + p.y + pad2(p.m) + pad2(p.d); }
  function icsFmtDateTime(p, min) { return icsFmtDate(p) + "T" + pad2(Math.floor(min / 60)) + pad2(min % 60) + "00"; }
  function icsNextDay(p) { var dt = new Date(p.y, p.m - 1, p.d + 1); return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }; }
  function icsEsc(s) { return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsUID(ev) {
    var basis = [ev.title, ev.dateStr, ev.timeStr, ev.location].join("|"), h = 0;
    for (var i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) | 0;
    return "efmfp-" + (h >>> 0).toString(36) + "@easternfestivalofmusic.org";
  }
  function icsStampUTC() {
    var d = new Date();
    return "" + d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
  }
  function vevent(ev, stamp) {
    var p = icsDate(ev.dateStr); if (!p) return null;
    var t = timeRange(ev.timeStr), lines = ["BEGIN:VEVENT", "UID:" + icsUID(ev), "DTSTAMP:" + stamp];
    if (t.allDay) { lines.push("DTSTART;VALUE=DATE:" + icsFmtDate(p)); lines.push("DTEND;VALUE=DATE:" + icsFmtDate(icsNextDay(p))); }
    else { var end = (t.end !== null && t.end > t.start) ? t.end : Math.min(t.start + 60, 1439); lines.push("DTSTART:" + icsFmtDateTime(p, t.start)); lines.push("DTEND:" + icsFmtDateTime(p, end)); }
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
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eastern Festival of Music//Faculty Portal//EN",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + icsEsc(calName || "EFM Schedule")]
      .concat(body, ["END:VCALENDAR"]).join("\r\n") + "\r\n";
  }
  function icsSlug(s) { return (String(s || "schedule").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)) || "schedule"; }
  function downloadICS(events, label) {
    var text = buildICS(events, "EFM " + (label || "Schedule")); if (!text) return;
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" }), url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "EFM-" + icsSlug(label) + ".ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function gcalUrl(ev) {
    var p = icsDate(ev.dateStr); if (!p) return null;
    var t = timeRange(ev.timeStr), dates;
    if (t.allDay) dates = icsFmtDate(p) + "/" + icsFmtDate(icsNextDay(p));
    else { var end = (t.end !== null && t.end > t.start) ? t.end : Math.min(t.start + 60, 1439); dates = icsFmtDateTime(p, t.start) + "/" + icsFmtDateTime(p, end); }
    var q = ["action=TEMPLATE", "text=" + encodeURIComponent(ev.title || "Event"), "dates=" + dates, "ctz=America/New_York"];
    if (ev.location) q.push("location=" + encodeURIComponent(ev.location));
    if (ev.description) q.push("details=" + encodeURIComponent(ev.description));
    return "https://calendar.google.com/calendar/render?" + q.join("&");
  }
  function feedUrl(viewKey) { return SUBSCRIBE_BASE + (viewKey ? "?view=" + encodeURIComponent(viewKey) : ""); }
  function webcalUrl(viewKey) { return feedUrl(viewKey).replace(/^https?:\/\//i, "webcal://"); }
  function gcalSubscribeUrl(viewKey) { return "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(webcalUrl(viewKey)); }

  /* ---- state ----------------------------------------------------------- */
  var ensembles = {};      // code -> [serviceRow]
  var efoAnchors = {};     // concert number -> dateKey (for roster week inference)
  var ensAnchors = {};     // ESO/GSO code -> { cycleN: dateKey } (student-orchestra roster windows)
  var rostersAll = [];     // [{title, link, release}]
  var calendarWeeks = [];  // released EFO roster weeks (Faculty-Portal Rosters tab)
  var ensWeeks = {};       // ensemble code -> [{label, roster}] released week pills (EFO + ESO + GSO)
  var weekSel = null;      // selected EFO week index, or null = full EFO schedule
  var sectionalData = null; // parsed Sectional Rehearsals: { eso, gso, perc, locations, esoCoaches, gsoCoaches }
  var sectionalEns = "ESO"; // selected sectionals ensemble (3rd-level under the Sectionals pill)
  var ticketData = null;    // parsed Friends-Family-Discounts: { head, blurb, codes:[{code,url,key,concert,day}], byKey }
  var facultyPeople = [];  // [{name, instrument, title, phone, email, photo, section}]
  var fellowPeople = [];
  var staffPeople = [];
  var diningLines = [];    // raw lines from Master Calendar General Information (dining)
  var infoRows = [];       // full rows from Faculty-Portal "General-Information" tab (dress code + library documents + ...)
  var announcements = [];  // {text,dateRaw,key,logic,type,audience} from the Master Calendar "Announcements" tab
  var lessons = [];        // [{ instrument, people:[{name, room}] }] from the Master Calendar "Faculty Lesson Locations" tab
  var allRows = [];        // every Master Calendar row (Room Schedule tab)
  var ensDetail = {};      // "dateKey|ENS|clock" -> { details, pdf } joined from the dedicated ESO/GSO tabs
  var seenRooms = {};      // room codes actually used (-> which per-room pills to build)
  var infoTabs = {};       // source key -> raw rows for Classes & Assignments (placement/sectionals/studio/concerto)

  var modalData = [], viewEvents = [], viewLabel = "", viewFeedKey = "";
  var built = false;        // true once the full build() has run (gates the early first-paint)
  var topSel = NAV[0].id, subSel = {};
  NAV.forEach(function (t) { subSel[t.id] = 0; });

  var root, topnav, subnav, subnav2, list, status, banner, searchBox, controls, icsBtn, modal, srLive, lastFocus, ticker;

  function currentTop() { for (var i = 0; i < NAV.length; i++) if (NAV[i].id === topSel) return NAV[i]; return NAV[0]; }
  function currentSub() { var t = currentTop(); return t.subs[subSel[t.id]] || t.subs[0]; }

  /* ---- nav render ------------------------------------------------------ */
  // Keep the active top tab visible inside the (swipeable, scrollbar-hidden) bar.
  function scrollActiveTabIntoView() {
    if (!topnav) return;
    var active = topnav.querySelector(".efmfp-active");
    if (!active || topnav.scrollWidth <= topnav.clientWidth) return;
    try { topnav.scrollLeft = active.offsetLeft - (topnav.clientWidth - active.offsetWidth) / 2; } catch (e) {}
  }
  function renderNav() {
    // The full rebuild destroys the button the user just activated; remember whether
    // focus was on a nav control so we can put it back on the new active button.
    var ae = document.activeElement;
    var refocus = ae && ae.parentNode === topnav ? "top"
      : ae && ae.parentNode === subnav ? "sub"
      : ae && subnav2 && ae.parentNode === subnav2 ? "sub2" : null;
    topnav.innerHTML = "";
    NAV.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = t.label;
      var on = t.id === topSel; b.className = on ? "efmfp-active" : "";
      if (on) b.setAttribute("aria-current", "true");
      b.onclick = function () { topSel = t.id; renderNav(); renderList(); };
      topnav.appendChild(b);
    });
    var top = currentTop();
    subnav.innerHTML = "";
    if (top.subs.length > 1) {
      top.subs.forEach(function (s, i) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = s.label;
        var on = i === subSel[top.id]; b.className = on ? "efmfp-active" : "";
        if (on) b.setAttribute("aria-current", "true");
        // Switching ensembles resets the EFO week selection back to the full schedule.
        b.onclick = function () { subSel[top.id] = i; if (top.id === "calendar") weekSel = null; renderNav(); renderList(); };
        subnav.appendChild(b);
      });
    }
    // 3rd-level: the released roster weeks, shown only when the active calendar
    // sub is "Eastern Festival Orchestra" (weeks: true).
    if (subnav2) {
      subnav2.innerHTML = "";
      var activeSub = top.subs[subSel[top.id]];
      var weeks = top.id === "calendar" ? weeksFor(activeSub) : [];
      if (weeks.length) {
        subnav2.hidden = false;
        weeks.forEach(function (w, i) {
          var b = document.createElement("button");
          b.type = "button"; b.textContent = w.label;
          var on = i === weekSel; b.className = on ? "efmfp-active" : "";
          if (on) b.setAttribute("aria-current", "true");
          // Clicking the active week toggles back to the full ensemble schedule.
          b.onclick = function () { weekSel = (weekSel === i ? null : i); renderNav(); renderList(); };
          subnav2.appendChild(b);
        });
      } else if (activeSub && activeSub.sectionals) {
        // ESO / GSO sectional pills (third level under the Sectionals pill).
        subnav2.hidden = false;
        ["ESO", "GSO"].forEach(function (ens) {
          var b = document.createElement("button");
          b.type = "button"; b.textContent = ens;
          var on = ens === sectionalEns; b.className = on ? "efmfp-active" : "";
          if (on) b.setAttribute("aria-current", "true");
          b.onclick = function () { sectionalEns = ens; renderNav(); renderList(); };
          subnav2.appendChild(b);
        });
      } else {
        subnav2.hidden = true;
      }
    }
    scrollActiveTabIntoView();
    // Restore keyboard focus to the active control so a tab/pill switch doesn't
    // drop focus to <body> (only when focus was already in the nav, never on load).
    if (refocus) {
      var cont = refocus === "top" ? topnav : refocus === "sub2" ? subnav2 : subnav;
      var target = (cont && cont.querySelector(".efmfp-active")) || (refocus === "sub2" ? subnav.querySelector(".efmfp-active") : null);
      if (target) try { target.focus(); } catch (e) {}
    }
  }

  // Polite SR announcement, debounced so fast typing in search doesn't chatter.
  var _annT;
  function announce(msg) {
    if (!srLive) return;
    clearTimeout(_annT);
    _annT = setTimeout(function () { srLive.textContent = ""; srLive.textContent = String(msg || ""); }, 300);
  }

  /* ---- agenda (calendar + roster services) ----------------------------- */
  function agendaRowHTML(o) {
    var cls = "efmfp-row", attrs = "";
    if (o.modal) {
      var idx = modalData.push(o.modal) - 1;
      cls += " efmfp-row--clickable";
      attrs = ' data-mi="' + idx + '" role="button" tabindex="0" aria-haspopup="dialog"';
    }
    var dateBlock = (o.big || o.small)
      ? '<div class="efmfp-row__date">' + (o.big ? "<b>" + esc(o.big) + "</b>" : "") + (o.small ? "<span>" + esc(o.small) + "</span>" : "") + "</div>" : "";
    var when = (o.when || []).filter(Boolean).map(esc).join(" &#183; ");
    var chips = (o.chips || []).map(function (c) {
      return '<span class="efmfp-chip' + (c.ens ? " efmfp-chip--ens" : "") + (c.ticket ? " efmfp-chip--ticket" : "") + '">' + esc(c.label) + "</span>";
    }).join("");
    return '<div class="' + cls + '"' + attrs + ">" + dateBlock +
      '<div class="efmfp-row__info"><div class="efmfp-row__title">' + esc(o.title || "(untitled)") + "</div>" +
        (when ? '<div class="efmfp-row__when">' + when + "</div>" : "") + "</div>" +
      (chips ? '<div class="efmfp-row__meta">' + chips + "</div>" : "") +
      (o.modal ? '<span class="efmfp-row__more" aria-hidden="true">&#8230;</span>' : "") + "</div>";
  }

  function serviceType(event) {
    if (/dress/i.test(event)) return { label: "Dress Rehearsal", ens: false };
    if (/rehearsal/i.test(event)) return { label: "Rehearsal", ens: false };
    return { label: "Performance", ens: true };
  }

  // Chips for one agenda row. Master Calendar rows (Room Schedule) carry an
  // ensemble + type, so show those; EFO/ECP/Outreach service rows don't, so fall
  // back to the dress/rehearsal/performance heuristic.
  function rowChips(r) {
    var c;
    if (r.ensemble !== undefined || r.type !== undefined) {
      c = [];
      if (r.ensemble) c.push({ label: r.ensemble, ens: true });
      if (r.type) c.push({ label: r.type });
    } else {
      var ty = serviceType(r.event);
      c = [{ label: ty.label, ens: ty.ens }];
    }
    if (r.ticket) c.push({ label: "Tickets", ticket: true });   // Friends & Family code available
    return c;
  }

  // Render a list of service / event rows as an agenda. Returns the count shown.
  // opts: { feedKey, groupByRoom, singleDay, banner, noun, emptyMsg }
  //   groupByRoom -> room-name group headers (Room Schedule) instead of month headers
  //   singleDay   -> suppress month headers (a single-day "Today" view)
  function renderAgenda(rows, opts) {
    opts = opts || {};
    var noun = opts.noun || "service";
    var q = clean(searchBox.value).toLowerCase();
    var html = "", shown = 0, lastMonth = null, lastGroup = null;
    rows.forEach(function (r) {
      if (q && r.haystack.indexOf(q) === -1) return;
      if (opts.groupByRoom) {
        var g = (r.roomTokens && r.roomTokens.length) ? r.roomTokens.map(roomLabel).join(" / ") : "Unassigned";
        if (g !== lastGroup) { html += '<div class="efmfp-group" role="heading" aria-level="3">' + esc(g) + "</div>"; lastGroup = g; }
      } else if (!opts.singleDay && r.key !== null) {
        var mon = Math.floor(r.key / 100);
        if (mon !== lastMonth) { html += '<div class="efmfp-month" role="heading" aria-level="3">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>"; lastMonth = mon; }
      }
      var ev = {
        title: r.event || "(untitled)", dateStr: r.date, timeStr: r.time, location: r.loc,
        description: [r.ensemble && ("Ensemble: " + r.ensemble), r.conductor && ("Conductor / Soloist: " + r.conductor),
          r.type && ("Type: " + r.type), r.details, r.pdf && ("PDF: " + r.pdf)].filter(Boolean).join("\n")
      };
      viewEvents.push(ev);
      html += agendaRowHTML({
        big: r.key !== null ? String(r.key % 100) : "", small: r.day || monthAbbr(r.key),
        title: r.event || "(untitled)", when: [r.time, r.loc, r.conductor],
        chips: rowChips(r),
        modal: {
          title: r.event || "Event",
          fields: [["Date", (r.day ? r.day + ", " : "") + r.date], ["Time", r.time], ["Location", r.loc],
            ["Ensemble", r.ensemble], ["Conductor / Soloist", r.conductor], ["Type", r.type]],
          ticket: r.ticket, details: r.details, pdf: r.pdf, pdfLabel: pdfLabel(r), ics: ev
        }
      });
      shown++;
    });
    if (opts.banner) { banner.textContent = opts.banner; banner.hidden = false; } else { banner.hidden = true; }
    if (shown) { list.innerHTML = html; status.hidden = true; }
    else { list.innerHTML = ""; status.textContent = q ? ("No " + noun + "s match your search.") : (opts.emptyMsg || "Nothing scheduled."); status.hidden = false; }
    viewFeedKey = opts.feedKey || "";
    var ann = shown + " " + noun + (shown === 1 ? "" : "s") + (q ? " match your search." : " shown.");
    if (opts.banner) ann = opts.banner + " " + ann;   // explain the "showing next day" jump to AT
    announce(ann);
    return shown;
  }

  /* ---- General Information (dining + dress code + library documents) ---- */
  // A short label line (<=4 words, no inner punctuation) is a heading. A single
  // trailing colon is allowed (e.g. "Dress Code:") so it still reads as a heading.
  function isHeadingLine(l) {
    var t = (l || "").replace(/:\s*$/, "");
    return t && !/[.:]/.test(t) && t.split(/\s+/).length <= 4;
  }

  // First http(s) URL cell in a row (a Library Documents link can sit in any column).
  function rowDocUrl(r) {
    for (var i = 0; i < (r ? r.length : 0); i++) { var c = clean(r[i]); if (/^https?:\/\//i.test(c)) return safeUrl(c); }
    return "";
  }
  // The roster-style "awesome download button", reused for Library Documents.
  function docButtonHTML(title, url) {
    var isPdf = /\.pdf(\?|#|$)/i.test(url);
    return '<div class="efmfp-roster__pdf"><div>' +
        '<div class="efmfp-roster__pdf-name">' + esc(title || "Document") + "</div>" +
        '<div class="efmfp-roster__pdf-meta">' + (isPdf ? "PDF document" : "Document") + "</div></div>" +
        '<a class="efmfp-roster__btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">View / Download' + (isPdf ? " PDF" : "") + "</a></div>";
  }
  // Parse the Faculty-Portal "General-Information" tab into ordered blocks. A
  // heading line that follows a blank row (or is first) is a major section head;
  // an in-section heading line is a sub-head; a row carrying a URL is a download;
  // everything else is a paragraph. Sections are separated by a blank row.
  function parseInfoBlocks(rows) {
    var blocks = [], prevBlank = true, started = false;
    (rows || []).forEach(function (r) {
      var a = clean(r[0]), url = rowDocUrl(r);
      if (!a && !url) { prevBlank = true; return; }
      if (url) { blocks.push({ type: "doc", title: a, url: url }); prevBlank = false; started = true; return; }
      var line = a.replace(/\s*\n\s*/g, " ").trim();   // un-wrap soft-wrapped sheet cells
      if (isHeadingLine(line)) blocks.push({ type: (prevBlank || !started) ? "major" : "sub", text: line.replace(/:\s*$/, "") });
      else blocks.push({ type: "para", text: line });
      prevBlank = false; started = true;
    });
    return blocks;
  }

  // The Faculty-Portal "General-Information" tab is a single sheet whose major
  // headings (Dress Code / Library Documents / Wifi Access / Key Replacement)
  // each become a General Information pill. Group the parsed blocks by major head.
  function infoSections() {
    var blocks = parseInfoBlocks(infoRows), out = [], cur = null;
    blocks.forEach(function (b) {
      if (b.type === "major") { cur = { head: b.text, blocks: [] }; out.push(cur); }
      else { if (!cur) { cur = { head: "", blocks: [] }; out.push(cur); } cur.blocks.push(b); }
    });
    return out;
  }
  // Render a list of parsed info blocks (sub-heads, docs, paragraphs) to HTML.
  // Text blocks sit in a card; documents render as download buttons (roster style).
  function renderInfoBlocksHTML(blocks) {
    var html = "", cardOpen = false;
    function closeCard() { if (cardOpen) { html += "</div>"; cardOpen = false; } }
    function openCard() { if (!cardOpen) { html += '<div class="efmfp-info__card">'; cardOpen = true; } }
    blocks.forEach(function (b) {
      if (b.type === "major") { closeCard(); html += '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(b.text) + "</div>"; }
      else if (b.type === "sub") { openCard(); html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(b.text) + "</div>"; }
      else if (b.type === "doc") { closeCard(); html += docButtonHTML(b.title, b.url); }
      else { openCard(); var lab = b.text.match(/^([A-Z][a-z]+):\s*(.*)$/); html += lab ? "<p><b>" + esc(lab[1]) + ":</b> " + esc(lab[2]) + "</p>" : "<p>" + esc(b.text) + "</p>"; }
    });
    closeCard();
    return html;
  }

  // General Information -> "Dining" pill (from the Master Calendar "General
  // Information" tab). Shows the on-campus dining hall hours and the "Off Campus
  // Dining" block. The tab's own title becomes the section head; day ranges are
  // sub-heads; Breakfast/Lunch/Dinner/Brunch lines are meal rows; other lines are
  // paragraphs.
  function renderDining() {
    banner.hidden = true; status.hidden = true;
    var html = '<div class="efmfp-info efmfp-info--center">';
    var all = diningLines.filter(function (l) { return l !== ""; })
      .filter(function (l) { return !/^general information$/i.test(l); });
    // The General Information tab stacks the dining hall hours, a "Student Access
    // Hours" block (student-portal only), a "Chamber Music Coaches" roster (its own
    // pill), then "Off Campus Dining". This pill shows the dining hall hours
    // followed by the off-campus block, skipping the access hours + roster.
    var dl = all.slice();
    for (var ci = 0; ci < dl.length; ci++) { if (/^(student|building) access hours/i.test(dl[ci]) || /^chamber music coaches/i.test(dl[ci]) || /^off[\s-]*campus dining/i.test(dl[ci])) { dl = dl.slice(0, ci); break; } }
    // Off-campus dining block: from its heading to the end of the tab.
    var off = [];
    for (var oi = 0; oi < all.length; oi++) { if (/^off[\s-]*campus dining/i.test(all[oi])) { off = all.slice(oi); break; } }
    var diningHead = "Dining";
    for (var di = 0; di < dl.length; di++) { if (/^dining\b/i.test(dl[di])) { diningHead = dl[di]; dl.splice(di, 1); break; } }
    html += '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(diningHead) + "</div>";
    if (dl.length) {
      html += '<div class="efmfp-info__card">';
      dl.forEach(function (l) {
        var meal = l.match(/^(Breakfast|Brunch|Lunch|Dinner|Supper|Snack|Coffee|Tea)\b[:\s]*(.*)$/i);
        var dayHdr = !meal && !/\d/.test(l) && l.split(/\s+/).length <= 6 &&
          /(weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(l);
        if (meal) html += '<div class="efmfp-info__meal"><b>' + esc(meal[1]) + "</b><span>" + esc(meal[2]) + "</span></div>";
        else if (dayHdr) html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(l) + "</div>";
        else html += "<p>" + esc(l) + "</p>";
      });
      html += "</div>";
    } else if (!off.length) {
      html += "<p>Dining information will appear here once posted in the master calendar.</p>";
    }
    // Off-campus dining: a second section head + card under the same pill. The first
    // line is the section head; a short, punctuation-free line ("EFM dining
    // discounts") is a sub-head; everything else is a paragraph.
    if (off.length) {
      html += '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(off[0]) + "</div>";
      html += '<div class="efmfp-info__card">';
      off.slice(1).forEach(function (l) {
        if (isHeadingLine(l)) html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(l) + "</div>";
        else html += "<p>" + esc(l) + "</p>";
      });
      html += "</div>";
    }
    html += "</div>";
    list.innerHTML = html;
    announce("Dining information shown.");
    syncBox();
  }

  // General Information -> "Chamber Coaches" pill: the chamber music coaches roster
  // (instrument groups + names) that lives below the dining hours on the Master
  // Calendar "General Information" tab.
  function renderChamberCoaches() {
    banner.hidden = true; status.hidden = true;
    var lines = diningLines.filter(function (l) { return l !== ""; }), start = -1;
    for (var i = 0; i < lines.length; i++) { if (/^chamber music coaches/i.test(lines[i])) { start = i; break; } }
    if (start < 0) {
      list.innerHTML = "";
      status.textContent = "Chamber music coaches will appear here once posted.";
      status.hidden = false;
      announce("Chamber music coaches will appear here once posted.");
      syncBox();
      return;
    }
    // The "Off Campus Dining" section follows the roster on the same tab (it lives
    // under the Dining pill); stop before it so its text isn't read as coach names.
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (/^off[\s-]*campus dining/i.test(lines[e])) { end = e; break; } }
    var SECTIONS = { "violin": 1, "viola": 1, "cello": 1, "bass": 1, "double bass": 1, "woodwind": 1, "woodwinds": 1, "brass": 1, "harp": 1, "piano": 1, "harp/piano": 1, "percussion": 1, "string fellows coach": 1, "conducting": 1 };
    var html = '<div class="efmfp-info efmfp-info--center"><div class="efmfp-info__head" role="heading" aria-level="3">Chamber Music Coaches</div>';
    var curNames = [], curSec = null;
    function flush() {
      if (curSec) {
        html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(curSec) + "</div>";
        if (curNames.length) html += "<p>" + curNames.map(esc).join(", ") + "</p>";
      }
      curNames = [];
    }
    lines.slice(start + 1, end).forEach(function (l) {
      if (SECTIONS[l.toLowerCase().trim()]) { flush(); curSec = l; }
      else curNames.push(l);
    });
    flush();
    html += "</div>";
    list.innerHTML = html;
    announce("Chamber music coaches shown.");
    syncBox();
  }

  // Parse the Master Calendar "Faculty Lesson Locations" tab (Name / Room /
  // Instrument) into instrument groups in first-seen order. Columns are matched
  // by header name so they can be reordered or renamed in the sheet.
  function parseLessons(rows) {
    if (!rows || !rows.length) return [];
    var ni = 0, ri = 1, ii = 2, start = 0;
    for (var h = 0; h < rows.length; h++) {
      var lc = rows[h].map(function (c) { return clean(c).toLowerCase(); });
      if (lc.indexOf("name") !== -1 && lc.indexOf("instrument") !== -1) {
        ni = lc.indexOf("name"); ii = lc.indexOf("instrument");
        ri = lc.indexOf("room"); if (ri === -1) ri = lc.indexOf("location"); if (ri === -1) ri = lc.indexOf("studio");
        start = h + 1; break;
      }
    }
    var order = [], byInst = {};
    rows.slice(start).forEach(function (r) {
      var name = clean(r[ni]), inst = clean(r[ii]), room = ri >= 0 ? clean(r[ri]) : "";
      if (!name) return;
      var key = inst || "Other";
      if (!byInst[key]) { byInst[key] = []; order.push(key); }
      byInst[key].push({ name: name, room: room });
    });
    return order.map(function (k) { return { instrument: k, people: byInst[k] }; });
  }

  // General Information -> "Lessons" pill: faculty private-lesson locations from
  // the Master Calendar "Faculty Lesson Locations" tab, grouped by instrument.
  function renderLessons() {
    banner.hidden = true; status.hidden = true;
    if (!lessons.length) {
      list.innerHTML = "";
      status.textContent = "Faculty lesson locations will appear here once posted.";
      status.hidden = false;
      announce("Faculty lesson locations will appear here once posted.");
      syncBox();
      return;
    }
    var html = '<div class="efmfp-info efmfp-info--center"><div class="efmfp-info__head" role="heading" aria-level="3">Faculty Lesson Locations</div>';
    var people = 0;
    lessons.forEach(function (g) {
      html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(g.instrument) + "</div>";
      html += '<div class="efmfp-info__card">';
      g.people.forEach(function (p) {
        html += '<div class="efmfp-info__meal"><b>' + esc(p.name) + "</b><span>" + esc(p.room || "Location to be announced") + "</span></div>";
        people++;
      });
      html += "</div>";
    });
    html += "</div>";
    list.innerHTML = html;
    announce(people + " faculty lesson locations shown.");
    syncBox();
  }

  // General Information -> "Dress Code" / "Wifi Access" / "Keys" / "Documents"
  // pills: the matching major section(s) of the Faculty-Portal "General-Information"
  // tab. Most pills show the first matching section; a pill with all:true (Documents)
  // renders every matching section stacked (e.g. both "Library Documents" and
  // "Festival Documents For Print" become download-button lists under one pill).
  // Inner HTML for the major section(s) of the Faculty-Portal "General-Information"
  // tab whose head matches matchTerms (first match, or all when all=true). Returns
  // "" if none. Used by renderInfoSection and the "Around Campus" pill.
  function infoSectionInner(matchTerms, all) {
    var matches = infoSections().filter(function (s) {
      var h = s.head.toLowerCase();
      return matchTerms.some(function (m) { return h.indexOf(m) !== -1; });
    });
    if (!all) matches = matches.slice(0, 1);
    var html = "";
    matches.forEach(function (match) {
      html += '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(match.head) + "</div>";
      html += renderInfoBlocksHTML(match.blocks);
    });
    return html;
  }
  function renderInfoSection(sub) {
    banner.hidden = true; status.hidden = true;
    var inner = infoSectionInner(sub.match, sub.all);
    if (!inner) {
      list.innerHTML = "";
      status.textContent = "This information will appear here once it is posted.";
      status.hidden = false;
      announce(sub.label + " will appear here once posted.");
      syncBox();
      return;
    }
    list.innerHTML = '<div class="efmfp-info efmfp-info--center">' + inner + "</div>";
    announce(sub.label + " shown.");
    syncBox();
  }

  // Section headings on the Master Calendar "General Information" tab (the Dining
  // source). A pill that shows one section slices from its heading to the next
  // heading in this list, so a new section never bleeds into a neighboring pill.
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
      if (ci >= 0 && value && headish) out += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(label) + "</div><p>" + esc(value) + "</p>";
      else if (ci >= 0 && !value && headish) out += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(label) + "</div>";
      else if (ci < 0 && headish) out += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(s) + "</div>";
      else out += "<p>" + esc(s) + "</p>";
    });
    return out;
  }

  // A Master Calendar General Information section (Maintenance, Mail) by start-
  // heading regex + display head. Returns the section's inner HTML (head + card),
  // or "" if absent. Used by the "Around Campus" pill.
  function mcSectionInner(matchRe, head) {
    var lines = diningLines.filter(function (l) { return l !== ""; });
    var start = -1;
    for (var i = 0; i < lines.length; i++) { if (matchRe.test(lines[i])) { start = i; break; } }
    if (start < 0) return "";
    var end = lines.length;
    for (var e = start + 1; e < lines.length; e++) { if (giIsHeading(lines[e])) { end = e; break; } }
    var html = '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(head) + '</div><div class="efmfp-info__card">';
    lines.slice(start, end).forEach(function (l) { html += giCellHTML(l); });
    return html + "</div>";
  }

  // General Information -> "Around Campus" pill: maintenance + mail (Master Calendar
  // General Information) + keys + wifi (Faculty-Portal General-Information sheet),
  // stacked in one panel.
  function renderAroundCampus() {
    banner.hidden = true; status.hidden = true;
    var inner = mcSectionInner(/^(urgent )?maintenance/i, "Maintenance") +
      mcSectionInner(/^mail\b/i, "Mail") +
      infoSectionInner(["key"], false) +
      infoSectionInner(["wifi", "wi-fi"], false);
    if (!inner) {
      list.innerHTML = "";
      status.textContent = "Campus information will appear here once posted.";
      status.hidden = false;
      announce("Campus information will appear here once posted.");
      syncBox();
      return;
    }
    list.innerHTML = '<div class="efmfp-info efmfp-info--center">' + inner + "</div>";
    announce("Around campus information shown.");
    syncBox();
  }

  // General Information -> "Tickets" pill: the "Ticketing Process" policy blurb
  // followed by the Friends & Family comp codes, each with a Reserve link. Codes
  // that map to a concert in the calendar also show that concert's date + name.
  function renderTickets() {
    banner.hidden = true; status.hidden = true;
    var t = ticketData;
    if (!t || (!t.blurb.length && !t.codes.length)) {
      list.innerHTML = "";
      status.textContent = "Ticketing information will appear here once it is posted.";
      status.hidden = false;
      announce("Ticketing information will appear here once posted.");
      syncBox();
      return;
    }
    var html = '<div class="efmfp-info efmfp-info--center"><div class="efmfp-info__head" role="heading" aria-level="3">' + esc(t.head || "Ticketing Process") + "</div>";
    t.blurb.forEach(function (p) { html += "<p>" + esc(p) + "</p>"; });
    if (t.codes.length) {
      html += '<div class="efmfp-info__sub" role="heading" aria-level="4">Friends &amp; Family Codes</div>';
      html += '<div class="efmfp-tickets">';
      // chronological by concert date; codes with no parseable date sink to the end
      var ordered = t.codes.slice().sort(function (a, b) {
        return (a.key == null ? 99999 : a.key) - (b.key == null ? 99999 : b.key);
      });
      ordered.forEach(function (c) {
        var when = c.key != null ? ((c.day ? c.day + ", " : "") + monthAbbr(c.key) + " " + (c.key % 100)) : "";
        html += '<div class="efmfp-ticket">' +
          '<div class="efmfp-ticket__info">' +
            (when ? '<div class="efmfp-ticket__when">' + esc(when) + "</div>" : "") +
            (c.concert ? '<div class="efmfp-ticket__name">' + esc(c.concert) + "</div>" : "") +
            '<div class="efmfp-ticket__code">Code <b>' + esc(c.code) + "</b></div>" +
          "</div>" +
          (c.url ? '<a class="efmfp-roster__btn efmfp-ticket__btn" href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer">Reserve<span class="efmfp__sr"> tickets for ' + esc(c.concert || ("the " + (when || "concert"))) + '</span></a>' : "") +
          "</div>";
      });
      html += "</div>";
    }
    html += "</div>";
    list.innerHTML = html;
    announce("Ticketing information shown.");
    syncBox();
  }

  /* ---- Classes & Assignments info tabs (from the 2026 portal) ------------- */
  // Find the "Show/Hide" cell, and read the value directly below it. A pill with
  // showWhen appears only when its tab's Show/Hide value reads "Yes" (build()).
  function showHideCol(rows) {
    for (var i = 0; i < (rows || []).length; i++)
      for (var j = 0; j < rows[i].length; j++)
        if (clean(rows[i][j]).toLowerCase() === "show/hide") return { row: i, col: j };
    return null;
  }
  function showHideValue(rows) {
    var sh = showHideCol(rows); if (!sh) return "";
    var below = rows[sh.row + 1] && rows[sh.row + 1][sh.col];
    return clean(below);
  }
  // These tabs are informational (a title, schedule lines, an instrument ->
  // location table), not event calendars. Render generically: the first cell is
  // the heading, single-cell label rows are sub-heads, single-cell content rows
  // are paragraphs, and label+value rows become key/value rows.
  function renderInfoTab(sub) {
    banner.hidden = true; status.hidden = true;
    var rows = infoTabs[sub.source];
    if (!rows || !rows.length) {
      list.innerHTML = "";
      status.textContent = "This information will appear here once it is posted.";
      status.hidden = false;
      announce(sub.label + " will appear here once posted.");
      syncBox();
      return;
    }
    var sh = showHideCol(rows);
    var html = '<div class="efmfp-info">', first = true;
    rows.forEach(function (r, ri) {
      var a = clean(r[0]);
      if (a.toLowerCase() === "instrument") return;                // the location-table column header row
      // Faculty see all rows incl. the Personnel column + coordinators. We only
      // suppress marker cells: "Faculty Only" / "Show/Hide" text, and the Show/Hide
      // value directly below its header (which can share a column with Personnel).
      var rest = r.map(function (c, ci) {
        var v = clean(c);
        if (ci === 0) return "";
        if (v.toLowerCase() === "faculty only" || v.toLowerCase() === "show/hide") return "";
        if (sh && ci === sh.col && (ri === sh.row || ri === sh.row + 1)) return "";
        return v;
      }).filter(Boolean);
      if (!a && !rest.length) return;                              // blank / marker-only row
      if (!a) { html += "<p>" + rest.map(esc).join(" &#183; ") + "</p>"; return; }
      if (rest.length) {                                           // label + value -> key/value row
        html += '<div class="efmfp-kv"><b>' + esc(a) + "</b><span>" + rest.map(esc).join(" &#183; ") + "</span></div>";
      } else if (first) {                                          // first cell = the tab title
        html += '<div class="efmfp-info__head" role="heading" aria-level="3">' + esc(a) + "</div>";
      } else if (/:\s*$/.test(a) || (a.split(/\s+/).length <= 4 && !/\d/.test(a))) {   // a section label
        html += '<div class="efmfp-info__sub" role="heading" aria-level="4">' + esc(a.replace(/:\s*$/, "")) + "</div>";
      } else {
        html += "<p>" + esc(a) + "</p>";                           // a schedule / content line
      }
      first = false;
    });
    html += "</div>";
    list.innerHTML = html;
    announce(sub.label + " shown.");
    syncBox();
  }

  /* ---- Sectionals (Classes & Assignments -> Sectionals -> ESO / GSO) ----- */
  // Parse the Sectional Rehearsals tab into { eso, gso, perc, locations,
  // esoCoaches, gsoCoaches }. ESO/GSO/Percussion schedule lines live under
  // "Week One Sectionals:" / "All other weeks:"; the shared location table under
  // "Locations:"; coaches in two columns under the "...Sectional Coaches" header.
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
  // Render one ensemble's sectionals: rehearsal times + a merged
  // Section / Location / Coach table (shared locations + that ensemble's coaches).
  function renderSectional(ens) {
    banner.hidden = true; status.hidden = true;
    var s = sectionalData;
    if (!s || (!s.locations.length && !s.eso.weekOne && !s.gso.weekOne)) {
      list.innerHTML = "";
      status.textContent = "Sectional information will appear here once posted.";
      status.hidden = false;
      announce("Sectionals will appear here once posted.");
      syncBox();
      return;
    }
    var sched = ens === "GSO" ? s.gso : s.eso;
    var coaches = ens === "GSO" ? s.gsoCoaches : s.esoCoaches;
    var html = '<div class="efmfp-info"><div class="efmfp-info__head" role="heading" aria-level="3">' + esc(ens) + " Sectionals</div>";
    html += '<div class="efmfp-info__sub" role="heading" aria-level="4">Rehearsal Times</div>';
    if (sched.weekOne) html += "<p><b>Week One:</b> " + esc(sched.weekOne) + "</p>";
    if (sched.other) html += "<p><b>All other weeks:</b> " + esc(sched.other) + "</p>";
    var perc = [s.perc.weekOne, s.perc.other].filter(Boolean);
    if (perc.length) html += "<p><b>Percussion:</b> " + perc.map(esc).join(" &#183; ") + "</p>";
    html += '<div class="efmfp-info__sub" role="heading" aria-level="4">Sections</div>';
    s.locations.forEach(function (loc) {
      var coach = coaches[loc.section.toLowerCase()] || "";
      html += '<div class="efmfp-kv"><b>' + esc(loc.section) + "</b><span>" + esc(loc.room) + (coach ? " &#183; " + esc(coach) : "") + "</span></div>";
    });
    if (!s.locations.length) html += "<p>No sections posted yet.</p>";
    html += "</div>";
    list.innerHTML = html;
    announce(ens + " sectionals shown.");
    syncBox();
  }

  /* ---- Campus Map (from the 2026 portal) ------------------------------- */
  function renderMap() {
    banner.hidden = true; status.hidden = true;
    list.innerHTML =
      '<div class="efmfp-map">' +
        '<a class="efmfp-map__frame" href="' + esc(MAP_IMAGE_URL) + '" target="_blank" rel="noopener noreferrer" ' +
          'aria-label="Open the full-size Guilford College campus map in a new tab">' +
          '<img src="' + esc(MAP_IMAGE_URL) + '" loading="lazy" ' +
            'alt="Guilford College campus map: an aerial view of campus buildings and parking lots, with a lettered building legend.">' +
        '</a>' +
        '<p class="efmfp-map__hint">Tap the map to open it full size. EFM venues: <b>Dana Auditorium</b> (Q) holds the ' +
          'Choir Room and Moon Room; <b>Sternberger Auditorium</b> is in Founders Hall (I); the <b>Carnegie Room</b> ' +
          'is in Hege (C); <b>Ragan-Brown Field House</b> is L1.</p>' +
        '<a class="efmfp-modal__cal efmfp-map__pdf" href="' + esc(MAP_PDF_URL) + '" target="_blank" rel="noopener noreferrer">Download map (PDF)</a>' +
      '</div>';
    announce("Campus map shown.");
    syncBox();
  }

  /* ---- contact cards (faculty / subs / fellows) ------------------------ */
  function avatarEl(p) {
    var av = document.createElement("span");
    av.className = "efmfp-card__avatar";
    var photoUrl = safeUrl(p.photo);
    if (photoUrl) {
      var img = document.createElement("img");
      img.src = photoUrl; img.alt = ""; img.loading = "lazy";
      img.addEventListener("error", function () {
        av.textContent = "";
        var ph = document.createElement("span"); ph.className = "efmfp-card__initials"; ph.textContent = initials(p.name);
        av.appendChild(ph);
      });
      av.appendChild(img);
    } else {
      var ph = document.createElement("span"); ph.className = "efmfp-card__initials"; ph.textContent = initials(p.name);
      av.appendChild(ph);
    }
    return av;
  }
  function contactLink(kind, value) {
    var v = clean(value); if (!v) return null;
    var a = document.createElement("a");
    a.className = "efmfp-card__link";
    if (kind === "tel") {
      var href = telHref(v); if (!href) return null;
      a.href = href; a.innerHTML = PHONE_ICO; a.setAttribute("aria-label", "Call " + v);
    } else {
      a.href = "mailto:" + v; a.innerHTML = MAIL_ICO; a.setAttribute("aria-label", "Email " + v);
    }
    var span = document.createElement("span"); span.textContent = v; a.appendChild(span);
    return a;
  }
  function contactCardEl(p, showAvatar) {
    var card = document.createElement("div");
    card.className = "efmfp-card" + (showAvatar ? "" : " efmfp-card--nophoto");
    if (showAvatar) card.appendChild(avatarEl(p));
    var body = document.createElement("div"); body.className = "efmfp-card__body";
    var name = document.createElement("div"); name.className = "efmfp-card__name"; name.setAttribute("role", "heading"); name.setAttribute("aria-level", "3"); name.textContent = p.name;
    body.appendChild(name);
    if (p.role) { var role = document.createElement("div"); role.className = "efmfp-card__role"; role.textContent = p.role; body.appendChild(role); }
    var cts = document.createElement("div"); cts.className = "efmfp-card__contacts";
    var tel = contactLink("tel", p.phone); if (tel) cts.appendChild(tel);
    var mail = contactLink("mail", p.email); if (mail) cts.appendChild(mail);
    body.appendChild(cts);
    card.appendChild(body);
    return card;
  }

  function renderCards(people, opts) {
    list.innerHTML = ""; banner.hidden = true; status.hidden = true;
    if (!people.length) { status.textContent = opts.empty || "Nothing to display yet."; status.hidden = false; announce(status.textContent); return; }
    var wrap = document.createElement("div"); wrap.className = "efmfp-contact";
    var frag = document.createDocumentFragment();
    if (opts.grouped) {
      // Group + order EXACTLY like the public Faculty page: section grouping and
      // within-section order both come from the roster sheet (rosterSection /
      // rosterOrder), with the contact-sheet instrument/section as a fallback for
      // anyone not on the roster (they sort to the end of their section).
      var groups = {}, order = [];
      people.forEach(function (p, i) {
        var s = p.rosterSection || p.section || "Faculty";
        if (!groups[s]) { groups[s] = []; order.push(s); }
        p._idx = i; groups[s].push(p);
      });
      order.sort(function (a, b) {
        var ia = SECTION_ORDER.indexOf(a), ib = SECTION_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return 0; if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
      });
      order.forEach(function (s) {
        groups[s].sort(function (a, b) {
          var ao = a.rosterOrder == null ? 1e9 : a.rosterOrder, bo = b.rosterOrder == null ? 1e9 : b.rosterOrder;
          return ao - bo || a._idx - b._idx;
        });
        var sec = document.createElement("div"); sec.className = "efmfp-section";
        var h = document.createElement("div"); h.className = "efmfp-section__head"; h.setAttribute("role", "heading"); h.setAttribute("aria-level", "2"); h.textContent = s;
        sec.appendChild(h);
        var grid = document.createElement("div"); grid.className = "efmfp-grid";
        groups[s].forEach(function (p) { grid.appendChild(contactCardEl(p, opts.avatar)); });
        sec.appendChild(grid); frag.appendChild(sec);
      });
    } else {
      var sec2 = document.createElement("div"); sec2.className = "efmfp-section";
      var grid2 = document.createElement("div"); grid2.className = "efmfp-grid";
      people.forEach(function (p) { grid2.appendChild(contactCardEl(p, opts.avatar)); });
      sec2.appendChild(grid2); frag.appendChild(sec2);
    }
    wrap.appendChild(frag); list.appendChild(wrap);
    announce(people.length + " contacts shown.");
    syncBox();
  }

  /* ---- staff cards (responsive; same card style as Subs) --------------- */
  function renderStaffCards() {
    renderCards(staffPeople, { grouped: false, avatar: false, empty: "Staff directory will appear here once posted." });
  }

  /* ---- rosters --------------------------------------------------------- */
  // Released roster-week pills for a weeks:true ensemble sub (EFO/ESO/GSO).
  function weeksFor(sub) {
    if (!sub || !sub.weeks || !sub.code) return [];
    return ensWeeks[sub.code] || [];
  }
  // Build EFO concert anchors (concert N -> dateKey) from the EFO tab.
  function buildAnchors() {
    efoAnchors = {};
    (ensembles.EFO || []).forEach(function (r) {
      var m = clean(r.event).match(/^EFO\s*0*(\d+)\s*$/i);
      if (m && r.key !== null) efoAnchors[parseInt(m[1], 10)] = r.key;
    });
  }
  // ESO/GSO concert-cycle anchors (cycle N -> dateKey) from the dedicated ESO/GSO
  // tabs: cycles 2..N from the numbered "ESO 2" / "GSO 5 / ESO 5" rows, cycle 1
  // from the combined opening gala ("ESO/GSO/EFO", an event naming >=2 bare codes).
  function buildEnsAnchors(code) {
    var a = {};
    (ensembles[code] || []).forEach(function (r) {
      if (r.key === null) return;
      var m = clean(r.event).match(new RegExp(code + "\\s*0*(\\d+)", "i"));
      if (m) a[parseInt(m[1], 10)] = r.key;
    });
    if (a[1] === undefined) {
      (ensembles[code] || []).some(function (r) {
        if (r.key === null) return false;
        var bare = clean(r.event).split("/").map(function (s) { return s.trim().toUpperCase(); })
          .filter(function (t) { return t === "ESO" || t === "GSO" || t === "EFO"; });
        if (bare.length >= 2) { a[1] = r.key; return true; }
        return false;
      });
    }
    return a;
  }
  // Parse "Week 1", "Week 1 (Mozart)" -> { week, qualifier }
  function rosterMeta(title) {
    var w = clean(title).match(/week\s*0*(\d+)/i);
    var q = clean(title).match(/\(([^)]+)\)/);
    return { week: w ? parseInt(w[1], 10) : null, qualifier: q ? q[1].trim() : "" };
  }
  // The services belonging to a roster row, inferred from concert cycles. EFO uses
  // its own anchors + program-qualifier filtering (its "(Mozart)" parenthetical
  // names a program); ESO/GSO use their own anchors and skip the qualifier filter
  // (their parenthetical names the ensemble, not a program).
  function rosterServices(code, rosterTitle) {
    var meta = rosterMeta(rosterTitle);
    if (meta.week === null) return [];
    var anchors = code === "EFO" ? efoAnchors : (ensAnchors[code] || {});
    var upper = anchors[meta.week];
    if (upper === undefined) return [];                 // that concert not in the calendar yet
    var lower = anchors[meta.week - 1];                  // previous concert (undefined for week 1)
    var rows = (ensembles[code] || []).filter(function (r) {
      if (r.key === null) return false;
      return (lower === undefined ? r.key <= upper : (r.key > lower && r.key <= upper));
    });
    if (code !== "EFO") return rows;                     // ESO/GSO: parenthetical is the ensemble
    if (meta.qualifier) {
      var qre = new RegExp(meta.qualifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      rows = rows.filter(function (r) { return qre.test(r.event); });
    } else {
      // exclude any sibling-week qualifier (e.g. plain "Week 1" drops the Mozart services)
      var sibQ = [];
      rostersAll.forEach(function (o) {
        var m2 = rosterMeta(o.title);
        if (m2.week === meta.week && m2.qualifier) sibQ.push(m2.qualifier);
      });
      if (sibQ.length) {
        var sre = new RegExp(sibQ.map(function (q) { return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "i");
        rows = rows.filter(function (r) { return !sre.test(r.event); });
      }
    }
    return rows;
  }

  function renderRoster(code, roster) {
    code = code || "EFO";
    banner.hidden = true; status.hidden = true;
    modalData = []; viewEvents = [];
    var html = '<div class="efmfp-roster">';
    // PDF block
    var link = safeUrl(roster.link);
    html += '<div class="efmfp-roster__pdf"><div><div class="efmfp-roster__pdf-name">' + esc(roster.title) + " Roster</div>";
    html += '<div class="efmfp-roster__pdf-meta">' + (link ? "PDF document" : "PDF not posted yet") + "</div></div>";
    if (link) html += '<a class="efmfp-roster__btn" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">View / Download PDF</a>';
    html += "</div>";
    list.innerHTML = html;

    // That ensemble's services for this week
    var svc = rosterServices(code, roster.title);
    var svcWrap = document.createElement("div");
    svcWrap.innerHTML = '<div class="efmfp-roster__svc-head" role="heading" aria-level="3">' + esc(code) + ' Services</div><div id="efmfp-roster-svc"></div>';
    list.querySelector(".efmfp-roster").appendChild(svcWrap);
    // temporarily point rendering at the services sub-list
    var svcList = svcWrap.querySelector("#efmfp-roster-svc");
    // render agenda into svcList (temporarily retarget the shared list pointer)
    var saved = list; list = svcList;
    renderAgenda(svc, { feedKey: "", noun: "service", emptyMsg: "No " + code + " services for this week yet." });   // .ics export covers the subset
    list = saved;
    viewLabel = roster.title + " " + code + " Services";
    updateICSButton();
    syncBox();
  }

  /* ---- master render dispatch ------------------------------------------ */
  function renderList() {
    var sub = currentSub();
    modalData = []; viewEvents = []; viewLabel = ""; viewFeedKey = "";
    var k = sub.kind;
    // Search + Add-to-Calendar belong to the agenda views (schedules + rooms).
    var showControls = (k === "ensemble" || k === "roster" || k === "room" || k === "roomsToday" || k === "allEvents");
    if (controls) controls.hidden = !showControls;

    if (k === "dining") renderDining();
    else if (k === "chamberCoaches") renderChamberCoaches();
    else if (k === "lessons") renderLessons();
    else if (k === "infoSection") renderInfoSection(sub);
    else if (k === "aroundCampus") renderAroundCampus();
    else if (k === "tickets") renderTickets();
    else if (k === "infoTab") renderInfoTab(sub);
    else if (k === "sectional") { viewLabel = sectionalEns + " Sectionals"; renderSectional(sectionalEns); }
    else if (k === "map") renderMap();
    else if (k === "ensemble") {
      // Eastern Festival Orchestra: a chosen week shows that week's roster +
      // services; with no week chosen it shows the full EFO schedule.
      var ws = weeksFor(sub);
      if (sub.weeks && weekSel != null && ws[weekSel]) {
        viewLabel = ws[weekSel].roster.title;
        renderRoster(sub.code, ws[weekSel].roster);
      } else {
        viewLabel = sub.code === "OUT" ? "EFM Outreach" : "EFM " + sub.code;
        renderAgenda(ensembles[sub.code] || [], {
          feedKey: FEED_VIEWS[sub.code] || "",
          noun: sub.code === "OUT" ? "concert" : "service",
          emptyMsg: sub.code === "OUT" ? "No outreach concerts scheduled." : "No services scheduled."
        });
      }
    }
    else if (k === "allEvents") {
      viewLabel = "EFM Full Schedule";
      // Upcoming only: keep events dated today or later. key is an MMDD integer and
      // allRows is already sorted chronologically (date, then start time) in
      // parseCalendar. todayKey() is null outside the festival year, in which case
      // show the full ordered list rather than blank the tab.
      var tk = todayKey();
      var upcoming = (tk === null) ? allRows : allRows.filter(function (r) { return r.key !== null && r.key >= tk; });
      renderAgenda(upcoming, { feedKey: "all", noun: "event", emptyMsg: "No upcoming events scheduled." });
    }
    else if (k === "roster") { viewLabel = sub.roster.title; renderRoster(sub.code, sub.roster); }
    else if (k === "roomsToday") {
      var t = todayRows(null);
      var roomed = t.rows.filter(function (r) { return r.roomTokens.length > 0; });
      roomed.sort(function (a, b) {
        var ai = ROOM_ORDER.indexOf(a.roomTokens[0]), bi = ROOM_ORDER.indexOf(b.roomTokens[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.seq - b.seq;
      });
      viewLabel = "Room Schedule (Today)";
      // Only surface the "showing the next scheduled day" note when that day
      // actually has room assignments to show (otherwise the empty state stands alone).
      renderAgenda(roomed, { groupByRoom: true, singleDay: true, banner: roomed.length ? t.banner : "", noun: "event", emptyMsg: "No room assignments scheduled for today." });
    }
    else if (k === "room") {
      viewLabel = sub.label + " Schedule";
      renderAgenda(allRows.filter(function (r) { return r.roomTokens.indexOf(sub.code) !== -1; }),
        { noun: "event", emptyMsg: "No events scheduled in this room." });
    }
    else if (k === "facultyCards") renderCards(facultyPeople, { grouped: true, avatar: true, empty: "Faculty contacts will appear here once posted." });
    else if (k === "fellowCards") renderCards(fellowPeople, { grouped: false, avatar: true, empty: "Orchestral Fellow contacts will appear here once posted." });
    else if (k === "staffCards") renderStaffCards();
    updateICSButton();
    syncBox();
  }

  function updateICSButton() { if (icsBtn) icsBtn.hidden = viewEvents.length === 0; }

  /* ---- details modal (calendar / roster services) ---------------------- */
  function openModal(d) {
    if (!d) return;
    lastFocus = document.activeElement;
    modal.querySelector(".efmfp-modal__title").textContent = d.title || "Details";
    var content = modal.querySelector(".efmfp-modal__content");
    var actions = modal.querySelector(".efmfp-modal__actions");
    if (d.html != null) { content.innerHTML = d.html; actions.hidden = true; }
    else {
      var html = "";
      if (d.fields) {
        var dl = d.fields.filter(function (f) { return f[1]; }).map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("");
        if (dl) html += "<dl>" + dl + "</dl>";
      }
      if (d.ticket && d.ticket.url) {
        html += '<div class="efmfp-modal__ticket"><div class="efmfp-modal__ticket-head">Friends &amp; Family tickets</div>' +
          (d.ticket.code ? '<div class="efmfp-modal__ticket-code">Code <b>' + esc(d.ticket.code) + "</b></div>" : "") +
          '<a class="efmfp-roster__btn efmfp-modal__ticket-btn" href="' + esc(d.ticket.url) + '" target="_blank" rel="noopener noreferrer">Reserve tickets</a></div>';
      }
      if (d.details) html += '<div class="efmfp-modal__details">' + esc(d.details) + "</div>";
      var pu = d.pdf ? safeUrl(d.pdf) : "";
      if (pu) html += '<div style="margin-top:12px;"><a class="efmfp-roster__btn" href="' + esc(pu) + '" target="_blank" rel="noopener noreferrer">' + esc(d.pdfLabel || "View PDF") + "</a></div>";
      if (!html) html = '<p style="margin:0;color:#5b6473;">No additional details.</p>';
      content.innerHTML = html;
      if (d.ics) {
        actions.hidden = false;
        var g = actions.querySelector(".efmfp-modal__cal--gcal"), gu = gcalUrl(d.ics);
        if (gu) { g.href = gu; g.hidden = false; } else { g.hidden = true; }
        actions.querySelector(".efmfp-modal__cal--ics").onclick = function () { downloadICS([d.ics], d.ics.title); };
      } else { actions.hidden = true; }
    }
    modal.hidden = false; document.body.classList.add("efmfp-modal-open"); setBgInert(true);
    if (d.afterRender) d.afterRender(content);
    modal.querySelector(".efmfp-modal__close").focus();
  }
  function setBgInert(on) {
    if (!root) return; var kids = root.children;
    for (var i = 0; i < kids.length; i++) { if (kids[i] === modal) continue; try { kids[i].inert = on; } catch (e) {} if (on) kids[i].setAttribute("aria-hidden", "true"); else kids[i].removeAttribute("aria-hidden"); }
  }
  function openAddToCalendar(events, label, feedKey) {
    if (!events || !events.length) return;
    var single = events.length === 1, gUrl = single ? gcalUrl(events[0]) : null;
    var canSub = !!(SUBSCRIBE_BASE && feedKey), fname = "EFM-" + icsSlug(label) + ".ics";
    var keys = events.map(function (e) { return icsDate(e.dateStr); }).filter(Boolean).map(function (p) { return p.m * 100 + p.d; }).sort(function (a, b) { return a - b; });
    var span = "";
    if (keys.length) { var lo = keys[0], hi = keys[keys.length - 1]; span = monthAbbr(lo) + " " + (lo % 100) + (hi !== lo ? " – " + monthAbbr(hi) + " " + (hi % 100) : "") + ", " + YEAR; }
    var html = '<div class="efmfp-cal">' +
      '<div class="efmfp-cal__what"><div class="efmfp-cal__what-label">You\'re adding</div>' +
        '<div class="efmfp-cal__what-name">' + esc(label || "This schedule") + '</div>' +
        '<div class="efmfp-cal__what-meta">' + events.length + ' event' + (single ? "" : "s") + (span ? " &#183; " + esc(span) : "") + '</div>' +
        '<div class="efmfp-cal__what-file">Download file: ' + esc(fname) + '</div></div>' +
      '<div class="efmfp-cal__opt"><div class="efmfp-cal__name">Google Calendar</div>' +
        (canSub
          ? '<a class="efmfp-modal__cal" target="_blank" rel="noopener noreferrer" href="' + esc(gcalSubscribeUrl(feedKey)) + '">Subscribe (auto-updates)</a>' +
            '<button type="button" class="efmfp-modal__cal efmfp-modal__cal--ghost" data-cal-dl data-cal-gimport>Download .ics instead</button>'
          : (gUrl
            ? '<a class="efmfp-modal__cal" target="_blank" rel="noopener noreferrer" href="' + esc(gUrl) + '">Add to Google Calendar</a>'
            : '<button type="button" class="efmfp-modal__cal" data-cal-dl data-cal-gimport>Download .ics for Google</button>')) +
      '</div>' +
      '<div class="efmfp-cal__opt"><div class="efmfp-cal__name">Apple Calendar</div>' +
        (canSub
          ? '<a class="efmfp-modal__cal" href="' + esc(webcalUrl(feedKey)) + '">Subscribe (auto-updates)</a>' +
            '<button type="button" class="efmfp-modal__cal efmfp-modal__cal--ghost" data-cal-dl>Download .ics instead</button>'
          : '<button type="button" class="efmfp-modal__cal" data-cal-dl>Open in Apple Calendar</button>') +
      '</div>' +
      '<div class="efmfp-cal__opt"><div class="efmfp-cal__name">Other apps (Outlook, etc.)</div>' +
        '<button type="button" class="efmfp-modal__cal' + (canSub ? " efmfp-modal__cal--ghost" : "") + '" data-cal-dl>Download .ics</button></div>' +
    '</div>';
    openModal({ title: "Add to calendar", html: html, afterRender: function (content) {
      Array.prototype.forEach.call(content.querySelectorAll("[data-cal-dl]"), function (b) {
        b.addEventListener("click", function () {
          downloadICS(events, label);
          if (b.hasAttribute("data-cal-gimport")) { try { window.open("https://calendar.google.com/calendar/r/settings/import", "_blank", "noopener"); } catch (e) {} }
        });
      });
    } });
  }
  function closeModal() { modal.hidden = true; document.body.classList.remove("efmfp-modal-open"); setBgInert(false); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function trapKey(e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.slice.call(modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---- parsing --------------------------------------------------------- */
  // EFO/ECP/Outreach tab -> service rows. The header row is the first row whose
  // cells include both a "Date" and a "Time" column (EFO/ECP put Date first;
  // Outreach Concerts uses "Concert Title, Location, Date, Time, Details").
  function parseEnsemble(rows) {
    rows = rows || []; var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      var lc = rows[i].map(function (x) { return clean(x).toLowerCase(); });
      if (clean(rows[i][0]) === "Date" || (lc.indexOf("date") !== -1 && lc.indexOf("time") !== -1)) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return [];
    var hdr = rows[headerIdx].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var idx = hdr.indexOf(arguments[a]); if (idx !== -1) return idx; } return -1; }
    var iDate = col("date"), iDay = col("day"), iTime = col("time"), iRoom = col("room"),
        iRoomName = col("room name", "location", "room/location"), iCond = col("conductor / soloist", "conductor/soloist", "conductor", "soloist"),
        iEvent = col("event", "title", "concert title", "concert"), iDetails = col("details", "notes"),
        iPdf = col("pdf link", "pdf", "pdf url", "program pdf", "program url");
    var out = [], lastDate = "", lastDay = "", seq = 0;
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j]; if (!c.join("").trim()) continue;
      var date = clean(c[iDate]) || lastDate;
      var day = clean(iDay !== -1 ? c[iDay] : "") || (clean(c[iDate]) ? "" : lastDay);
      lastDate = date; lastDay = day;
      var roomName = clean(iRoomName !== -1 ? c[iRoomName] : ""), roomCode = clean(iRoom !== -1 ? c[iRoom] : "");
      var loc = roomName || roomLabel(roomCode);   // map a bare room code (e.g. "D") to its full name
      var key = dateKey(date);
      var entry = {
        seq: seq++, date: date, day: day, key: key, time: clean(iTime !== -1 ? c[iTime] : ""),
        startMin: startMinutes(clean(iTime !== -1 ? c[iTime] : "")), loc: loc,
        conductor: clean(iCond !== -1 ? c[iCond] : ""), event: clean(iEvent !== -1 ? c[iEvent] : ""),
        details: clean(iDetails !== -1 ? c[iDetails] : ""), pdf: iPdf !== -1 ? safeUrl(c[iPdf]) : ""
      };
      if (!entry.event && !entry.time) continue;   // skip stray blank rows
      entry.haystack = [entry.date, entry.day, entry.time, entry.loc, entry.conductor, entry.event, entry.details].join(" ").toLowerCase();
      out.push(entry);
    }
    out.sort(function (a, b) { var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key; return ka - kb || a.startMin - b.startMin || a.seq - b.seq; });
    return out;
  }

  /* ---- Room Schedule: full Master Calendar + Legend (from the 2026 portal) -- */
  // Legend "Rooms / Locations" section -> override the room-code names.
  function applyLegend(rows) {
    var section = "";
    (rows || []).forEach(function (r) {
      var a = clean(r[0]), b = clean(r[1]);
      if (/^Rooms/i.test(a)) { section = "rooms"; return; }
      if (/^Ensembles/i.test(a)) { section = "ens"; return; }
      if (!a || !b) return;
      if (section === "rooms") ROOM_NAMES[a] = b;
    });
  }

  // Full Master Calendar tab -> allRows (every event, with room + ensemble + type).
  // Columns: Date, Day, Time, Room, Location, Ensemble, Conductor / Soloist, Type,
  // Event, Details. Best-effort: a missing/unparseable tab just leaves the Room
  // Schedule empty rather than throwing.
  function parseCalendar(rows) {
    rows = rows || [];
    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) { if (clean(rows[i][0]) === "Date") { headerIdx = i; break; } }
    if (headerIdx === -1) return;
    var lastDate = "", lastDay = "", seq = 0;
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j];
      if (!c.join("").trim()) continue;
      var date = clean(c[0]) || lastDate;
      var day = clean(c[1]) || (clean(c[0]) ? "" : lastDay);
      lastDate = date; lastDay = day;
      var roomRaw = clean(c[3]), location = clean(c[4]);
      var roomTokens = tokens(roomRaw);
      var roomFull = roomTokens.map(roomLabel).join(" / ");
      var loc = (location && location !== roomRaw) ? (roomFull ? roomFull + " - " + location : location) : roomFull;
      var key = dateKey(date);
      var ensVal = clean(c[5]), ensToks = tokens(ensVal);
      // The Master Calendar tab leaves Details + PDF blank for ESO/GSO rows;
      // graft them in from the dedicated ESO/GSO tabs (date+ensemble+clock join).
      var det = clean(c[9]), pdf = "";
      var ek = ensToks.indexOf("ESO") !== -1 ? "ESO" : (ensToks.indexOf("GSO") !== -1 ? "GSO" : "");
      if (ek) {
        var hit = ensDetail[key + "|" + ek + "|" + clockKey(clean(c[2]))];
        if (hit) { if (!det && hit.details) det = hit.details; if (hit.pdf) pdf = hit.pdf; }
      }
      var entry = {
        seq: seq++, date: date, day: day, key: key,
        time: clean(c[2]), startMin: startMinutes(clean(c[2])), loc: loc,
        roomTokens: roomTokens,
        ensemble: ensVal, ensTokens: ensToks,
        conductor: clean(c[6]), type: clean(c[7]), event: clean(c[8]), details: det, pdf: pdf
      };
      entry.haystack = [entry.date, entry.day, entry.time, entry.loc, entry.ensemble,
        entry.conductor, entry.type, entry.event, entry.details].join(" ").toLowerCase();
      allRows.push(entry);
      roomTokens.forEach(function (t) { seenRooms[t] = true; });
    }
    allRows.sort(function (a, b) { var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key; return ka - kb || a.startMin - b.startMin || a.seq - b.seq; });
    allRows.forEach(function (r, i) { r.seq = i; });
  }

  /* ---- Friends & Family ticket codes ----------------------------------- */
  // Parse the "Friends-Family-Discounts" tab: a "Ticketing Process" heading + a
  // policy blurb, then a "Code | URL" table. Each code ends in MMDD (e.g.
  // EGCD0801 -> Aug 1), which is the join key (month*100 + day) onto a concert.
  function parseTickets(rows) {
    var out = { head: "Ticketing Process", blurb: [], codes: [], byKey: {} };
    if (!rows || !rows.length) return out;
    var mode = "intro";
    rows.forEach(function (r) {
      var a = clean(r[0]), b = clean(r[1]);
      if (!a && !b) return;
      if (/^ticketing process/i.test(a)) { out.head = a; mode = "intro"; return; }
      if (/^code$/i.test(a) && /url|link/i.test(b)) { mode = "codes"; return; }
      if (mode === "codes") {
        if (!a) return;
        var m = a.match(/(\d{4})\s*$/);              // trailing MMDD
        var t = { code: a, url: safeUrl(b), key: m ? parseInt(m[1], 10) : null, concert: "", day: "" };
        out.codes.push(t);
        if (t.key != null && !out.byKey[t.key]) out.byKey[t.key] = t;
      } else {
        out.blurb.push(a);                            // policy paragraph(s)
      }
    });
    return out;
  }
  // A ticketed concert: not a rehearsal/dress run, and not a meeting/orientation.
  // (Excluding meetings keeps a code off a non-concert that shares a main-stage
  // date — e.g. the Jul 25 "Mandatory Student Meeting" sitting beside "EFO 4".)
  function isConcertRow(r) { return !/dress|rehearsal|meeting|orientation/i.test((r.type || "") + " " + (r.event || "")); }
  // A main-stage event: at Dana Auditorium (room code "D"). The ticket codes are for
  // the nightly Dana concert, so this separates a coded concert from the off-campus
  // Outreach concerts, pre-concert talks (Moon Room), receptions (Choir Room), and
  // Young Artist recitals (Carnegie Room) that can share the same date.
  function isMainStage(r) {
    return (r.roomTokens && r.roomTokens.indexOf("D") !== -1) || /dana auditorium/i.test(r.loc || "");
  }
  // Route each code onto its concert by date key (code MMDD == row.key). EFO/ECP
  // dedicated tabs: tag every performance (each tab is one ensemble, all at Dana).
  // All Events: the single main-stage Dana concert that night — this also covers the
  // ESO/GSO, Special Event Series, and Fellows Recital concerts that have a code but
  // live only in the full master calendar, not the EFO/ECP tabs.
  function attachTickets() {
    var tm = ticketData; if (!tm) return;
    function tag(list) {
      (list || []).forEach(function (r) {
        if (r.key == null) return;
        var t = tm.byKey[r.key];
        if (t && isConcertRow(r)) { r.ticket = t; if (!t.concert) { t.concert = r.event; t.day = r.day; } }
      });
    }
    tag(ensembles.EFO);
    tag(ensembles.ECP);
    var seen = {};   // one Dana concert per coded date wins (first in date/time order)
    (allRows || []).forEach(function (r) {
      if (r.key == null || seen[r.key]) return;
      var t = tm.byKey[r.key]; if (!t || !isConcertRow(r) || !isMainStage(r)) return;
      r.ticket = t; seen[r.key] = true;
      if (!t.concert) { t.concert = r.event; t.day = r.day; }
    });
  }

  // Append a per-room pill to the Room Schedule tab for every room actually used,
  // in ROOM_ORDER (then any extras), after the calendar has been parsed.
  function appendRoomTabs() {
    var roomsTab = null;
    for (var t = 0; t < NAV.length; t++) {
      if (NAV[t].subs.some(function (s) { return s.kind === "roomsToday"; })) { roomsTab = NAV[t]; break; }
    }
    if (!roomsTab) return;
    roomsTab.subs = roomsTab.subs.filter(function (s) { return s.kind !== "room"; });   // idempotent if build re-runs
    ROOM_ORDER.concat(Object.keys(seenRooms).filter(function (r) { return ROOM_ORDER.indexOf(r) === -1; }))
      .forEach(function (code) { if (seenRooms[code]) roomsTab.subs.push({ label: roomLabel(code), kind: "room", code: code }); });
  }

  // Today's rows (or the next scheduled day, with a banner explaining the jump).
  // codes === null -> every ensemble; otherwise keep rows in those ensemble codes
  // (plus untagged rows). Used by the Room Schedule "Today" pill.
  function todayRows(codes) {
    var tk = todayKey();
    var keys = allRows.map(function (r) { return r.key; });
    var bannerMsg = "", useKey = tk;
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

  function parseRosters(rows) {
    var t = tableObjects(rows), out = [];
    t.items.forEach(function (o) {
      var title = field(o, ["week/title", "week / title", "week", "title", "roster"]);
      var link = field(o, ["link", "url", "pdf", "pdf link", "roster link"]);
      var release = field(o, ["release?", "release", "released", "publish", "show"]);
      if (!title) return;
      out.push({ title: title, link: link, release: release });
    });
    return out;
  }

  // Contact tabs (faculty / subs / fellows / staff). Returns normalized people.
  function parseContacts(rows, kind) {
    var t = tableObjects(rows), out = [];
    t.items.forEach(function (o) {
      var first = field(o, ["first name", "first"]);
      var last = field(o, ["last name", "last", "surname"]);
      var name = clean(first + " " + last) || field(o, ["name", "full name"]);
      if (!name) return;
      var phone = field(o, ["phone number", "phone", "phone #", "cell", "mobile", "telephone"]);
      var email = field(o, ["email address", "email", "e-mail"]);
      var p = { name: name, phone: phone, email: email, photo: "" };
      if (kind === "faculty" || kind === "subs") {
        var instrument = field(o, ["instrument", "section"]);
        var title = field(o, ["title position", "title/position", "title", "position"]);
        p.instrument = instrument;
        if (kind === "faculty") { p.section = instrumentToSection(instrument); p.role = [instrument, title].filter(Boolean).join(" · "); }
        else { p.role = title || instrument; }
      } else if (kind === "fellows") {
        var program = field(o, ["program", "instrument", "section"]);
        p.role = program;
      } else if (kind === "staff") {
        p.position = field(o, ["position", "title", "title position"]);
        p.staffRole = field(o, ["role"]);
        p.role = p.position;
      }
      out.push(p);
    });
    return out;
  }

  function instrumentToSection(instr) {
    var s = clean(instr);
    if (!s) return "Faculty";
    if (/conduct/i.test(s)) return "Conductors";
    if (/timpani/i.test(s)) return "Percussion & Timpani";
    if (/percussion/i.test(s)) return "Percussion & Timpani";
    if (/bass trombone/i.test(s)) return "Trombone";
    if (/double bass|contrabass|^bass$/i.test(s)) return "Double Bass";
    if (/french horn|^horn$/i.test(s)) return "French Horn";
    return s;
  }

  // Build a name -> {photo, section, order} map from a roster/photo sheet.
  // map keyed by full-name + first|last; lastMap by surname (only when that
  // surname is unambiguous, so a nickname like Rick/Richard still lands the right
  // entry). `order` is the sheet row index and `section` the sheet's own section,
  // so faculty can be grouped + ordered EXACTLY like the public Faculty page.
  function photoMap(rows) {
    var t = tableObjects(rows), map = {}, lastMap = {}, lastSeen = {};
    t.items.forEach(function (o, idx) {
      var name = field(o, ["name", "full name", "faculty", "artist"]);
      if (!name) return;
      var entry = {
        photo: field(o, ["photo", "headshot", "image", "picture", "photo url", "image url", "headshot url"]),
        section: field(o, ["section", "group", "group name", "department", "instrument group", "instrument section"]),
        order: idx
      };
      nameKeys(name).forEach(function (k) { if (!(k in map)) map[k] = entry; });
      var toks = normName(name).split(" ");
      if (toks.length > 1) { var ln = toks[toks.length - 1]; lastSeen[ln] = (lastSeen[ln] || 0) + 1; lastMap[ln] = lastSeen[ln] === 1 ? entry : null; }
    });
    return { map: map, lastMap: lastMap };
  }
  // Stamp each person with their matched roster photo + section + row order.
  function attachPhotos(people, pm) {
    var lastCount = {};
    people.forEach(function (p) { var t = normName(p.name).split(" "); if (t.length > 1) { var ln = t[t.length - 1]; lastCount[ln] = (lastCount[ln] || 0) + 1; } });
    people.forEach(function (p) {
      var keys = nameKeys(p.name), e = null;
      for (var i = 0; i < keys.length; i++) { if (pm.map[keys[i]]) { e = pm.map[keys[i]]; break; } }
      if (!e) {
        var t = normName(p.name).split(" ");
        if (t.length > 1) { var ln = t[t.length - 1]; if (lastCount[ln] === 1 && pm.lastMap[ln]) e = pm.lastMap[ln]; }
      }
      if (e) { if (e.photo) p.photo = e.photo; p.rosterOrder = e.order; if (e.section) p.rosterSection = e.section; }
    });
  }

  /* ---- Duda box sync (defuse scroll-reveal + grow the iframe) ----------- */
  function defuseAnimations() {
    for (var el = root; el && el !== document.body; el = el.parentElement) {
      try {
        var cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 1) el.style.setProperty("opacity", "1", "important");
        if (cs.visibility === "hidden") el.style.setProperty("visibility", "visible", "important");
        if (el.classList && el.classList.contains("animated")) el.classList.add("revealed");
      } catch (e) {}
    }
  }
  function autoHeight() {
    if (!root) return;
    for (var el = root.parentElement; el && el !== document.body; el = el.parentElement) {
      try {
        var cs = getComputedStyle(el);
        var hidesOverflow = cs.overflowY === "hidden" || cs.overflowY === "clip" || cs.overflow === "hidden";
        var clipper = el.scrollHeight > el.clientHeight + 2 && hidesOverflow;
        var pinned = el.style && /px\s*$/.test(el.style.height || "");
        if (clipper || pinned) { el.style.setProperty("height", "auto", "important"); el.style.setProperty("max-height", "none", "important"); el.style.setProperty("min-height", "0", "important"); }
      } catch (e) {}
    }
    try { var f = window.frameElement; if (f) { var h = Math.ceil(root.getBoundingClientRect().height) + 8; if (parseInt(f.style.height, 10) !== h) { f.style.height = h + "px"; f.style.minHeight = h + "px"; } } } catch (e) {}
  }
  var _wired = false;
  function syncBox() { defuseAnimations(); autoHeight(); }
  function wireBox() {
    if (_wired) return; _wired = true;
    window.addEventListener("resize", syncBox);
    if (window.ResizeObserver) { try { new ResizeObserver(syncBox).observe(root); } catch (e) {} }
    var n = 0, iv = setInterval(function () { syncBox(); if (++n >= 16) clearInterval(iv); }, 250);
  }

  /* ---- announcements ticker (side-scrolling, pinned above the tabs) ----- */
  // Master Calendar "Announcements" tab. Columns resolved BY NAME (header row),
  // falling back to legacy positions (Text=0, Date=1, Logic=2). Optional Type ->
  // a category chip; optional Audience (All / Students / Faculty) gates the portal.
  function parseAnnouncements(rows) {
    if (!rows || !rows.length) return [];
    var hdr = rows[0].map(function (c) { return clean(c).toLowerCase(); });
    function col(names, dflt) { for (var n = 0; n < names.length; n++) { var x = hdr.indexOf(names[n]); if (x !== -1) return x; } return dflt; }
    var iText = col(["announcement text", "text", "announcement"], 0);
    var iDate = col(["date"], 1);
    var iLogic = col(["logic"], 2);
    var iType = col(["type", "category"], -1);
    var iAud = col(["audience", "portal", "who"], -1);
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var text = clean(r[iText]), date = clean(r[iDate]), logic = clean(r[iLogic]);
      if (!text && !date) continue;
      out.push({ text: text, dateRaw: date, key: dateKey(date), logic: logic,
        type: iType >= 0 ? clean(r[iType]) : "",
        audience: iAud >= 0 ? clean(r[iAud]) : "" });
    }
    return out;
  }
  // This portal's audience tag: a row shows here when its Audience cell is blank /
  // "All" or names this portal, so student-only rows stay out of the faculty ticker.
  var PORTAL_AUDIENCE = "facult";
  function audienceShows(aud) {
    var a = clean(aud).toLowerCase();
    if (!a || a === "all" || a === "everyone" || a === "everybody" || a === "both") return true;
    return a.indexOf(PORTAL_AUDIENCE) !== -1;   // "faculty" contains "facult"
  }
  function renderTicker() {
    if (!ticker) return;
    var tk = todayKey();
    var withText = announcements.filter(function (a) { return a.text && audienceShows(a.audience); });
    // Priority: any "Override" row wins and shows EXCLUSIVELY (chronological); else
    // today's date-matched rows; else fall forward to upcoming so the bar is never
    // blank when something is on the way.
    var overrides = withText.filter(function (a) { return /override/i.test(a.logic); });
    var items;
    if (overrides.length) {
      items = overrides.slice().sort(function (a, b) { return (a.key === null ? 99999 : a.key) - (b.key === null ? 99999 : b.key); });
    } else {
      var todays = withText.filter(function (a) { return a.key !== null && a.key === tk; });
      items = todays.length ? todays
        : withText.filter(function (a) { return a.key !== null && tk !== null && a.key >= tk; }).sort(function (a, b) { return a.key - b.key; });
    }
    if (!items.length) { ticker.hidden = true; ticker.innerHTML = ""; return; }
    var seq = items.map(function (a) {
      var chip = a.type ? '<span class="efmfp-ticker__type">' + esc(a.type) + "</span> " : "";
      return '<span class="efmfp-ticker__item">' + chip + esc(a.text) + "</span>";
    }).join("");
    // The track holds the sequence twice for a seamless marquee; the second copy
    // is aria-hidden so a screen reader reads each announcement only once.
    ticker.innerHTML =
      '<span class="efmfp-ticker__label">Announcements</span>' +
      '<div class="efmfp-ticker__viewport"><div class="efmfp-ticker__track">' +
        '<span class="efmfp-ticker__seq">' + seq + '</span>' +
        '<span class="efmfp-ticker__seq" aria-hidden="true">' + seq + '</span>' +
      "</div></div>" +
      '<button type="button" class="efmfp-ticker__pause" aria-pressed="false" aria-label="Pause announcements">∥</button>';
    ticker.hidden = false;
    var btn = ticker.querySelector(".efmfp-ticker__pause");
    btn.addEventListener("click", function () {
      var paused = ticker.classList.toggle("efmfp-paused");
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      btn.setAttribute("aria-label", paused ? "Play announcements" : "Pause announcements");
      btn.innerHTML = paused ? "▶" : "∥";
    });
  }

  /* ---- load ------------------------------------------------------------ */
  function loadCSV(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(parseCSV);
  }
  function loadFirst(urls) {
    return new Promise(function (resolve) {
      (function tryNext(i) {
        if (i >= urls.length) { resolve(null); return; }
        loadCSV(urls[i]).then(function (rows) { if (rows && rows.length) resolve(rows); else tryNext(i + 1); }, function () { tryNext(i + 1); });
      })(0);
    });
  }
  // Published-tab directory: name -> gid (so a rebuild that changes gids still works).
  function resolveDir(pubhtmlUrl) {
    return fetch(pubhtmlUrl, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (html) {
      var map = {};
      html.split("items.push(").forEach(function (chunk) {
        var n = chunk.match(/name:\s*"([^"]+)"/), g = chunk.match(/gid:\s*"(\d+)"/);
        if (n && g) map[n[1]] = g[1];
      });
      return map;
    }).catch(function () { return {}; });
  }

  function build(data) {
    built = true;
    // contacts
    facultyPeople = data.faculty ? parseContacts(data.faculty, "faculty") : [];
    fellowPeople = data.fellows ? parseContacts(data.fellows, "fellows") : [];
    staffPeople = data.staff ? parseContacts(data.staff, "staff") : [];
    // photos (best-effort)
    if (data.facultyPhotos) attachPhotos(facultyPeople, photoMap(data.facultyPhotos));
    if (data.fellowPhotos) attachPhotos(fellowPeople, photoMap(data.fellowPhotos));
    // legend (room-code names) before parsing the full master calendar
    if (data.legend) applyLegend(data.legend);
    // calendar ensembles (EFO/ECP/REP standard layout, Outreach Concerts alternate)
    ensembles.EFO = parseEnsemble(data.EFO);
    ensembles.ECP = parseEnsemble(data.ECP);
    ensembles.REP = parseEnsemble(data.REP);
    ensembles.OUT = parseEnsemble(data.OUT);
    ensembles.ESO = parseEnsemble(data.ESO);
    ensembles.GSO = parseEnsemble(data.GSO);
    buildAnchors();
    ensAnchors = { ESO: buildEnsAnchors("ESO"), GSO: buildEnsAnchors("GSO") };

    // Classes & Assignments info tabs + conditional pills: a showWhen pill stays only
    // when its tab's Show/Hide cell reads "Yes"; drop any parent left with no subs.
    ["placement", "sectionals", "studio", "concerto"].forEach(function (key) { infoTabs[key] = data[key] || null; });
    sectionalData = parseSectionals(infoTabs.sectionals);
    NAV.forEach(function (t) {
      t.subs = t.subs.filter(function (s) { return !s.showWhen || /^y(es)?$/i.test(showHideValue(infoTabs[s.showWhen] || [])); });
    });
    NAV = NAV.filter(function (t) { return t.subs.length; });
    NAV.forEach(function (t) { if (subSel[t.id] >= t.subs.length) subSel[t.id] = 0; });

    // ESO/GSO Details + program PDFs live on their own tabs; build the join map
    // (date+ensemble+clock -> {details, pdf}) so parseCalendar can graft them onto
    // the otherwise-blank ESO/GSO rows in All Events / Room Schedule.
    ensDetail = {};
    ["ESO", "GSO"].forEach(function (code) {
      (ensembles[code] || []).forEach(function (r) {
        if (!r.details && !r.pdf) return;
        var k = r.key + "|" + code + "|" + clockKey(r.time);
        if (!ensDetail[k]) ensDetail[k] = {};
        if (r.details && !ensDetail[k].details) ensDetail[k].details = r.details;
        if (r.pdf && !ensDetail[k].pdf) ensDetail[k].pdf = r.pdf;
      });
    });
    // full master calendar -> Room Schedule (today + per-room pills)
    parseCalendar(data.master);
    appendRoomTabs();

    // Friends & Family ticket codes (Faculty-Portal "Friends-Family-Discounts"
    // tab) -> the General Information "Tickets" pill, and routed onto each
    // matching EFO/ECP concert (build after ensembles + allRows exist).
    ticketData = parseTickets(data.tickets);
    attachTickets();

    // Released roster weeks (Release == Yes) become the 3rd-level week nav under
    // "Eastern Festival Orchestra" (renderNav); unreleased weeks simply don't appear.
    rostersAll = data.rosters ? parseRosters(data.rosters) : [];
    calendarWeeks = rostersAll
      .filter(function (o) { return /^y(es)?$/i.test(clean(o.release)); })
      .map(function (o) { return { label: o.title, roster: o }; });
    // Unified per-ensemble week pills: EFO from the Faculty-Portal Rosters tab
    // (above); ESO/GSO from the shared Master Calendar Student-Rosters tab, where
    // each title "Week N (ESO|GSO)" names its ensemble in the parenthetical.
    ensWeeks = { EFO: calendarWeeks, ESO: [], GSO: [] };
    (data.studentRosters ? parseRosters(data.studentRosters) : [])
      .filter(function (o) { return /^y(es)?$/i.test(clean(o.release)); })
      .forEach(function (o) {
        var m = rosterMeta(o.title), code = clean(m.qualifier).toUpperCase();
        if ((code === "ESO" || code === "GSO") && m.week != null) ensWeeks[code].push({ label: "Week " + m.week, roster: o });
      });
    ["ESO", "GSO"].forEach(function (code) {
      ensWeeks[code].sort(function (a, b) { return rosterMeta(a.roster.title).week - rosterMeta(b.roster.title).week; });
    });
    if (weekSel != null && weekSel >= calendarWeeks.length) weekSel = null;
    // info text: dining (master calendar) + the Faculty-Portal General-Information tab (full rows)
    diningLines = data.generalInfo ? data.generalInfo.map(function (r) { return clean(r[0]); }) : [];
    infoRows = data.info || [];
    lessons = parseLessons(data.lessons);
    announcements = data.announcements ? parseAnnouncements(data.announcements) : [];
    renderTicker();

    searchBox.addEventListener("input", renderList);
    renderNav();
    renderList();
  }

  function fail(err) {
    if (status) { status.textContent = "Could not load the faculty portal right now. Please refresh the page, or contact the EFM office."; status.hidden = false; announce(status.textContent); }
    if (window.console) console.error("EFM faculty portal load failed:", err);
  }

  function run() {
    // Resolve the published-tab directories in parallel, but DON'T block on them.
    // Each tab fetches by its known gid first; it only waits on the directory if
    // that gid fetch comes back empty (the sheet was rebuilt and gids moved). This
    // keeps the ~0.5s directory round-trip off the critical path. (#1)
    var fpDirP = resolveDir(FP_PUBHTML), mcDirP = resolveDir(MC_PUBHTML);
    function job(csvBase, dirP, tab) {
      return loadFirst([csvBase + tab.gid]).then(function (rows) {
        if (rows && rows.length) return rows;                 // known gid worked
        return dirP.then(function (dir) {                      // gid stale -> resolved gid
          var gid = dir && dir[tab.name];
          return (gid && gid !== tab.gid) ? loadFirst([csvBase + gid]) : null;
        });
      });
    }
    var jobs = {
      faculty: job(FP_CSV, fpDirP, FP_TABS.faculty),
      fellows: job(FP_CSV, fpDirP, FP_TABS.fellows),
      staff: job(FP_CSV, fpDirP, FP_TABS.staff),
      rosters: job(FP_CSV, fpDirP, FP_TABS.rosters),
      info: job(FP_CSV, fpDirP, FP_TABS.info),
      tickets: job(FP_CSV, fpDirP, FP_TABS.tickets),
      EFO: job(MC_CSV, mcDirP, MC_TABS.EFO),
      ECP: job(MC_CSV, mcDirP, MC_TABS.ECP),
      REP: job(MC_CSV, mcDirP, MC_TABS.REP),
      OUT: job(MC_CSV, mcDirP, MC_TABS.OUT),
      ESO: job(MC_CSV, mcDirP, MC_TABS.ESO),
      GSO: job(MC_CSV, mcDirP, MC_TABS.GSO),
      studentRosters: job(MC_CSV, mcDirP, MC_TABS.studentRosters),
      generalInfo: job(MC_CSV, mcDirP, MC_TABS.generalInfo),
      announcements: job(MC_CSV, mcDirP, MC_TABS.announcements),
      master: job(MC_CSV, mcDirP, MC_TABS.master),
      legend: job(MC_CSV, mcDirP, MC_TABS.legend),
      placement: job(MC_CSV, mcDirP, MC_TABS.placement),
      sectionals: job(MC_CSV, mcDirP, MC_TABS.sectionals),
      studio: job(MC_CSV, mcDirP, MC_TABS.studio),
      concerto: job(MC_CSV, mcDirP, MC_TABS.concerto),
      lessons: job(MC_CSV, mcDirP, MC_TABS.lessons),
      facultyPhotos: loadFirst(FACULTY_PHOTO_URLS),
      fellowPhotos: loadFirst(FELLOW_PHOTO_URLS)
    };
    // Early first-paint: render the default General Information -> Dining view as
    // soon as that one tab arrives, instead of waiting for all ~19 fetches. The
    // full build() (which finalizes nav + every other tab) still runs below. (#2)
    jobs.generalInfo.then(function (rows) {
      if (built || !rows) return;
      diningLines = rows.map(function (r) { return clean(r[0]); });
      var sub = currentSub();
      if (sub && sub.kind === "dining") renderDining();
    });
    var keys = Object.keys(jobs);
    Promise.all(keys.map(function (k) { return jobs[k]; })).then(function (results) {
      var data = {}; keys.forEach(function (k, i) { data[k] = results[i]; });
      build(data);
    }).catch(fail);
  }

  /* ---- boot ------------------------------------------------------------ */
  function boot() {
    root = document.getElementById("efm-faculty-portal");
    if (!root) return;
    topnav = document.getElementById("efmfp-topnav");
    subnav = document.getElementById("efmfp-subnav");
    list = document.getElementById("efmfp-list");
    status = document.getElementById("efmfp-status");
    banner = document.getElementById("efmfp-banner");
    searchBox = document.getElementById("efmfp-search");
    controls = root.querySelector(".efmfp__controls");
    if (!topnav || !list) return;

    // 3rd-level week nav (injected just under the sub-pills); shown only for the
    // "Eastern Festival Orchestra" pill, which carries the released roster weeks.
    subnav2 = document.createElement("nav");
    subnav2.id = "efmfp-subnav2";
    subnav2.className = "efmfp__subtabs efmfp__subtabs--week";
    subnav2.setAttribute("aria-label", "Week");
    subnav2.hidden = true;
    if (subnav && subnav.parentNode) subnav.parentNode.insertBefore(subnav2, subnav.nextSibling);

    srLive = document.createElement("div");
    srLive.className = "efmfp__sr"; srLive.setAttribute("aria-live", "polite"); srLive.setAttribute("aria-atomic", "true");
    root.appendChild(srLive); announce("Loading the faculty portal…");

    // Announcements ticker, injected ABOVE the nav tabs (just under the title).
    ticker = document.createElement("div");
    ticker.className = "efmfp__ticker"; ticker.id = "efmfp-ticker"; ticker.hidden = true;
    var tabsEl = root.querySelector(".efmfp__tabs");
    if (tabsEl && tabsEl.parentNode) tabsEl.parentNode.insertBefore(ticker, tabsEl);
    else root.insertBefore(ticker, root.firstChild);

    icsBtn = document.createElement("button");
    icsBtn.type = "button"; icsBtn.id = "efmfp-ics"; icsBtn.className = "efmfp__ics"; icsBtn.hidden = true;
    icsBtn.textContent = "Add to Calendar";
    icsBtn.setAttribute("aria-label", "Add the services shown here to your calendar");
    icsBtn.addEventListener("click", function () { if (viewEvents.length) openAddToCalendar(viewEvents, viewLabel, viewFeedKey); });
    if (controls) controls.appendChild(icsBtn);

    modal = document.createElement("div");
    modal.className = "efmfp-modal"; modal.hidden = true;
    modal.innerHTML =
      '<div class="efmfp-modal__box" role="dialog" aria-modal="true" aria-labelledby="efmfp-modal-title">' +
        '<button type="button" class="efmfp-modal__close" aria-label="Close">×</button>' +
        '<div class="efmfp-modal__title" id="efmfp-modal-title" role="heading" aria-level="2"></div>' +
        '<div class="efmfp-modal__content"></div>' +
        '<div class="efmfp-modal__actions" hidden>' +
          '<span class="efmfp-modal__addlabel">Add to calendar:</span>' +
          '<a class="efmfp-modal__cal efmfp-modal__cal--gcal" target="_blank" rel="noopener noreferrer" href="#">Google Calendar</a>' +
          '<button type="button" class="efmfp-modal__cal efmfp-modal__cal--ics">Apple Calendar (.ics)</button>' +
        '</div>' +
      '</div>';
    root.appendChild(modal);
    modal.querySelector(".efmfp-modal__close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener("keydown", trapKey);

    list.addEventListener("click", function (e) { var r = e.target.closest ? e.target.closest("[data-mi]") : null; if (r) openModal(modalData[+r.getAttribute("data-mi")]); });
    list.addEventListener("keydown", function (e) { if (e.key !== "Enter" && e.key !== " ") return; var r = e.target.closest ? e.target.closest("[data-mi]") : null; if (r) { e.preventDefault(); openModal(modalData[+r.getAttribute("data-mi")]); } });

    wireBox();
    renderNav();
    run();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
