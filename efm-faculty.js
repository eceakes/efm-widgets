(function(){
  "use strict";
  /* ====================== CONFIG ====================== */
  /* The roster is read live from your Google Sheet. Primary = the gviz CSV
     endpoint (reliable + CORS-clean from the live site); the publish-to-web CSV
     is kept as an automatic backup. The block tries them in order, then falls
     back to the built-in list so the page is never blank. */
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1PuagTf2lB19eRNRmbaUdYzKytzoLCQ6PsRrgBAxvPTw/gviz/tq?tqx=out:csv&gid=1338599143";
  var SHEET_CSV_FALLBACKS = ["https://docs.google.com/spreadsheets/d/e/2PACX-1vRlBTW1VcRV6-cDZfm9ibRqo23_c1BAvMRfC3eoTj502VrUaxov7OsDY6anYA7a8akD8bz9IfCCDJ3i/pub?gid=1338599143&single=true&output=csv"];
  /* Heading shown at the top of the module. Set to "" to hide it. */
  var MODULE_TITLE = "Eastern Festival of Music Faculty";
  /* Section heading order. Sections found in the data but not listed here are
     appended afterward in the order they first appear. */
  var SECTION_ORDER = ["Conductors","Flute","Oboe","Clarinet","Bassoon",
    "French Horn","Trumpet","Trombone","Tuba","Percussion & Timpani","Harp",
    "Piano","Violin","Viola","Cello","Double Bass"];
  /* Built-in roster (used until SHEET_CSV_URL is set, and as a safety net if the
     sheet ever fails to load). Columns mirror the sheet: name, role, section,
     photo, link, bio, affiliations, website. */
  var FALLBACK_DATA = [
    {name:"Gerard Schwarz",role:"Music Director & Conductor",section:"Conductors",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/gerard-home-1920w.jpg",link:"/gerard-schwarz"},
    {name:"José-Luis Novo",role:"Resident Conductor",section:"Conductors",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Jose--Luis+Novo+by+Richar+Brown+4+Shoot_1518+4x5-1920w.jpg",link:"/jose-luis-novo"},
    {name:"Grant Cooper",role:"Resident Conductor",section:"Conductors",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Grant+Cooper-1920w.jpg",link:"/grant-cooper"},
    {name:"Ho-Yin Kwok",role:"Resident Conductor (weeks 4-5)",section:"Conductors"},
    {name:"Mark Teplitsky",role:"Principal Flute",section:"Flute",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Mark-Teplitsky-1920w.jpg",link:"/mark-teplitsky"},
    {name:"Ann Choomack",role:"Flute/Piccolo",section:"Flute",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/AnnChoomack_SLSO_2024_4958-1920w.jpg",link:"/ann-choomack"},
    {name:"Elizabeth Teplisky",role:"Flute/Piccolo (weeks 4-5)",section:"Flute"},
    {name:"Randall Ellis",role:"Principal Oboe",section:"Oboe",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Randall+Ellis+PORTRAIT+4-1920w.JPG",link:"/randall-ellis"},
    {name:"Karen Birch Blundell",role:"Associate Principal Oboe/English Horn",section:"Oboe",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Headshot+%28Both+use+at+EMF%29-1920w.jpg",link:"/karen-birch-blundell"},
    {name:"Robert DiLutis",role:"Principal Clarinet",section:"Clarinet",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/profile_photo_rdilutis-1920w.png",link:"/robert-dilutis"},
    {name:"Anthony Taylor",role:"Clarinet",section:"Clarinet",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Anthony+Taylor+Headshot-1920w.jpg",link:"/anthony-taylor"},
    {name:"Gabriel Beavers",role:"Principal Bassoon",section:"Bassoon",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/beavers+photo-1920w.jpg",link:"/gabriel-beavers"},
    {name:"Francisco Joubert Bernard",role:"Bassoon",section:"Bassoon",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Francisco+Joubert+Bernard-1920w.jpg",link:"/francisco-joubert-bernard"},
    {name:"Valerie Sly",role:"Principal French Horn",section:"French Horn",photo:"https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/valerie-sly-headshot.jpg",link:"/valerie-sly"},
    {name:"Amber Dean",role:"French Horn",section:"French Horn",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Headshot-1920w.jpeg",link:"/amber-dean"},
    {name:"Joy Hodges",role:"French Horn",section:"French Horn",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/download-10-1920w.jpeg",link:"/joy-hodges"},
    {name:"Kelly Hofman",role:"French Horn",section:"French Horn"},
    {name:"Alex Wilborn",role:"Co-Principal Trumpet",section:"Trumpet",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/AJW+Headshot-1920w.jpg",link:"/alex-wilborn"},
    {name:"Chris Gekker",role:"Co-Principal Trumpet",section:"Trumpet",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Chris-Gekker-300-res-2-1920w.jpg",link:"/chris-gekker"},
    {name:"James Justin Kent",role:"Principal Trombone",section:"Trombone",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/IMG_0069-1920w.jpeg",link:"/james-justin-kent"},
    {name:"Chris Davis",role:"Bass Trombone",section:"Trombone",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/DSC_0042-1920w.JPG",link:"/chris-davis"},
    {name:"Aaron Tindall",role:"Principal Tuba",section:"Tuba",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Aaron_Tindall_IMG_4126_Edited-1920w.png",link:"/aaron-tindall"},
    {name:"Meagan Gillis",role:"Principal Timpani",section:"Percussion & Timpani",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Meagan+Gillis+Headshot-1920w.webp",link:"/meagan-gillis"},
    {name:"John Shaw",role:"Percussion",section:"Percussion & Timpani",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/xhnnFcCJ-1920w.jpeg",link:"/john-shaw"},
    {name:"Alison Chorn",role:"Percussion",section:"Percussion & Timpani",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/headshot-1920w.jpeg",link:"/alison-chorn"},
    {name:"Anna Kate Mackle",role:"Principal Harp",section:"Harp",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/John_Shaw_Anna_Kate-49-Edit-Web_Resolution-1920w.jpg",link:"/anna-kate-mackle"},
    {name:"Marika Bournaki",role:"Piano",section:"Piano",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Schwarz-62564-0216-1920w.jpg",link:"/marika"},
    {name:"William Wolfram",role:"Piano",section:"Piano",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/download-42-1920w.jpg",link:"/william-wolfram"},
    {name:"Eric Clark",role:"Associate Faculty",section:"Piano"},
    {name:"Jeff Multer",role:"Concertmaster · Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Jeff+Multer-1920w.jpeg",link:"/jeff-multer"},
    {name:"Avi Nagin",role:"1st Assistant Concertmaster · Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Avi-Final-Headshot-3-1920w.png",link:"/avi-nagin"},
    {name:"Benjamin Hoffman",role:"2nd Assistant Concertmaster",section:"Violin",link:"/benjamin-hoffman"},
    {name:"Randall Weiss",role:"Principal 2nd Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Randall+Weiss+Headshot_Final-1920w.jpg",link:"/randall-weiss"},
    {name:"Jenny Gregoire",role:"Assistant Principal 2nd Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/IMG_0058_Original-1920w.JPG",link:"/jenny-gregoire"},
    {name:"Fabián López",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Fabian_Lopez-1920w.jpeg",link:"/fabian-lopez"},
    {name:"Daniel Skidmore",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Dan-Skidmore-Headshot-2021-PRINT-0001--281-29-1920w.png",link:"/daniel-skidmore"},
    {name:"Uli Speth",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/L1240161-1920w.jpg",link:"/uli-speth"},
    {name:"Courtney LeBauer",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Courtney_Lebauer_Headshot-1920w.jpeg",link:"/courtney-lebauer"},
    {name:"Jessica Ryou",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/download-11-1920w.jpeg",link:"/jessica-ryou"},
    {name:"Misha Vitenson",role:"Violin",section:"Violin",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Misha-Vitenson-1920w.png",link:"/misha-vitenson"},
    {name:"Catherine Cary",role:"Violin",section:"Violin"},
    {name:"Seula Lee",role:"Violin",section:"Violin"},
    {name:"Daniel Reinker",role:"Principal Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Daniel+Reinker+Headshot-1920w.jpg",link:"/daniel-reinker"},
    {name:"Chauncey Patterson",role:"Associate Principal Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Chauncey+Patterson-1920w.jpg",link:"/chauncey-patterson"},
    {name:"Chi Lee",role:"Assistant Principal Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Chi+Lee+viola-1920w.jpeg",link:"/chi-lee"},
    {name:"Diane Phoenix-Neal",role:"Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/DianePNheadshot-2e15e8d7-1920w.jpg",link:"/diane-phoenix-neal"},
    {name:"Jamie Hofman",role:"Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Jamie_Hofman_2025-1920w.jpg",link:"/jamie-hofman"},
    {name:"Naomi Graf",role:"Viola",section:"Viola",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/_MG_2179-2-1920w.jpeg",link:"/naomi-graf"},
    {name:"Neal Cary",role:"Principal Cello",section:"Cello",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Cello+-+Neal+Cary+-+RVA+Symphony+Headshots+10-10-24-007-1920w.jpg",link:"/neal-cary"},
    {name:"Julian Schwarz",role:"Associate Principal Cello",section:"Cello",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Headshot1-1920w.webp",link:"/julian-schwarz"},
    {name:"Amy Frost Baumgarten",role:"Assistant Principal Cello",section:"Cello",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/AmyFrostBaumHeadshot-2-1920w.png",link:"/amy-frost-baumgarten"},
    {name:"Beth Vanderborgh",role:"Cello",section:"Cello",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/DSC07807-1920w.jpeg",link:"/beth-vanderborgh"},
    {name:"Marta Simidtchieva",role:"Cello",section:"Cello",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/Marta+Simidtchieva-+headshot-1920w.jpg",link:"/marta-simidtchieva"},
    {name:"Leonid Finkelshteyn",role:"Principal Double Bass",section:"Double Bass",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/IMG_4180-1920w.jpeg",link:"/leonid-finkelshteyn"},
    {name:"Joel Braun",role:"Assistant Principal Double Bass",section:"Double Bass",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/BraunJoel-1920w.jpg",link:"/joel-braun"},
    {name:"Juan Carlos Pena",role:"Double Bass",section:"Double Bass",photo:"https://lirp.cdn-website.com/1e6f3c7e/dms3rep/multi/opt/foto+jcp+%284%29-1920w.jpg",link:"/juan-carlos-pena"},
    {name:"Marc Facci",role:"Double Bass",section:"Double Bass"},
    {name:"Richard Ostrovsky",role:"Double Bass",section:"Double Bass"}
  ];
  /* ====================== ENGINE (no need to edit below) ====================== */
  var root, statusEl;
  function setStatus(msg){
    if(!statusEl) return;
    if(msg){ statusEl.textContent = msg; statusEl.hidden = false; }
    else { statusEl.hidden = true; }
  }
  /* RFC-4180-ish CSV parser: handles quoted fields, commas & newlines inside
     quotes, and "" escaped quotes. Returns an array of string arrays. */
  function parseCSV(text){
    var rows = [], row = [], field = "", inQ = false, i = 0, c;
    text = String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for(; i < text.length; i++){
      c = text[i];
      if(inQ){
        if(c === '"'){
          if(text[i+1] === '"'){ field += '"'; i++; }
          else { inQ = false; }
        } else { field += c; }
      } else {
        if(c === '"'){ inQ = true; }
        else if(c === ','){ row.push(field); field = ""; }
        else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ""; }
        else { field += c; }
      }
    }
    row.push(field); rows.push(row);
    // drop a single trailing empty line
    if(rows.length && rows[rows.length-1].length === 1 && rows[rows.length-1][0] === "") rows.pop();
    return rows;
  }
  /* Columns are matched by HEADER NAME (any alias below), never by position, so
     you can add / remove / reorder sheet columns freely. Renaming a header to
     something off its list is the only thing that drops a field — lists kept wide. */
  var ALIASES = {
    name:["name","faculty","full name","full_name","faculty name","artist","artist name","person","performer","musician"],
    role:["role","title","instrument","instruments","position","roles","subtitle","job title","title/role","role/title"],
    section:["section","group","group name","department","dept","category","ensemble","instrument group","instrument section"],
    photo:["photo","image","headshot","picture","img","photo url","image url","photourl","headshot url","photo link","image link","avatar","portrait"],
    link:["link","page","page url","bio link","biolink","profile url","profile page","profile link","bio page","efm page","festival page","more info"],
    bio:["bio","biography","biography text","about","about text","description","blurb","bio text","full bio","long bio","profile","notes"],
    affiliations:["affiliations","affiliation","affiliation(s)","orgs","organizations","memberships","positions","positions held","current positions","ensembles","orchestras"],
    website:["website","web","web page","webpage","web site","site","homepage","personal website","personal site","personal page","official website","official site","artist website","link to website","website url","site url","url","web url","external url","www"]
  };
  function headerMap(headerRow){
    var map = {};
    headerRow.forEach(function(h, idx){
      var key = String(h == null ? "" : h).trim().toLowerCase();
      Object.keys(ALIASES).forEach(function(field){
        if(map[field] === undefined && ALIASES[field].indexOf(key) !== -1) map[field] = idx;
      });
    });
    return map;
  }
  function cell(row, idx){ return idx === undefined ? "" : String(row[idx] == null ? "" : row[idx]).trim(); }
  function toObj(map, row){
    return {
      name: cell(row, map.name),
      role: cell(row, map.role),
      section: cell(row, map.section) || "Faculty",
      photo: cell(row, map.photo),
      link: cell(row, map.link),
      bio: cell(row, map.bio),
      affiliations: cell(row, map.affiliations),
      website: cell(row, map.website)
    };
  }
  function rowsToData(rows){
    if(!rows.length) return [];
    var map = headerMap(rows[0]);
    var body = rows.slice(1);
    if(map.name === undefined){
      // No header we recognize → assume positional columns and keep row 0.
      map = { name:0, role:1, section:2, photo:3, link:4, bio:5, affiliations:6, website:7 };
      body = rows;
    }
    return body.map(function(r){ return toObj(map, r); }).filter(function(o){ return o.name; });
  }
  /* ---- tiny, SAFE Markdown -> HTML (for bios from the sheet) ----
     Escapes all HTML first, then re-introduces only **bold**, *italic*,
     [text](url) links, bullet lists, line breaks and blank-line paragraphs.
     A pasted <script> can never execute — it's escaped before anything runs. */
  function escapeHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function safeUrl(u){
    u = String(u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "#";
    if(/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://" + u; // bare domain
    return "#";
  }
  function mdInline(text){
    var links = [];
    // Stash each [text](url) link behind an ASCII sentinel that can't appear in a
    // bio, run the bold/italic passes, then restore the links. (Plain-ASCII so it
    // survives any copy/paste or CMS sanitizer untouched.)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(_, t, u){
      links.push('<a href="' + safeUrl(u) + '" target="_blank" rel="noopener noreferrer">' + t + "</a>");
      return "@@LNK" + (links.length - 1) + "@@";
    });
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]+?\S)\1/g, "<strong>$2</strong>");
    text = text.replace(/(\*|_)(?=\S)([\s\S]+?\S)\1/g, "<em>$2</em>");
    return text.replace(/@@LNK(\d+)@@/g, function(_, i){ return links[+i]; });
  }
  function mdToHtml(md){
    md = String(md == null ? "" : md).replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim();
    if(!md) return "";
    return escapeHtml(md).split(/\n\s*\n/).map(function(block){
      block = block.replace(/^\n+|\n+$/g,"");
      if(!block) return "";
      var lines = block.split("\n");
      if(lines.every(function(l){ return /^\s*[-*]\s+/.test(l); })){
        return "<ul>" + lines.map(function(l){ return "<li>" + mdInline(l.replace(/^\s*[-*]\s+/,"")) + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.map(mdInline).join("<br>") + "</p>";
    }).join("");
  }
  /* split an Affiliations cell into individual items (accepts ·, |, ;, or new lines) */
  function splitItems(s){
    return String(s == null ? "" : s).split(/\s*[·|;]\s*|\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
  }
  /* ---- bio modal (built once, reused) ---- */
  var modal, modalAvatar, modalName, modalRole, modalBio, modalAffilWrap, modalAffilItems, modalWebWrap, modalWebLink, modalLink, modalClose, lastFocus;
  function buildModal(){
    if(modal) return;
    var host = document.getElementById("efm-faculty");   // NOT inside .efmf__sections (that's a query container)
    modal = document.createElement("div");
    modal.className = "efmf-modal"; modal.hidden = true;
    modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-labelledby","efmf-modal-name");
    modal.innerHTML =
      '<div class="efmf-modal__backdrop" data-efmf-close></div>' +
      '<div class="efmf-modal__panel" role="document">' +
        '<button type="button" class="efmf-modal__close" data-efmf-close aria-label="Close">×</button>' +
        '<div class="efmf-modal__head">' +
          '<span class="efmf-modal__avatar"></span>' +
          '<div><div class="efmf-modal__name" id="efmf-modal-name"></div><div class="efmf-modal__role"></div></div>' +
        '</div>' +
        '<div class="efmf-modal__bio"></div>' +
        '<div class="efmf-modal__affil" hidden><div class="efmf-modal__label">Affiliations</div><div class="efmf-modal__affil-items"></div></div>' +
        '<div class="efmf-modal__web" hidden><div class="efmf-modal__label">Website</div><a class="efmf-modal__weblink" target="_blank" rel="noopener noreferrer" href="#"></a></div>' +
        '<a class="efmf-modal__link" href="#">View full page &rarr;</a>' +
      '</div>';
    host.appendChild(modal);
    modalAvatar = modal.querySelector(".efmf-modal__avatar");
    modalName = modal.querySelector(".efmf-modal__name");
    modalRole = modal.querySelector(".efmf-modal__role");
    modalBio = modal.querySelector(".efmf-modal__bio");
    modalAffilWrap = modal.querySelector(".efmf-modal__affil");
    modalAffilItems = modal.querySelector(".efmf-modal__affil-items");
    modalWebWrap = modal.querySelector(".efmf-modal__web");
    modalWebLink = modal.querySelector(".efmf-modal__weblink");
    modalLink = modal.querySelector(".efmf-modal__link");
    modalClose = modal.querySelector(".efmf-modal__close");
    modal.addEventListener("click", function(e){ if(e.target.hasAttribute("data-efmf-close")) closeModal(); });
    modal.addEventListener("keydown", function(e){
      if(e.key === "Escape"){ closeModal(); return; }
      if(e.key === "Tab"){
        var f = modal.querySelectorAll('a[href],button:not([disabled])');
        if(!f.length) return;
        var first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }
  function openModal(p){
    buildModal();
    modalName.textContent = p.name;
    modalRole.textContent = p.role || "";
    modalRole.style.display = p.role ? "" : "none";
    modalAvatar.innerHTML = "";
    if(p.photo){ var im = document.createElement("img"); im.src = p.photo; im.alt = p.name; modalAvatar.appendChild(im); modalAvatar.style.display = ""; }
    else { modalAvatar.style.display = "none"; }
    modalBio.innerHTML = mdToHtml(p.bio);                 // safe: built only from our escaped renderer
    // affiliations (own column) — render each item on its own line, text-safe
    var affil = splitItems(p.affiliations);
    if(affil.length){
      modalAffilItems.textContent = "";
      affil.forEach(function(a){ var d = document.createElement("div"); d.className = "efmf-modal__affil-item"; d.textContent = a; modalAffilItems.appendChild(d); });
      modalAffilWrap.hidden = false;
    } else { modalAffilWrap.hidden = true; }
    // website (own column)
    if(p.website){
      modalWebLink.href = safeUrl(p.website);
      modalWebLink.textContent = String(p.website).replace(/^https?:\/\//i,"").replace(/\/+$/,"");
      modalWebWrap.hidden = false;
    } else { modalWebWrap.hidden = true; }
    if(p.link){ modalLink.href = safeUrl(p.link); modalLink.style.display = ""; } else { modalLink.style.display = "none"; }
    lastFocus = document.activeElement;
    modal.hidden = false;
    modalClose.focus();
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function initials(name){
    var p = name.split(/\s+/).filter(Boolean);
    return ((p[0] ? p[0][0] : "") + (p.length > 1 ? p[p.length-1][0] : "")).toUpperCase();
  }
  function avatarEl(p){
    var tag = p.link ? "a" : "span";
    var av = document.createElement(tag);
    av.className = "efmf-person__avatar";
    if(p.link){ av.setAttribute("href", safeUrl(p.link)); av.setAttribute("aria-label", p.name); }
    if(p.photo){
      var img = document.createElement("img");
      img.src = p.photo; img.alt = p.name; img.loading = "lazy";
      img.addEventListener("error", function(){
        av.textContent = "";
        var ph = document.createElement("span");
        ph.className = "efmf-person__initials";
        ph.textContent = initials(p.name);
        av.appendChild(ph);
      });
      av.appendChild(img);
    } else {
      var ph = document.createElement("span");
      ph.className = "efmf-person__initials";
      ph.textContent = initials(p.name);
      av.appendChild(ph);
    }
    return av;
  }
  function personEl(p){
    var wrap = document.createElement("div");
    wrap.className = "efmf-person";
    var av = avatarEl(p);
    wrap.appendChild(av);
    var body = document.createElement("div");
    body.className = "efmf-person__body";
    var hasModal = !!((p.bio && p.bio.trim()) || (p.affiliations && p.affiliations.trim()) || (p.website && p.website.trim()));
    var name = document.createElement(p.link || hasModal ? "a" : "div");
    name.className = "efmf-person__name";
    name.textContent = p.name;
    if(p.link) name.setAttribute("href", safeUrl(p.link));
    else if(hasModal) name.setAttribute("href", "#");
    body.appendChild(name);
    if(p.role){
      var role = document.createElement("div");
      role.className = "efmf-person__role";
      role.textContent = p.role;
      body.appendChild(role);
    }
    wrap.appendChild(body);
    // bio / affiliations / website turn the name + photo into a popup trigger
    // (still left-clickable through to the page via the href for new-tab / no-JS).
    if(hasModal){
      name.setAttribute("data-efmf-bio","1");
      av.setAttribute("data-efmf-bio","1");
      var open = function(e){ e.preventDefault(); openModal(p); };
      name.addEventListener("click", open);
      av.addEventListener("click", open);
    }
    return wrap;
  }
  /* Force our container + any faded ancestors visible — Duda's scroll-reveal
     entrance animation can otherwise leave JS-rendered content stuck invisible
     until a hover repaints it. */
  function defuseAnimations(){
    for(var el = document.getElementById("efm-faculty"); el && el !== document.body; el = el.parentElement){
      try{
        var cs = getComputedStyle(el);
        if(parseFloat(cs.opacity) < 1) el.style.setProperty("opacity","1","important");
        if(cs.visibility === "hidden") el.style.setProperty("visibility","visible","important");
        if(el.classList && el.classList.contains("animated")) el.classList.add("revealed");
      }catch(e){}
    }
  }
  /* Keep the Duda widget box matched to our responsive content height, so the
     desktop <-> tablet <-> mobile reflow never leaves a fixed-height gap and —
     importantly — never CLIPS the lower part of the grid. Releases any ancestor
     that is shorter than its content (fixed height + hidden overflow), whether
     that height came from an inline style or a CSS class, and if Duda embedded us
     in a same-origin iframe, grows that iframe to fit. */
  function autoHeight(){
    var node = document.getElementById("efm-faculty");
    if(!node) return;
    for(var el = node.parentElement; el && el !== document.body; el = el.parentElement){
      try{
        var cs = getComputedStyle(el);
        var hidesOverflow = cs.overflowY === "hidden" || cs.overflowY === "clip" || cs.overflow === "hidden";
        var clipper = el.scrollHeight > el.clientHeight + 2 && hidesOverflow;   // a fixed box hiding our overflow
        var pinned  = el.style && /px\s*$/.test(el.style.height || "");          // a deliberately pinned px height
        if(clipper || pinned){
          // Only relax the HEIGHT — never touch overflow, so a real scroll
          // container (e.g. the Duda editor canvas) is left alone.
          el.style.setProperty("height","auto","important");
          el.style.setProperty("max-height","none","important");
          el.style.setProperty("min-height","0","important");
        }
      }catch(e){}
    }
    try{
      var f = window.frameElement;   // only when Duda embedded us in a same-origin iframe
      if(f){ var h = Math.ceil(node.getBoundingClientRect().height) + 8;
        if(parseInt(f.style.height,10) !== h){ f.style.height = h + "px"; f.style.minHeight = h + "px"; } }
    }catch(e){}
  }
  var _wired = false;
  function syncBox(){ defuseAnimations(); autoHeight(); }
  function wireBox(){
    if(_wired) return; _wired = true;
    window.addEventListener("resize", syncBox);
    if(window.ResizeObserver){ try{ new ResizeObserver(syncBox).observe(document.getElementById("efm-faculty")); }catch(e){} }
    // keep re-asserting for ~4s so Duda can't re-pin the box height after we open it
    var n = 0, iv = setInterval(function(){ syncBox(); if(++n >= 16) clearInterval(iv); }, 250);
  }
  function render(people){
    root.textContent = "";
    if(!people.length){ setStatus("No faculty to display yet."); return; }
    setStatus("");
    if(MODULE_TITLE){ var ttl=document.createElement("div"); ttl.className="efmf-title"; ttl.setAttribute("role","heading"); ttl.setAttribute("aria-level","1"); ttl.textContent=MODULE_TITLE; root.appendChild(ttl); }
    var groups = {}, order = [];
    people.forEach(function(p){
      var s = p.section || "Faculty";
      if(!groups[s]){ groups[s] = []; order.push(s); }
      groups[s].push(p);
    });
    order.sort(function(a, b){
      var ia = SECTION_ORDER.indexOf(a), ib = SECTION_ORDER.indexOf(b);
      if(ia === -1 && ib === -1) return 0;
      if(ia === -1) return 1;
      if(ib === -1) return -1;
      return ia - ib;
    });
    var frag = document.createDocumentFragment();
    order.forEach(function(s){
      var sec = document.createElement("section");
      sec.className = "efmf-section";
      var h = document.createElement("div");      // div, not <h2>, to dodge the site heading theme
      h.className = "efmf-section__head";
      h.setAttribute("role", "heading");
      h.setAttribute("aria-level", "2");
      h.textContent = s;
      sec.appendChild(h);
      var grid = document.createElement("div");
      grid.className = "efmf-grid";
      groups[s].forEach(function(p){ grid.appendChild(personEl(p)); });
      sec.appendChild(grid);
      frag.appendChild(sec);
    });
    root.appendChild(frag);
    syncBox();
    wireBox();
  }
  function start(){
    var urls = [SHEET_CSV_URL].concat(SHEET_CSV_FALLBACKS || [])
      .filter(function(u){ return u && !/PASTE|YOUR_|^\s*$/.test(u); });
    if(!urls.length){ render(FALLBACK_DATA); return; }
    setStatus("Loading faculty…");
    (function tryNext(i){
      if(i >= urls.length){ render(FALLBACK_DATA); return; }   // every source failed → built-in roster
      fetch(urls[i], { cache:"no-store" })
        .then(function(r){ if(!r.ok) throw 0; return r.text(); })
        .then(function(t){ var data = rowsToData(parseCSV(t)); if(!data.length) throw 0; render(data); })
        .catch(function(){ tryNext(i + 1); });
    })(0);
  }
  function boot(){
    root = document.querySelector('#efm-faculty [data-efmf-root]');
    statusEl = document.querySelector('#efm-faculty [data-efmf-status]');
    if(!root) return;   // widget not on this page -> no-op (paste order irrelevant)
    start();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
