/* ============================================================
   EFM 2026 Schedule Portal — behavior
   Hosted externally and referenced from the portal page:
     <link rel="stylesheet" href=".../efm-portal.css">
     <div id="efm-portal" class="efmp"> ... </div>
     <script src=".../efm-portal.js"></script>

   Data source: the published "DRAFT Master Calendar" Google Sheet.
   Tabs are resolved by NAME from the published /pubhtml directory,
   so the widget keeps working after the sheet is rebuilt (gids change).

   Optional "Config" tab drives the audience tabs (the top nav). When
   present, it replaces the built-in DEFAULT_NAV below. Columns:
       TabId | TabLabel | SubLabel | Kind | Args
     - TabId .... stable id for the top tab (blank row = continue previous tab)
     - TabLabel . display label for the top tab (read from its first row)
     - SubLabel . display label for the sub-tab (view)
     - Kind ..... today | ensemble | allEnsembles | type | jump | roomsToday
     - Args ..... today -> comma-separated ensemble codes (blank = everyone)
                  ensemble -> a single code (e.g. ESO)
                  type -> the exact Type value (e.g. Meeting / Admin)
                  jump -> the TabId to jump to (e.g. rooms)
                  allEnsembles / roomsToday -> leave blank
   Per-room sub-tabs are appended automatically to whichever tab holds a
   "roomsToday" view, so they never need to be listed in Config.
   ============================================================ */
