(function(){
  "use strict";

  /* ====================== CONFIG ======================
     Concert Programs page (e.g. /programs). Reads a "Programs" tab in the
     SAME Event Grid workbook as the Events widget. ONE downloadable file
     per row; the page groups rows by concert. Columns are matched by
     HEADER NAME (see ALIASES), so you can add/reorder columns freely.

     Recommended sheet columns:
       Concert | Date | Type | Title | PDF URL | Show   (+ optional Description, Anchor)
       - Type  = "Program" or "Insert"
       - Show  = No/false/hide to skip a row
       - Anchor (optional) = a short slug for QR deep-links (e.g. "eso-gala");
         if blank it is derived from the concert name.
  */
  var WORKBOOK = "1zjhmDd9mhYNryry7oEd6yht0rar-QMS54yv6I_V8n-s";
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/"+WORKBOOK+"/gviz/tq?tqx=out:csv&sheet=Programs";
  var SHEET_CSV_FALLBACKS = [];

  var MODULE_TITLE = "Concert Programs";          /* "" hides it */
  var INTRO        = "Download the program and inserts for each concert of the season.";  /* "" hides it */

  /* Conversion CTA shown at the bottom (any blank URL hides that button). */
  var TICKETS_URL   = "https://www.tangercenter.com/events/eastern-festival-of-music/";
  var TICKETS_LABEL = "Buy Tickets";
  var DONATE_URL    = "";                          /* <-- set your donate page URL to show a Donate button */
  var DONATE_LABEL  = "Donate";
  var CTA_HEADING   = "Enjoyed the music?";
  var CTA_TEXT      = "Support the next generation of musicians.";

  /* GA4 / analytics: events fire only if gtag() or a dataLayer exists.
     (No-op otherwise, so the widget is safe on a page without analytics.) */
  var EV_DOWNLOAD = "program_download";
  var EV_CTA      = "program_cta_click";

  /* ====================== ENGINE ====================== */
  var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOWFULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  var host, titleEl, introEl, statusEl, listEl, ctaEl;

  function setStatus(m){ if(!statusEl) return; if(m){ statusEl.textContent=m; statusEl.hidden=false; } else statusEl.hidden=true; }
  function escapeHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function htmlBreaks(s){ return escapeHtml(s).replace(/&lt;br\s*\/?&gt;/gi,"<br>").replace(/\r?\n/g,"<br>"); }
  function plain(s){ return String(s==null?"":s).replace(/<br\s*\/?>(?=)/gi," ").replace(/\s+/g," ").trim(); }
  function safeUrl(u){ u=String(u==null?"":u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "";
    if(/^[\\/]{2}/.test(u) || /^\\/.test(u)) return "";   /* block //host, \\host, /\host, \host (protocol-relative / open-redirect) */
    if(/^(https?:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;   /* bare domain */
    return "";
  }
  function httpUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }

  /* tiny safe Markdown (descriptions): escape, then re-introduce **bold**,
     *italic*, [text](url), "- " bullets, line breaks and paragraphs. */
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

  /* ---- CSV parser (RFC-4180-ish) ---- */
  function parseCSV(text){
    var rows=[],row=[],f="",q=false,i,c; text=String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for(i=0;i<text.length;i++){ c=text[i];
      if(q){ if(c=='"'){ if(text[i+1]=='"'){ f+='"'; i++; } else q=false; } else f+=c; }
      else { if(c=='"') q=true; else if(c==","){ row.push(f); f=""; } else if(c=="\n"){ row.push(f); rows.push(row); row=[]; f=""; } else f+=c; } }
    row.push(f); rows.push(row);
    if(rows.length && rows[rows.length-1].length==1 && rows[rows.length-1][0]==="") rows.pop();
    return rows;
  }
  var ALIASES={
    concert:["concert","concert title","concert name","event","performance","program group","group"],
    date:["date","concert date","event date","start","startdate","start date","day"],
    type:["type","kind","item type","document type","doc type","category"],
    title:["title","item title","label","name","document","file title","item","heading"],
    url:["pdf url","url","link","pdf","file","file url","download","download url","program url","pdf link","href","document url"],
    desc:["description","desc","notes","about","summary","details","blurb"],
    anchor:["anchor","slug","id","qr","qr slug","deep link","deeplink"],
    show:["show","showevent","show event","visible","published","display","active","live","show item"]
  };
  function headerMap(h){ var m={}; h.forEach(function(x,i){ var k=String(x==null?"":x).trim().toLowerCase();
    Object.keys(ALIASES).forEach(function(fld){ if(m[fld]===undefined && ALIASES[fld].indexOf(k)!==-1) m[fld]=i; }); }); return m; }
  function cell(r,i){ return i===undefined?"":String(r[i]==null?"":r[i]).trim(); }
  function rowsToItems(rows){
    if(!rows.length) return [];
    var m=headerMap(rows[0]), body=rows.slice(1);
    if(m.url===undefined && m.title===undefined){ return []; }
    return body.map(function(r){ return {
      concert:cell(r,m.concert), date:cell(r,m.date), type:cell(r,m.type), title:cell(r,m.title),
      url:cell(r,m.url), desc:cell(r,m.desc), anchor:cell(r,m.anchor), show:cell(r,m.show) }; });
  }

  /* ---- dates (local, date-only) ---- */
  function parseDate(s){ s=String(s==null?"":s).trim(); if(!s) return null; var m;
    if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[1]-1,+m[2]); }
    var d=new Date(s); return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function isoKey(d){ return d? d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2) : ""; }
  function fmtDate(d){ if(!d) return ""; return DOWFULL[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
  function slug(s){ return String(s==null?"":s).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60); }
  function fileNameOf(u){ try{ var p=String(u).split(/[?#]/)[0].split("/").pop(); return decodeURIComponent(p||""); }catch(e){ return ""; } }

  function visible(x){ return !(String(x.show||"").trim().toLowerCase().match(/^(no|false|0|hide|hidden|off)$/)); }
  function isInsert(it){ return /insert|addendum|supplement/i.test(it.type||""); }
  function typeLabel(it){ var t=plain(it.type); return t || "Program"; }

  /* ---- analytics (no-op without gtag/dataLayer) ---- */
  function utmParams(){ var p={}; try{ var s=new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v=s.get(k); if(v) p[k]=v; }); }catch(e){}
    return p; }
  function track(name, params){ try{
    var data=Object.assign({}, params||{}, utmParams());
    if(typeof window.gtag==="function"){ window.gtag("event", name, data); return; }
    if(window.dataLayer && typeof window.dataLayer.push==="function"){ window.dataLayer.push(Object.assign({event:name}, data)); return; }
  }catch(e){} }

  /* ---- grouping ---- */
  function groupByConcert(items){
    var order=[], byKey={};
    items.forEach(function(it){ var d=parseDate(it.date); var key=(slug(it.concert)||"x")+"|"+isoKey(d);
      if(!byKey[key]){ byKey[key]={ concert:it.concert, date:d, anchor:(it.anchor||"").trim(), desc:"", items:[] }; order.push(key); }
      var g=byKey[key];
      if(!g.anchor && it.anchor) g.anchor=it.anchor.trim();
      if(!g.desc && it.desc) g.desc=it.desc;
      g.items.push(it);
    });
    var groups=order.map(function(k){ return byKey[k]; });
    groups.sort(function(a,b){ if(a.date&&b.date) return a.date-b.date; if(a.date) return -1; if(b.date) return 1; return 0; });
    // anchors: explicit wins; else slug(concert); de-dupe with date suffix on collision
    var seen={};
    groups.forEach(function(g){ var base=slug(g.anchor)||slug(g.concert)||"program";
      var a=base; if(seen[a]){ a=base+"-"+(isoKey(g.date)||(++seen[base])); } seen[a]=1; seen[base]=1; g.anchorId="prog-"+a; g.anchorSlug=a;
      // items: Programs before Inserts, otherwise sheet order
      g.items.sort(function(x,y){ return (isInsert(x)?1:0)-(isInsert(y)?1:0); });
    });
    return groups;
  }

  /* ---- render ---- */
  function downloadIconSvg(){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'; }

  function renderItem(it){
    var url=safeUrl(it.url); if(!url) return null;
    var a=document.createElement("a");
    a.className="efmpr-item"; a.href=url; a.target="_blank"; a.rel="noopener noreferrer"; a.setAttribute("download","");
    var t=plain(it.title)||typeLabel(it);
    a.setAttribute("aria-label","View or download "+t+" (PDF)");
    a.innerHTML='<span class="efmpr-item__icon">'+downloadIconSvg()+'</span>'+
      '<span class="efmpr-item__text"><span class="efmpr-item__title">'+escapeHtml(t)+'</span>'+
      (it.type?'<span class="efmpr-item__type">'+escapeHtml(typeLabel(it))+' · PDF</span>':'<span class="efmpr-item__type">PDF</span>')+'</span>'+
      '<span class="efmpr-item__cta" aria-hidden="true">View / Download</span>';
    a.addEventListener("click",function(){ track(EV_DOWNLOAD,{ concert:plain(it.concertName||""), item_type:typeLabel(it), item_title:t, file_name:fileNameOf(url), link_url:url }); });
    return a;
  }

  function renderGroup(g){
    var sec=document.createElement("section"); sec.className="efmpr-group"; sec.id=g.anchorId;
    var head=document.createElement("div"); head.className="efmpr-group__head";
    var badge=g.date? '<span class="efmpr-group__badge"><b>'+g.date.getDate()+'</b><span>'+MON3[g.date.getMonth()].toUpperCase()+'</span></span>' : '';
    head.innerHTML=badge+
      '<span class="efmpr-group__meta">'+
        '<span class="efmpr-group__title">'+escapeHtml(plain(g.concert)||"Concert")+'</span>'+
        (g.date?'<span class="efmpr-group__date">'+escapeHtml(fmtDate(g.date))+'</span>':'')+
      '</span>';
    sec.appendChild(head);
    if(g.desc){ var dsc=document.createElement("div"); dsc.className="efmpr-group__desc"; dsc.innerHTML=mdToHtml(g.desc); sec.appendChild(dsc); }
    var wrap=document.createElement("div"); wrap.className="efmpr-group__items"; var n=0;
    g.items.forEach(function(it){ it.concertName=g.concert; var el=renderItem(it); if(el){ wrap.appendChild(el); n++; } });
    if(!n){ var none=document.createElement("p"); none.className="efmpr-group__none"; none.textContent="Program coming soon."; wrap.appendChild(none); }
    sec.appendChild(wrap);
    return sec;
  }

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

  function scrollToHash(){ var h=(location.hash||"").replace(/^#/,""); if(!h) return;
    var el=document.getElementById(h) || document.getElementById("prog-"+h);
    if(el){ try{ el.scrollIntoView({behavior:(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches)?"auto":"smooth", block:"start"}); }catch(e){ el.scrollIntoView(); }
      el.classList.add("efmpr-group--target"); } }

  function render(items){
    var clean=items.filter(visible).filter(function(it){ return safeUrl(it.url) || plain(it.title); });
    if(!clean.length){ setStatus("Programs will be posted here soon — check back closer to each concert."); listEl.innerHTML=""; ctaEl.hidden=true; return; }
    setStatus("");
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.hidden=false; }
    if(INTRO){ introEl.textContent=INTRO; introEl.hidden=false; }
    var groups=groupByConcert(clean);
    listEl.innerHTML="";
    groups.forEach(function(g){ listEl.appendChild(renderGroup(g)); });
    renderCTA();
    sync();
    setTimeout(scrollToHash,60);
    window.addEventListener("hashchange",scrollToHash);
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
  function fetchRows(urls){
    return new Promise(function(resolve){
      (function tryNext(i){ if(i>=urls.length){ resolve([]); return; }
        fetch(urls[i],{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
          .then(function(t){ var it=rowsToItems(parseCSV(t)); if(!it.length) throw 0; resolve(it); })
          .catch(function(){ tryNext(i+1); }); })(0);
    });
  }
  function start(){
    var urls=[SHEET_CSV_URL].concat(SHEET_CSV_FALLBACKS||[]).filter(urlOk);
    if(!urls.length){ render([]); wire(); return; }
    setStatus("Loading programs…");
    fetchRows(urls).then(function(items){ render(items); wire(); });
  }
  function boot(){
    host=document.getElementById("efm-programs");
    if(!host) return;
    titleEl = host.querySelector("[data-efmpr-title]");
    introEl = host.querySelector("[data-efmpr-intro]");
    statusEl= host.querySelector("[data-efmpr-status]");
    listEl  = host.querySelector("[data-efmpr-list]");
    ctaEl   = host.querySelector("[data-efmpr-cta]");
    start();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
