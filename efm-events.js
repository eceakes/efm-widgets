(function(){
  "use strict";

  /* ====================== CONFIG ====================== */
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1zjhmDd9mhYNryry7oEd6yht0rar-QMS54yv6I_V8n-s/gviz/tq?tqx=out:csv&sheet=EventGridToWebsite";
  var SHEET_CSV_FALLBACKS = [];

  /* Extra tab(s) in the SAME workbook shown in the Event Calendar + List View
     ONLY (kept out of the Upcoming Events photo cards) — e.g. master classes,
     studio recitals. Same column headers as the main sheet. Each entry is a
     gviz CSV link for that tab (just change &sheet=TabName). */
  var SCHEDULE_CSV_URLS = ["https://docs.google.com/spreadsheets/d/1zjhmDd9mhYNryry7oEd6yht0rar-QMS54yv6I_V8n-s/gviz/tq?tqx=out:csv&sheet=Masterclasses"];

  var MODULE_TITLE = "Events at Eastern Festival of Music";   /* big heading above the tabs; "" hides it */
  var DEFAULT_TAB  = "calendar";    /* "calendar" or "upcoming" (URL #hash overrides) */
  var TICKETS_URL   = "https://www.ticketmaster.com/eastern-festival-of-music-tickets/artist/4397109";   /* "Purchase Tickets" tab link */
  var TICKETS_LABEL = "Purchase Tickets";    /* text shown on that tab */
  var SUBSCRIBE_URL   = "https://am.ticketmaster.com/tangercenter/buy?id=MjAz";   /* "Become a Subscriber" tab link */
  var SUBSCRIBE_LABEL = "Become a Subscriber";    /* text shown on that tab */
  var PROGRAMS_URL = "/programs";   /* concert programs page — a bare anchor in the Program column (e.g. "eso-gala") deep-links here for unified tracking; a full PDF URL still downloads directly */
  var HIDE_PAST    = true;                  /* Upcoming list hides events that already ended */
  var WEEK_START   = 0;                     /* 0 = Sunday, 1 = Monday */
  var MAX_EV_PER_DAY = 3;                   /* calendar chips before "+N more" */

  /* Built-in events (used only if the sheet can't load, so the page is never blank). */
  var FALLBACK_DATA = [
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/Community_Chamber_May3_2026.png",
        "start": "2026-05-03",
        "end": "2026-05-03",
        "title": "Community Chamber Music Concert",
        "time": "4:00 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "This free event will be the start of an inspiratinal summer of music making at Eastern Festival of Music.<br>The program will feature dynamic chamber pieces including the Trio in B-flat major, Op. 11 by Ludwig van Beethoven.",
        "link": "ev1",
        "button": ""
    },
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/pexels-cottonbro-7095505.jpg",
        "start": "2026-06-30",
        "end": "2026-06-30",
        "title": "Eastern Chamber Players #1",
        "time": "7:30 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "Foote, Arthur: 3 Pieces Op. 1<br>Beethoven, Ludwig van: Piano Trio in E-flat Op. 1 No. 1<br>Mendelssohn, Felix: Octet Op. 20",
        "link": "https://www.tangercenter.com/events/eastern-festival-of-music/",
        "button": "Ticket Information"
    },
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/AdobeStock_67163863.jpeg",
        "start": "2026-07-01",
        "end": "2026-07-01",
        "title": "Only Mozart",
        "time": "7:30 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "An all-Mozart concerto concert with concertos for piano, flute, and bassoon",
        "link": "https://www.tangercenter.com/events/eastern-festival-of-music/",
        "button": "Ticket Information"
    },
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/violin-standing-sheet-music.jpg",
        "start": "2026-07-02",
        "end": "2026-07-02",
        "title": "String Solo Works",
        "time": "7:30 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "A recital of string solo works performed by the String Fellows",
        "link": "https://www.tangercenter.com/events/eastern-festival-of-music/",
        "button": "Ticket Information"
    },
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/gerard-home.jpg",
        "start": "2026-07-03",
        "end": "2026-07-03",
        "title": "Gala Opening Orchestral Night",
        "time": "7:30 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "All orchestra concert with George Gershwin's Rhapsody in Blue (Bournaki) and\nAntonin Dvorak's 9th Symphony",
        "link": "https://www.tangercenter.com/events/eastern-festival-of-music/",
        "button": "Ticket Information"
    },
    {
        "image": "https://irp.cdn-website.com/1e6f3c7e/dms3rep/multi/getty-images-Bl-q_tjjg4A-unsplash.jpg",
        "start": "2026-07-04",
        "end": "2026-07-04",
        "title": "USA AT 250!",
        "time": "7:30 PM",
        "address": "Dana Auditorium<br>710 Levi Coffin Dr<br>Greensboro, NC",
        "desc": "Copland, Aaron: Appalachian Spring<br>Zwilich, Ellen Taaffe:\nRemembrance (world premiere)<br> Foote, Arthur: Cello Concerto (Schwarz)<br>Zwilich: Jubilation<br>Gershwin, George: American in Paris<br>Eastern Festival Orchestra",
        "link": "https://www.tangercenter.com/events/eastern-festival-of-music/",
        "button": "Ticket Information"
    }
];

  /* ====================== ENGINE ====================== */
  var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  var MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var DOWFULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  var host, titleEl, tabsBar, statusEl, panels;

  function setStatus(m){ if(!statusEl) return; if(m){ statusEl.textContent=m; statusEl.hidden=false; } else statusEl.hidden=true; }
  function escapeHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  /* allow ONLY <br> through (everything else escaped) */
  function htmlBreaks(s){ return escapeHtml(s).replace(/&lt;br\s*\/?&gt;/gi,"<br>").replace(/\r?\n/g,"<br>"); }
  function plain(s){ return String(s==null?"":s).replace(/<br\s*\/?>(?=)/gi," ").replace(/\s+/g," ").trim(); }
  function safeUrl(u){ u=String(u==null?"":u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "";
    if(/^[\\/]{2}/.test(u) || /^\\/.test(u)) return "";   /* block //host, \\host, /\host, \host (protocol-relative / open-redirect) */
    if(/^(https?:\/\/|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;   /* bare domain */
    return "";
  }
  function ticketUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }   /* internal ids like "ev1" make no button */

  /* ---- analytics (no-op without gtag/dataLayer) ---- */
  function utmParams(){ var p={}; try{ var s=new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v=s.get(k); if(v) p[k]=v; }); }catch(e){} return p; }
  function track(name,params){ try{ var d=Object.assign({},params||{},utmParams());
    if(typeof window.gtag==="function"){ window.gtag("event",name,d); return; }
    if(window.dataLayer && typeof window.dataLayer.push==="function"){ window.dataLayer.push(Object.assign({event:name},d)); return; } }catch(e){} }
  function progSlug(s){ return String(s==null?"":s).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }

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
  function calLoc(e){ return plain(String(e.address==null?"":e.address).replace(/<br\s*\/?>/gi,", ")); }
  function calTimes(e){ var d=e.start, t=parseTimeStr(e.time);
    if(t){ var s=new Date(d.getFullYear(),d.getMonth(),d.getDate(),t.h,t.m); return { allDay:false, s:s, e:new Date(s.getTime()+CAL_DURATION_MIN*60000) }; }
    var en=(e.end&&e.end.getTime()>d.getTime())?e.end:d; return { allDay:true, s:d, e:new Date(en.getFullYear(),en.getMonth(),en.getDate()+1) }; }
  function buildICS(e){ if(!e.start) return null; var tm=calTimes(e);
    var L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Eastern Festival of Music//Events//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",VTIMEZONE,"BEGIN:VEVENT","UID:"+(progSlug(e.title)||"event")+"-"+ymd(e.start)+"@easternfestivalofmusic.org","DTSTAMP:"+utcStampNow()];
    if(tm.allDay){ L.push("DTSTART;VALUE=DATE:"+ymd(tm.s)); L.push("DTEND;VALUE=DATE:"+ymd(tm.e)); }
    else { L.push("DTSTART;TZID="+CAL_TZID+":"+localStampDate(tm.s)); L.push("DTEND;TZID="+CAL_TZID+":"+localStampDate(tm.e)); }
    L.push("SUMMARY:"+icsEscape(plain(e.title))); var loc=calLoc(e); if(loc) L.push("LOCATION:"+icsEscape(loc));
    var desc=plain(e.desc); if(desc) L.push("DESCRIPTION:"+icsEscape(desc));
    L.push("END:VEVENT","END:VCALENDAR"); return L.join("\r\n"); }
  function googleCalUrl(e){ if(!e.start) return ""; var tm=calTimes(e);
    var dates=tm.allDay?(ymd(tm.s)+"/"+ymd(tm.e)):(localStampDate(tm.s)+"/"+localStampDate(tm.e));
    var p=["action=TEMPLATE","text="+encodeURIComponent(plain(e.title)),"dates="+dates,"ctz="+encodeURIComponent(CAL_TZID)];
    var loc=calLoc(e); if(loc) p.push("location="+encodeURIComponent(loc));
    var desc=plain(e.desc); if(desc) p.push("details="+encodeURIComponent(desc));
    return "https://calendar.google.com/calendar/render?"+p.join("&"); }
  function downloadICS(e){ var ics=buildICS(e); if(!ics) return; var name=(progSlug(e.title)||"event")+".ics";
    try{ var blob=new Blob([ics],{type:"text/calendar;charset=utf-8"}); var u=URL.createObjectURL(blob); var a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click();
      setTimeout(function(){ try{document.body.removeChild(a);}catch(x){} URL.revokeObjectURL(u); },100);
    }catch(x){ try{ window.open("data:text/calendar;charset=utf-8,"+encodeURIComponent(ics),"_blank"); }catch(x2){} } }
  function closeAllCalMenus(){ if(!modal) return; Array.prototype.forEach.call(modal.querySelectorAll(".efme-cal__menu"),function(m){ if(!m.hidden){ m.hidden=true; var b=m.parentNode.querySelector(".efme-cal__btn"); if(b) b.setAttribute("aria-expanded","false"); } }); }
  function calIconSvg(){ return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'; }
  function renderCalControl(e){
    var wrap=document.createElement("div"); wrap.className="efme-cal"; var gurl=googleCalUrl(e); var ct=escapeHtml(plain(e.title));
    wrap.innerHTML='<button type="button" class="efme-cal__btn" aria-expanded="false" aria-controls="efme-calmenu">'+calIconSvg()+'<span>Add to Calendar</span></button>'+
      '<div class="efme-cal__menu" id="efme-calmenu" hidden>'+
        (gurl?'<a class="efme-cal__opt" data-cal="google" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(gurl)+'" aria-label="Add '+ct+' to Google Calendar (opens in a new tab)">Google Calendar</a>':'')+
        '<button type="button" class="efme-cal__opt" data-cal="ics" aria-label="Download '+ct+' calendar file (.ics) for Apple or Outlook">Apple / Outlook (.ics)</button>'+
      '</div>';
    var btn=wrap.querySelector(".efme-cal__btn"), menu=wrap.querySelector(".efme-cal__menu");
    btn.addEventListener("click",function(ev){ ev.stopPropagation(); var willOpen=menu.hidden; closeAllCalMenus(); menu.hidden=!willOpen; btn.setAttribute("aria-expanded", menu.hidden?"false":"true"); });
    var gx=wrap.querySelector('[data-cal="google"]'); if(gx) gx.addEventListener("click",function(){ track(EV_CAL,{ title:plain(e.title), method:"google" }); });
    wrap.querySelector('[data-cal="ics"]').addEventListener("click",function(){ track(EV_CAL,{ title:plain(e.title), method:"ics" }); downloadICS(e); });
    return wrap;
  }
  /* The Program column may hold a direct PDF URL, OR a bare anchor slug (e.g. "eso-gala")
     that deep-links into the concert programs page (PROGRAMS_URL) for unified tracking. */
  function resolveProgram(v){ v=String(v==null?"":v).trim(); if(!v) return null;
    if(/^[a-z0-9][a-z0-9\-]*$/i.test(v)){ var base=safeUrl(PROGRAMS_URL)||"/programs"; return { href:base+"#"+progSlug(v), isPdf:false }; }
    var u=safeUrl(v); if(!u) return null;
    return { href:u, isPdf:/\.pdf(\?|#|$)/i.test(u) }; }

  /* ---- tiny, SAFE Markdown -> HTML (rich text straight from sheet cells) ----
     Escape everything first, then re-introduce only **bold**, *italic*,
     [text](url) links, "-" bullet lists, line breaks (Alt+Enter newlines) and
     blank-line paragraphs. A legacy <br> in a cell is treated as a line break.
     No raw HTML can execute. So staff format naturally in the sheet — normal
     line breaks + simple Markdown, no <br> coordination. */
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
  /* Columns are matched by HEADER NAME (any of the aliases below), never by
     position — so you can add, remove or reorder columns in the sheet freely.
     A column whose header isn't listed here is simply ignored. The only thing
     that breaks a field is renaming its header to something off this list, so
     the lists are kept wide on purpose. Add more aliases here if you rename. */
  var ALIASES={
    image:["image","photo","img","picture","image url","photo url","img url","picture url","poster","flyer","event image","thumbnail"],
    start:["startdate","start","start date","date","event date","begin date","begins"],
    end:["enddate","end","end date","ends","finish","through","end day"],
    title:["title","event title","name","event name","event","headline","program title"],
    desc:["description","desc","description text","details","program","notes","summary","about","blurb","more details"],
    address:["address","location","venue","place","where","hall","room","address/venue"],
    time:["time","starttime","start time","event time","times"],
    link:["link","url","tickets","ticket","ticket link","ticketurl","ticket url","tickets url","tickets link","buy tickets","ticket page","event link","event url","rsvp","register","registration","more info"],
    button:["button text","button","buttontext","cta","cta text","button label","label","link text","btn text"],
    program:["program url","program pdf","program link","program download","program file","programurl","program (pdf)","program booklet","program notes pdf"],
    show:["showevent","show","show event","visible","published","display","active","live"]
  };
  function headerMap(h){ var m={}; h.forEach(function(x,i){ var k=String(x==null?"":x).trim().toLowerCase();
    Object.keys(ALIASES).forEach(function(fld){ if(m[fld]===undefined && ALIASES[fld].indexOf(k)!==-1) m[fld]=i; }); }); return m; }
  function cell(r,i){ return i===undefined?"":String(r[i]==null?"":r[i]).trim(); }
  function rowsToEvents(rows){
    if(!rows.length) return [];
    var m=headerMap(rows[0]), body=rows.slice(1);
    if(m.title===undefined && m.start===undefined){ return []; }
    return body.map(function(r){ return {
      image:cell(r,m.image), start:cell(r,m.start), end:cell(r,m.end), title:cell(r,m.title),
      desc:cell(r,m.desc), address:cell(r,m.address), time:cell(r,m.time), link:cell(r,m.link),
      button:cell(r,m.button), program:cell(r,m.program), show:cell(r,m.show) }; });
  }

  /* ---- dates (local, date-only) ---- */
  function parseDate(s){ s=String(s==null?"":s).trim(); if(!s) return null; var m;
    if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[1]-1,+m[2]); }
    var d=new Date(s); return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function dayKey(d){ return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  function monthKey(y,mo){ return y*12+mo; }
  function today(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }

  function coerce(e){ var s=parseDate(e.start)||parseDate(e.date), en=parseDate(e.end)||s;
    return { image:e.image||"", start:s, end:en||s, title:e.title||"", desc:e.desc||"",
             address:e.address||"", time:e.time||"", link:e.link||"", button:e.button||"", program:e.program||"", show:e.show,
             scheduleOnly:!!e.scheduleOnly }; }
  function visible(e){ return !(String(e.show||"").trim().toLowerCase().match(/^(no|false|0|hide|hidden)$/)); }

  /* ---- shared event modal ---- */
  var modal;
  function modalFocusables(){ if(!modal) return []; return Array.prototype.filter.call(
    modal.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'),
    function(el){ return el.offsetParent!==null; }); }
  function trapTab(e){ if(e.key!=="Tab") return; var f=modalFocusables(); if(!f.length) return;
    var first=f[0], last=f[f.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); } }
  function bgInert(on){ if(!host) return; Array.prototype.forEach.call(host.children,function(c){ if(c===modal) return;
    if(on) c.setAttribute("aria-hidden","true"); else c.removeAttribute("aria-hidden"); }); }
  function buildModal(){ if(modal) return; modal=document.createElement("div"); modal.className="efme-modal"; modal.hidden=true;
    modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true"); modal.setAttribute("aria-labelledby","efme-modal-title");
    modal.innerHTML='<div class="efme-modal__backdrop" data-efme-close></div>'+
      '<div class="efme-modal__panel">'+
        '<div class="efme-modal__media" data-m-media></div>'+
        '<button type="button" class="efme-modal__close" data-efme-close aria-label="Close">×</button>'+
        '<div class="efme-modal__body">'+
          '<div class="efme-modal__date" data-m-date></div>'+
          '<div class="efme-modal__title" id="efme-modal-title" role="heading" aria-level="2" data-m-title></div>'+
          '<div class="efme-modal__loc" data-m-loc></div>'+
          '<div class="efme-modal__desc" data-m-desc></div>'+
          '<a class="efme-modal__btn" data-m-btn target="_blank" rel="noopener noreferrer" href="#"></a>'+
          '<a class="efme-modal__program" data-m-program target="_blank" rel="noopener noreferrer" download href="#">'+
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'+
            '<span data-m-program-label>View / Download Program (PDF)</span>'+
          '</a>'+
          '<div class="efme-modal__cal" data-m-cal></div>'+
          '<a class="efme-modal__more" data-m-programs href="#">View concert programs →</a>'+
        '</div></div>';
    host.appendChild(modal);
    modal.addEventListener("click",function(e){ if(e.target.hasAttribute("data-efme-close")) closeModal(); });
    modal.addEventListener("keydown",trapTab);
    document.addEventListener("keydown",function(e){ if(modal.hidden || e.key!=="Escape") return;
      if(modal.querySelector(".efme-cal__menu:not([hidden])")){ closeAllCalMenus(); var cb=modal.querySelector(".efme-cal__btn"); if(cb) cb.focus(); }
      else closeModal(); });
    document.addEventListener("click",function(){ closeAllCalMenus(); });
  }
  var lastFocus;
  function fmtRange(e){ var d=e.start; var base=DOW[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate();
    if(e.end && e.end.getTime()!==e.start.getTime()) base+=" – "+MONTHS[e.end.getMonth()]+" "+e.end.getDate();
    return base + (e.time? "  ·  "+e.time : ""); }
  function openModal(e){ buildModal();
    var media=modal.querySelector("[data-m-media]"); media.innerHTML="";
    var miu=safeUrl(e.image);
    if(miu){ var im=document.createElement("img"); im.src=miu; im.alt=""; im.referrerPolicy="no-referrer";
      im.addEventListener("error",function(){ media.style.display="none"; }); media.style.display=""; media.appendChild(im); }
    else media.style.display="none";
    modal.querySelector("[data-m-date]").textContent=fmtRange(e);
    modal.querySelector("[data-m-title]").textContent=e.title;
    modal.querySelector("[data-m-loc]").innerHTML=htmlBreaks(e.address);
    modal.querySelector("[data-m-loc]").style.display=e.address?"":"none";
    modal.querySelector("[data-m-desc]").innerHTML=mdToHtml(e.desc);
    var btn=modal.querySelector("[data-m-btn]"); var url=ticketUrl(e.link);
    if(url){ btn.href=url; btn.textContent=(plain(e.button)||"Tickets"); btn.setAttribute("aria-label",(plain(e.button)||"Tickets")+" (opens in a new tab)"); btn.style.display=""; } else btn.style.display="none";
    var prog=modal.querySelector("[data-m-program]"), plbl=modal.querySelector("[data-m-program-label]"), pr=resolveProgram(e.program);
    if(pr){ prog.href=pr.href;
      if(pr.isPdf){ prog.setAttribute("download",""); if(plbl) plbl.textContent="View / Download Program (PDF)"; prog.setAttribute("aria-label","View or download program (PDF) for "+plain(e.title)+" (opens in a new tab)"); }
      else { prog.removeAttribute("download"); if(plbl) plbl.textContent="View Program"; prog.setAttribute("aria-label","View the program for "+plain(e.title)+" (opens in a new tab)"); }
      prog.onclick=function(){ track("program_link_click",{ title:plain(e.title), target_url:pr.href, is_pdf:!!pr.isPdf }); };
      prog.style.display=""; }
    else { prog.style.display="none"; prog.onclick=null; }
    var calc=modal.querySelector("[data-m-cal]"); calc.innerHTML=""; if(e.start){ calc.appendChild(renderCalControl(e)); calc.style.display=""; } else calc.style.display="none";
    var pl=modal.querySelector("[data-m-programs]"); var ppl=safeUrl(PROGRAMS_URL);
    if(pl){ if(ppl){ pl.href=ppl; pl.onclick=function(){ track("programs_page_click",{ from_event:plain(e.title) }); }; pl.style.display=""; } else pl.style.display="none"; }
    lastFocus=document.activeElement; modal.hidden=false; bgInert(true); modal.querySelector(".efme-modal__close").focus();
  }
  function closeModal(){ if(!modal) return; modal.hidden=true; bgInert(false); if(lastFocus&&document.contains(lastFocus)&&lastFocus.focus) lastFocus.focus(); }

  /* ---- UPCOMING LIST ---- */
  function renderList(events){
    var list=events.filter(function(e){ return !e.scheduleOnly; });   // master classes etc. stay Calendar/List-only
    if(HIDE_PAST){ var t=today(); var up=list.filter(function(e){ return e.end>=t; }); if(up.length) list=up; }
    list.sort(function(a,b){ return a.start-b.start; });
    var wrap=document.createElement("div"); wrap.className="efme-list";
    list.forEach(function(e){
      var card=document.createElement("article"); card.className="efme-card";
      var media="";
      var ciu=safeUrl(e.image);
      if(ciu){ media='<div class="efme-card__media"><img src="'+escapeHtml(ciu)+'" alt="" loading="lazy" referrerpolicy="no-referrer">'+
        '<div class="efme-card__badge" aria-hidden="true"><b>'+e.start.getDate()+'</b><span>'+MON3[e.start.getMonth()].toUpperCase()+'</span></div></div>'; }
      var dateStr=DOWFULL[e.start.getDay()]+", "+MONTHS[e.start.getMonth()]+" "+e.start.getDate()+", "+e.start.getFullYear();
      if(e.end && e.end.getTime()!==e.start.getTime()) dateStr=MONTHS[e.start.getMonth()]+" "+e.start.getDate()+" – "+MONTHS[e.end.getMonth()]+" "+e.end.getDate()+", "+e.end.getFullYear();
      var when=(e.time?escapeHtml(e.time)+" · ":"")+escapeHtml(dateStr);
      var where=e.address? '<div class="efme-card__where">'+htmlBreaks(e.address)+'</div>' : '';
      var url=ticketUrl(e.link);
      var btn=url? '<a class="efme-card__btn" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escapeHtml((plain(e.button)||"Tickets")+" for "+plain(e.title))+' (opens in a new tab)">'+escapeHtml(plain(e.button)||"Tickets")+'</a>' : '';
      card.innerHTML = media +
        '<div class="efme-card__body">'+
          '<div class="efme-card__title" role="heading" aria-level="3">'+escapeHtml(e.title)+'</div>'+
          '<div class="efme-card__when">'+when+'</div>'+
          '<div class="efme-card__desc">'+mdToHtml(e.desc)+'</div>'+
          where +
          '<div class="efme-card__spacer"></div>'+ btn +
        '</div>';
      wrap.appendChild(card);
    });
    if(!list.length){ wrap.innerHTML='<p style="color:var(--efme-role)">No upcoming events right now — check back soon.</p>'; }
    panels.upcoming.innerHTML=""; panels.upcoming.appendChild(wrap);
  }

  /* ---- CALENDAR ---- */
  var calState={ y:0, mo:0, minMK:0, maxMK:0, byDay:{}, events:[] };
  function buildCalIndex(events){
    var byDay={}, mks=[];
    events.forEach(function(e){ var k=dayKey(e.start); (byDay[k]=byDay[k]||[]).push(e); mks.push(monthKey(e.start.getFullYear(),e.start.getMonth())); });
    Object.keys(byDay).forEach(function(k){ byDay[k].sort(function(a,b){ return (a.time||"").localeCompare(b.time||""); }); });
    mks.sort(function(a,b){return a-b;});
    // peak month = the one with the most events
    var counts={}, peak=mks[0]||monthKey(today().getFullYear(),today().getMonth()), best=-1;
    mks.forEach(function(m){ counts[m]=(counts[m]||0)+1; if(counts[m]>best){ best=counts[m]; peak=m; } });
    calState.byDay=byDay; calState.events=events;
    calState.minMK=mks.length?mks[0]:peak; calState.maxMK=mks.length?mks[mks.length-1]:peak;
    calState.y=Math.floor(peak/12); calState.mo=peak%12;
  }
  function dowIndex(jsDay){ return (jsDay - WEEK_START + 7) % 7; }
  function venueOf(a){ a=String(a==null?"":a).replace(/<br\s*\/?>/gi,"\n"); return a.split("\n")[0].trim(); }

  /* a fresh month-nav header — both the grid and the list view get their own */
  function buildHead(){
    var head=document.createElement("div"); head.className="efme-cal__head";
    var prev=document.createElement("button"); prev.type="button"; prev.className="efme-cal__nav"; prev.setAttribute("aria-label","Previous month"); prev.innerHTML="‹";
    var label=document.createElement("div"); label.className="efme-cal__month"; label.textContent=MONTHS[calState.mo]+" "+calState.y;
    var next=document.createElement("button"); next.type="button"; next.className="efme-cal__nav"; next.setAttribute("aria-label","Next month"); next.innerHTML="›";
    var curMK=monthKey(calState.y,calState.mo);
    prev.disabled = curMK<=calState.minMK; next.disabled = curMK>=calState.maxMK;
    prev.addEventListener("click",function(){ step(-1); }); next.addEventListener("click",function(){ step(1); });
    head.appendChild(prev); head.appendChild(label); head.appendChild(next);
    return head;
  }

  function monthEventsList(){
    var daysIn=new Date(calState.y,calState.mo+1,0).getDate(), out=[];
    for(var ad=1; ad<=daysIn; ad++){ var ak=dayKey(new Date(calState.y,calState.mo,ad)); (calState.byDay[ak]||[]).forEach(function(e){ out.push(e); }); }
    return out;
  }

  /* EVENT CALENDAR tab — month grid (desktop) */
  function renderGrid(){
    var p=panels.calendar; p.innerHTML=""; p.appendChild(buildHead());
    var grid=document.createElement("div"); grid.className="efme-cal__grid";
    for(var i=0;i<7;i++){ var dh=document.createElement("div"); dh.className="efme-cal__dow"; dh.textContent=DOW[(WEEK_START+i)%7]; grid.appendChild(dh); }
    var first=new Date(calState.y,calState.mo,1); var lead=dowIndex(first.getDay());
    var daysIn=new Date(calState.y,calState.mo+1,0).getDate(); var tdy=today();
    for(var b=0;b<lead;b++){ var bl=document.createElement("div"); bl.className="efme-cal__cell efme-cal__cell--blank"; grid.appendChild(bl); }
    for(var d=1; d<=daysIn; d++){
      var cell=document.createElement("div"); cell.className="efme-cal__cell";
      var date=new Date(calState.y,calState.mo,d);
      var isToday=date.getTime()===tdy.getTime();
      if(isToday){ cell.className+=" efme-cal__cell--today"; cell.setAttribute("aria-current","date"); }
      var num=document.createElement("div"); num.className="efme-cal__daynum"; num.innerHTML=d+(isToday?'<span class="efme-sr-only"> (Today)</span>':''); cell.appendChild(num);
      var evs=calState.byDay[dayKey(date)]||[];
      if(evs.length) cell.className+=" efme-cal__cell--has";
      evs.slice(0,MAX_EV_PER_DAY).forEach(function(e){
        var chip=document.createElement("button"); chip.type="button"; chip.className="efme-cal__ev";
        chip.title=(e.time?e.time+" · ":"")+e.title;
        chip.setAttribute("aria-label",DOWFULL[e.start.getDay()]+", "+MONTHS[e.start.getMonth()]+" "+e.start.getDate()+(e.time?" at "+e.time:"")+" — "+plain(e.title));
        chip.innerHTML=(e.time?'<b>'+escapeHtml(e.time.replace(/:00\s/," "))+'</b> ':'')+escapeHtml(e.title);
        chip.addEventListener("click",function(){ openModal(e); });
        cell.appendChild(chip);
      });
      if(evs.length>MAX_EV_PER_DAY){ var more=document.createElement("button"); more.type="button"; more.className="efme-cal__ev efme-cal__more"; more.textContent="+"+(evs.length-MAX_EV_PER_DAY)+" more"; more.addEventListener("click",function(){ openModal(evs[0]); }); cell.appendChild(more); }
      grid.appendChild(cell);
    }
    p.appendChild(grid);
    var hint=document.createElement("p"); hint.className="efme-cal__hint"; hint.textContent="Tap an event for details and tickets.";
    p.appendChild(hint);
  }

  /* LIST VIEW tab — the whole season in one list (no month paging): every
     date, split into Upcoming (today onward) and Past (dimmed). */
  function renderAgenda(){
    var p=panels.list; p.innerHTML="";
    var all=calState.events.slice().sort(function(a,b){ return (a.start-b.start) || String(a.time||"").localeCompare(String(b.time||"")); });
    if(!all.length){ var em=document.createElement("p"); em.className="efme-cal__empty"; em.textContent="No events to display yet."; p.appendChild(em); return; }
    var t=today();
    var upcoming=all.filter(function(e){ return e.end>=t; });
    var past=all.filter(function(e){ return e.end<t; });
    var agenda=document.createElement("div"); agenda.className="efme-cal__agenda";
    function addGroup(label,list,isPast){
      if(!list.length) return;
      var h=document.createElement("div"); h.className="efme-agenda-group"+(isPast?" efme-agenda-group--past":"");
      h.setAttribute("role","heading"); h.setAttribute("aria-level","3"); h.textContent=label;
      agenda.appendChild(h);
      list.forEach(function(e){
        var meta=[DOWFULL[e.start.getDay()]]; if(e.time) meta.push(escapeHtml(e.time)); var v=venueOf(e.address); if(v) meta.push(escapeHtml(v));
        var row=document.createElement("button"); row.type="button"; row.className="efme-agenda-row"+(isPast?" efme-agenda-row--past":"");
        row.innerHTML='<span class="efme-agenda-date" aria-hidden="true"><b>'+e.start.getDate()+'</b><span>'+MON3[e.start.getMonth()].toUpperCase()+'</span></span>'+
          '<span class="efme-agenda-info"><span class="efme-agenda-title">'+escapeHtml(e.title)+'</span>'+
          '<span class="efme-agenda-time">'+meta.join(" · ")+'</span></span>'+
          '<span class="efme-agenda-arrow" aria-hidden="true">›</span>';
        row.setAttribute("aria-label",DOWFULL[e.start.getDay()]+", "+MONTHS[e.start.getMonth()]+" "+e.start.getDate()+", "+e.start.getFullYear()+(e.time?" at "+e.time:"")+" — "+plain(e.title)+(isPast?" (past)":""));
        row.addEventListener("click",function(){ openModal(e); });
        agenda.appendChild(row);
      });
    }
    addGroup("Upcoming",upcoming,false);
    addGroup("Past",past,true);
    p.appendChild(agenda);
  }

  function renderMonth(){ renderGrid(); renderAgenda(); }
  function step(dir){ var mk=monthKey(calState.y,calState.mo)+dir; if(mk<calState.minMK||mk>calState.maxMK) return;
    calState.y=Math.floor(mk/12); calState.mo=((mk%12)+12)%12; renderMonth(); sync(); }

  /* ---- tabs ---- */
  var TABS=[{key:"calendar",label:"Event Calendar"},{key:"list",label:"List View"},{key:"upcoming",label:"Upcoming Events"}];
  var buttons={}, active=null, ticketsHref="", subscribeHref="";
  function buildTabs(){ tabsBar.textContent="";
    var tl=document.createElement("div"); tl.className="efme__tablist"; tl.setAttribute("role","tablist"); tl.setAttribute("aria-label","Events views");
    TABS.forEach(function(t){ var b=document.createElement("button"); b.type="button"; b.className="efme-tab"; b.id="efme-tab-"+t.key;
      b.textContent=t.label; b.setAttribute("role","tab"); b.setAttribute("aria-selected","false"); b.setAttribute("aria-controls","efme-panel-"+t.key);
      b.addEventListener("click",function(){ activate(t.key,true); });
      b.addEventListener("keydown",onTabKey); tl.appendChild(b); buttons[t.key]=b; });
    tabsBar.appendChild(tl);
    if(ticketsHref){ var a=document.createElement("a"); a.className="efme-tab efme-tab--tickets";
      a.href=ticketsHref; a.target="_blank"; a.rel="noopener noreferrer";
      a.textContent=TICKETS_LABEL; a.setAttribute("aria-label",TICKETS_LABEL+" (opens in a new tab)");
      tabsBar.appendChild(a); }
    if(subscribeHref){ var s=document.createElement("a"); s.className="efme-tab efme-tab--subscribe";
      s.href=subscribeHref; s.target="_blank"; s.rel="noopener noreferrer";
      s.textContent=SUBSCRIBE_LABEL; s.setAttribute("aria-label",SUBSCRIBE_LABEL+" (opens in a new tab)");
      tabsBar.appendChild(s); } }
  function onTabKey(e){ var keys=TABS.map(function(t){return t.key;}).filter(function(k){ return !(k==="calendar" && !calAvail()); }); var i=keys.indexOf(active);
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); activate(keys[(i+1)%keys.length],true); buttons[active].focus(); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); activate(keys[(i-1+keys.length)%keys.length],true); buttons[active].focus(); } }
  function calAvail(){ return !(window.matchMedia && window.matchMedia("(max-width:820px)").matches); }
  function activate(key,hash){
    if(key==="calendar" && !calAvail()) key="list";   // the month grid is a desktop-only tab
    active=key;
    var calOff=!calAvail();
    TABS.forEach(function(t){ var on=t.key===key; var b=buttons[t.key];
      if(b){ b.setAttribute("aria-selected",on?"true":"false"); b.tabIndex=on?0:-1;
        if(t.key==="calendar"){ if(calOff){ b.setAttribute("hidden",""); b.setAttribute("aria-hidden","true"); } else { b.removeAttribute("hidden"); b.removeAttribute("aria-hidden"); } } }
      if(panels[t.key]){ panels[t.key].hidden=!on; panels[t.key].tabIndex=on?0:-1; } });
    if(hash){ try{ history.replaceState(null,"","#"+key); }catch(e){} }
    sync();
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
    if(window.matchMedia){ var mq=window.matchMedia("(max-width:820px)");
      var onmq=function(){ if(active==="calendar" && !calAvail()) activate("list",false); };
      try{ mq.addEventListener("change",onmq); }catch(e){ try{ mq.addListener(onmq); }catch(e2){} } }
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- boot ---- */
  function render(rawEvents){
    var events=rawEvents.map(coerce).filter(function(e){ return e.start && e.title; }).filter(visible);
    if(!events.length){ setStatus("No events to display yet."); return; }
    setStatus("");
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.setAttribute("role","heading"); titleEl.setAttribute("aria-level","2"); titleEl.hidden=false; }
    ticketsHref = ticketUrl(TICKETS_URL);
    if(!ticketsHref){ for(var i=0;i<events.length;i++){ var tu=ticketUrl(events[i].link); if(tu){ ticketsHref=tu; break; } } }
    subscribeHref = ticketUrl(SUBSCRIBE_URL);
    buildTabs();
    buildCalIndex(events);
    renderMonth();
    renderList(events);
    var fromHash=(location.hash||"").replace("#","").toLowerCase();
    activate(buttons[fromHash]?fromHash:(DEFAULT_TAB in buttons?DEFAULT_TAB:"calendar"), false);
    window.addEventListener("hashchange",function(){ var k=(location.hash||"").replace("#","").toLowerCase(); if(buttons[k]) activate(k,false); });
    wire();
  }
  function urlOk(u){ return u && !/PASTE|YOUR_|^\s*$/.test(u); }
  /* try the given URLs in order; resolve to parsed events ([] if all fail) */
  function fetchEvents(urls){
    return new Promise(function(resolve){
      (function tryNext(i){ if(i>=urls.length){ resolve([]); return; }
        fetch(urls[i],{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
          .then(function(t){ var ev=rowsToEvents(parseCSV(t)); if(!ev.length) throw 0; resolve(ev); })
          .catch(function(){ tryNext(i+1); }); })(0);
    });
  }
  function evKey(e){ var d=parseDate(e.start)||parseDate(e.date); return String(e.title==null?"":e.title).trim().toLowerCase()+"|"+(d?dayKey(d):""); }
  function start(){
    var mainUrls=[SHEET_CSV_URL].concat(SHEET_CSV_FALLBACKS||[]).filter(urlOk);
    if(!mainUrls.length){ render(FALLBACK_DATA); return; }
    setStatus("Loading events…");
    fetchEvents(mainUrls).then(function(main){
      if(!main.length) main=FALLBACK_DATA;                 // safety net so the page is never blank
      var schedUrls=(SCHEDULE_CSV_URLS||[]).filter(urlOk);
      if(!schedUrls.length){ render(main); return; }
      Promise.all(schedUrls.map(function(u){ return fetchEvents([u]); })).then(function(lists){
        var all=main.slice(), seen={};
        main.forEach(function(e){ seen[evKey(e)]=1; });
        lists.forEach(function(l){ l.forEach(function(e){ var k=evKey(e);
          if(seen[k]) return;                 // skip dupes (incl. a not-yet-created tab that gviz answers with the main sheet)
          seen[k]=1; e.scheduleOnly=true; all.push(e); }); });
        render(all);
      }, function(){ render(main); });
    });
  }
  function boot(){
    host = document.getElementById("efm-events");
    if(!host) return;   // widget not on this page -> no-op (paste order irrelevant)
    titleEl = host.querySelector("[data-efme-title]");
    tabsBar = host.querySelector("[data-efme-tabs]");
    statusEl= host.querySelector("[data-efme-status]"); if(statusEl) statusEl.setAttribute("role","status");
    if(tabsBar){ tabsBar.removeAttribute("role"); tabsBar.removeAttribute("aria-label"); }
    panels  = { calendar: host.querySelector('[data-efme-panel="calendar"]'),
                list:     host.querySelector('[data-efme-panel="list"]'),
                upcoming: host.querySelector('[data-efme-panel="upcoming"]') };
    Object.keys(panels).forEach(function(k){ if(panels[k]) panels[k].id="efme-panel-"+k; });
    start();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
