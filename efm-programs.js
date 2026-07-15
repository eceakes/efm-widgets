(function(){
  "use strict";

  /* ====================== CONFIG ======================
     Concert Programs page (e.g. /programs). Three tabs:
       • Concert Programs — driven by the "EventGridToWebsite" tab. Each concert
         shows its image + title + date, and a download for its "Program URL"
         (plus any "Insert URL"). No separate sheet needed.
       • Masterclasses — driven by the "Masterclasses" tab (image + date + title
         + Program URL).
       • Program Book — one season-wide PDF, shown inline + downloadable.
     Each tab splits into Upcoming / Past. Columns are matched by HEADER NAME.

     To add a concert program: in the EventGridToWebsite tab, paste the PDF link
     into a "Program URL" column on that concert's row. (Optional: "Insert URL"
     for one or more inserts — separate multiple links with a comma or newline;
     "Anchor" for a stable QR/deep-link slug.)
  */
  var WORKBOOK = "1zjhmDd9mhYNryry7oEd6yht0rar-QMS54yv6I_V8n-s";
  function csvUrl(tab){ return "https://docs.google.com/spreadsheets/d/"+WORKBOOK+"/gviz/tq?tqx=out:csv&sheet="+encodeURIComponent(tab); }
  var EVENTS_CSV      = csvUrl("EventGridToWebsite");
  var MASTERCLASS_CSV = csvUrl("Masterclasses");
  var BOOKS_CSV       = csvUrl("flipbooks");   /* Program Book tab: see PROGRAM BOOKS below */

  var MODULE_TITLE = "Concert Programs";          /* "" hides it */
  var INTRO        = "Download the program for each concert and masterclass of the season.";  /* "" hides */

  var TABS = [{key:"concerts",label:"Concert Programs"},{key:"masterclasses",label:"Masterclasses"},{key:"programbook",label:"Program Book"}];
  var DEFAULT_TAB = "concerts";
  var DESC_MAX_LINES = 6;   /* a description longer than N lines is clamped on the card with a "Read more" toggle */

  /* ============================================================
     PROGRAM BOOKS — read LIVE from the "flipbooks" tab of the Event Grid workbook.

     *** ADDING NEXT WEEK'S BOOK IS A SHEET EDIT. NO CODE, NO PUSH, NO RE-UPLOAD. ***
     Add a row and it is on the site within a minute, like the concert programs.

     COLUMNS (matched by HEADER NAME, so their order does not matter):
       Title          required. A row with no title is skipped.
       PDF-URL        the downloadable PDF.        -> "View / Download (PDF)" button
       FlipBook-URL   the FlippingBook "view" url. -> the interactive flipbook
     OPTIONAL, add them only if you want them:
       Blurb          a line of text under the title
       Download only  "yes" -> show this book as a compact download ROW, never a flipbook

     ROW ORDER IS DISPLAY ORDER. Put the current week at the TOP.

     DEFAULT WHEN THERE IS NO "Download only" COLUMN: the FIRST book that has a flipbook is
     embedded as the big flipbook; every book below it becomes a compact download row (with
     a "flip through it online" link if it has a flipbook). That is deliberate: the current
     week should be the thing you can read on the page, and stacking several 80vh
     third-party iframes would make the tab enormous.

     If the sheet tab is missing or empty, FALLBACK_BOOKS below is used instead, so the tab
     can never go blank. */
  var BOOK_ALIASES = {
    title:    ["title","name","book","program book","label"],
    pdf:      ["pdf-url","pdf url","pdf","download","download url","pdf link","file","program pdf"],
    embed:    ["flipbook-url","flipbook url","flipbook","flip book","embed","embed url","online","view url"],
    blurb:    ["blurb","description","desc","notes","subtitle","summary"],
    download: ["download only","download-only","downloadonly","no flipbook","pdf only","pdf-only"]
  };

  /* Used only if the "flipbooks" sheet tab is missing or empty. */
  var FALLBACK_BOOKS = [
    {
      title: "2026 Full Program Book",
      blurb: "The complete season program book.",
      /* NOTE: the ORIGINAL full-book flipbook (view/416920229/) was DELETED from
         FlippingBook while still embedded on the live page, which is why every visitor who
         opened this tab saw "Sorry, but this online flipbook was deleted." This is its
         replacement. Do not restore the old id. */
      embed: "https://online.flippingbook.com/view/958667728/",
      pdf:   "https://irp.cdn-website.com/1e6f3c7e/files/uploaded/11x17+-+EFM+PROGRAM+BOOK+-+11x17-d59928dd.pdf",   /* ~62 MB */
      download: true
    }
  ];

  function parseBookRows(rows){
    if(!rows || !rows.length) return [];
    var m=makeMap(rows[0], BOOK_ALIASES);
    if(m.title===undefined) return [];            /* not the flipbooks tab */

    var out=[];
    for(var i=1;i<rows.length;i++){
      var r=rows[i];
      var title=cell(r,m.title);
      if(!title) continue;
      var pdf=httpUrl(cell(r,m.pdf)), embed=httpUrl(cell(r,m.embed));
      if(!pdf && !embed) continue;                /* nothing to point at */
      out.push({
        title: title,
        blurb: cell(r,m.blurb),
        pdf: pdf,
        embed: embed,
        /* undefined (not false) when the column is absent, so the default rule below can
           tell "the operator said no" apart from "the operator did not say". */
        download: (m.download===undefined) ? undefined : /^y(es)?|^true|^1$/i.test(cell(r,m.download))
      });
    }

    /* Default: EVERY book with a PDF gets a viewer, and the books are COLLAPSIBLE, so the
       reader opens the one they want. Only the first is open, and a closed book has not
       downloaded anything, so having several weeks listed costs nothing.

       (This used to force every book after the first into a download-only row, because
       stacking several always-open 80vh viewers would have been enormous. Collapsing them
       solves that properly instead.)

       A book with no PDF cannot use our viewer, so it stays a download/FlippingBook row.
       "Download only" = yes in the sheet still forces a plain download row. */
    out.forEach(function(b){
      if(b.download!==undefined) return;          /* the sheet was explicit: respect it */
      b.download = !b.pdf;
    });
    return out;
  }

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
    if(/^(https?:\/\/|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;   /* bare domain */
    return "";
  }
  function httpUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }   /* a real, downloadable resource (not a bare anchor) */

  /* tiny safe Markdown for descriptions (handles <br>, **bold**, *italic*, [text](url), - bullets) */
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

  /* program-PDF column family (shared by concerts + masterclasses); never matches the ticket "Link" column */
  var PROGRAM_URL_ALIASES = ["program url","program pdf","program link","program download","program file","programurl","program (pdf)","program booklet","program notes pdf"];
  var EVENT_ALIASES={
    image:["image","photo","img","picture","image url","photo url","poster","flyer","event image","thumbnail"],
    title:["title","event title","name","event name","event","headline"],
    date:["startdate","start","start date","date","event date","begins"],
    desc:["description","desc","notes","about","summary","details","blurb"],
    time:["time","starttime","start time","event time","times"],
    location:["address","location","venue","place","where","hall","room","address/venue"],
    url:PROGRAM_URL_ALIASES,
    inserts:["insert url","inserts","insert","insert urls","program insert","program inserts","insert pdf","insert pdfs"],
    anchor:["anchor","slug","program anchor","qr","qr slug","deep link","deeplink"],
    show:["showevent","show","show event","visible","published","display","active","live"]
  };
  /* Masterclasses tab uses the same shape */
  var MC_ALIASES=EVENT_ALIASES;

  function parseEventRows(rows){ if(!rows.length) return []; var m=makeMap(rows[0],EVENT_ALIASES);
    if(m.title===undefined) return [];
    return rows.slice(1).map(function(r){ return { title:cell(r,m.title), date:cell(r,m.date), image:cell(r,m.image),
      desc:cell(r,m.desc), time:cell(r,m.time), location:cell(r,m.location),
      url:cell(r,m.url), inserts:cell(r,m.inserts), anchor:cell(r,m.anchor), show:cell(r,m.show) }; })
      .filter(function(e){ return e.title; }); }

  /* ---- dates ---- */
  function parseDate(s){ s=String(s==null?"":s).trim(); if(!s) return null; var m;
    if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[1]-1,+m[2]); }
    var d=new Date(s); return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function isoKey(d){ return d? d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2) : ""; }
  function fmtDate(d){ if(!d) return ""; return DOWFULL[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear(); }
  function today(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
  function slug(s){ return String(s==null?"":s).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60); }
  function fileNameOf(u){ try{ var p=String(u).split(/[?#]/)[0].split("/").pop(); return decodeURIComponent(p||""); }catch(e){ return ""; } }

  function visible(x){ return !(String(x.show||"").trim().toLowerCase().match(/^(no|false|0|hide|hidden|off)$/)); }
  function typeLabel(it){ return plain(it.type) || "Program"; }

  /* ---- analytics (no-op without gtag/dataLayer) ---- */
  function utmParams(){ var p={}; try{ var s=new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v=s.get(k); if(v) p[k]=v; }); }catch(e){} return p; }
  function track(name, params){ try{ var d=Object.assign({}, params||{}, utmParams());
    if(typeof window.gtag==="function"){ window.gtag("event", name, d); return; }
    if(window.dataLayer && typeof window.dataLayer.push==="function"){ window.dataLayer.push(Object.assign({event:name}, d)); return; } }catch(e){} }

  /* ---- build groups (a concert or masterclass = one event row + its program/insert PDFs) ---- */
  function eventToGroup(ev){
    var items=[]; var pu=httpUrl(ev.url); if(pu) items.push({ type:"Program", title:"Program", url:pu });
    String(ev.inserts||"").split(/[\n,]+/).forEach(function(s){ var u=httpUrl(s); if(u) items.push({ type:"Insert", title:"Insert", url:u }); });
    return { title:plain(ev.title), date:parseDate(ev.date), image:safeUrl(ev.image), desc:ev.desc||"",
             time:ev.time||"", location:ev.location||"", anchorRaw:ev.anchor||"", items:items };
  }
  function buildGroups(eventRows){ return finalizeGroups(eventRows.filter(visible).map(eventToGroup)); }

  function finalizeGroups(groups){ var seen={};
    groups.forEach(function(g){ var base=slug(g.anchorRaw)||slug(g.title)||"program"; var a=base;
      if(seen[a]){ a=base+"-"+(isoKey(g.date)||"x"); var n=2; while(seen[a]){ a=base+"-"+(n++); } }
      seen[a]=1; g.anchorSlug=a; g.anchorId="prog-"+a; });
    return groups; }

  /* ---- Add to Calendar (Google + .ics, Eastern time) ---- */
  var CAL_TZID="America/New_York", CAL_DURATION_MIN=120, EV_CAL="add_to_calendar";
  var VTIMEZONE=["BEGIN:VTIMEZONE","TZID:America/New_York","BEGIN:DAYLIGHT","TZOFFSETFROM:-0500","TZOFFSETTO:-0400","TZNAME:EDT","DTSTART:19700308T020000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU","END:DAYLIGHT","BEGIN:STANDARD","TZOFFSETFROM:-0400","TZOFFSETTO:-0500","TZNAME:EST","DTSTART:19701101T020000","RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU","END:STANDARD","END:VTIMEZONE"].join("\r\n");
  function pad2(n){ return (n<10?"0":"")+n; }
  function parseTimeStr(s){ s=String(s==null?"":s).trim(); if(!s) return null;
    var m=s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i) || s.match(/^(\d{1,2}):(\d{2})/);
    if(!m) return null; var h=+m[1], mi=m[2]?+m[2]:0, ap=(m[3]||"").toLowerCase();
    if(ap==="p" && h<12) h+=12; if(ap==="a" && h===12) h=0;
    return (h>=0&&h<=23&&mi>=0&&mi<=59)?{h:h,m:mi}:null; }
  function ymd(d){ return d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate()); }
  function localStampDate(dt){ return dt.getFullYear()+pad2(dt.getMonth()+1)+pad2(dt.getDate())+"T"+pad2(dt.getHours())+pad2(dt.getMinutes())+"00"; }
  function utcStampNow(){ var d=new Date(); return d.getUTCFullYear()+pad2(d.getUTCMonth()+1)+pad2(d.getUTCDate())+"T"+pad2(d.getUTCHours())+pad2(d.getUTCMinutes())+pad2(d.getUTCSeconds())+"Z"; }
  function icsEscape(s){ return String(s==null?"":s).replace(/\\/g,"\\\\").replace(/\r\n?|\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;"); }
  function calTimes(g){ var d=g.date, t=parseTimeStr(g.time);
    if(t){ var s=new Date(d.getFullYear(),d.getMonth(),d.getDate(),t.h,t.m); return { allDay:false, s:s, e:new Date(s.getTime()+CAL_DURATION_MIN*60000) }; }
    return { allDay:true, s:d, e:new Date(d.getFullYear(),d.getMonth(),d.getDate()+1) }; }
  function buildICS(g){ if(!g.date) return null; var tm=calTimes(g);
    var uid=(g.anchorSlug||slug(g.title)||"event")+"-"+ymd(g.date)+"@easternfestivalofmusic.org";
    var L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Eastern Festival of Music//Programs//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",VTIMEZONE,"BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+utcStampNow()];
    if(tm.allDay){ L.push("DTSTART;VALUE=DATE:"+ymd(tm.s)); L.push("DTEND;VALUE=DATE:"+ymd(tm.e)); }
    else { L.push("DTSTART;TZID="+CAL_TZID+":"+localStampDate(tm.s)); L.push("DTEND;TZID="+CAL_TZID+":"+localStampDate(tm.e)); }
    L.push("SUMMARY:"+icsEscape(plain(g.title)));
    if(g.location) L.push("LOCATION:"+icsEscape(plain(g.location)));
    var desc=plain(g.desc); if(desc) L.push("DESCRIPTION:"+icsEscape(desc));
    L.push("END:VEVENT","END:VCALENDAR"); return L.join("\r\n"); }
  function googleCalUrl(g){ if(!g.date) return ""; var tm=calTimes(g);
    var dates=tm.allDay? (ymd(tm.s)+"/"+ymd(tm.e)) : (localStampDate(tm.s)+"/"+localStampDate(tm.e));
    var p=["action=TEMPLATE","text="+encodeURIComponent(plain(g.title)),"dates="+dates,"ctz="+encodeURIComponent(CAL_TZID)];
    if(g.location) p.push("location="+encodeURIComponent(plain(g.location)));
    var desc=plain(g.desc); if(desc) p.push("details="+encodeURIComponent(desc));
    return "https://calendar.google.com/calendar/render?"+p.join("&"); }
  function downloadICS(g){ var ics=buildICS(g); if(!ics) return; var name=(slug(g.title)||"event")+".ics";
    try{ var blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}); var url=URL.createObjectURL(blob); var a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click();
      setTimeout(function(){ try{ document.body.removeChild(a); }catch(e){} URL.revokeObjectURL(url); },100);
    }catch(e){ try{ window.open("data:text/calendar;charset=utf-8,"+encodeURIComponent(ics),"_blank"); }catch(e2){} } }
  function closeAllCalMenus(){ if(!host) return; Array.prototype.forEach.call(host.querySelectorAll(".efmpr-cal__menu"),function(m){ if(!m.hidden){ m.hidden=true; var b=m.parentNode.querySelector(".efmpr-cal__btn"); if(b) b.setAttribute("aria-expanded","false"); } }); }
  function calIconSvg(){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'; }
  function renderCalControl(g){
    var wrap=document.createElement("div"); wrap.className="efmpr-cal"; var gurl=googleCalUrl(g);
    var menuId="efmpr-calmenu-"+(g.anchorSlug||slug(g.title)||"x"), ct=escapeHtml(plain(g.title));
    wrap.innerHTML='<button type="button" class="efmpr-cal__btn" aria-expanded="false" aria-controls="'+menuId+'">'+calIconSvg()+'<span>Add to Calendar</span></button>'+
      '<div class="efmpr-cal__menu" id="'+menuId+'" hidden>'+
        (gurl?'<a class="efmpr-cal__opt" data-cal="google" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(gurl)+'" aria-label="Add '+ct+' to Google Calendar (opens in a new tab)">Google Calendar</a>':'')+
        '<button type="button" class="efmpr-cal__opt" data-cal="ics" aria-label="Download '+ct+' calendar file (.ics) for Apple or Outlook">Apple / Outlook (.ics)</button>'+
      '</div>';
    var btn=wrap.querySelector(".efmpr-cal__btn"), menu=wrap.querySelector(".efmpr-cal__menu");
    btn.addEventListener("click",function(e){ e.stopPropagation(); var willOpen=menu.hidden; closeAllCalMenus(); menu.hidden=!willOpen; btn.setAttribute("aria-expanded", menu.hidden?"false":"true"); sync(); });
    var gx=wrap.querySelector('[data-cal="google"]'); if(gx) gx.addEventListener("click",function(){ track(EV_CAL,{ concert:plain(g.title), method:"google" }); });
    wrap.querySelector('[data-cal="ics"]').addEventListener("click",function(){ track(EV_CAL,{ concert:plain(g.title), method:"ics" }); downloadICS(g); });
    return wrap;
  }

  /* ---- render ---- */
  function downloadIconSvg(){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'; }

  function renderItem(it, concertTitle){
    var url=httpUrl(it.url); if(!url) return null;
    var a=document.createElement("a"); a.className="efmpr-item"; a.href=url; a.target="_blank"; a.rel="noopener noreferrer"; a.setAttribute("download","");
    var t=plain(it.title)||typeLabel(it);
    a.setAttribute("aria-label","View or download "+t+" (PDF, opens in a new tab)");
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
        '<img src="'+escapeHtml(g.image)+'" alt="" loading="lazy" referrerpolicy="no-referrer">'+
        (g.date?'<span class="efmpr-group__badge" aria-hidden="true"><b>'+g.date.getDate()+'</b><span>'+MON3[g.date.getMonth()].toUpperCase()+'</span></span>':'')+
      '</div>'; }
    var body=document.createElement("div"); body.className="efmpr-group__body";
    body.innerHTML='<div class="efmpr-group__title" role="heading" aria-level="4">'+escapeHtml(g.title||"Program")+'</div>'+
      (g.date?'<div class="efmpr-group__date">'+escapeHtml(fmtDate(g.date))+'</div>':'');
    if(g.desc){
      var d=document.createElement("div"); d.className="efmpr-group__desc efmpr-group__desc--clamp";
      d.id="efmpr-desc-"+(g.anchorSlug||slug(g.title)||"x"); d.style.webkitLineClamp=String(DESC_MAX_LINES);
      d.innerHTML=mdToHtml(g.desc); body.appendChild(d);
      /* "Read more" toggle: hidden until clampPass() (run from sync) finds the text is
         actually clipped AT THIS WIDTH, so it never shows on a description that fits. */
      var mb=document.createElement("button"); mb.type="button"; mb.className="efmpr-group__more"; mb.hidden=true;
      mb.textContent="Read more"; mb.setAttribute("aria-expanded","false"); mb.setAttribute("aria-controls",d.id);
      mb.setAttribute("aria-label","Read more of the description for "+(plain(g.title)||"this program"));
      mb.addEventListener("click",function(){ var expand=d.classList.contains("efmpr-group__desc--clamp");
        if(expand) d.classList.remove("efmpr-group__desc--clamp"); else d.classList.add("efmpr-group__desc--clamp");
        mb.setAttribute("aria-expanded",expand?"true":"false"); mb.textContent=expand?"Show less":"Read more"; sync(); });
      body.appendChild(mb);
    }
    var wrap=document.createElement("div"); wrap.className="efmpr-group__items"; var n=0;
    g.items.forEach(function(it){ var el=renderItem(it, g.title); if(el){ wrap.appendChild(el); n++; } });
    if(!n){ var none=document.createElement("p"); none.className="efmpr-group__none"; none.textContent="Program coming soon."; wrap.appendChild(none); }
    body.appendChild(wrap);
    if(g.date) body.appendChild(renderCalControl(g));
    art.appendChild(body);
    return art;
  }

  function renderPanel(panelEl, groups){
    panelEl.innerHTML="";
    if(!groups.length){ var em=document.createElement("p"); em.className="efmpr__empty"; em.textContent="Programs will be posted here soon — check back closer to each date."; panelEl.appendChild(em); return; }
    var t=today();
    var up=groups.filter(function(g){ return !g.date || g.date>=t; }).sort(function(a,b){ return (a.date?a.date:0)-(b.date?b.date:0); });
    var past=groups.filter(function(g){ return g.date && g.date<t; }).sort(function(a,b){ return b.date-a.date; });
    function section(label, list, isPast){ if(!list.length) return;
      var h=document.createElement("div"); h.className="efmpr-section"+(isPast?" efmpr-section--past":""); h.setAttribute("role","heading"); h.setAttribute("aria-level","3"); h.textContent=label; panelEl.appendChild(h);
      list.forEach(function(g){ panelEl.appendChild(renderGroup(g, isPast)); }); }
    section("Upcoming", up, false);
    section("Past", past, true);
  }

  /* ============================================================
     FLIPBOOK FAILOVER: if the flipbook will not display, show the PDF instead.

     A flipbook can fail in three ways. We can detect all three, but only just, and each
     needed a different trick. Everything below fails SAFE: if a check is inconclusive we
     still show the flipbook (today's behaviour), and if a check fires we drop to the PDF,
     which is degraded but never broken. Set FAILOVER=false to switch it all off.

     1. THE BOOK WAS DELETED.
        FlippingBook serves the error page with HTTP 200, so a status check proves nothing
        (this is exactly how the live /programs page ended up embedding a deleted book and
        showing "Sorry, but this online flipbook was deleted" to every visitor). But the
        deleted page's HTML is tiny and literally contains that sentence, and
        online.flippingbook.com reflects our Origin in Access-Control-Allow-Origin, so we
        can just fetch() it and read it. Caught before the iframe is ever given a src.

     2. FLIPPINGBOOK IS UNREACHABLE (offline, or the network blocks it).
        The same fetch() rejects. Worth failing over on: the Guilford campus wifi already
        blocks cdn.jsdelivr.net, so a blocked flippingbook.com is not hypothetical, and an
        iframe pointed at a blocked host renders nothing at all.

     3. THE BOOK IS IN "PROTECTED EMBED" PRIVACY MODE.
        This one is invisible to fetch(): the server returns the full, healthy viewer page
        to any request (verified, including with a spoofed Referer). The block is enforced
        client-side INSIDE the iframe, which then renders "cannot be displayed here because
        of its privacy settings". Cross-origin we cannot read that.
        What we CAN see: a protected book postMessages {fbPublicationUrl:"<its url>"} to the
        parent, over and over (12 times in ~10s in testing). That is its handshake: it is
        waiting for FlippingBook's official embed script to answer, and ours never does.
        A public book has nothing to negotiate. So: repeated handshakes with no answer =
        this book will not render for us.
        CAUTION: that message is undocumented FlippingBook behaviour and could change. It
        is therefore treated as a HINT, not gospel: we require the RETRY (>= 2 messages),
        never act on a single one, and if FlippingBook ever stops sending it we simply lose
        this one check and are back to today's behaviour. We deliberately do NOT answer the
        handshake to force a protected book to render: that would be reverse-engineering a
        protection mechanism, and the supported fix is one setting (see below).

     THE REAL FIX, which makes all of this unnecessary: set the publication's privacy to
     Public in FlippingBook. Protected embed additionally requires FlippingBook's own JS
     embed code (their docs are explicit that whitelisting a domain is NOT enough), and a
     public program book has nothing to protect.
     ============================================================ */
  /* ---- OUR OWN FLIPBOOK (efm-flipbook.js) ----
     true  = render books with our own PDF.js viewer. No FlippingBook, no subscription.
     false = fall back to the FlippingBook iframe path below.
     Any book that has a PDF-URL uses ours; the FlippingBook path survives only for a book
     with a FlipBook-URL and no PDF.

     PDF.js MUST be served from Duda, not a public CDN: the Guilford campus wifi blocks
     cdn.jsdelivr.net, and a viewer that dies on campus is no better than the embed we are
     replacing. Leave these blank and efm-flipbook falls back to its own CDN default. */
  var OWN_FLIPBOOK  = true;
  var PDFJS_SRC     = "";   /* e.g. https://irp.cdn-website.com/1e6f3c7e/files/uploaded/pdf-<hash>.min.js */
  var PDFJS_WORKER  = "";   /* e.g. .../pdf.worker-<hash>.min.js */

  var FAILOVER = true;
  var HANDSHAKES_BEFORE_FAILOVER = 2;   /* never act on a single message: require the retry */
  var PROBE_TIMEOUT_MS = 6000;

  var bookFrames=[];
  var handshakeCounts={};               /* flipbook url -> how many times it has called out */
  var bookSeq=0;                        /* only the FIRST book starts open */

  function isFlipbookErrorPage(html){
    if(!html) return true;
    /* the deleted page is ~1.8k and says so; the real viewer is ~77k and does not */
    return /this online flipbook was deleted|class="error-image"/i.test(html);
  }

  /* Resolves "ok" | "gone" | "unreachable". Never throws. */
  function probeFlipbook(url){
    return new Promise(function(resolve){
      var done=false;
      var t=setTimeout(function(){ if(!done){ done=true; resolve("unreachable"); } }, PROBE_TIMEOUT_MS);
      try{
        fetch(url, { method:"GET", credentials:"omit" })
          .then(function(r){ return r.text(); })
          .then(function(html){ if(done) return; done=true; clearTimeout(t);
            resolve(isFlipbookErrorPage(html) ? "gone" : "ok"); })
          .catch(function(){ if(done) return; done=true; clearTimeout(t); resolve("unreachable"); });
      }catch(e){ if(!done){ done=true; clearTimeout(t); resolve("unreachable"); } }
    });
  }

  /* Swap a book's card from "flipbook" to "download row", in place. Only worth doing if
     the book actually HAS a pdf: with no pdf there is nothing better to show, so we leave
     the flipbook (and its "open in a new tab" link) alone rather than blank the card. */
  function failoverToPdf(card, book, why){
    if(!card || !httpUrl(book.pdf)) return;
    if(card.getAttribute("data-failed-over")) return;
    var replacement=document.createElement("div");
    replacement.innerHTML=bookCardHtml(assign({}, book, { download:true }));
    var next=replacement.firstChild;
    if(!next) return;
    next.setAttribute("data-failed-over", why);
    card.parentNode.replaceChild(next, card);
    wireBookCard(next, book);
    bookFrames=bookFrames.filter(function(f){ return document.contains(f); });
    track("program_book_failover", { item_title:book.title||"", reason:why });
  }

  function assign(target){
    for(var i=1;i<arguments.length;i++){ var s=arguments[i];
      for(var k in s){ if(Object.prototype.hasOwnProperty.call(s,k)) target[k]=s[k]; } }
    return target;
  }

  function bookCardHtml(book){
    var pdf=httpUrl(book.pdf), embed=httpUrl(book.embed);
    var dl=pdf||embed;
    if(!dl) return "";                                  /* nothing to point at: skip it */

    var title=book.title||"Program Book";

    /* OUR OWN FLIPBOOK, not FlippingBook.
       If the book has a PDF and is meant to be featured, render it with efm-flipbook:
       PDF.js + a real CSS 3D page turn, from our own origin. No third party to ask
       permission from, nothing to be deleted out from under us, nothing for the campus
       wifi to block, and no subscription. The FlippingBook iframe path below is kept only
       for a book that has a FlipBook-URL and NO PDF, which should not happen again. */
    if(pdf && !book.download && OWN_FLIPBOOK){
      /* COLLAPSIBLE. Each book is a header you can open and close, and the reader chooses
         which one to read. This is not just tidiness: opening a book is what downloads and
         rasterises its PDF, so a collapsed book costs nothing. With several weeks' books on
         the page, mounting them all would mean several PDFs and several sets of page
         bitmaps for books nobody looked at.

         The FIRST book is open by default, because that is the current week and it is what
         almost everyone came for. */
      var open = (bookSeq===0);
      var id = "efmpr-book-" + (bookSeq++);

      return '<div class="efmpr-book efmpr-book--collapsible'+(open?" is-open":"")+'" data-book-panel>'+
          '<div class="efmpr-book__head">'+
            '<button type="button" class="efmpr-book__toggle" aria-expanded="'+(open?"true":"false")+'" aria-controls="'+id+'" data-book-toggle>'+
              '<span class="efmpr-book__meta">'+
                '<span class="efmpr-book__title" role="heading" aria-level="3">'+escapeHtml(title)+'</span>'+
                (book.blurb?'<span class="efmpr-book__blurb">'+escapeHtml(book.blurb)+'</span>':'')+
              '</span>'+
              /* Explicit affordance. The word changes with state (CSS, off aria-expanded)
                 and the chevron rotates, so the row unmistakably reads as expand/collapse.
                 A bare grey box gave no such signal, which is what confused readers. */
              '<span class="efmpr-book__expand" aria-hidden="true">'+
                '<span class="efmpr-book__expand-txt"></span>'+
                '<span class="efmpr-book__chevron"></span>'+
              '</span>'+
            '</button>'+
            '<a class="efmpr-book__btn" href="'+escapeHtml(pdf)+'" target="_blank" rel="noopener noreferrer" download'+
              ' data-book-dl data-book-title="'+escapeHtml(title)+'" aria-label="'+escapeHtml("Download "+title+" (PDF, opens in a new tab)")+'">'+
              downloadIconSvg()+'<span>Download PDF</span></a>'+
          '</div>'+
          '<div class="efmpr-book__body" id="'+id+'" role="region" aria-label="'+escapeHtml(title)+'"'+(open?"":" hidden")+'>'+
            '<div class="efmfb" data-efmfb-pdf="'+escapeHtml(pdf)+'" data-efmfb-title="'+escapeHtml(title)+'"'+
              (PDFJS_SRC?' data-efmfb-pdfjs="'+escapeHtml(PDFJS_SRC)+'"':'')+
              (PDFJS_WORKER?' data-efmfb-pdfjs-worker="'+escapeHtml(PDFJS_WORKER)+'"':'')+
            '></div>'+
          '</div>'+
        '</div>';
    }

    /* download:true renders the compact row even when an embed exists (see the config). */
    var showFlip = !!embed && !book.download;

    var btnLabel = pdf ? "View / Download (PDF)" : "Open the program book";
    var btnAria  = escapeHtml(pdf
      ? ("View or download "+title+" (PDF, opens in a new tab)")
      : ("Open "+title+" (opens in a new tab)"));

    /* A flipbook is an <iframe> full of images: useless to a screen reader. Point those
       users at the PDF, which is the accessible equivalent. */
    var srNote = (showFlip && pdf)
      ? '<p class="efmpr-sr-only">This program book is shown as an interactive flipbook. For a screen-reader-accessible version, use the "View / Download (PDF)" button above.</p>'
      : '';

    var head='<div class="efmpr-book__head">'+
        '<div class="efmpr-book__meta"><div class="efmpr-book__title" role="heading" aria-level="3">'+escapeHtml(title)+'</div>'+
          (book.blurb?'<div class="efmpr-book__blurb">'+escapeHtml(book.blurb)+'</div>':'')+'</div>'+
        '<a class="efmpr-book__btn" href="'+escapeHtml(dl)+'" target="_blank" rel="noopener noreferrer"'+(pdf?' download':'')+
          ' data-book-dl data-book-title="'+escapeHtml(title)+'" aria-label="'+btnAria+'">'+
          downloadIconSvg()+'<span>'+escapeHtml(btnLabel)+'</span></a>'+
      '</div>';

    if(!showFlip){
      /* Download row. If the book ALSO has a flipbook, offer it: handing someone a 62 MB
         PDF as their only option is not a kindness. */
      var online = embed
        ? '<p class="efmpr-book__fallback">Or <a href="'+escapeHtml(embed)+'" target="_blank" rel="noopener noreferrer">flip through it online</a> without downloading.</p>'
        : '';
      return '<div class="efmpr-book efmpr-book--dl">'+head+online+'</div>';
    }

    var viewer=embed||(pdf?pdf+"#view=FitH":"");
    var frameTitle=escapeHtml(title+(embed?" (interactive flipbook)":" (PDF document viewer)"));
    return '<div class="efmpr-book">'+head+
      '<div class="efmpr-book__viewer" aria-busy="false">'+srNote+
        '<iframe class="efmpr-book__frame" title="'+frameTitle+'" loading="lazy" allowfullscreen scrolling="no" data-src="'+escapeHtml(viewer)+'"></iframe>'+
        '<p class="efmpr-book__fallback">Trouble viewing it here? <a href="'+escapeHtml(embed||dl)+'" target="_blank" rel="noopener noreferrer">Open the program book in a new tab.</a>'+
          (pdf&&embed?' Or <a href="'+escapeHtml(pdf)+'" target="_blank" rel="noopener noreferrer" download>download the PDF</a>.':'')+'</p>'+
      '</div></div>';
  }

  /* Per-card wiring, so a card built by the initial render and a card rebuilt by the
     failover get identical behaviour. */
  function wireBookCard(card, book){
    var f=card.querySelector(".efmpr-book__frame");
    if(f){
      var viewerEl=f.parentNode;
      if(viewerEl&&viewerEl.setAttribute) f.addEventListener("load",function(){ viewerEl.setAttribute("aria-busy","false"); });
      f.__book=book;                       /* so the message listener can find its card */
      bookFrames.push(f);
    }
    [].slice.call(card.querySelectorAll("[data-book-dl]")).forEach(function(btn){
      btn.addEventListener("click",function(){
        var href=btn.getAttribute("href"), t=btn.getAttribute("data-book-title");
        track(EV_DOWNLOAD,{ concert:"Program Book", item_type:"Program Book", item_title:t, file_name:fileNameOf(href), link_url:href });
      });
    });
  }

  var bookList=[];
  function renderProgramBook(panelEl, books){
    bookList=books||[];
    bookFrames=[];
    bookSeq=0;
    panelEl.innerHTML = bookList.map(bookCardHtml).join("");
    [].slice.call(panelEl.querySelectorAll(".efmpr-book")).forEach(function(card, i){
      wireBookCard(card, bookList[i]);
    });
    wireBookToggles(panelEl);
    if(FAILOVER) listenForHandshakes();
  }

  /* Open/close a book. Mounting is deferred until a book is actually opened, so a book the
     reader never expands never downloads its PDF or rasterises a single page. */
  function wireBookToggles(panelEl){
    [].slice.call(panelEl.querySelectorAll("[data-book-toggle]")).forEach(function(btn){
      btn.addEventListener("click", function(){
        var card=btn.closest("[data-book-panel]");
        var body=card.querySelector(".efmpr-book__body");
        var open=btn.getAttribute("aria-expanded")==="true";

        if(open){
          btn.setAttribute("aria-expanded","false");
          card.classList.remove("is-open");
          body.hidden=true;
        } else {
          btn.setAttribute("aria-expanded","true");
          card.classList.add("is-open");
          body.hidden=false;
          mountBooksIn(body);            /* first open = the PDF finally loads */
        }
      });
    });
  }

  function mountBooksIn(root){
    if(!OWN_FLIPBOOK || !window.EFMFlipbook || !root) return;
    window.EFMFlipbook.mountAll(root);
  }

  /* A protected-embed flipbook calls out to the parent repeatedly, waiting for an answer
     it will never get from us. Count those calls; on the RETRY (not the first message),
     conclude it will not render and swap in the PDF. See the big note above. */
  var handshakeWired=false;
  function listenForHandshakes(){
    if(handshakeWired) return; handshakeWired=true;
    window.addEventListener("message", function(e){
      if(!/(^|\.)flippingbook\.com$/i.test((function(){ try{ return new URL(e.origin).hostname; }catch(_){ return ""; } })())) return;
      var url = e.data && e.data.fbPublicationUrl;
      if(!url) return;

      handshakeCounts[url]=(handshakeCounts[url]||0)+1;
      if(handshakeCounts[url] < HANDSHAKES_BEFORE_FAILOVER) return;

      bookFrames.slice().forEach(function(f){
        var b=f.__book; if(!b) return;
        if(httpUrl(b.embed)!==url) return;
        var card=f.closest ? f.closest(".efmpr-book") : null;
        failoverToPdf(card, b, "protected-embed");
      });
    });
  }

  /* Lazy-load, on tab activate. Two things happen here, and BOTH are deliberately deferred
     until someone actually opens the Program Book tab:
       - our own flipbook mounts, which is what pulls in PDF.js (~478 KB gzipped). Most
         visitors come to /programs for the concert programs and never open this tab; they
         should not pay for a PDF engine they will not look at.
       - any remaining FlippingBook iframe is probed and then given a src. */
  function loadBookFrame(){
    /* Mount only the books that are actually OPEN. A collapsed book stays unmounted, so it
       costs nothing until the reader asks for it. */
    if(OWN_FLIPBOOK && window.EFMFlipbook){
      var panel=panels && panels.programbook;
      if(panel){
        [].slice.call(panel.querySelectorAll(".efmpr-book__body:not([hidden])")).forEach(mountBooksIn);
        /* a book rendered without the collapsible wrapper (there should be none) */
        [].slice.call(panel.querySelectorAll(".efmfb")).forEach(function(n){
          if(!n.closest(".efmpr-book__body")) window.EFMFlipbook.mount(n);
        });
      }
    }

    bookFrames.slice().forEach(function(f){
      if(f.getAttribute("src")) return;
      var s=f.getAttribute("data-src"); if(!s) return;
      var v=f.parentNode; if(v&&v.setAttribute) v.setAttribute("aria-busy","true");

      if(!FAILOVER || !window.fetch || !window.Promise){ f.setAttribute("src",s); return; }

      probeFlipbook(s).then(function(verdict){
        if(!document.contains(f)) return;              /* already swapped out */
        if(verdict==="ok"){ f.setAttribute("src",s); return; }
        var card=f.closest ? f.closest(".efmpr-book") : null;
        var b=f.__book||{};
        if(httpUrl(b.pdf)) failoverToPdf(card, b, verdict);
        else f.setAttribute("src",s);                  /* no pdf to fall back to: try anyway */
      });
    });
  }

  function renderCTA(){
    var tickets=httpUrl(TICKETS_URL), donate=httpUrl(DONATE_URL);
    if(!tickets && !donate){ ctaEl.hidden=true; return; }
    var btns="";
    if(tickets) btns+='<a class="efmpr-cta__btn efmpr-cta__btn--primary" href="'+escapeHtml(tickets)+'" target="_blank" rel="noopener noreferrer" data-cta="tickets" aria-label="'+escapeHtml(TICKETS_LABEL)+' (opens in a new tab)">'+escapeHtml(TICKETS_LABEL)+'</a>';
    if(donate)  btns+='<a class="efmpr-cta__btn efmpr-cta__btn--ghost" href="'+escapeHtml(donate)+'" target="_blank" rel="noopener noreferrer" data-cta="donate" aria-label="'+escapeHtml(DONATE_LABEL)+' (opens in a new tab)">'+escapeHtml(DONATE_LABEL)+'</a>';
    ctaEl.innerHTML='<div class="efmpr-cta__inner">'+
      (CTA_HEADING?'<div class="efmpr-cta__heading" role="heading" aria-level="3">'+escapeHtml(CTA_HEADING)+'</div>':'')+
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
      b.textContent=t.label; b.setAttribute("role","tab"); b.setAttribute("aria-selected","false"); b.setAttribute("aria-controls","efmpr-panel-"+t.key);
      b.addEventListener("click",function(){ activate(t.key,true); });
      b.addEventListener("keydown",onTabKey); tabsBar.appendChild(b); }); }
  function onTabKey(e){ var i=shownKeys.indexOf(activeKey);
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); var k=shownKeys[(i+1)%shownKeys.length]; activate(k,true); focusTab(k); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); var k2=shownKeys[(i-1+shownKeys.length)%shownKeys.length]; activate(k2,true); focusTab(k2); } }
  function focusTab(k){ var b=document.getElementById("efmpr-tab-"+k); if(b) b.focus(); }
  function activate(key, user){ if(!panels[key]) return; activeKey=key;
    TABS.forEach(function(t){ var on=t.key===key; var b=document.getElementById("efmpr-tab-"+t.key);
      if(b){ b.setAttribute("aria-selected",on?"true":"false"); b.tabIndex=on?0:-1; }
      if(panels[t.key]){ panels[t.key].hidden=!on; panels[t.key].tabIndex=on?0:-1; } });
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
    /* Keep only books that have a title AND somewhere to point. An entry with neither a
       pdf nor an embed would render an empty card; an empty list hides the tab. */
    var books=(data.books||[]).filter(function(b){
      return b && b.title && (httpUrl(b.pdf) || httpUrl(b.embed));
    });
    var content={ concerts:buildGroups(data.events), masterclasses:buildGroups(data.masterclasses),
                  programbook: books };
    var keys=TABS.map(function(t){return t.key;}).filter(function(k){ return content[k] && content[k].length; });
    if(!keys.length){ setStatus("Programs will be posted here soon — check back closer to each concert."); return; }
    setStatus("");
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.setAttribute("role","heading"); titleEl.setAttribute("aria-level","2"); titleEl.hidden=false; }
    if(INTRO){ introEl.textContent=INTRO; introEl.hidden=false; }
    listEl.innerHTML=""; panels={};
    TABS.forEach(function(t){ if(keys.indexOf(t.key)<0) return;
      var p=document.createElement("div"); p.className="efmpr__panel"; p.id="efmpr-panel-"+t.key; p.setAttribute("role","tabpanel"); p.setAttribute("aria-labelledby","efmpr-tab-"+t.key); p.hidden=true;
      if(t.key==="programbook") renderProgramBook(p, content[t.key]); else renderPanel(p, content[t.key]);
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
  /* Show each description's "Read more" toggle only when the text is really clipped
     at the current width (measured, so it is correct on wide and narrow cards alike).
     Left alone once the visitor has expanded it (aria-expanded="true"). */
  function clampPass(){ if(!host) return;
    Array.prototype.forEach.call(host.querySelectorAll(".efmpr-group__more"),function(mb){
      if(mb.getAttribute("aria-expanded")==="true") return;
      var d=mb.previousElementSibling; if(!d) return;
      mb.hidden = !(d.scrollHeight - d.clientHeight > 2); }); }
  var _wired=false; function sync(){ defuse(); clampPass(); autoHeight(); }
  function wire(){ if(_wired) return; _wired=true; window.addEventListener("resize",sync);
    if(window.ResizeObserver){ try{ new ResizeObserver(sync).observe(host); }catch(e){} }
    document.addEventListener("click",function(){ closeAllCalMenus(); });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape") closeAllCalMenus(); });
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- boot ---- */
  function fetchRows(url){ return fetch(url,{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
    .then(function(t){ return parseCSV(t); }).catch(function(){ return []; }); }
  function headerSig(rows){ return (rows&&rows[0])? rows[0].map(function(c){ return String(c==null?"":c).trim().toLowerCase(); }).join("|") : ""; }
  function start(){
    setStatus("Loading programs…");
    /* The books tab is optional: if it 404s or is empty we fall back, so its fetch must
       never take the whole page down with it. */
    var books = fetchRows(BOOKS_CSV).catch(function(){ return []; });

    Promise.all([ fetchRows(EVENTS_CSV), fetchRows(MASTERCLASS_CSV), books ]).then(function(res){
      var evRows=res[0], mcRows=res[1], bkRows=res[2], evSig=headerSig(evRows);
      /* gviz returns the FIRST sheet when a named tab doesn't exist — if "Masterclasses"
         (or "flipbooks") comes back identical to the events sheet, that tab is missing:
         treat as empty. */
      if(evSig && headerSig(mcRows)===evSig) mcRows=[];
      if(evSig && headerSig(bkRows)===evSig) bkRows=[];

      var parsedBooks=parseBookRows(bkRows);
      if(!parsedBooks.length) parsedBooks=FALLBACK_BOOKS;   /* the tab can never go blank */

      render({ events:parseEventRows(evRows), masterclasses:parseEventRows(mcRows), books:parsedBooks });
      wire();
    });
  }
  function boot(){
    host=document.getElementById("efm-programs");
    if(!host) return;
    titleEl = host.querySelector("[data-efmpr-title]");
    introEl = host.querySelector("[data-efmpr-intro]");
    tabsBar = host.querySelector("[data-efmpr-tabs]");
    statusEl= host.querySelector("[data-efmpr-status]"); if(statusEl) statusEl.setAttribute("role","status");
    listEl  = host.querySelector("[data-efmpr-list]");
    ctaEl   = host.querySelector("[data-efmpr-cta]");
    if(!tabsBar){ tabsBar=document.createElement("div"); tabsBar.setAttribute("data-efmpr-tabs",""); tabsBar.setAttribute("role","tablist"); tabsBar.setAttribute("aria-label","Program categories"); tabsBar.hidden=true; host.insertBefore(tabsBar, statusEl||listEl); }
    tabsBar.className="efmpr__tabs";
    start();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
