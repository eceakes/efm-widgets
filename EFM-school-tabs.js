(function () {
"use strict";
var FACULTY_CSV = "https://docs.google.com/spreadsheets/d/1PuagTf2lB19eRNRmbaUdYzKytzoLCQ6PsRrgBAxvPTw/gviz/tq?tqx=out:csv&gid=1338599143";
var FACULTY_CSV_FALLBACK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRlBTW1VcRV6-cDZfm9ibRqo23_c1BAvMRfC3eoTj502VrUaxov7OsDY6anYA7a8akD8bz9IfCCDJ3i/pub?gid=1338599143&single=true&output=csv";
var SITE_ORIGIN = "https://easternfestivalofmusic.org";
var root = document.getElementById("efm-school");
if (!root) return;
var tabbar = document.getElementById("efmsc-tabs");
var panels = Array.prototype.slice.call(root.querySelectorAll(".efmsc__panel"));
function scrollBehavior() {
return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
? "auto" : "smooth";
}
var current = null;
var buttons = {};
function selectTab(id, pushHash, focusBtn) {
var found = false;
panels.forEach(function (p) { if (p.getAttribute("data-tab") === id) found = true; });
if (!found) id = panels[0].getAttribute("data-tab");
if (current === id) return;
current = id;
panels.forEach(function (p) {
var on = p.getAttribute("data-tab") === id;
p.hidden = !on;
});
Object.keys(buttons).forEach(function (k) {
var on = k === id;
buttons[k].className = on ? "efmsc-active" : "";
buttons[k].setAttribute("aria-selected", on ? "true" : "false");
buttons[k].tabIndex = on ? 0 : -1;
});
if (pushHash) {
var h = "#" + id;
var cur = location.hash.replace(/^#/, "").split("/")[0];
if (cur !== id) {
if (history.replaceState) history.replaceState(null, "", h);
else location.hash = h;
}
}
if (focusBtn && buttons[id]) buttons[id].focus();
}
panels.forEach(function (p) {
var id = p.getAttribute("data-tab");
var b = document.createElement("button");
b.innerHTML = p.getAttribute("data-label");
b.id = "efmsc-tab-" + id;
b.setAttribute("role", "tab");
b.setAttribute("aria-controls", p.id);
p.setAttribute("aria-labelledby", b.id);
b.onclick = function () { selectTab(id, true); };
tabbar.appendChild(b);
buttons[id] = b;
});
tabbar.addEventListener("keydown", function (e) {
if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
var ids = panels.map(function (p) { return p.getAttribute("data-tab"); });
var i = ids.indexOf(current);
if (e.key === "ArrowRight") i = (i + 1) % ids.length;
else if (e.key === "ArrowLeft") i = (i - 1 + ids.length) % ids.length;
else if (e.key === "Home") i = 0;
else i = ids.length - 1;
selectTab(ids[i], true, true);
e.preventDefault();
});
function toggleItem(item, open) {
var head = item.querySelector(".efmsc-acc__head");
var on = typeof open === "boolean" ? open : item.className.indexOf("efmsc-open") === -1;
item.className = on ? "efmsc-acc__item efmsc-open" : "efmsc-acc__item";
head.setAttribute("aria-expanded", on ? "true" : "false");
}
Array.prototype.slice.call(root.querySelectorAll(".efmsc-acc__item")).forEach(function (item) {
var head = item.querySelector(".efmsc-acc__head");
var body = item.querySelector(".efmsc-acc__body");
body.id = "efmsc-accb-" + item.parentNode.getAttribute("data-acc-group") + "-" + item.getAttribute("data-acc");
head.setAttribute("aria-controls", body.id);
var label = head.querySelector("span");
if (label) {
label.id = body.id + "-label";
head.setAttribute("aria-labelledby", label.id);
}
head.onclick = function () {
toggleItem(item);
var group = item.parentNode.getAttribute("data-acc-group");
if (item.className.indexOf("efmsc-open") !== -1 && history.replaceState)
history.replaceState(null, "", "#" + group + "/" + item.getAttribute("data-acc"));
};
});
(function () {
var rep = document.getElementById("efmsc-rep");
if (!rep) return;
var items = Array.prototype.slice.call(rep.querySelectorAll("li"));
var titled = items.some(function (li) { return li.textContent.indexOf(":") !== -1; });
if (!titled) return;
rep.classList.remove("efmsc-chips");
rep.classList.add("efmsc-rep--titled");
items.forEach(function (li) {
var t = li.textContent.trim();
var i = t.indexOf(":");
if (i === -1) {
li.innerHTML = '<span class="efmsc-rep__c">' + esc(t) + "</span>";
} else {
li.innerHTML = '<span class="efmsc-rep__c">' + esc(t.slice(0, i).trim()) + "</span>" +
'<span class="efmsc-rep__p">' + esc(t.slice(i + 1).trim()) + "</span>";
}
});
})();
function applyHash() {
var h = location.hash.replace(/^#/, "");
if (!h) return;
var parts = h.split("/");
var known = panels.some(function (p) { return p.getAttribute("data-tab") === parts[0]; });
if (!known) return;
selectTab(parts[0], false);
if (parts[1]) {
var item = root.querySelector('[data-acc-group="' + parts[0] + '"] [data-acc="' + parts[1] + '"]');
if (item) {
toggleItem(item, true);
setTimeout(function () { item.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" }); }, 60);
}
}
}
window.addEventListener("hashchange", applyHash);
root.addEventListener("click", function (e) {
if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
var a = e.target;
while (a && a !== root && !(a.tagName === "A")) a = a.parentNode;
if (!a || a === root) return;
var href = a.getAttribute("href") || "";
if (href.charAt(0) !== "#") return;
e.preventDefault();
if (history.replaceState) history.replaceState(null, "", href);
applyHash();
var parts = href.slice(1).split("/");
var target = parts[1] &&
root.querySelector('[data-acc-group="' + parts[0] + '"] [data-acc="' + parts[1] + '"] .efmsc-acc__head');
if (!target) target = root.querySelector('.efmsc__panel[data-tab="' + parts[0] + '"]');
if (target) target.focus({ preventScroll: true });
root.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
});
selectTab(panels[0].getAttribute("data-tab"), false);
applyHash();
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
function initials(name) {
return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) {
return w.charAt(0).toUpperCase();
}).join("");
}
function cardHTML(f) {
var media = f.photo
? '<img class="efmsc-fac__photo" src="' + esc(f.photo) + '" alt="" loading="lazy">'
: '<span class="efmsc-fac__init" aria-hidden="true">' + esc(initials(f.name)) + "</span>";
var inner = media + "<span><span class=\"efmsc-fac__name\">" + esc(f.name) + "</span>" +
(f.role ? '<span class="efmsc-fac__role">' + esc(f.role) + "</span>" : "") + "</span>";
if (f.link) {
var href = f.link.charAt(0) === "/" ? SITE_ORIGIN + f.link : f.link;
return '<a class="efmsc-fac__card" href="' + esc(href) + '">' + inner + "</a>";
}
return '<span class="efmsc-fac__card">' + inner + "</span>";
}
function populateFaculty(bySection) {
Array.prototype.slice.call(root.querySelectorAll(".efmsc-fac")).forEach(function (el) {
var section = el.getAttribute("data-fac");
var has = (el.getAttribute("data-fac-has") || "").toLowerCase();
var not = (el.getAttribute("data-fac-not") || "").toLowerCase();
var people = (bySection[section] || []).filter(function (f) {
var role = f.role.toLowerCase();
if (has && role.indexOf(has) === -1) return false;
if (not && role.indexOf(not) !== -1) return false;
return true;
});
if (!people.length) { el.innerHTML = ""; return; }
el.setAttribute("role", "group");
el.setAttribute("aria-label", section + " faculty");
el.innerHTML = '<p class="efmsc-fac__label">Faculty</p>' + people.map(cardHTML).join("");
});
}
function loadCSV(url) {
return fetch(url, { cache: "no-store" }).then(function (r) {
if (!r.ok) throw new Error("HTTP " + r.status);
return r.text();
});
}
loadCSV(FACULTY_CSV)
.catch(function () { return loadCSV(FACULTY_CSV_FALLBACK); })
.then(function (text) {
var rows = parseCSV(text);
if (!rows.length) return;
var hdr = rows[0].map(function (h) { return h.trim().toLowerCase(); });
var iName = hdr.indexOf("name"), iRole = hdr.indexOf("role"),
iSec = hdr.indexOf("section"), iPhoto = hdr.indexOf("photo"),
iLink = hdr.indexOf("link");
if (iName === -1 || iSec === -1) return;
var bySection = {};
for (var j = 1; j < rows.length; j++) {
var c = rows[j];
var name = (c[iName] || "").trim();
var sec = (c[iSec] || "").trim();
if (!name || !sec) continue;
(bySection[sec] = bySection[sec] || []).push({
name: name,
role: iRole === -1 ? "" : (c[iRole] || "").trim(),
photo: iPhoto === -1 ? "" : (c[iPhoto] || "").trim(),
link: iLink === -1 ? "" : (c[iLink] || "").trim()
});
}
populateFaculty(bySection);
})
.catch(function (err) {
Array.prototype.slice.call(root.querySelectorAll(
"#efmsc-panel-conducting .efmsc-fac, #efmsc-panel-piano .efmsc-fac"
)).forEach(function (el) {
el.innerHTML = '<p class="efmsc-note">The faculty list is temporarily unavailable. ' +
'Please refresh the page, or visit the <a href="' + SITE_ORIGIN + '/faculty">Faculty page</a>.</p>';
});
if (window.console) console.error("EFM school faculty load failed:", err);
});
var FELLOWS_CSV = "https://docs.google.com/spreadsheets/d/13-BoGp6mgwtO4Dik00yL8GtBCNJxGF5R6dWfS3LnF6Q/gviz/tq?tqx=out:csv&gid=0";
var FELLOWS_CSV_FALLBACK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwqLaKpbTcG97P3JqEynwskulE7oxMaRAb2KfBKZjPtRu7P53IiZ2tUwtnu7rVPcVHcyaemFUduaqV/pub?gid=0&single=true&output=csv";
var fellowsRoot = document.getElementById("efmsc-fellows-root");
var fellowsStatus = document.getElementById("efmsc-fellows-status");
var scholarsRoot = document.getElementById("efmsc-scholars-root");
var scholarsStatus = document.getElementById("efmsc-scholars-status");
function safeUrl(u) {
u = String(u).trim();
if (/^(javascript|data|vbscript):/i.test(u)) return "#";
if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
if (/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://" + u;
return "#";
}
function mdInline(text) {
var links = [];
text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
links.push('<a href="' + safeUrl(u) + '" target="_blank" rel="noopener noreferrer">' + t +
'<span class="efmsc-sr"> (opens in new tab)</span></a>');
return " L" + (links.length - 1) + " ";
});
text = text.replace(/(\*\*|__)(?=\S)([\s\S]+?\S)\1/g, "<strong>$2</strong>");
text = text.replace(/(\*|_)(?=\S)([\s\S]+?\S)\1/g, "<em>$2</em>");
return text.replace(/ L(\d+) /g, function (_, i) { return links[+i]; });
}
function mdToHtml(md) {
md = String(md == null ? "" : md).replace(/\r\n?/g, "\n").trim();
if (!md) return "";
return esc(md).split(/\n\s*\n/).map(function (block) {
block = block.replace(/^\n+|\n+$/g, "");
if (!block) return "";
var lines = block.split("\n");
if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
return "<ul>" + lines.map(function (l) {
return "<li>" + mdInline(l.replace(/^\s*[-*]\s+/, "")) + "</li>";
}).join("") + "</ul>";
}
return "<p>" + lines.map(mdInline).join("<br>") + "</p>";
}).join("");
}
function splitItems(s) {
return String(s == null ? "" : s).split(/\s*[·|;]\s*|\n+/)
.map(function (x) { return x.trim(); }).filter(Boolean);
}
var modal, modalPanel, modalAvatar, modalName, modalRole, modalBio,
modalAffilWrap, modalAffilItems, modalWebWrap, modalWebLink, modalClose,
lastFocus, prevBodyOverflow;
function buildModal() {
if (modal) return;
modal = document.createElement("div");
modal.className = "efmsc-modal"; modal.hidden = true;
modal.setAttribute("role", "dialog");
modal.setAttribute("aria-modal", "true");
modal.setAttribute("aria-labelledby", "efmsc-modal-name");
modal.innerHTML =
'<div class="efmsc-modal__backdrop" data-efmsc-close></div>' +
'<div class="efmsc-modal__panel" role="document" tabindex="0" aria-label="Fellow biography">' +
'<button type="button" class="efmsc-modal__close" data-efmsc-close aria-label="Close">&times;</button>' +
'<div class="efmsc-modal__head">' +
'<span class="efmsc-modal__avatar"></span>' +
'<div><div class="efmsc-modal__name" id="efmsc-modal-name" role="heading" aria-level="3"></div><div class="efmsc-modal__role"></div></div>' +
"</div>" +
'<div class="efmsc-modal__bio"></div>' +
'<div class="efmsc-modal__affil" hidden><div class="efmsc-modal__label" role="heading" aria-level="4">Affiliations</div><div class="efmsc-modal__affil-items"></div></div>' +
'<div class="efmsc-modal__web" hidden><div class="efmsc-modal__label" role="heading" aria-level="4">Website</div><a class="efmsc-modal__weblink" target="_blank" rel="noopener noreferrer" href="#"></a></div>' +
"</div>";
root.appendChild(modal);
modalPanel = modal.querySelector(".efmsc-modal__panel");
modalAvatar = modal.querySelector(".efmsc-modal__avatar");
modalName = modal.querySelector(".efmsc-modal__name");
modalRole = modal.querySelector(".efmsc-modal__role");
modalBio = modal.querySelector(".efmsc-modal__bio");
modalAffilWrap = modal.querySelector(".efmsc-modal__affil");
modalAffilItems = modal.querySelector(".efmsc-modal__affil-items");
modalWebWrap = modal.querySelector(".efmsc-modal__web");
modalWebLink = modal.querySelector(".efmsc-modal__weblink");
modalClose = modal.querySelector(".efmsc-modal__close");
modal.addEventListener("click", function (e) {
if (e.target.hasAttribute("data-efmsc-close")) closeModal();
});
modal.addEventListener("keydown", function (e) {
if (e.key === "Escape") { closeModal(); return; }
if (e.key === "Tab") {
var f = Array.prototype.filter.call(
modal.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]'),
function (el) { return !el.closest("[hidden]"); }
);
if (!f.length) return;
var first = f[0], last = f[f.length - 1];
if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
});
}
function openModal(p) {
buildModal();
modalName.textContent = p.name;
modalRole.textContent = p.role || "";
modalRole.style.display = p.role ? "" : "none";
modalAvatar.innerHTML = "";
if (p.photo) {
var im = document.createElement("img");
im.src = p.photo; im.alt = "";
im.addEventListener("error", function () { modalAvatar.innerHTML = ""; modalAvatar.style.display = "none"; });
modalAvatar.appendChild(im); modalAvatar.style.display = "";
} else { modalAvatar.style.display = "none"; }
modalBio.innerHTML = mdToHtml(p.bio);
var affil = splitItems(p.affiliations);
if (affil.length) {
modalAffilItems.textContent = "";
affil.forEach(function (a) {
var d = document.createElement("div");
d.className = "efmsc-modal__affil-item"; d.textContent = a;
modalAffilItems.appendChild(d);
});
modalAffilWrap.hidden = false;
} else { modalAffilWrap.hidden = true; }
if (p.website) {
modalWebLink.href = safeUrl(p.website);
modalWebLink.textContent = String(p.website).replace(/^https?:\/\//i, "").replace(/\/+$/, "");
modalWebLink.setAttribute("aria-label", modalWebLink.textContent + " (opens in new tab)");
modalWebWrap.hidden = false;
} else { modalWebWrap.hidden = true; }
lastFocus = document.activeElement;
modal.hidden = false;
Array.prototype.forEach.call(root.children, function (el) {
if (el !== modal) el.inert = true;
});
prevBodyOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";
document.addEventListener("keydown", docEscape);
modalPanel.focus();
}
function docEscape(e) { if (e.key === "Escape") closeModal(); }
function closeModal() {
if (!modal || modal.hidden) return;
modal.hidden = true;
Array.prototype.forEach.call(root.children, function (el) { el.inert = false; });
document.body.style.overflow = prevBodyOverflow || "";
document.removeEventListener("keydown", docEscape);
if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function fellowEl(p) {
var wrap = document.createElement("div");
wrap.className = "efmsc-person";
var hasModal = !!((p.bio && p.bio.trim()) || (p.affiliations && p.affiliations.trim()) || (p.website && p.website.trim()));
var interactive = hasModal || !!p.link;
var av = document.createElement("span");
av.className = "efmsc-person__avatar" + (interactive ? " efmsc-clickable" : "");
av.setAttribute("aria-hidden", "true");
if (p.photo) {
var img = document.createElement("img");
img.src = p.photo; img.alt = ""; img.loading = "lazy";
img.addEventListener("error", function () {
av.textContent = "";
var ph = document.createElement("span");
ph.className = "efmsc-person__initials";
ph.textContent = initials(p.name);
av.appendChild(ph);
});
av.appendChild(img);
} else {
var ph = document.createElement("span");
ph.className = "efmsc-person__initials";
ph.textContent = initials(p.name);
av.appendChild(ph);
}
wrap.appendChild(av);
var body = document.createElement("div");
body.className = "efmsc-person__body";
var name = document.createElement(hasModal ? "button" : (p.link ? "a" : "div"));
name.className = "efmsc-person__name";
name.textContent = p.name;
if (hasModal) {
name.type = "button";
name.setAttribute("aria-haspopup", "dialog");
} else if (p.link) {
name.href = safeUrl(p.link);
}
body.appendChild(name);
if (p.role) {
var role = document.createElement("div");
role.className = "efmsc-person__role";
role.textContent = p.role;
body.appendChild(role);
}
wrap.appendChild(body);
if (hasModal) {
var open = function (e) { e.preventDefault(); openModal(p); };
name.addEventListener("click", open);
av.addEventListener("click", open);
} else if (p.link) {
av.addEventListener("click", function () { location.href = safeUrl(p.link); });
}
return wrap;
}
function renderGroup(people, rootEl, statusEl, label) {
rootEl.textContent = "";
if (!people.length) { statusEl.textContent = "No " + label + " to display yet."; return; }
statusEl.textContent = people.length + " " + label + " loaded.";
setTimeout(function () { statusEl.hidden = true; }, 1500);
var grid = document.createElement("div");
grid.className = "efmsc-people";
people.forEach(function (p) { grid.appendChild(fellowEl(p)); });
rootEl.appendChild(grid);
}
loadCSV(FELLOWS_CSV)
.catch(function () { return loadCSV(FELLOWS_CSV_FALLBACK); })
.then(function (text) {
var rows = parseCSV(text);
if (!rows.length) throw new Error("empty sheet");
var hdr = rows[0].map(function (h) { return h.trim().toLowerCase(); });
var col = {};
["name", "role", "section", "photo", "link", "bio", "affiliations", "website"].forEach(function (k) {
col[k] = hdr.indexOf(k);
});
if (col.name === -1) throw new Error("no Name column");
var people = [];
for (var j = 1; j < rows.length; j++) {
var c = rows[j];
var name = (c[col.name] || "").trim();
if (!name) continue;
people.push({
name: name,
role: col.role === -1 ? "" : (c[col.role] || "").trim(),
section: col.section === -1 ? "" : (c[col.section] || "").trim(),
photo: col.photo === -1 ? "" : (c[col.photo] || "").trim(),
link: col.link === -1 ? "" : (c[col.link] || "").trim(),
bio: col.bio === -1 ? "" : (c[col.bio] || "").trim(),
affiliations: col.affiliations === -1 ? "" : (c[col.affiliations] || "").trim(),
website: col.website === -1 ? "" : (c[col.website] || "").trim()
});
}
var isScholar = function (p) { return /conduct/i.test(p.section); };
renderGroup(people.filter(isScholar), scholarsRoot, scholarsStatus, "conducting scholars");
renderGroup(people.filter(function (p) { return !isScholar(p); }), fellowsRoot, fellowsStatus, "orchestral fellows");
})
.catch(function (err) {
var msg = "The roster couldn&rsquo;t load right now. Please refresh the page, " +
'or contact <a href="mailto:admissions@easternfestivalofmusic.org">admissions@easternfestivalofmusic.org</a>.';
scholarsStatus.innerHTML = msg; fellowsStatus.innerHTML = msg;
if (window.console) console.error("EFM school fellows load failed:", err);
});
var CONTENT_PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOPyJQPSuQ4pMh7SjYClTiVeFz0L0Pszbm0vTBoPO35GXVHt_t7xq3hsl8znwVCX4hQajPr1yv2W-o/pub";
var CONTENT_GIDS = {
settings: "1591152503", introText: "464272698", cards: "972858453",
repertoire: "534050850", positions: "8880545", tuition: "1356521809",
lists: "457392491", auditions: "1745013024"
};
function contentUrl(gid) { return CONTENT_PUB + "?output=csv&single=true&gid=" + gid; }
function logc(e) { if (window.console) console.warn("EFM content binding:", e); }
function rowsToObjects(rows, firstHeader) {
var hi = -1;
for (var i = 0; i < rows.length; i++) {
if ((rows[i][0] || "").trim().toLowerCase() === firstHeader) { hi = i; break; }
}
if (hi === -1) return [];
var hdr = rows[hi].map(function (c) { return (c || "").trim().toLowerCase(); });
var out = [];
for (var j = hi + 1; j < rows.length; j++) {
var r = rows[j];
if (!r.length || r.every(function (c) { return !(c || "").trim(); })) continue;
var o = {};
hdr.forEach(function (h, idx) { if (h) o[h] = (r[idx] || "").trim(); });
out.push(o);
}
return out;
}
function applyTokens(text, s) {
return String(text == null ? "" : text).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, function (m, k) {
return (s[k] != null && s[k] !== "") ? s[k] : m;
});
}
function rich(text, s) { return mdInline(esc(applyTokens(text, s))); }
function afterHeading(scope, text, tag) {
var hs = scope.querySelectorAll(".efmsc-h3");
for (var i = 0; i < hs.length; i++) {
if (hs[i].textContent.trim() === text) {
var n = hs[i].nextElementSibling;
while (n && n.tagName.toLowerCase() !== tag) n = n.nextElementSibling;
return n;
}
}
return null;
}
function renderRep(ul, items) {
if (items.some(function (it) { return it.piece; })) {
ul.classList.remove("efmsc-chips"); ul.classList.add("efmsc-rep--titled");
ul.innerHTML = items.map(function (it) {
return "<li><span class=\"efmsc-rep__c\">" + esc(it.composer) + "</span>" +
(it.piece ? "<span class=\"efmsc-rep__p\">" + esc(it.piece) + "</span>" : "") + "</li>";
}).join("");
} else {
ul.classList.add("efmsc-chips"); ul.classList.remove("efmsc-rep--titled");
ul.innerHTML = items.map(function (it) { return "<li>" + esc(it.composer) + "</li>"; }).join("");
}
}
var contentSettings = {};
function bindSettings(s) {
var FACTS = { "dates": "festival_dates", "location": "festival_location", "student programs": "student_age_range", "apply by": "application_deadline" };
Array.prototype.forEach.call(root.querySelectorAll(".efmsc__facts li"), function (li) {
var b = li.querySelector("b"), span = li.querySelector("span");
if (!b || !span) return;
var key = FACTS[b.textContent.trim().toLowerCase()];
if (key && s[key]) span.textContent = applyTokens(s[key], s);
});
var fn = root.querySelector(".efmsc__footnote");
if (fn && s.page_footnote) fn.innerHTML = rich(s.page_footnote, s);
if (s.acceptd_url) Array.prototype.forEach.call(root.querySelectorAll('a[href*="getacceptd"]'), function (a) { a.setAttribute("href", s.acceptd_url); });
var qp = afterHeading(root, "Questions?", "p");
if (qp && s.contact_org) {
qp.innerHTML = esc(s.contact_org) + "<br>" + esc(s.contact_address || "") + "<br>" +
'<a href="mailto:' + esc(s.contact_email || "") + '">' + esc(s.contact_email || "") + "</a>";
}
}
var INTRO_MAP = {
"Overview|lede": "#efmsc-panel-overview p.efmsc-lede",
"Orchestral Program|paragraph 1": "#efmsc-panel-orchestral p.efmsc-lede",
"Orchestral Program|paragraph 2": "#efmsc-panel-orchestral p.efmsc-lede + p",
"Conducting Institute|paragraph 1": "#efmsc-panel-conducting p.efmsc-lede",
"Conducting Institute|paragraph 2": "#efmsc-panel-conducting p.efmsc-lede + p",
"Piano Academy|paragraph 1": "#efmsc-panel-piano p.efmsc-lede",
"Piano Academy|paragraph 2": "#efmsc-panel-piano p.efmsc-lede + p",
"Fellowships|lede": "#efmsc-panel-fellowships p.efmsc-lede"
};
function bindIntro(rows, s) {
rows.forEach(function (o) {
var k = (o["tab / section"] || "") + "|" + (o["slot"] || "");
var text = o["text"];
if (!text) return;
if (k === "Tuition & Applying|Alexander Technique") {
var ax = afterHeading(root, "Alexander Technique Lessons", "p");
if (ax) ax.innerHTML = rich(text, s);
return;
}
var sel = INTRO_MAP[k];
if (sel) { var el = root.querySelector(sel); if (el) el.innerHTML = rich(text, s); }
});
}
function bindCards(rows, s) {
var ov = document.getElementById("efmsc-panel-overview"); if (!ov) return;
var groups = {}, order = [];
rows.forEach(function (o) { var g = o["group"]; if (!g) return; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(o); });
order.forEach(function (g) {
var container = afterHeading(ov, g, "div"); if (!container) return;
container.innerHTML = groups[g].map(function (o) {
return '<a class="efmsc-card" href="' + esc(o["opens tab"] || "#") + '">' +
"<h4>" + esc(o["title"] || "") + "</h4>" +
'<p class="efmsc-card__meta">' + esc(o["ages"] || "") + "</p>" +
"<p>" + rich(o["description"] || "", s) + "</p>" +
'<span class="efmsc-card__go">Explore <span aria-hidden="true">&rarr;</span></span></a>';
}).join("");
});
}
function bindRepertoire(rows) {
var ul = document.getElementById("efmsc-rep"); if (!ul) return;
var items = rows.map(function (o) { return { composer: o["composer"] || "", piece: o["piece (optional)"] || "" }; })
.filter(function (it) { return it.composer; });
if (items.length) renderRep(ul, items);
}
function bindPositions(rows) {
var ul = root.querySelector("#efmsc-panel-fellowships .efmsc-chips--link"); if (!ul) return;
var items = rows.filter(function (o) { return o["position"]; });
if (!items.length) return;
ul.innerHTML = items.map(function (o) {
var slug = (o["jumps to audition section (key)"] || "").trim();
return '<li><a href="#fellowships/' + esc(slug) + '">' + esc(o["position"]) + "</a></li>";
}).join("");
}
function bindTuition(rows) {
var tbody = root.querySelector("#efmsc-panel-apply .efmsc-table tbody"); if (!tbody) return;
var items = rows.filter(function (o) { return o["item"]; });
if (!items.length) return;
tbody.innerHTML = items.map(function (o) {
var isTotal = (o["item"] || "").trim().toLowerCase() === "total";
var detail = (o["detail"] || "").trim();
return "<tr" + (isTotal ? ' class="efmsc-table__total"' : "") + ">" +
'<th scope="row">' + esc(o["item"]) + (detail ? " <small>" + esc(detail) + "</small>" : "") + "</th>" +
"<td>" + esc(o["amount"] || "") + "</td></tr>";
}).join("");
}
var LIST_MAP = {
"Every fellowship includes": "Every fellowship includes",
"Applying (Fellowships)": "Applying",
"Curriculum (Conducting Institute)": "Curriculum",
"The summer includes (Tuition)": "The summer includes",
"How to Apply (Tuition)": "How to Apply"
};
function bindLists(rows, s) {
var groups = {};
rows.forEach(function (o) { var l = o["list"]; if (!l) return; (groups[l] = groups[l] || []).push(o["item"] || ""); });
Object.keys(groups).forEach(function (l) {
var heading = LIST_MAP[l]; if (!heading) return;
var ul = afterHeading(root, heading, "ul"); if (!ul) return;
ul.innerHTML = groups[l].map(function (item) { return "<li>" + rich(item, s) + "</li>"; }).join("");
});
}
function bindAuditions(rows, s) {
var groups = {};
rows.forEach(function (o) {
var key = (o["program"] || "") + "::" + (o["section"] || "");
(groups[key] = groups[key] || []).push({ kind: (o["kind"] || "Bullet"), text: o["text"] || "" });
});
function buildBody(items) {
var html = "", bullets = [];
function flush() { if (bullets.length) { html += "<ul>" + bullets.map(function (b) { return "<li>" + rich(b, s) + "</li>"; }).join("") + "</ul>"; bullets = []; } }
items.forEach(function (it) {
if (it.kind.toLowerCase() === "intro") { flush(); html += "<p>" + rich(it.text, s) + "</p>"; }
else bullets.push(it.text);
});
flush();
return html;
}
Array.prototype.forEach.call(root.querySelectorAll(".efmsc-acc__item"), function (item) {
var group = item.parentNode.getAttribute("data-acc-group");
var program = group === "orchestral" ? "Orchestral" : (group === "fellowships" ? "Fellowship" : null);
if (!program) return;
var acc = item.getAttribute("data-acc");
var headEl = item.querySelector(".efmsc-acc__head span");
var headText = headEl ? headEl.textContent.trim() : "";
var items = groups[program + "::" + acc] || groups[program + "::" + headText];
if (!items) return;
var body = item.querySelector(".efmsc-acc__body");
var fac = body.querySelector(".efmsc-fac");
Array.prototype.slice.call(body.children).forEach(function (ch) { if (ch !== fac) body.removeChild(ch); });
var tmp = document.createElement("div"); tmp.innerHTML = buildBody(items);
Array.prototype.slice.call(tmp.childNodes).forEach(function (n) { body.insertBefore(n, fac); });
});
[["Conducting Institute", "efmsc-panel-conducting"], ["Piano Academy", "efmsc-panel-piano"]].forEach(function (pair) {
var program = pair[0], panel = document.getElementById(pair[1]); if (!panel) return;
var bullets = [];
Object.keys(groups).forEach(function (k) {
if (k.indexOf(program + "::") === 0) groups[k].forEach(function (it) { if (it.kind.toLowerCase() !== "intro") bullets.push(it.text); });
});
if (!bullets.length) return;
var ul = afterHeading(panel, "Audition Requirements", "ul"); if (!ul) return;
ul.innerHTML = bullets.map(function (b) { return "<li>" + rich(b, s) + "</li>"; }).join("");
});
}
function fetchBind(gid, firstHeader, fn) {
loadCSV(contentUrl(gid)).then(function (t) {
try { fn(rowsToObjects(parseCSV(t), firstHeader), contentSettings); } catch (e) { logc(e); }
}).catch(function (e) { logc(e); });
}
loadCSV(contentUrl(CONTENT_GIDS.settings))
.then(function (t) {
rowsToObjects(parseCSV(t), "key").forEach(function (o) { if (o.key != null) contentSettings[o.key] = o.value; });
try { bindSettings(contentSettings); } catch (e) { logc(e); }
})
.catch(function (e) { logc(e); })
.then(function () {
fetchBind(CONTENT_GIDS.introText, "tab / section", bindIntro);
fetchBind(CONTENT_GIDS.cards, "group", bindCards);
fetchBind(CONTENT_GIDS.repertoire, "composer", bindRepertoire);
fetchBind(CONTENT_GIDS.positions, "position", bindPositions);
fetchBind(CONTENT_GIDS.tuition, "item", bindTuition);
fetchBind(CONTENT_GIDS.lists, "list", bindLists);
fetchBind(CONTENT_GIDS.auditions, "program", bindAuditions);
});
})();