(function () {
  var PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQg7mhQsWCaOdsg1k_z-TkSHRqNDTuAQE7NEXr6xzCBR-psxMoQGExmVlINpF-xu_3FIgbE4qSK1aAJ";
  var CSV = PUB + "/pub?output=csv";    // bare CSV = the document's first (left-most) tab
  var PUBHTML = PUB + "/pubhtml";        // published tab directory: maps tab name -> gid
  var TAB_CALENDAR = "Master Calendar";  // looked up by NAME (gids change on rebuild)
  var TAB_LEGEND = "Legend";
  var TAB_CONFIG = "Config";             // optional; drives the audience tabs
  var YEAR = 2026;

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
  // Used only if there's no Config tab in the sheet (or it can't be parsed).
  var DEFAULT_NAV = [
    { id: "students", label: "Students", subs: [
      { label: "Today", kind: "today", codes: ["ESO", "GSO"] },
      { label: "ESO Schedule", kind: "ensemble", code: "ESO" },
      { label: "GSO Schedule", kind: "ensemble", code: "GSO" } ] },
    { id: "faculty", label: "Faculty", subs: [
      { label: "Today", kind: "today", codes: ["EFO", "ECP"] },
      { label: "EFO Schedule", kind: "ensemble", code: "EFO" },
      { label: "ECP Schedule", kind: "ensemble", code: "ECP" } ] },
    { id: "fellows", label: "Fellows", subs: [
      { label: "Today", kind: "today", codes: ["EFO", "REP"] },
      { label: "EFO Schedule", kind: "ensemble", code: "EFO" },
      { label: "REP Schedule", kind: "ensemble", code: "REP" } ] },
    { id: "staff", label: "Staff", subs: [
      { label: "Today", kind: "today", codes: null },
      { label: "Ensemble Schedule", kind: "allEnsembles" },
      { label: "Meeting Schedule", kind: "type", value: "Meeting / Admin" },
      { label: "Room Schedule", kind: "jump", target: "rooms" } ] },
    { id: "rooms", label: "Room Schedule", subs: [
      { label: "Today", kind: "roomsToday" } ] }  // room tabs appended after data loads
  ];

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

  function tokens(s) {
    return s.split("/").map(function (t) { return t.trim(); }).filter(Boolean);
  }

  var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function dateKey(dateStr) {  // "Jun 22" -> 622 style sortable key, or null
    var m = dateStr.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
    if (!m || !(m[1].slice(0,1).toUpperCase()+m[1].slice(1,3).toLowerCase() in MONTHS)) return null;
    var mon = MONTHS[m[1].slice(0,1).toUpperCase() + m[1].slice(1,3).toLowerCase()];
    return (mon + 1) * 100 + parseInt(m[2], 10);
  }
  function todayKey() {
    var now = new Date();
    if (now.getFullYear() !== YEAR) return null;  // outside festival year
    return (now.getMonth() + 1) * 100 + now.getDate();
  }
  function roomLabel(code) { return ROOM_NAMES[code] || code; }

  // Start time in minutes since midnight, for chronological sorting.
  // Handles the sheet's mixed formats: "8:00 AM", "7:30 - 8:30am",
  // "5:30:00 PM - 6:45 pm", "10:00-12:00", bare "7:30", etc.
  // Untimed rows return -1 so announcements lead their day.
  function startMinutes(time) {
    var s = (time || "").trim();
    var m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?:[:.]\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!m || !m[1]) return -1;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0;
    if (h > 23 || min > 59) return -1;
    var mer = m[3] ? m[3].charAt(0).toLowerCase() : null;
    if (!mer) {
      // borrow the meridiem from the end time ("12:00 - 1:15pm")
      var em = s.slice(m[0].length).match(/(am|pm|a\.m\.|p\.m\.)/i);
      if (em) mer = em[1].charAt(0).toLowerCase();
      // a pm end doesn't make a late-morning start pm ("10:00 - 1:00pm")
      if (mer === "p" && h >= 8 && h <= 11) mer = "a";
    }
    if (!mer) mer = (h >= 8 && h <= 11) ? "a" : "p";  // festival-day heuristic
    if (h === 12) h = 0;
    return (h + (mer === "p" ? 12 : 0)) * 60 + min;
  }

  // ---- state --------------------------------------------------------------
  var allRows = [];
  var NAV = DEFAULT_NAV;
  var topSel = NAV[0].id;
  var subSel = {};  // topId -> sub index

  var topnav, subnav, list, status, banner, searchBox;  // assigned in boot()

  // Swap in a nav model and reset selection state for it.
  function setNav(nav) {
    NAV = (nav && nav.length) ? nav : DEFAULT_NAV;
    topSel = NAV[0].id;
    subSel = {};
    NAV.forEach(function (t) { subSel[t.id] = 0; });
  }

  function currentTop() {
    for (var i = 0; i < NAV.length; i++) if (NAV[i].id === topSel) return NAV[i];
    return NAV[0];
  }

  // ---- config -> nav ------------------------------------------------------
  // Build the nav model from the optional "Config" tab. Returns null when the
  // tab is absent/empty/headerless, so the caller falls back to DEFAULT_NAV.
  function parseConfig(rows) {
    if (!rows || !rows.length) return null;
    var nav = [], byId = {}, started = false;
    rows.forEach(function (r) {
      var id = (r[0] || "").trim(), tabLabel = (r[1] || "").trim(),
          subLabel = (r[2] || "").trim(), kind = (r[3] || "").trim(),
          args = (r[4] || "").trim();
      if (!started) {                              // skip until the header row
        if (/^TabId$/i.test(id)) started = true;
        return;
      }
      if (!id && !subLabel) return;                // blank spacer row
      var tab;
      if (id) {
        tab = byId[id];
        if (!tab) { tab = { id: id, label: tabLabel || id, subs: [] }; byId[id] = tab; nav.push(tab); }
        else if (tabLabel) tab.label = tabLabel;
      } else {
        tab = nav[nav.length - 1];                 // blank id = continue previous tab
      }
      if (!tab || !subLabel || !kind) return;
      var sub = { label: subLabel, kind: kind };
      if (kind === "today") sub.codes = args ? args.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
      else if (kind === "ensemble" || kind === "room") sub.code = args;
      else if (kind === "type") sub.value = args;
      else if (kind === "jump") sub.target = args;
      tab.subs.push(sub);
    });
    return nav.length ? nav : null;
  }

  // ---- filtering ------------------------------------------------------------
  function todayRows(codes) {
    var tk = todayKey();
    var keys = allRows.map(function (r) { return r.key; });
    var bannerMsg = "";
    var useKey = tk;
    if (tk === null || keys.indexOf(tk) === -1) {
      // nothing today: fall forward to the next scheduled day (or first day)
      var future = allRows.filter(function (r) { return tk !== null && r.key !== null && r.key >= tk; });
      useKey = future.length ? future[0].key : (allRows.length ? allRows[0].key : null);
      var sample = allRows.filter(function (r) { return r.key === useKey; })[0];
      if (sample) bannerMsg = "No events scheduled today. Showing the next scheduled day: " + sample.date + ".";
    }
    var rows = allRows.filter(function (r) {
      if (r.key !== useKey) return false;
      if (codes === null) return true;                       // staff: everything
      if (r.ensTokens.length === 0) return true;             // general items (meals, meetings)
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
      // group by first room, in legend order
      roomed.sort(function (a, b) {
        var ai = ROOM_ORDER.indexOf(a.roomTokens[0]), bi = ROOM_ORDER.indexOf(b.roomTokens[0]);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.seq - b.seq;
      });
      return { rows: roomed, banner: t.banner, groupByRoom: true, singleDay: true };
    }
    return { rows: [], banner: "" };
  }

  // ---- rendering ------------------------------------------------------------
  function renderNav() {
    topnav.innerHTML = "";
    NAV.forEach(function (t) {
      var b = document.createElement("button");
      b.textContent = t.label;
      b.className = t.id === topSel ? "efmp-active" : "";
      b.onclick = function () { topSel = t.id; renderNav(); renderList(); };
      topnav.appendChild(b);
    });
    var top = currentTop();
    subnav.innerHTML = "";
    top.subs.forEach(function (s, i) {
      var b = document.createElement("button");
      b.textContent = s.label;
      b.className = (s.kind !== "jump" && i === subSel[top.id]) ? "efmp-active" : "";
      b.onclick = function () {
        if (s.kind === "jump") { topSel = s.target; renderNav(); renderList(); return; }
        subSel[top.id] = i; renderNav(); renderList();
      };
      subnav.appendChild(b);
    });
  }

  function rowHTML(r) {
    var when = [];
    if (r.time) when.push(esc(r.time));
    if (r.loc) when.push(esc(r.loc));
    if (r.conductor) when.push(esc(r.conductor));
    var chips = "";
    if (r.ensemble) chips += '<span class="efmp-chip efmp-chip--ens">' + esc(r.ensemble) + "</span>";
    if (r.type) chips += '<span class="efmp-chip">' + esc(r.type) + "</span>";
    return '<div class="efmp-row">' +
      '<div class="efmp-row__date"><b>' + esc(r.dayNum) + "</b><span>" + esc(r.day) + "</span></div>" +
      '<div class="efmp-row__info">' +
        '<div class="efmp-row__title">' + esc(r.event || "(untitled)") + "</div>" +
        (when.length ? '<div class="efmp-row__when">' + when.join(" &#183; ") + "</div>" : "") +
      "</div>" +
      (chips ? '<div class="efmp-row__meta">' + chips + "</div>" : "") +
    "</div>";
  }

  function renderList() {
    var top = currentTop();
    var sub = top.subs[subSel[top.id]] || top.subs[0];
    var res = rowsForSub(sub);
    var q = searchBox.value.trim().toLowerCase();
    var html = "", shown = 0, lastMonth = null, lastGroup = null;
    res.rows.forEach(function (r) {
      if (q && r.haystack.indexOf(q) === -1) return;
      if (res.groupByRoom) {
        var g = r.roomTokens.map(roomLabel).join(" / ");
        if (g !== lastGroup) {
          html += '<div class="efmp-group">' + esc(g) + "</div>";
          lastGroup = g;
        }
      } else if (!res.singleDay && r.key !== null) {
        var mon = Math.floor(r.key / 100);
        if (mon !== lastMonth) {
          html += '<div class="efmp-month">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>";
          lastMonth = mon;
        }
      }
      html += rowHTML(r);
      shown++;
    });
    banner.hidden = !res.banner;
    banner.textContent = res.banner || "";
    list.innerHTML = html;
    status.textContent = shown ? "" : "No events match this view.";
    status.hidden = !!shown;
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

  // ---- load ------------------------------------------------------------
  function loadCSV(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(parseCSV);
  }

  // Resolve each tab's gid by NAME from the published tab directory (pubhtml),
  // so the calendar survives sheet rebuilds. Google's CSV endpoint ignores
  // &sheet=NAME, so gid is the only per-tab selector — but a recreated tab gets
  // a brand-new gid. The tab NAMES ("Master Calendar", "Legend", "Config") stay
  // stable, so we look the current gids up at load time instead of hardcoding
  // them. The pubhtml endpoint returns CORS for the requesting origin, so this
  // fetch works from the live site.
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

  function build(results) {
    var rows = results[0];
    if (results[1]) applyLegend(results[1]);
    setNav(parseConfig(results[2]));   // Config tab -> nav, else DEFAULT_NAV

    var headerIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i][0] || "").trim() === "Date") { headerIdx = i; break; }
    }
    if (headerIdx === -1) throw new Error("Header row not found");

    var lastDate = "", lastDay = "", seq = 0;
    var seenRooms = {};
    for (var j = headerIdx + 1; j < rows.length; j++) {
      var c = rows[j];
      if (!c.join("").trim()) continue;
      // Columns: Date, Day, Time, Room, Location, Ensemble, Conductor / Soloist, Type, Event
      var date = (c[0] || "").trim() || lastDate;
      var day = (c[1] || "").trim() || ((c[0] || "").trim() ? "" : lastDay);
      lastDate = date; lastDay = day;
      var roomRaw = (c[3] || "").trim(), location = (c[4] || "").trim();
      var roomTokens = tokens(roomRaw);
      var roomFull = roomTokens.map(roomLabel).join(" / ");
      var loc = (location && location !== roomRaw) ? (roomFull ? roomFull + " - " + location : location) : roomFull;
      var key = dateKey(date);
      var entry = {
        seq: seq++, date: date, day: day, key: key,
        dayNum: key !== null ? String(key % 100) : "",
        time: (c[2] || "").trim(), startMin: startMinutes((c[2] || "").trim()), loc: loc,
        roomTokens: roomTokens,
        ensemble: (c[5] || "").trim(), ensTokens: tokens((c[5] || "").trim()),
        conductor: (c[6] || "").trim(),
        type: (c[7] || "").trim(), event: (c[8] || "").trim()
      };
      entry.haystack = [entry.date, entry.day, entry.time, entry.loc, entry.ensemble,
        entry.conductor, entry.type, entry.event].join(" ").toLowerCase();
      allRows.push(entry);
      roomTokens.forEach(function (t) { seenRooms[t] = true; });
    }

    // Chronological order: by date, then start time, then sheet order.
    allRows.sort(function (a, b) {
      var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key;
      return ka - kb || a.startMin - b.startMin || a.seq - b.seq;
    });
    allRows.forEach(function (r, i) { r.seq = i; });  // seq now = chronological rank

    // Append per-room tabs (legend order, only rooms that have events) to
    // whichever tab holds the "roomsToday" view.
    var roomsTab = null;
    for (var t = 0; t < NAV.length; t++) {
      if (NAV[t].subs.some(function (s) { return s.kind === "roomsToday"; })) { roomsTab = NAV[t]; break; }
    }
    if (roomsTab) {
      ROOM_ORDER.concat(Object.keys(seenRooms).filter(function (r) {
        return ROOM_ORDER.indexOf(r) === -1;
      })).forEach(function (code) {
        if (seenRooms[code]) roomsTab.subs.push({ label: roomLabel(code), kind: "room", code: code });
      });
    }

    searchBox.addEventListener("input", renderList);
    renderNav();
    renderList();
  }

  function fail(err) {
    if (status) {
      status.textContent = "Could not load the schedule right now. Please refresh the page, or contact the EFM office.";
      status.hidden = false;
    }
    console.error("EFM schedule load failed:", err);
  }

  // Resolve gids by name, then load calendar + legend + config. If the tab
  // directory can't be read (network blip or a Google format change), degrade
  // gracefully to the bare CSV (always the first tab = Master Calendar), the
  // built-in room names, and DEFAULT_NAV — so the schedule still renders.
  function run() {
    resolveTabGids().then(function (map) {
      return [
        map[TAB_CALENDAR] ? CSV + "&gid=" + map[TAB_CALENDAR] : CSV,
        map[TAB_LEGEND] ? CSV + "&gid=" + map[TAB_LEGEND] : null,
        map[TAB_CONFIG] ? CSV + "&gid=" + map[TAB_CONFIG] : null
      ];
    }, function () {
      return [CSV, null, null];
    }).then(function (urls) {
      return Promise.all([
        loadCSV(urls[0]),
        urls[1] ? loadCSV(urls[1]).catch(function () { return null; }) : null,  // legend optional
        urls[2] ? loadCSV(urls[2]).catch(function () { return null; }) : null   // config optional
      ]);
    }).then(build).catch(fail);
  }

  // ---- boot --------------------------------------------------------------
  // Wrapped so block/script order never matters, and so the script no-ops on
  // any page that doesn't contain the widget.
  function boot() {
    if (!document.getElementById("efm-portal")) return;
    topnav = document.getElementById("efmp-topnav");
    subnav = document.getElementById("efmp-subnav");
    list = document.getElementById("efmp-list");
    status = document.getElementById("efmp-status");
    banner = document.getElementById("efmp-banner");
    searchBox = document.getElementById("efmp-search");
    run();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
  // Exposed for tests in a non-DOM (Node) environment; harmless in the browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseConfig: parseConfig, startMinutes: startMinutes, dateKey: dateKey };
  }
})();
