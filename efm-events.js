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
    if(/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;   /* bare domain */
    return "";
  }
  function ticketUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }   /* internal ids like "ev1" make no button */

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
      button:cell(r,m.button), show:cell(r,m.show) }; });
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
             address:e.address||"", time:e.time||"", link:e.link||"", button:e.button||"", show:e.show,
             scheduleOnly:!!e.scheduleOnly }; }
  function visible(e){ return !(String(e.show||"").trim().toLowerCase().match(/^(no|false|0|hide|hidden)$/)); }

  /* ---- shared event modal ---- */
  var modal;
  function buildModal(){ if(modal) return; modal=document.createElement("div"); modal.className="efme-modal"; modal.hidden=true;
    modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true");
    modal.innerHTML='<div class="efme-modal__backdrop" data-efme-close></div>'+
      '<div class="efme-modal__panel" role="document">'+
        '<div class="efme-modal__media" data-m-media></div>'+
        '<button type="button" class="efme-modal__close" data-efme-close aria-label="Close">×</button>'+
        '<div class="efme-modal__body">'+
          '<div class="efme-modal__date" data-m-date></div>'+
          '<div class="efme-modal__title" data-m-title></div>'+
          '<div class="efme-modal__loc" data-m-loc></div>'+
          '<div class="efme-modal__desc" data-m-desc></div>'+
          '<a class="efme-modal__btn" data-m-btn target="_blank" rel="noopener noreferrer" href="#"></a>'+
        '</div></div>';
    host.appendChild(modal);
    modal.addEventListener("click",function(e){ if(e.target.hasAttribute("data-efme-close")) closeModal(); });
    document.addEventListener("keydown",function(e){ if(!modal.hidden && e.key==="Escape") closeModal(); });
  }
  var lastFocus;
  function fmtRange(e){ var d=e.start; var base=DOW[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate();
    if(e.end && e.end.getTime()!==e.start.getTime()) base+=" – "+MONTHS[e.end.getMonth()]+" "+e.end.getDate();
    return base + (e.time? "  ·  "+e.time : ""); }
  function openModal(e){ buildModal();
    var media=modal.querySelector("[data-m-media]"); media.innerHTML="";
    if(e.image){ var im=document.createElement("img"); im.src=e.image; im.alt=e.title;
      im.addEventListener("error",function(){ media.style.display="none"; }); media.style.display=""; media.appendChild(im); }
    else media.style.display="none";
    modal.querySelector("[data-m-date]").textContent=fmtRange(e);
    modal.querySelector("[data-m-title]").textContent=e.title;
    modal.querySelector("[data-m-loc]").innerHTML=htmlBreaks(e.address);
    modal.querySelector("[data-m-loc]").style.display=e.address?"":"none";
    modal.querySelector("[data-m-desc]").innerHTML=mdToHtml(e.desc);
    var btn=modal.querySelector("[data-m-btn]"); var url=ticketUrl(e.link);
    if(url){ btn.href=url; btn.textContent=(plain(e.button)||"Tickets"); btn.style.display=""; } else btn.style.display="none";
    lastFocus=document.activeElement; modal.hidden=false; modal.querySelector(".efme-modal__close").focus();
  }
  function closeModal(){ if(!modal) return; modal.hidden=true; if(lastFocus&&lastFocus.focus) lastFocus.focus(); }

  /* ---- UPCOMING LIST ---- */
  function renderList(events){
    var list=events.filter(function(e){ return !e.scheduleOnly; });   // master classes etc. stay Calendar/List-only
    if(HIDE_PAST){ var t=today(); var up=list.filter(function(e){ return e.end>=t; }); if(up.length) list=up; }
    list.sort(function(a,b){ return a.start-b.start; });
    var wrap=document.createElement("div"); wrap.className="efme-list";
    list.forEach(function(e){
      var card=document.createElement("article"); card.className="efme-card";
      var media="";
      if(e.image){ media='<div class="efme-card__media"><img src="'+escapeHtml(e.image)+'" alt="'+escapeHtml(e.title)+'" loading="lazy">'+
        '<div class="efme-card__badge"><b>'+e.start.getDate()+'</b><span>'+MON3[e.start.getMonth()].toUpperCase()+'</span></div></div>'; }
      var dateStr=DOWFULL[e.start.getDay()]+", "+MONTHS[e.start.getMonth()]+" "+e.start.getDate()+", "+e.start.getFullYear();
      if(e.end && e.end.getTime()!==e.start.getTime()) dateStr=MONTHS[e.start.getMonth()]+" "+e.start.getDate()+" – "+MONTHS[e.end.getMonth()]+" "+e.end.getDate()+", "+e.end.getFullYear();
      var when=(e.time?escapeHtml(e.time)+" · ":"")+escapeHtml(dateStr);
      var where=e.address? '<div class="efme-card__where">'+htmlBreaks(e.address)+'</div>' : '';
      var url=ticketUrl(e.link);
      var btn=url? '<a class="efme-card__btn" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(plain(e.button)||"Tickets")+'</a>' : '';
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
      if(date.getTime()===tdy.getTime()) cell.className+=" efme-cal__cell--today";
      var num=document.createElement("div"); num.className="efme-cal__daynum"; num.textContent=d; cell.appendChild(num);
      var evs=calState.byDay[dayKey(date)]||[];
      if(evs.length) cell.className+=" efme-cal__cell--has";
      evs.slice(0,MAX_EV_PER_DAY).forEach(function(e){
        var chip=document.createElement("button"); chip.type="button"; chip.className="efme-cal__ev";
        chip.title=(e.time?e.time+" · ":"")+e.title;
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
        row.innerHTML='<span class="efme-agenda-date"><b>'+e.start.getDate()+'</b><span>'+MON3[e.start.getMonth()].toUpperCase()+'</span></span>'+
          '<span class="efme-agenda-info"><span class="efme-agenda-title">'+escapeHtml(e.title)+'</span>'+
          '<span class="efme-agenda-time">'+meta.join(" · ")+'</span></span>'+
          '<span class="efme-agenda-arrow" aria-hidden="true">›</span>';
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
    TABS.forEach(function(t){ var b=document.createElement("button"); b.type="button"; b.className="efme-tab"; b.id="efme-tab-"+t.key;
      b.textContent=t.label; b.setAttribute("role","tab"); b.setAttribute("aria-selected","false");
      b.addEventListener("click",function(){ activate(t.key,true); });
      b.addEventListener("keydown",onTabKey); tabsBar.appendChild(b); buttons[t.key]=b; });
    if(ticketsHref){ var a=document.createElement("a"); a.className="efme-tab efme-tab--tickets";
      a.href=ticketsHref; a.target="_blank"; a.rel="noopener noreferrer";
      a.textContent=TICKETS_LABEL; a.setAttribute("aria-label",TICKETS_LABEL+" (opens in a new tab)");
      tabsBar.appendChild(a); }
    if(subscribeHref){ var s=document.createElement("a"); s.className="efme-tab efme-tab--subscribe";
      s.href=subscribeHref; s.target="_blank"; s.rel="noopener noreferrer";
      s.textContent=SUBSCRIBE_LABEL; s.setAttribute("aria-label",SUBSCRIBE_LABEL+" (opens in a new tab)");
      tabsBar.appendChild(s); } }
  function onTabKey(e){ var keys=TABS.map(function(t){return t.key;}); var i=keys.indexOf(active);
    if(e.key==="ArrowRight"||e.key==="ArrowDown"){ e.preventDefault(); activate(keys[(i+1)%keys.length],true); buttons[active].focus(); }
    else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){ e.preventDefault(); activate(keys[(i-1+keys.length)%keys.length],true); buttons[active].focus(); } }
  function calAvail(){ return !(window.matchMedia && window.matchMedia("(max-width:820px)").matches); }
  function activate(key,hash){
    if(key==="calendar" && !calAvail()) key="list";   // the month grid is a desktop-only tab
    active=key;
    TABS.forEach(function(t){ var on=t.key===key; if(buttons[t.key]){ buttons[t.key].setAttribute("aria-selected",on?"true":"false"); buttons[t.key].tabIndex=on?0:-1; }
      if(panels[t.key]) panels[t.key].hidden=!on; });
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
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.hidden=false; }
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
    statusEl= host.querySelector("[data-efme-status]");
    panels  = { calendar: host.querySelector('[data-efme-panel="calendar"]'),
                list:     host.querySelector('[data-efme-panel="list"]'),
                upcoming: host.querySelector('[data-efme-panel="upcoming"]') };
    start();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
