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
     Master Calendar, Legend, Announcements, General Information, Counselors,
     Outreach Concerts
   ============================================================ */
(function () {
  var PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQg7mhQsWCaOdsg1k_z-TkSHRqNDTuAQE7NEXr6xzCBR-psxMoQGExmVlINpF-xu_3FIgbE4qSK1aAJ";
  var CSV = PUB + "/pub?output=csv";   // bare CSV = the document's first (left-most) tab
  var PUBHTML = PUB + "/pubhtml";       // published tab directory: maps tab name -> gid
  var TAB_CALENDAR = "Master Calendar"; // looked up by NAME (gids change on rebuild)
  var TAB_LEGEND = "Legend";
  var YEAR = 2026;

  // Tabs to fetch: key (used in code) -> sheet tab name. calendar is required.
  var SOURCES = [
    { key: "calendar", tab: TAB_CALENDAR, required: true },
    { key: "legend", tab: TAB_LEGEND },
    { key: "announcements", tab: "Announcements" },
    { key: "generalInfo", tab: "General Information" },
    { key: "counselors", tab: "Counselors" },
    { key: "outreach", tab: "Outreach Concerts" }
  ];

  // Generic schedule tables (title column + Date/Time/Location/Details).
  var TABLES = {
    outreach: { titleCol: "Concert Title", empty: "No outreach concerts scheduled yet." }
  };

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
  var NAV = [
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
      { label: "REP Schedule", kind: "ensemble", code: "REP" },
      { label: "Outreach Concerts", kind: "table", source: "outreach" } ] },
    { id: "staff", label: "Staff", subs: [
      { label: "Today", kind: "today", codes: null },
      { label: "Ensemble Schedule", kind: "allEnsembles" },
      { label: "Meeting Schedule", kind: "type", value: "Meeting / Admin" },
      { label: "Room Schedule", kind: "jump", target: "rooms" } ] },
    { id: "info", label: "General Information", subs: [
      { label: "Overview", kind: "info" } ] },
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

  // ---- state --------------------------------------------------------------
  var allRows = [];
  var seenRooms = {};
  var aux = {};            // outreach -> {headers, items}
  var announcements = [];  // { text, dateRaw, key, logic }
  var generalInfo = [];    // raw lines
  var counselors = [];     // { Name, Title, Phone, Email }
  var modalData = [];      // rebuilt each renderList; index referenced by row data-mi

  var topSel = NAV[0].id;
  var subSel = {};  // topId -> sub index
  NAV.forEach(function (t) { subSel[t.id] = 0; });

  var topnav, subnav, list, status, banner, searchBox, ticker, modal, lastFocus;

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

  function finishList(html, shown, bannerMsg, emptyMsg) {
    banner.hidden = !bannerMsg;
    banner.textContent = bannerMsg || "";
    list.innerHTML = html;
    status.textContent = shown ? "" : (emptyMsg || "No events match this view.");
    status.hidden = !!shown;
  }

  function calDateLabel(r) { return r.day ? (r.day + ", " + r.date) : r.date; }

  function renderAgenda(res) {
    var q = searchBox.value.trim().toLowerCase();
    var html = "", shown = 0, lastMonth = null, lastGroup = null;
    res.rows.forEach(function (r) {
      if (q && r.haystack.indexOf(q) === -1) return;
      if (res.groupByRoom) {
        var g = r.roomTokens.map(roomLabel).join(" / ");
        if (g !== lastGroup) { html += '<div class="efmp-group">' + esc(g) + "</div>"; lastGroup = g; }
      } else if (!res.singleDay && r.key !== null) {
        var mon = Math.floor(r.key / 100);
        if (mon !== lastMonth) { html += '<div class="efmp-month">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>"; lastMonth = mon; }
      }
      html += agendaRowHTML({
        big: r.dayNum, small: r.day, title: r.event || "(untitled)",
        when: [r.time, r.loc, r.conductor],
        chips: [].concat(r.ensemble ? [{ label: r.ensemble, ens: true }] : [], r.type ? [{ label: r.type }] : []),
        modal: {
          title: r.event || "Event",
          fields: [["Date", calDateLabel(r)], ["Time", r.time], ["Location", r.loc],
            ["Ensemble", r.ensemble], ["Conductor / Soloist", r.conductor], ["Type", r.type]],
          details: r.details
        }
      });
      shown++;
    });
    finishList(html, shown, res.banner);
  }

  function renderTable(sub) {
    var t = aux[sub.source], cfg = TABLES[sub.source];
    if (!t || !t.items.length) { finishList("", 0, "", cfg.empty); return; }
    var q = searchBox.value.trim().toLowerCase();
    var entries = t.items.map(function (o, i) {
      return { o: o, key: dateKey(o.Date || ""), start: startMinutes(o.Time || ""), seq: i };
    });
    entries.sort(function (a, b) {
      var ka = a.key === null ? 9999 : a.key, kb = b.key === null ? 9999 : b.key;
      return ka - kb || a.start - b.start || a.seq - b.seq;
    });
    var html = "", shown = 0, lastMonth = null;
    entries.forEach(function (e) {
      var o = e.o;
      var hay = [o[cfg.titleCol], o.Date, o.Time, o.Location, o.Details].join(" ").toLowerCase();
      if (q && hay.indexOf(q) === -1) return;
      if (e.key !== null) {
        var mon = Math.floor(e.key / 100);
        if (mon !== lastMonth) { html += '<div class="efmp-month">' + MONTH_NAMES[mon - 1] + " " + YEAR + "</div>"; lastMonth = mon; }
      }
      html += agendaRowHTML({
        big: e.key !== null ? String(e.key % 100) : "", small: monthAbbr(e.key),
        title: o[cfg.titleCol] || "(untitled)",
        when: [o.Time, o.Location], chips: [],
        modal: { title: o[cfg.titleCol] || cfg.titleCol,
          fields: [["Date", o.Date], ["Time", o.Time], ["Location", o.Location]], details: o.Details }
      });
      shown++;
    });
    finishList(html, shown, "", "No matches.");
  }

  function renderInfo() {
    banner.hidden = true; banner.textContent = "";
    status.hidden = true; status.textContent = "";
    var html = '<div class="efmp-info">';
    var lines = generalInfo.filter(function (l) { return l !== ""; });
    if (lines.length && /^general information$/i.test(lines[0])) lines = lines.slice(1);
    lines.forEach(function (l) {
      var heading = (l === l.toUpperCase() && /[A-Z]/.test(l)) || (!/\d/.test(l) && l.length < 30);
      html += heading ? "<h4>" + esc(l) + "</h4>" : "<p>" + esc(l) + "</p>";
    });
    if (counselors.length) {
      html += "<h4>Counselors</h4><ul class=\"efmp-people\">";
      counselors.forEach(function (c) {
        var name = c.Name || "";
        if (!name) return;
        var bits = [];
        if (c.Title) bits.push(esc(c.Title));
        if (c.Phone) bits.push(esc(c.Phone));
        if (c.Email) bits.push('<a href="mailto:' + esc(c.Email) + '">' + esc(c.Email) + "</a>");
        html += "<li><b>" + esc(name) + "</b>" + (bits.length ? ' <span>' + bits.join(" &#183; ") + "</span>" : "") + "</li>";
      });
      html += "</ul>";
    }
    html += '<h4>General Inquiries</h4><p><a href="mailto:info@easternfestivalofmusic.org">info@easternfestivalofmusic.org</a></p>';
    html += "</div>";
    list.innerHTML = html;
  }

  function renderList() {
    var top = currentTop();
    var sub = top.subs[subSel[top.id]] || top.subs[0];
    modalData = [];
    if (sub.kind === "info") return renderInfo();
    if (sub.kind === "table") return renderTable(sub);
    renderAgenda(rowsForSub(sub));
  }

  // ---- announcements ticker (side-scrolling, pinned under the search box) --
  function renderTicker() {
    if (!ticker) return;
    var tk = todayKey();
    var withText = announcements.filter(function (a) { return a.text; });
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
    var seq = items.map(function (a) { return '<span class="efmp-ticker__item">' + esc(a.text) + "</span>"; }).join("");
    ticker.innerHTML =
      '<span class="efmp-ticker__label">Announcements</span>' +
      '<div class="efmp-ticker__viewport"><div class="efmp-ticker__track">' + seq + seq + "</div></div>" +
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
    var html = "";
    if (d.fields) {
      var dl = d.fields.filter(function (f) { return f[1]; })
        .map(function (f) { return "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("");
      if (dl) html += "<dl>" + dl + "</dl>";
    }
    if (d.details) html += '<div class="efmp-modal__details">' + esc(d.details) + "</div>";
    if (!html) html = '<p style="margin:0;color:#5b6473;">No additional details.</p>';
    modal.querySelector(".efmp-modal__content").innerHTML = html;
    modal.hidden = false;
    document.body.classList.add("efmp-modal-open");
    modal.querySelector(".efmp-modal__close").focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("efmp-modal-open");
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
      var entry = {
        seq: seq++, date: date, day: day, key: key,
        dayNum: key !== null ? String(key % 100) : "",
        time: (c[2] || "").trim(), startMin: startMinutes((c[2] || "").trim()), loc: loc,
        roomTokens: roomTokens,
        ensemble: (c[5] || "").trim(), ensTokens: tokens((c[5] || "").trim()),
        conductor: (c[6] || "").trim(),
        type: (c[7] || "").trim(), event: (c[8] || "").trim(),
        details: (c[9] || "").trim()
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

  function parseAnnouncements(rows) {
    var out = [];
    for (var i = 1; i < rows.length; i++) {  // skip header
      var r = rows[i];
      var text = (r[0] || "").trim(), date = (r[1] || "").trim(), logic = (r[2] || "").trim();
      if (!text && !date) continue;
      out.push({ text: text, dateRaw: date, key: dateKey(date), logic: logic });
    }
    return out;
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
    if (data.legend) applyLegend(data.legend);
    if (data.counselors) counselors = tableObjects(data.counselors).items;
    if (data.generalInfo) generalInfo = data.generalInfo.map(function (r) { return (r[0] || "").trim(); });
    if (data.announcements) announcements = parseAnnouncements(data.announcements);
    aux.outreach = data.outreach ? tableObjects(data.outreach) : null;

    parseCalendar(data.calendar);
    appendRoomTabs();
    renderTicker();

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

  // Resolve gids, then load every source tab in parallel (all optional except
  // the calendar). If the directory can't be read, fall back to the bare CSV
  // (first tab = Master Calendar) so the schedule still renders.
  function run() {
    resolveTabGids().then(function (map) { return map; }, function () { return {}; })
      .then(function (map) {
        return Promise.all(SOURCES.map(function (s) {
          var gid = map[s.tab];
          var url = gid ? (CSV + "&gid=" + gid) : (s.key === "calendar" ? CSV : null);
          if (!url) return Promise.resolve([s.key, null]);
          var p = loadCSV(url).then(function (rows) { return [s.key, rows]; });
          if (!s.required) p = p.catch(function () { return [s.key, null]; });
          return p;
        }));
      })
      .then(function (pairs) {
        var data = {};
        pairs.forEach(function (p) { data[p[0]] = p[1]; });
        build(data);
      })
      .catch(fail);
  }

  // ---- boot --------------------------------------------------------------
  // Wrapped so block/script order never matters, and so the script no-ops on
  // any page that doesn't contain the widget.
  function boot() {
    var root = document.getElementById("efm-portal");
    if (!root) return;
    topnav = document.getElementById("efmp-topnav");
    subnav = document.getElementById("efmp-subnav");
    list = document.getElementById("efmp-list");
    status = document.getElementById("efmp-status");
    banner = document.getElementById("efmp-banner");
    searchBox = document.getElementById("efmp-search");

    // Announcements ticker, injected right under the search controls.
    ticker = document.createElement("div");
    ticker.className = "efmp__ticker";
    ticker.id = "efmp-ticker";
    ticker.hidden = true;
    ticker.setAttribute("aria-label", "Announcements");
    var controls = root.querySelector(".efmp__controls");
    if (controls && controls.parentNode) controls.parentNode.insertBefore(ticker, controls.nextSibling);

    // Details modal, injected once.
    modal = document.createElement("div");
    modal.className = "efmp-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="efmp-modal__box" role="dialog" aria-modal="true" aria-labelledby="efmp-modal-title">' +
        '<button type="button" class="efmp-modal__close" aria-label="Close">×</button>' +
        '<h3 class="efmp-modal__title" id="efmp-modal-title"></h3>' +
        '<div class="efmp-modal__content"></div></div>';
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

    run();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
