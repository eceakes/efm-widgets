(function(){
  "use strict";

  /* ====================== CONFIG ======================
     Concert Programs page (e.g. /programs). Two tabs:
       • Concert Programs — driven by the "EventGridToWebsite" tab (every
         concert: real title + date + image). Program/insert PDFs come from
         the "Programs" tab and attach to a concert by matching title + date.
       • Masterclasses — driven by the "Masterclasses" tab (image + date +
         title + Program URL).
     Each tab splits into Upcoming / Past. Images are pulled from the event
     grid. Columns are matched by HEADER NAME (see *_ALIASES), order-free.

     "Programs" tab columns: Concert | Date | Type | Title | PDF URL
       (+ optional Description, Anchor, Image). Concert should match the
       concert's Title in EventGridToWebsite. Type = "Program" or "Insert".
  */
  var WORKBOOK = "1zjhmDd9mhYNryry7oEd6yht0rar-QMS54yv6I_V8n-s";
  function csvUrl(tab){ return "https://docs.google.com/spreadsheets/d/"+WORKBOOK+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(tab); }
  var EVENTS_CSV      = csvUrl("EventGridToWebsite");
  var PROGRAMS_CSV    = csvUrl("Programs");
  var MASTERCLASS_CSV = csvUrl("Masterclasses");

  var MODULE_TITLE = "Concert Programs";          /* "" hides it */
  var INTRO        = "Download the program and inserts for each concert and masterclass of the season.";  /* "" hides */

  var TABS = [{key:"concerts",label:"Concert Programs"},{key:"masterclasses",label:"Masterclasses"},{key:"programbook",label:"Program Book"}];
  var DEFAULT_TAB = "concerts";

  /* Program Book tab — one season-wide PDF, shown inline + downloadable. "" hides the tab. */
  var PROGRAM_BOOK_URL   = "https://irp.cdn-website.com/1e6f3c7e/files/uploaded/11x17+-+EFM+PROGRAM+BOOK+-+11x17+%282%29.pdf";
  var PROGRAM_BOOK_TITLE = "2026 Program Book";
  var PROGRAM_BOOK_BLURB = "Browse or download the complete season program book.";

  /* Conversion CTA (any blank URL hides that button). */
  var TICKETS_URL   = "https://www.tangercenter.com/events/eastern-festival-of-music/";
  var TICKETS_LABEL = "Buy Tickets";
  var DONATE_URL    = "https://ahrpferd.donorsupport.co/page/EFMDonations";   /* "" hides the Donate button */
  var DONATE_LABEL  = "Donate";
  var CTA_HEADING   = "Enjoyed the music?";
  var CTA_TEXT      = "Support the next generation of musicians.";

  var EV_DOWNLOAD = "program_download";
  var EV_CTA      = "program_cta_click";

  /* ====================== ENGINE ====================== */
  var MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var DOWFULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  var host, titleEl, introEl, tabsBar, statusEl, listEl, ctaEl, panels={}, activeKey=null;

  function setStatus(m){ if(!statusEl) return; if(m){ statusEl.textContent=m; statusEl.hidden=false; } else statusEl.hidden=true; }
  function escapeHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function plain(s){ return String(s==null?"":s).replace(/<br\s*\/?>(?=)/gi," ").replace(/\s+/g," ").trim(); }
  function safeUrl(u){ u=String(u==null?"":u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "";
    if(/^[\\/]{2}/.test(u) || /^\\/.test(u)) return "";   /* block //host, \\host, /\host, \host (protocol-relative / open-redirect) */
    if(/^(https?:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;   /* bare domain */
    return "";
  }
  function httpUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }   /* a real, downloadable resource (not a bare anchor) */

  /* tiny safe Markdown for descriptions */
  function mdInline(t){ var L=[];
    t=t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(_,x,u){ var s=safeUrl(u)||"#"; L.push('<a href="'+s+'" target="_blank" rel="noopener noreferrer">'+x+'</a>'); return "\x00"+(L.length-1)+"\x00"; });
    t=t.replace(/(\*\*|__)(?=\S)([\s\S]+?\S)\1/g,"<strong>$2</strong>");
    t=t.replace(/(\*|_)(?=\S)([\s\S]+?\S)\1/g,"<em>$2</em>");
    return t.replace(/\x00(\d+)\x00/g,function(_,i){ return L[+i]; }); }
  function mdToHtml(md){ md=String(md==null?"":md).replace(/<br\s*\/?>/gi,"\n").replace(/\r\n?/g,"\n").trim(); if(!md) return "";
    return escapeHtml(md).split(/\n\s*\n/).map(function(blk){ blk=blk.replace(/^\n+|\n+$/g,""); if(!blk) return "";
      var lines=blk.split("\n");
      if(lines.every(function(l){ return /^\s*[-*]\s+/.test(l); })) return "<ul>"+lines.map(function(l){ return "<li>"+mdInline(l.replace(/^\s*[-*]\s+/,""))+"</li>"; }).join("")+"</ul>";
      return "<p>"+lines.map(mdInline).join("<br>")+"</p>"; }).join(""); }

  /* ---- CSV ---- */
  function parseCSV(text){
    var rows=[],row=[],f="",q=false,i,c; text=String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for(i=0;i<text.length;i++){ c=text[i];
      if(q){ if(c=='"'){ if(text[i+1]=='"'){ f+='"'; i++; } else q=false; } else f+=c; }
      else { if(c=='"') q=true; else if(c==","){ row.push(f); f=""; } else if(c=="\n"){ row.push(f); rows.push(row); row=[]; f=""; } else f+=c; } }
    row.push(f); rows.push(row);
    if(rows.length && rows[rows.length-1].length==1 && rows[rows.length-1][0]==="") rows.pop();
    return rows;
  }
  function norm(x){ return String(x==null?"":x).trim().toLowerCase(); }
  function makeMap(headerRow, aliases){ var m={}; headerRow.forEach(function(x,i){ var k=norm(x);
    Object.keys(aliases).forEach(function(f){ if(m[f]===undefined && aliases[f].indexOf(k)!==-1) m[f]=i; }); }); return m; }
  function cell(r,i){ return i===undefined?"":String(r[i]==null?"":r[i]).trim(); }

  var EVENT_ALIASES={
    image:["image","photo","img","picture","image url","photo url","poster","flyer","event image","thumbnail"],
    title:["title","event title","name","event name","event","headline"],
    date:["startdate","start","start date","date","event date","begins"],
    show:["showevent","show","show event","visible","published","display","active","live"]
  };
  var PROGRAM_ALIASES={
    concert:["concert","concert title","concert name","event","performance","program group","group","title"],
    date:["date","concert date","event date","start","startdate","start date","day"],
    type:["type","kind","item type","document type","doc type","category"],
    title:["item title","label","document","file title","item","heading","piece title"],
    url:["pdf url","url","link","pdf","file","file url","download","download url","program url","pdf link","href","document url"],
    desc:["description","desc","notes","about","summary","details","blurb"],
    anchor:["anchor","slug","id","qr","qr slug","deep link","deeplink"],
    image:["image","photo","poster","img"],
    show:["show","showevent","show event","visible","published","display","active","live","show item"]
  };
  var MC_ALIASES={
    image:["image","photo","img","picture","image url","photo url","poster","flyer","event image","thumbnail"],
    title:["title","event title","name","event name","event","headline"],
    date:["startdate","start","start date","date","event date","begins"],
    url:["program url","program pdf","program link","program download","program file","programurl","program (pdf)","program booklet","pdf url","pdf"],
    desc:["description","desc","notes","about","summary","details"],
    show:["showevent","show","show event","visible","published","display","active","live"]
  };

  function parseEvents(rows){ if(!rows.length) return []; var m=makeMap(rows[0],EVENT_ALIASES);
    if(m.title===undefined) return [];
    return rows.slice(1).map(function(r){ return { title:cell(r,m.title), date:cell(r,m.date), image:cell(r,m.image), show:cell(r,m.show) }; })
      .filter(function(e){ return e.title; }); }
  function parsePrograms(rows){ if(!rows.length) return []; var m=makeMap(rows[0],PROGRAM_ALIASES);
    if(m.url===undefined && m.title===undefined && m.concert===undefined) return [];
    return rows.slice(1).map(function(r,i){ return { _key:i, concert:cell(r,m.concert), date:cell(r,m.date), type:cell(r,m.type),
      title:cell(r,m.title), url:cell(r,m.url), desc:cell(r,m.desc), anchor:cell(r,m.anchor), image:cell(r,m.image), show:cell(r,m.show) }; }); }
  function parseMasterclasses(rows){ if(!rows.length) return []; var m=makeMap(rows[0],MC_ALIASES);
    if(m.title===undefined) return [];
    return rows.slice(1).map(function(r){ return { title:cell(r,m.title), date:cell(r,m.date), image:cell(r,m.image),
      url:cell(r,m.url), desc:cell(r,m.desc), show:cell(r,m.show) }; }).filter(function(e){ return e.title; }); }

  /* ---- dates ---- */
  function parseDate(s){ s=String(s==null?"":s).trim(); if(!s) return null; var m;
    if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[1]-1,+m[2]); }
    var d=new Date(s); return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function isoKey(d){ return d? d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2) : ""; }
  function fmtDate(d){ if(!d) return ""; return DOWFULL[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
  function today(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
  function slug(s){ return String(s==null?"":s).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60); }
  function normTitle(s){ return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,""); }
  function fileNameOf(u){ try{ var p=String(u).split(/[?#]/)[0].split("/").pop(); return decodeURIComponent(p||""); }catch(e){ return ""; } }

  function visible(x){ return !(String(x.show||"").trim().toLowerCase().match(/^(no|false|0|hide|hidden|off)$/)); }
  function isInsert(it){ return /insert|addendum|supplement/i.test(it.type||""); }
  function typeLabel(it){ return plain(it.type) || "Program"; }
  function sortItems(items){ items.sort(function(a,b){ return (isInsert(a)?1:0)-(isInsert(b)?1:0); }); }

  /* ---- analytics (no-op without gtag/dataLayer) ---- */
  function utmParams(){ var p={}; try{ var s=new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v=s.get(k); if(v) p[k]=v; }); }catch(e){} return p; }
  function track(name, params){ try{ var d=Object.assign({}, params||{}, utmParams());
    if(typeof window.gtag==="function"){ window.gtag("event", name, d); return; }
    if(window.dataLayer && typeof window.dataLayer.push==="function"){ window.dataLayer.push(Object.assign({event:name}, d)); return; } }catch(e){} }

  /* ---- image index (from the event grid), for orphan-program joins ---- */
  var imgIndex={ byTitle:{}, byDate:{} };
  function buildImageIndex(events){ imgIndex={ byTitle:{}, byDate:{} };
    events.forEach(function(e){ var img=safeUrl(e.image); if(!img) return; var nt=normTitle(e.title), dk=isoKey(parseDate(e.date));
      if(nt && !imgIndex.byTitle[nt]) imgIndex.byTitle[nt]=img;
      if(dk){ (imgIndex.byDate[dk]=imgIndex.byDate[dk]||[]).push({nt:nt,img:img}); } }); }
  function matchImage(titleLike, dateKey){ var nc=normTitle(titleLike);
    if(nc && imgIndex.byTitle[nc]) return imgIndex.byTitle[nc];
    var byd=imgIndex.byDate[dateKey];
    if(byd && byd.length){ if(byd.length===1) return byd[0].img;
      for(var i=0;i<byd.length;i++){ if(nc && (byd[i].nt.indexOf(nc)>=0 || nc.indexOf(byd[i].nt)>=0)) return byd[i].img; }
      return byd[0].img; }
    if(nc){ for(var k in imgIndex.byTitle){ if(k && (k.indexOf(nc)>=0 || nc.indexOf(k)>=0)) return imgIndex.byTitle[k]; } }
    return ""; }

  /* ---- build groups ---- */
  function programsForEvent(ev, programs){ var net=normTitle(ev.title), dk=isoKey(parseDate(ev.date));
    return programs.filter(function(p){ var npc=normTitle(p.concert); if(!npc) return false;
      if(npc===net) return true;
      var pdk=isoKey(parseDate(p.date));
      if(pdk && pdk===dk && (npc.indexOf(net)>=0 || net.indexOf(npc)>=0)) return true;
      return false; }); }

  function buildConcertGroups(events, programs){
    var groups=[], used={};
    events.filter(visible).forEach(function(ev){
      var d=parseDate(ev.date);
      var g={ title:plain(ev.title), date:d, image:safeUrl(ev.image), desc:"", anchorRaw:"", items:[] };
      programsForEvent(ev, programs).forEach(function(p){ used[p._key]=1; if(!g.desc&&p.desc)g.desc=p.desc;
        if(!g.image&&p.image)g.image=safeUrl(p.image); if(!g.anchorRaw&&p.anchor)g.anchorRaw=p.anchor; g.items.push(p); });
      sortItems(g.items);
      groups.push(g);
    });
    /* programs whose Concert matched no event -> keep them (grouped by concert) so nothing is lost */
    var orphans=programs.filter(function(p){ return visible(p) && !used[p._key]; });
    var byKey={}, order=[];
    orphans.forEach(function(p){ var dk=isoKey(parseDate(p.date)); var k=(slug(p.concert)||"x")+"|"+dk;
      if(!byKey[k]){ byKey[k]={ title:plain(p.concert)||"Program", date:parseDate(p.date), image:safeUrl(p.image)||matchImage(p.concert,dk), desc:"", anchorRaw:"", items:[] }; order.push(k); }
      var g=byKey[k]; if(!g.desc&&p.desc)g.desc=p.desc; if(!g.anchorRaw&&p.anchor)g.anchorRaw=p.anchor; g.items.push(p); });
    order.forEach(function(k){ var g=byKey[k]; sortItems(g.items); groups.push(g); });
    return finalizeGroups(groups);
  }

  function buildMasterclassGroups(mcs){
    var groups=mcs.filter(visible).map(function(mc){ var u=httpUrl(mc.url);
      return { title:plain(mc.title), date:parseDate(mc.date), image:safeUrl(mc.image), desc:mc.desc||"", anchorRaw:"",
        items: u? [{ type:"", title:"Program", url:u }] : [] }; });
    return finalizeGroups(groups);
  }

  function finalizeGroups(groups){ var seen={};
    groups.forEach(function(g){ var base=slug(g.anchorRaw)||slug(g.title)||"program"; var a=base;
      if(seen[a]){ a=base+"-"+(isoKey(g.date)||"x"); var n=2; while(seen[a]){ a=base+"-"+(n++); } }
      seen[a]=1; g.anchorSlug=a; g.anchorId="prog-"+a; });
    return groups; }

  /* ---- render ---- */
  function downloadIconSvg(){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'; }

  function renderItem(it, concertTitle){
    var url=httpUrl(it.url); if(!url) return null;
    var a=document.createElement("a"); a.className="efmpr-item"; a.href=url; a.target="_blank"; a.rel="noopener noreferrer"; a.setAttribute("download","");
    var t=plain(it.title)||typeLabel(it);
    a.setAttribute("aria-label","View or download "+t+" (PDF)");
    a.innerHTML='<span class="efmpr-item__icon">'+downloadIconSvg()+'</span>'+
      '<span class="efmpr-item__text"><span class="efmpr-item__title">'+escapeHtml(t)+'</span>'+
      '<span class="efmpr-item__type">'+escapeHtml(plain(it.type)?typeLabel(it)+" · PDF":"PDF")+'</span></span>'+
      '<span class="efmpr-item__cta" aria-hidden="true">View / Download</span>';
    a.addEventListener("click",function(){ track(EV_DOWNLOAD,{ concert:plain(concertTitle||""), item_type:typeLabel(it), item_title:t, file_name:fileNameOf(url), link_url:url }); });
    return a;
  }

  function renderGroup(g, isPast){
    var art=document.createElement("article"); art.className="efmpr-group"+(isPast?" efmpr-group--past":""); art.id=g.anchorId;
    if(g.image){ art.innerHTML='<div class="efmpr-group__banner">'+
        '<img src="'+escapeHtml(g.image)+'" alt="'+escapeHtml(g.title)+'" loading="lazy">'+
        (g.date?'<span class="efmpr-group__badge"><b>'+g.date.getDate()+'</b><span>'+MON3[g.date.getMonth()].toUpperCase()+'</span></span>':'')+
      '</div>'; }
    var body=document.createElement("div"); body.className="efmpr-group__body";
    body.innerHTML='<div class="efmpr-group__title">'+escapeHtml(g.title||"Program")+'</div>'+
      (g.date?'<div class="efmpr-group__date">'+escapeHtml(fmtDate(g.date))+'</div>':'');
    if(g.desc){ var d=document.createElement("div"); d.className="efmpr-group__desc"; d.innerHTML=mdToHtml(g.desc); body.appendChild(d); }
    var wrap=document.createElement("div"); wrap.className="efmpr-group__items"; var n=0;
    g.items.forEach(function(it){ var el=renderItem(it, g.title); if(el){ wrap.appendChild(el); n++; } });
    if(!n){ var none=document.createElement("p"); none.className="efmpr-group__none"; none.textContent="Program coming soon."; wrap.appendChild(none); }
    body.appendChild(wrap); art.appendChild(body);
    return art;
  }

  function renderPanel(panelEl, groups){
    panelEl.innerHTML="";
    if(!groups.length){ var em=document.createElement("p"); em.className="efmpr__empty"; em.textContent="Programs will be posted here soon — check back closer to each date."; panelEl.appendChild(em); return; }
    var t=today();
    var up=groups.filter(function(g){ return !g.date || g.date>=t; }).sort(function(a,b){ return (a.date?a.date:0)-(b.date?b.date:0); });
    var past=groups.filter(function(g){ return g.date && g.date<t; }).sort(function(a,b){ return b.date-a.date; });
    function section(label, list, isPast){ if(!list.length) return;
      var h=document.createElement("div"); h.className="efmpr-section"+(isPast?" efmpr-section--past":""); h.setAttribute("role","heading"); h.setAttribute("aria-level","2"); h.textContent=label; panelEl.appendChild(h);
      list.forEach(function(g){ panelEl.appendChild(renderGroup(g, isPast)); }); }
    section("Upcoming", up, false);
    section("Past", past, true);
  }

  /* ---- Program Book panel: inline PDF viewer + download (lazy-loaded on tab activate) ---- */
  var bookFrame=null;
  function renderProgramBook(panelEl, book){
    var url=httpUrl(book.url); panelEl.innerHTML="";
    var card=document.createElement("div"); card.className="efmpr-book";
    card.innerHTML='<div class="efmpr-book__head">'+
        '<div class="efmpr-book__meta"><div class="efmpr-book__title">'+escapeHtml(PROGRAM_BOOK_TITLE)+'</div>'+
          (PROGRAM_BOOK_BLURB?'<div class="efmpr-book__blurb">'+escapeHtml(PROGRAM_BOOK_BLURB)+'</div>':'')+'</div>'+
        '<a class="efmpr-book__btn" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer" download data-book-dl>'+downloadIconSvg()+'<span>View / Download (PDF)</span></a>'+
      '</div>'+
      '<div class="efmpr-book__viewer"><iframe class="efmpr-book__frame" title="'+escapeHtml(PROGRAM_BOOK_TITLE)+'" loading="lazy" data-src="'+escapeHtml(url)+'#view=FitH"></iframe>'+
        '<p class="efmpr-book__fallback">Trouble viewing it here? <a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Open the program book in a new tab.</a></p></div>';
    panelEl.appendChild(card);
    bookFrame=card.querySelector(".efmpr-book__frame");
    var dl=card.querySelector("[data-book-dl]");
    if(dl) dl.addEventListener("click",function(){ track(EV_DOWNLOAD,{ concert:"Program Book", item_type:"Program Book", item_title:PROGRAM_BOOK_TITLE, file_name:fileNameOf(url), link_url:url }); });
  }
  function loadBookFrame(){ if(bookFrame && !bookFrame.getAttribute("src")){ var s=bookFrame.getAttribute("data-src"); if(s) bookFrame.setAttribute("src",s); } }

  function renderCTA(){
    var tickets=httpUrl(TICKETS_URL), donate=httpUrl(DONATE_URL);
    if(!tickets && !donate){ ctaEl.hidden=true; return; }
    var btns="";
    if(tickets) btns+='<a class="efmpr-cta__btn efmpr-cta__btn--primary" href="'+escapeHtml(tickets)+'" target="_blank" rel="noopener noreferrer" data-cta="tickets">'+escapeHtml(TICKETS_LABEL)+'</a>';
    if(donate)  btns+='<a class="efmpr-cta__btn efmpr-cta__btn--ghost" href="'+escapeHtml(donate)+'" target="_blank" rel="noopener noreferrer" data-cta="donate">'+escapeHtml(DONATE_LABEL)+'</a>';
    ctaEl.innerHTML='<div class="efmpr-cta__inner">'+
      (CTA_HEADING?'<div class="efmpr-cta__heading">'+escapeHtml(CTA_HEADING)+'</div>':'')+
      (CTA_TEXT?'<div class="efmpr-cta__text">'+escapeHtml(CTA_TEXT)+'</div>':'')+
      '<div class="efmpr-cta__btns">'+btns+'</div></div>';
    ctaEl.hidden=false;
    Array.prototype.forEach.call(ctaEl.querySelectorAll("[data-cta]"),function(b){
      b.addEventListener("click",function(){ track(EV_CTA,{ cta:b.getAttribute("data-cta"), link_url:b.href }); }); });
  }

  /* ---- tabs ---- */
  var shownKeys=[];
  function buildTabs(keys){ tabsBar.innerHTML=""; shownKeys=keys;
    if(keys.length<=1){ tabsBar.hidden=true; return; }
    tabsBar.hidden=false;
    TABS.filter(function(t){ return keys.indexOf(t.key)>=0; }).forEach(function(t){
      var b=document.createElement("button"); b.type="button"; b.className="efmpr-tab"; b.id="efmpr-tab-"+t.key;
      b.textContent=t.label; b.setAttribute("role","tab"); b.setAttribute("aria-selected","false");
      b.addEventListener("click",function(){ activate(t.key,true); });
      b.addEventListener("keydown",onTabKey); tabsBar.appendChild(b); }); }
  function onTabKey(e){ var i=shownKeys.indexOf(activeKey);
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); var k=shownKeys[(i+1)%shownKeys.length]; activate(k,true); focusTab(k); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); var k2=shownKeys[(i-1+shownKeys.length)%shownKeys.length]; activate(k2,true); focusTab(k2); } }
  function focusTab(k){ var b=document.getElementById("efmpr-tab-"+k); if(b) b.focus(); }
  function activate(key, user){ if(!panels[key]) return; activeKey=key;
    TABS.forEach(function(t){ var on=t.key===key; var b=document.getElementById("efmpr-tab-"+t.key);
      if(b){ b.setAttribute("aria-selected",on?"true":"false"); b.tabIndex=on?0:-1; }
      if(panels[t.key]) panels[t.key].hidden=!on; });
    if(key==="programbook") loadBookFrame();
    sync(); }

  /* ---- deep link (#prog-slug or #slug): select the right tab, scroll, highlight ---- */
  function handleHash(){ var h=(location.hash||"").replace(/^#/,""); if(!h) return;
    var el=document.getElementById(h) || document.getElementById("prog-"+h); if(!el) return;
    var panel=el.closest?el.closest(".efmpr__panel"):null;
    if(panel){ var key=panel.id.replace("efmpr-panel-",""); if(key!==activeKey) activate(key,false); }
    el.classList.add("efmpr-group--target");
    try{ el.scrollIntoView({behavior:(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches)?"auto":"smooth", block:"start"}); }catch(e){ el.scrollIntoView(); } }

  function render(data){
    buildImageIndex(data.events);
    var content={ concerts:buildConcertGroups(data.events, data.programs), masterclasses:buildMasterclassGroups(data.masterclasses),
                  programbook: httpUrl(PROGRAM_BOOK_URL)? [{ url:httpUrl(PROGRAM_BOOK_URL) }] : [] };
    var keys=TABS.map(function(t){return t.key;}).filter(function(k){ return content[k] && content[k].length; });
    if(!keys.length){ setStatus("Programs will be posted here soon — check back closer to each concert."); return; }
    setStatus("");
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.hidden=false; }
    if(INTRO){ introEl.textContent=INTRO; introEl.hidden=false; }
    listEl.innerHTML=""; panels={};
    TABS.forEach(function(t){ if(keys.indexOf(t.key)<0) return;
      var p=document.createElement("div"); p.className="efmpr__panel"; p.id="efmpr-panel-"+t.key; p.setAttribute("role","tabpanel"); p.setAttribute("aria-labelledby","efmpr-tab-"+t.key); p.hidden=true;
      if(t.key==="programbook") renderProgramBook(p, content[t.key][0]); else renderPanel(p, content[t.key]);
      listEl.appendChild(p); panels[t.key]=p; });
    buildTabs(keys);
    activate(keys.indexOf(DEFAULT_TAB)>=0?DEFAULT_TAB:keys[0], false);
    renderCTA();
    sync();
    setTimeout(handleHash,60);
    window.addEventListener("hashchange",handleHash);
  }

  /* ---- box sync (Duda) ---- */
  function defuse(){ for(var el=host; el && el!==document.body; el=el.parentElement){ try{ var cs=getComputedStyle(el);
    if(parseFloat(cs.opacity)<1) el.style.setProperty("opacity","1","important");
    if(cs.visibility==="hidden") el.style.setProperty("visibility","visible","important");
    if(el.classList && el.classList.contains("animated")) el.classList.add("revealed"); }catch(e){} } }
  function autoHeight(){ for(var el=host.parentElement; el && el!==document.body; el=el.parentElement){ try{ var cs=getComputedStyle(el);
    var hide=cs.overflowY==="hidden"||cs.overflowY==="clip"||cs.overflow==="hidden";
    if((el.scrollHeight>el.clientHeight+2 && hide) || (el.style && /px\s*$/.test(el.style.height||""))){
      el.style.setProperty("height","auto","important"); el.style.setProperty("max-height","none","important"); el.style.setProperty("min-height","0","important"); } }catch(e){} }
    try{ var f=window.frameElement; if(f){ var h=Math.ceil(host.getBoundingClientRect().height)+8; if(parseInt(f.style.height,10)!==h){ f.style.height=h+"px"; f.style.minHeight=h+"px"; } } }catch(e){} }
  var _wired=false; function sync(){ defuse(); autoHeight(); }
  function wire(){ if(_wired) return; _wired=true; window.addEventListener("resize",sync);
    if(window.ResizeObserver){ try{ new ResizeObserver(sync).observe(host); }catch(e){} }
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- boot ---- */
  function urlOk(u){ return u && !/PASTE|YOUR_|^\s*$/.test(u); }
  function fetchRows(url){ return fetch(url,{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
    .then(function(t){ return parseCSV(t); }).catch(function(){ return []; }); }
  function headerSig(rows){ return (rows&&rows[0])? rows[0].map(function(c){ return String(c==null?"":c).trim().toLowerCase(); }).join("|") : ""; }
  function start(){
    setStatus("Loading programs…");
    Promise.all([ fetchRows(EVENTS_CSV), fetchRows(PROGRAMS_CSV), fetchRows(MASTERCLASS_CSV) ]).then(function(res){
      var evRows=res[0], pgRows=res[1], mcRows=res[2], evSig=headerSig(evRows);
      /* gviz returns the FIRST sheet when a named tab doesn't exist yet — so if
         "Programs"/"Masterclasses" come back identical to the events sheet, that
         tab hasn't been created: treat as empty instead of rendering events as programs. */
      if(evSig){ if(headerSig(pgRows)===evSig) pgRows=[]; if(headerSig(mcRows)===evSig) mcRows=[]; }
      render({ events:parseEvents(evRows), programs:parsePrograms(pgRows), masterclasses:parseMasterclasses(mcRows) });
      wire();
    });
  }
  function boot(){
    host=document.getElementById("efm-programs");
    if(!host) return;
    titleEl = host.querySelector("[data-efmpr-title]");
    introEl = host.querySelector("[data-efmpr-intro]");
    tabsBar = host.querySelector("[data-efmpr-tabs]");
    statusEl= host.querySelector("[data-efmpr-status]");
    listEl  = host.querySelector("[data-efmpr-list]");
    ctaEl   = host.querySelector("[data-efmpr-cta]");
    if(!tabsBar){ tabsBar=document.createElement("div"); tabsBar.setAttribute("data-efmpr-tabs",""); tabsBar.setAttribute("role","tablist"); tabsBar.setAttribute("aria-label","Program categories"); tabsBar.hidden=true; host.insertBefore(tabsBar, statusEl||listEl); }
    tabsBar.className="efmpr__tabs";
    start();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
