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
     Calendar             — EFO / ECP (Master Calendar ensemble tabs, live;
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
  var FP_TABS = {
    faculty: { name: "Faculty", gid: "0" },
    dress:   { name: "Dress Code", gid: "1025224143" },
    subs:    { name: "Subs", gid: "1288329624" },
    rosters: { name: "Rosters", gid: "1681602909" },
    staff:   { name: "Staff", gid: "1949353186" },
    fellows: { name: "Orchestral Fellows", gid: "752003554" }
  };

  // The Master Calendar (same document that feeds the 2026 portal). EFO/ECP are
  // dedicated, pre-filtered ensemble tabs; "General Information" holds dining.
  // Resolved by NAME (gids change when the calendar is rebuilt); gids are fallback.
  var MC_PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQg7mhQsWCaOdsg1k_z-TkSHRqNDTuAQE7NEXr6xzCBR-psxMoQGExmVlINpF-xu_3FIgbE4qSK1aAJ";
  var MC_CSV = MC_PUB + "/pub?single=true&output=csv&gid=";
  var MC_PUBHTML = MC_PUB + "/pubhtml";
  var MC_TABS = {
    EFO:         { name: "EFO", gid: "1438770792" },
    ECP:         { name: "ECP", gid: "518713173" },
    generalInfo: { name: "General Information", gid: "1031874194" }
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
  var FEED_VIEWS = { EFO: "efo", ECP: "ecp" };
  var YEAR = 2026;

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  // Faculty section order (mirrors the public Faculty page).
  var SECTION_ORDER = ["Conductors", "Flute", "Oboe", "Clarinet", "Bassoon",
    "French Horn", "Trumpet", "Trombone", "Tuba", "Percussion & Timpani",
    "Harp", "Piano", "Violin", "Viola", "Cello", "Double Bass"];

  /* ---- navigation model ------------------------------------------------ */
  var NAV = [
    { id: "info", label: "General Information", subs: [
      { label: "General Information", kind: "info" } ] },
    { id: "calendar", label: "Calendar", subs: [
      { label: "EFO", kind: "ensemble", code: "EFO" },
      { label: "ECP", kind: "ensemble", code: "ECP" } ] },
    { id: "rosters", label: "Rosters", subs: [
      { label: "Rosters", kind: "rostersEmpty" } ] },   // rebuilt after data loads
    { id: "facultyc", label: "Faculty Contact", subs: [
      { label: "Faculty", kind: "facultyCards" },
      { label: "Subs", kind: "subCards" },
      { label: "Orchestral Fellows", kind: "fellowCards" } ] },
    { id: "staffc", label: "Staff Contact", subs: [
      { label: "Staff Contact", kind: "staffCards" } ] }
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
  var rostersAll = [];     // [{title, link, release}]
  var facultyPeople = [];  // [{name, instrument, title, phone, email, photo, section}]
  var subPeople = [];
  var fellowPeople = [];
  var staffPeople = [];
  var diningLines = [];    // raw lines from Master Calendar General Information
  var dressLines = [];     // raw lines from Faculty-Portal Dress Code

  var modalData = [], viewEvents = [], viewLabel = "", viewFeedKey = "";
  var topSel = NAV[0].id, subSel = {};
  NAV.forEach(function (t) { subSel[t.id] = 0; });

  var root, topnav, subnav, list, status, banner, searchBox, controls, icsBtn, modal, srLive, lastFocus;

  function currentTop() { for (var i = 0; i < NAV.length; i++) if (NAV[i].id === topSel) return NAV[i]; return NAV[0]; }
  function currentSub() { var t = currentTop(); return t.subs[subSel[t.id]] || t.subs[0]; }

  /* ---- nav render ------------------------------------------------------ */
  function renderNav() {
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
        b.onclick = function () { subSel[top.id] = i; renderNav(); renderList(); };
        subnav.appendChild(b);
      });
    }
  }

  function announce(msg) { if (srLive) { srLive.textContent = ""; srLive.textContent = String(msg || ""); } }

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
      return '<span class="efmfp-chip' + (c.ens ? " efmfp-chip--ens" : "") + '">' + esc(c.label) + "</span>";
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

  // Render a list of service rows as a month-grouped agenda. Returns the count shown.
  function renderAgenda(rows, feedKey) {
    var q = clean(searchBox.value).toLowerCase();
    var html = "", shown = 0, lastMonth = null;
    rows.forEach(function (r) {
      if (q && r.haystack.indexOf(q) === -1) return;
      if (r.key !== null) {
        var mon = Math.floor(r.key / 100);
        if (mon !== lastMonth) { html += '<div class="efmfp-month" role="heading" aria-level="3">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>"; lastMonth = mon; }
      }
      var ev = {
        title: r.event || "(untitled)", dateStr: r.date, timeStr: r.time, location: r.loc,
        description: [r.conductor && ("Conductor / Soloist: " + r.conductor), r.details].filter(Boolean).join("\n")
      };
      viewEvents.push(ev);
      var ty = serviceType(r.event);
      html += agendaRowHTML({
        big: r.key !== null ? String(r.key % 100) : "", small: r.day || monthAbbr(r.key),
        title: r.event || "(untitled)", when: [r.time, r.loc, r.conductor],
        chips: [{ label: ty.label, ens: ty.ens }],
        modal: {
          title: r.event || "Event",
          fields: [["Date", (r.day ? r.day + ", " : "") + r.date], ["Time", r.time], ["Location", r.loc], ["Conductor / Soloist", r.conductor]],
          details: r.details, ics: ev
        }
      });
      shown++;
    });
    banner.hidden = true;
    if (shown) { list.innerHTML = html; status.hidden = true; }
    else { list.innerHTML = ""; status.textContent = q ? "No services match your search." : "No services scheduled."; status.hidden = false; }
    viewFeedKey = feedKey || "";
    announce(shown + (shown === 1 ? " service" : " services") + (q ? " match your search." : " shown."));
    return shown;
  }

  /* ---- General Information (dining + dress) ----------------------------- */
  function isHeadingLine(l) { return l && !/[.:]/.test(l) && l.split(/\s+/).length <= 4; }

  function renderInfo() {
    banner.hidden = true; status.hidden = true;
    var html = '<div class="efmfp-info">';

    // Dining (from the Master Calendar General Information tab)
    html += '<div class="efmfp-info__head" role="heading" aria-level="2">Dining</div>';
    var dl = diningLines.filter(function (l) { return l !== ""; });
    // drop a leading "General Information" / "Dining Schedule" label line
    dl = dl.filter(function (l) { return !/^general information$/i.test(l) && !/^dining schedule$/i.test(l); });
    if (dl.length) {
      html += '<div class="efmfp-info__card">';
      dl.forEach(function (l) {
        var meal = l.match(/^(Breakfast|Brunch|Lunch|Dinner|Snack|Coffee)\b[:\s]*(.*)$/i);
        if (/^(WEEKDAYS|WEEKENDS)/i.test(l)) {
          html += '<div class="efmfp-info__sub" role="heading" aria-level="3">' + esc(l) + "</div>";
        } else if (meal) {
          html += '<div class="efmfp-info__meal"><b>' + esc(meal[1]) + "</b><span>" + esc(meal[2]) + "</span></div>";
        } else {
          html += "<p>" + esc(l) + "</p>";
        }
      });
      html += "</div>";
    } else {
      html += '<p>Dining information will appear here once posted in the master calendar.</p>';
    }

    // Dress Code (from the Faculty-Portal sheet)
    html += '<div class="efmfp-info__head" role="heading" aria-level="2">Dress Code</div>';
    var ds = dressLines.filter(function (l) { return l !== ""; });
    ds = ds.filter(function (l) { return !/^dress code$/i.test(l); });
    if (ds.length) {
      html += '<div class="efmfp-info__card">';
      ds.forEach(function (l) {
        l = l.replace(/\s*\n\s*/g, " ").trim();   // un-wrap soft-wrapped sheet cells
        if (isHeadingLine(l)) {
          html += '<div class="efmfp-info__sub" role="heading" aria-level="3">' + esc(l) + "</div>";
        } else {
          var lab = l.match(/^([A-Z][a-z]+):\s*(.*)$/);
          html += lab ? "<p><b>" + esc(lab[1]) + ":</b> " + esc(lab[2]) + "</p>" : "<p>" + esc(l) + "</p>";
        }
      });
      html += "</div>";
    } else {
      html += '<p>Dress code information will appear here once posted.</p>';
    }

    html += "</div>";
    list.innerHTML = html;
    announce("General information shown.");
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
    if (!people.length) { status.textContent = opts.empty || "Nothing to display yet."; status.hidden = false; return; }
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
  // Build EFO concert anchors (concert N -> dateKey) from the EFO tab.
  function buildAnchors() {
    efoAnchors = {};
    (ensembles.EFO || []).forEach(function (r) {
      var m = clean(r.event).match(/^EFO\s*0*(\d+)\s*$/i);
      if (m && r.key !== null) efoAnchors[parseInt(m[1], 10)] = r.key;
    });
  }
  // Parse "Week 1", "Week 1 (Mozart)" -> { week, qualifier }
  function rosterMeta(title) {
    var w = clean(title).match(/week\s*0*(\d+)/i);
    var q = clean(title).match(/\(([^)]+)\)/);
    return { week: w ? parseInt(w[1], 10) : null, qualifier: q ? q[1].trim() : "" };
  }
  // The EFO services belonging to a roster row, inferred from concert cycles.
  function rosterServices(rosterTitle) {
    var meta = rosterMeta(rosterTitle);
    if (meta.week === null) return [];
    var upper = efoAnchors[meta.week];
    if (upper === undefined) return [];                 // that concert not in the calendar yet
    var lower = efoAnchors[meta.week - 1];               // previous concert (undefined for week 1)
    var rows = (ensembles.EFO || []).filter(function (r) {
      if (r.key === null) return false;
      return (lower === undefined ? r.key <= upper : (r.key > lower && r.key <= upper));
    });
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

  function renderRoster(roster) {
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

    // EFO services for this week
    var svc = rosterServices(roster.title);
    var svcWrap = document.createElement("div");
    svcWrap.innerHTML = '<div class="efmfp-roster__svc-head" role="heading" aria-level="3">EFO Services</div><div id="efmfp-roster-svc"></div>';
    list.querySelector(".efmfp-roster").appendChild(svcWrap);
    // temporarily point rendering at the services sub-list
    var svcList = svcWrap.querySelector("#efmfp-roster-svc");
    // render agenda into svcList (temporarily retarget the shared list pointer)
    var saved = list; list = svcList;
    renderAgenda(svc, "");        // no subscribe for a week subset; .ics export covers it
    list = saved;
    viewLabel = roster.title + " EFO Services";
    updateICSButton();
    syncBox();
  }

  /* ---- master render dispatch ------------------------------------------ */
  function renderList() {
    var sub = currentSub();
    modalData = []; viewEvents = []; viewLabel = ""; viewFeedKey = "";
    var k = sub.kind;
    var showControls = (k === "ensemble" || k === "roster");
    if (controls) controls.hidden = !showControls;

    if (k === "info") renderInfo();
    else if (k === "ensemble") {
      viewLabel = "EFM " + sub.code;
      renderAgenda(ensembles[sub.code] || [], FEED_VIEWS[sub.code] || "");
    }
    else if (k === "roster") { viewLabel = sub.roster.title; renderRoster(sub.roster); }
    else if (k === "facultyCards") renderCards(facultyPeople, { grouped: true, avatar: true, empty: "Faculty contacts will appear here once posted." });
    else if (k === "subCards") renderCards(subPeople, { grouped: false, avatar: false, empty: "Substitute contacts will appear here once posted." });
    else if (k === "fellowCards") renderCards(fellowPeople, { grouped: false, avatar: true, empty: "Orchestral Fellow contacts will appear here once posted." });
    else if (k === "staffCards") renderStaffCards();
    else if (k === "rostersEmpty") { banner.hidden = true; status.textContent = "No rosters have been released yet. Released rosters will appear here as sub-tabs."; status.hidden = false; list.innerHTML = ""; }
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
      if (d.details) html += '<div class="efmfp-modal__details">' + esc(d.details) + "</div>";
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
  // EFO/ECP tab -> service rows. Header row is the one whose first cell is "Date".
  function parseEnsemble(rows) {
    rows = rows || []; var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) { if (clean(rows[i][0]) === "Date") { headerIdx = i; break; } }
    if (headerIdx === -1) return [];
    var hdr = rows[headerIdx].map(function (h) { return clean(h).toLowerCase(); });
    function col() { for (var a = 0; a < arguments.length; a++) { var idx = hdr.indexOf(arguments[a]); if (idx !== -1) return idx; } return -1; }
    var iDate = col("date"), iDay = col("day"), iTime = col("time"), iRoom = col("room"),
        iRoomName = col("room name", "location", "room/location"), iCond = col("conductor / soloist", "conductor/soloist", "conductor", "soloist"),
        iEvent = col("event", "title"), iDetails = col("details", "notes");
    var out = [], lastDate = "", lastDay = "", seq = 0;
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j]; if (!c.join("").trim()) continue;
      var date = clean(c[iDate]) || lastDate;
      var day = clean(iDay !== -1 ? c[iDay] : "") || (clean(c[iDate]) ? "" : lastDay);
      lastDate = date; lastDay = day;
      var roomName = clean(iRoomName !== -1 ? c[iRoomName] : ""), roomCode = clean(iRoom !== -1 ? c[iRoom] : "");
      var loc = roomName || roomCode;
      var key = dateKey(date);
      var entry = {
        seq: seq++, date: date, day: day, key: key, time: clean(iTime !== -1 ? c[iTime] : ""),
        startMin: startMinutes(clean(iTime !== -1 ? c[iTime] : "")), loc: loc,
        conductor: clean(iCond !== -1 ? c[iCond] : ""), event: clean(iEvent !== -1 ? c[iEvent] : ""),
        details: clean(iDetails !== -1 ? c[iDetails] : "")
      };
      if (!entry.event && !entry.time) continue;   // skip stray blank rows
      entry.haystack = [entry.date, entry.day, entry.time, entry.loc, entry.conductor, entry.event, entry.details].join(" ").toLowerCase();
      out.push(entry);
    }
    out.sort(function (a, b) { var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key; return ka - kb || a.startMin - b.startMin || a.seq - b.seq; });
    return out;
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
  function tabUrl(csvBase, dir, tab) { var gid = (dir && dir[tab.name]) || tab.gid; return csvBase + gid; }

  function build(data) {
    // contacts
    facultyPeople = data.faculty ? parseContacts(data.faculty, "faculty") : [];
    subPeople = data.subs ? parseContacts(data.subs, "subs") : [];
    fellowPeople = data.fellows ? parseContacts(data.fellows, "fellows") : [];
    staffPeople = data.staff ? parseContacts(data.staff, "staff") : [];
    // photos (best-effort)
    if (data.facultyPhotos) attachPhotos(facultyPeople, photoMap(data.facultyPhotos));
    if (data.fellowPhotos) attachPhotos(fellowPeople, photoMap(data.fellowPhotos));
    // calendar ensembles
    ensembles.EFO = parseEnsemble(data.EFO);
    ensembles.ECP = parseEnsemble(data.ECP);
    buildAnchors();
    // rosters -> sub-tabs (only Release == Yes)
    rostersAll = data.rosters ? parseRosters(data.rosters) : [];
    var released = rostersAll.filter(function (o) { return /^y(es)?$/i.test(clean(o.release)); });
    var rostersTab = NAV.filter(function (t) { return t.id === "rosters"; })[0];
    rostersTab.subs = released.length
      ? released.map(function (o) { return { label: o.title, kind: "roster", roster: o }; })
      : [{ label: "Rosters", kind: "rostersEmpty" }];
    if (subSel.rosters >= rostersTab.subs.length) subSel.rosters = 0;
    // info text
    diningLines = data.generalInfo ? data.generalInfo.map(function (r) { return clean(r[0]); }) : [];
    dressLines = data.dress ? data.dress.map(function (r) { return clean(r[0]); }) : [];

    searchBox.addEventListener("input", renderList);
    renderNav();
    renderList();
  }

  function fail(err) {
    if (status) { status.textContent = "Could not load the faculty portal right now. Please refresh the page, or contact the EFM office."; status.hidden = false; announce(status.textContent); }
    if (window.console) console.error("EFM faculty portal load failed:", err);
  }

  function run() {
    Promise.all([resolveDir(FP_PUBHTML), resolveDir(MC_PUBHTML)]).then(function (dirs) {
      var fpDir = dirs[0], mcDir = dirs[1];
      var jobs = {
        faculty: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.faculty)]),
        subs: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.subs)]),
        fellows: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.fellows)]),
        staff: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.staff)]),
        rosters: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.rosters)]),
        dress: loadFirst([tabUrl(FP_CSV, fpDir, FP_TABS.dress)]),
        EFO: loadFirst([tabUrl(MC_CSV, mcDir, MC_TABS.EFO)]),
        ECP: loadFirst([tabUrl(MC_CSV, mcDir, MC_TABS.ECP)]),
        generalInfo: loadFirst([tabUrl(MC_CSV, mcDir, MC_TABS.generalInfo)]),
        facultyPhotos: loadFirst(FACULTY_PHOTO_URLS),
        fellowPhotos: loadFirst(FELLOW_PHOTO_URLS)
      };
      var keys = Object.keys(jobs);
      Promise.all(keys.map(function (k) { return jobs[k]; })).then(function (results) {
        var data = {}; keys.forEach(function (k, i) { data[k] = results[i]; });
        build(data);
      }).catch(fail);
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

    srLive = document.createElement("div");
    srLive.className = "efmfp__sr"; srLive.setAttribute("aria-live", "polite"); srLive.setAttribute("aria-atomic", "true");
    root.appendChild(srLive); announce("Loading the faculty portal…");

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
