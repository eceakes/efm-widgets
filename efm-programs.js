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

  var MODULE_TITLE = "Concert Programs";          /* "" hides it */
  var INTRO        = "Download the program for each concert and masterclass of the season.";  /* "" hides */

  var TABS = [{key:"concerts",label:"Concert Programs"},{key:"masterclasses",label:"Masterclasses"},{key:"programbook",label:"Program Book"}];
  var DEFAULT_TAB = "concerts";

  /* Program Book tab — an interactive flipbook embed with a downloadable PDF
     (the PDF is also the screen-reader-accessible fallback). Either URL may be ""
     (blank both to hide the tab). */
  var PROGRAM_BOOK_EMBED_URL = "https://online.flippingbook.com/view/416920229/";   /* flipbook viewer ("" -> show the PDF inline instead) */
  var PROGRAM_BOOK_URL   = "https://irp.cdn-website.com/1e6f3c7e/files/uploaded/11x17+-+EFM+PROGRAM+BOOK+-+11x17-d59928dd.pdf";   /* PDF: download + screen-reader-accessible alternative to the flipbook */
  var PROGRAM_BOOK_TITLE = "2026 Program Book";
  var PROGRAM_BOOK_BLURB = "Flip through the season program book below, or download the PDF.";

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
    if(g.desc){ var d=document.createElement("div"); d.className="efmpr-group__desc"; d.innerHTML=mdToHtml(g.desc); body.appendChild(d); }
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

  /* ---- Program Book panel: inline PDF viewer + download (lazy-loaded on tab activate) ---- */
  var bookFrame=null;
  function renderProgramBook(panelEl, book){
    var pdf=httpUrl(book.pdf), embed=httpUrl(book.embed);
    var viewer=embed||(pdf?pdf+"#view=FitH":""), dl=pdf||embed, isFlip=!!embed;
    var frameTitle=escapeHtml(PROGRAM_BOOK_TITLE+(isFlip?" (interactive flipbook)":" (PDF document viewer)"));
    var btnLabel=pdf?"View / Download (PDF)":"Open the program book";
    var btnAria=escapeHtml(pdf?("View or download "+PROGRAM_BOOK_TITLE+" (PDF, opens in a new tab)"):("Open "+PROGRAM_BOOK_TITLE+" (opens in a new tab)"));
    var srNote=(isFlip&&pdf)?'<p class="efmpr-sr-only">The program book below is shown as an interactive flipbook. For a screen-reader-accessible version, use the "View / Download (PDF)" button above.</p>':'';
    panelEl.innerHTML="";
    var card=document.createElement("div"); card.className="efmpr-book";
    card.innerHTML='<div class="efmpr-book__head">'+
        '<div class="efmpr-book__meta"><div class="efmpr-book__title" role="heading" aria-level="3">'+escapeHtml(PROGRAM_BOOK_TITLE)+'</div>'+
          (PROGRAM_BOOK_BLURB?'<div class="efmpr-book__blurb">'+escapeHtml(PROGRAM_BOOK_BLURB)+'</div>':'')+'</div>'+
        '<a class="efmpr-book__btn" href="'+escapeHtml(dl)+'" target="_blank" rel="noopener noreferrer"'+(pdf?' download':'')+' data-book-dl aria-label="'+btnAria+'">'+downloadIconSvg()+'<span>'+escapeHtml(btnLabel)+'</span></a>'+
      '</div>'+
      '<div class="efmpr-book__viewer" aria-busy="false">'+srNote+'<iframe class="efmpr-book__frame" title="'+frameTitle+'" loading="lazy" allowfullscreen scrolling="no" data-src="'+escapeHtml(viewer)+'"></iframe>'+
        '<p class="efmpr-book__fallback">Trouble viewing it here? <a href="'+escapeHtml(embed||dl)+'" target="_blank" rel="noopener noreferrer">Open the program book in a new tab.</a>'+(pdf&&isFlip?' Or <a href="'+escapeHtml(pdf)+'" target="_blank" rel="noopener noreferrer" download>download the PDF</a>.':'')+'</p></div>';
    panelEl.appendChild(card);
    bookFrame=card.querySelector(".efmpr-book__frame");
    var viewerEl=card.querySelector(".efmpr-book__viewer");
    if(bookFrame&&viewerEl) bookFrame.addEventListener("load",function(){ viewerEl.setAttribute("aria-busy","false"); });
    var dlbtn=card.querySelector("[data-book-dl]");
    if(dlbtn) dlbtn.addEventListener("click",function(){ track(EV_DOWNLOAD,{ concert:"Program Book", item_type:"Program Book", item_title:PROGRAM_BOOK_TITLE, file_name:fileNameOf(dl), link_url:dl }); });
  }
  function loadBookFrame(){ if(bookFrame && !bookFrame.getAttribute("src")){ var s=bookFrame.getAttribute("data-src"); if(s){ var v=bookFrame.parentNode; if(v&&v.setAttribute) v.setAttribute("aria-busy","true"); bookFrame.setAttribute("src",s); } } }

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
    var bpdf=httpUrl(PROGRAM_BOOK_URL), bembed=httpUrl(PROGRAM_BOOK_EMBED_URL);
    var content={ concerts:buildGroups(data.events), masterclasses:buildGroups(data.masterclasses),
                  programbook: (bpdf||bembed)? [{ pdf:bpdf, embed:bembed }] : [] };
    var keys=TABS.map(function(t){return t.key;}).filter(function(k){ return content[k] && content[k].length; });
    if(!keys.length){ setStatus("Programs will be posted here soon — check back closer to each concert."); return; }
    setStatus("");
    if(MODULE_TITLE){ titleEl.textContent=MODULE_TITLE; titleEl.setAttribute("role","heading"); titleEl.setAttribute("aria-level","2"); titleEl.hidden=false; }
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
    document.addEventListener("click",function(){ closeAllCalMenus(); });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape") closeAllCalMenus(); });
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- boot ---- */
  function fetchRows(url){ return fetch(url,{cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.text(); })
    .then(function(t){ return parseCSV(t); }).catch(function(){ return []; }); }
  function headerSig(rows){ return (rows&&rows[0])? rows[0].map(function(c){ return String(c==null?"":c).trim().toLowerCase(); }).join("|") : ""; }
  function start(){
    setStatus("Loading programs…");
    Promise.all([ fetchRows(EVENTS_CSV), fetchRows(MASTERCLASS_CSV) ]).then(function(res){
      var evRows=res[0], mcRows=res[1], evSig=headerSig(evRows);
      /* gviz returns the FIRST sheet when a named tab doesn't exist — if "Masterclasses"
         comes back identical to the events sheet, that tab is missing: treat as empty. */
      if(evSig && headerSig(mcRows)===evSig) mcRows=[];
      render({ events:parseEventRows(evRows), masterclasses:parseEventRows(mcRows) });
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
