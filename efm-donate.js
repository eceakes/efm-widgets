(function(){
  "use strict";

  /* ============================================================
     EFM Donate: a single-page giving module for /donate.
     Host id #efm-donate, class prefix efmd. Config-driven (no sheet):
     every label, amount, fund and URL is a var below, so editing the
     copy is a code change (push + bump the @sha, like the other widgets).

     Sections (each hides itself when its config is blank):
       0 eyebrow ribbon          5 giving ladder (deep-linked tiers)
       1 hero + dual CTA         6 "be a founder" band
       2 "every gift" thesis     7 legacy + stat strip
       3 three named funds       8 more ways to give
       4 (thesis flows into 3)   9 trust + contact footer

     The donation platform behind ahrpferd.donorsupport.co is Fundraise Up.
     Its URL API is VERIFIED working on this page: a link with
       ?amount=<whole-dollars>&recurring=<once|monthly>
     opens the form with the amount pre-filled and frequency pre-selected
     (one residual "Donate" tap on the form is expected; the prefill carries
     through). Cents are rejected; use whole dollars. To target a specific
     fund, append &designationId=<ID from the Fundraise Up dashboard>; the
     value is an internal id (e.g. EHHJ9R36), NOT the display label. Those
     ids are blank below until Eric pulls them from the dashboard; with a
     blank id the button still works, it just lands on the default fund.
     ============================================================ */

  /* ---------- page header ---------- */
  var PAGE_TITLE = "Support the Festival";   /* the page's own title, shown at the top above the hero; "" hides it */

  /* ---------- HERO + framing ---------- */
  var EYEBROW   = "Inaugural Season 2026 | Guilford College, Greensboro";
  var HERO_TITLE = "Help bring the music home.";
  var HERO_COPY  =
    "For more than sixty years, summer in Greensboro has meant young musicians from around the world gathering at Guilford College to study, to perform, and to grow. This summer the Eastern Festival of Music opens its inaugural season, continuing a legacy of great music-making founded here in 1961, with Gerard Schwarz returning to the podium as music director. Your gift is what makes the first notes of this new chapter possible.";
  var HERO_IMAGE = "";   /* optional cleared photo (orchestra at Dana Auditorium / a young artist). "" -> text-only hero, no broken image. */
  var HERO_PRIMARY_LABEL = "Choose your gift";      /* scrolls to the giving ladder */
  var HERO_GHOST_LABEL   = "More ways to give";     /* scrolls to "ways to give" */

  /* ---------- the giving platform ---------- */
  /* Fundraise Up campaign that every gift link routes to. To use a DIFFERENT
     campaign on a specific page, set data-efmd-donate-url="..." on the
     #efm-donate host div in that page's embed; it overrides this default. */
  var DONATE_BASE = "https://ahrpferd.donorsupport.co/page/outreachdonations";
  var DEFAULT_FREQ = "monthly";   /* "monthly" or "once": which ladder is shown first (Fundraise Up's own default is monthly) */

  /* Suggested amounts. amount = WHOLE DOLLARS (no $ or commas). label = a short
     recognition caption ("" hides it). popular:true puts the "Most popular" ribbon
     on one tier. impact = an OPTIONAL one-line outcome ("" hides). Leave impact
     blank until Eric confirms real per-gift costs; do not assert "$X buys Y" without it. */
  var TIERS_ONCE = [
    { amount:50,   label:"Friend",            impact:"" },
    { amount:100,  label:"Supporter",         impact:"", popular:true },
    { amount:250,  label:"Benefactor",        impact:"" },
    { amount:500,  label:"Patron",            impact:"" },
    { amount:1000, label:"Conductor's Circle",impact:"" },
    { amount:2500, label:"Maestro's Circle",  impact:"" }
  ];
  var TIERS_MONTHLY = [
    { amount:10,  label:"Friend",     impact:"" },
    { amount:25,  label:"Sustainer",  impact:"", popular:true },
    { amount:50,  label:"Supporter",  impact:"" },
    { amount:100, label:"Benefactor", impact:"" },
    { amount:250, label:"Patron",     impact:"" }
  ];
  var LADDER_TITLE = "Choose your gift";
  var LADDER_NOTE  = "Prefer a different amount? Choose Other on the next screen. Gifts are processed securely; we never see your card number.";
  var OTHER_LABEL  = "Other amount";

  /* ---------- "every gift has a destination" + three named funds ---------- */
  var THESIS_TITLE = "Every gift has a destination.";
  var THESIS_COPY  = "When you give, you choose where your support goes. Pick a fund below, or give where it is needed most.";
  /* share = an honest qualitative label ("Largest share" / "Significant share" / "Growing share").
     Swap to a real percentage only when Eric confirms an allocation. designationId routes the
     fund's button to that fund in Fundraise Up ("" -> default fund, still works). */
  var FUNDS = [
    { name:"Student Scholarships & Housing",
      blurb:"We keep the festival within reach for talented young musicians, including housing for students who travel here from around the world.",
      share:"Largest share", designationId:"" },
    { name:"Faculty & Guest Artists",
      blurb:"We bring world-class musicians on every instrument to teach, mentor, and perform alongside the next generation.",
      share:"Significant share", designationId:"" },
    { name:"Music in the Community",
      blurb:"We keep great music accessible across Greensboro and the Piedmont, on stage at Dana Auditorium and beyond.",
      share:"Growing share", designationId:"" }
  ];
  var FUND_BTN_LABEL = "Give to this fund";

  /* ---------- "be a founder" band ---------- */
  var FOUNDERS_TITLE = "Be a founder of the 2026 season";
  var FOUNDERS_COPY  =
    "Every institution has a founding moment, and this is ours. Supporters who help launch the inaugural season are recognized as founding members of the Eastern Festival of Music. Your name belongs to the summer the music came home.";
  /* Recognition levels ship hidden until Eric defines real thresholds + benefits.
     To turn them on, add entries like { name:"Conductor's Circle", from:"$1,000", benefit:"Program-book listing" }. */
  var FOUNDERS_CIRCLES = [];

  /* ---------- legacy + stat strip ---------- */
  var LEGACY_TITLE = "A tradition worth continuing";
  var LEGACY_BODY  =
    "In 1961, Sheldon Morgenstern founded a summer music festival on the campus of Guilford College in Greensboro, and over the decades it grew into a celebrated home for young artists, among them the trumpeter Wynton Marsalis and the cellist Sterling Elliott. The Eastern Festival of Music is a new festival, created to honor that legacy and carry its spirit forward on the same Greensboro campus. Gerard Schwarz, who served as that festival's music director for nearly twenty years, now leads the Eastern Festival of Music through 2030. Your support is what brings this new chapter to life for the next generation of musicians.";
  /* These figures belong to the ORIGINAL festival Morgenstern founded, NOT to EFM.
     STATS_CAPTION scopes them as an inherited legacy so nothing reads as EFM's own
     track record. "" hides the caption. Confirm the numbers with Eric before launch. */
  var STATS_CAPTION = "The legacy we carry forward";
  var STATS = [
    { big:"60+",     small:"years of summer music-making" },
    { big:"10,000+", small:"musicians from 40 countries" },
    { big:"4,500+",  small:"alumni worldwide" },
    { big:"5 weeks", small:"each summer at Guilford College" }
  ];

  /* ---------- more ways to give ---------- */
  var WAYS_TITLE = "More ways to give";
  /* contact:true renders a "Contact us" button when CONTACT_EMAIL is set (for gifts that need a person). */
  var WAYS = [
    { title:"Donor-Advised Fund", how:"Recommend a grant to the Eastern Festival of Music from your donor-advised fund.", contact:true },
    { title:"Gifts of Stock",     how:"Give appreciated securities and put your full gift to work. Contact us for transfer details.", contact:true },
    { title:"Employer Matching",  how:"Many employers double their employees' gifts. Check with your HR department to multiply your impact." },
    { title:"Multi-Year Pledge",  how:"Commit a gift over several years and help us build on a steady foundation.", contact:true },
    { title:"Planned & Legacy Gifts", how:"Include the festival in your estate plans and help secure its future for generations to come.", contact:true },
    { title:"Gift by Check",      how:"Mail your gift to: Eastern Festival of Music, 3912 Battleground Ave, Suite 112, Box 323, Greensboro, NC 27410." }
  ];

  /* ---------- trust + contact footer ---------- */
  var CONTACT_EMAIL = "";   /* e.g. "give@easternfestivalofmusic.org"; "" hides the contact buttons/line */
  var CONTACT_PHONE = "";   /* e.g. "(336) 555-0100"; "" hides */
  var TRUST_ALWAYS =
    "The Eastern Festival of Music continues a legacy of music-making founded in Greensboro in 1961. Your gift is processed securely; we never see or store your card number.";
  /* Tax line stays HIDDEN until Eric confirms the 501(c)(3) determination. Fill BOTH to show it. */
  var LEGAL_NAME = "";      /* registered legal name from the IRS determination letter */
  var EIN        = "";      /* e.g. "XX-XXXXXXX" */

  /* ---------- GA4 events (no-op without gtag/dataLayer) ---------- */
  var EV_DONATE = "donate_click";
  var EV_WAY    = "give_method_click";

  /* ====================== ENGINE ====================== */
  var host, rootEl, statusEl;
  var activeFreq = (DEFAULT_FREQ==="once") ? "once" : "monthly";

  function escapeHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function safeUrl(u){ u=String(u==null?"":u).trim();
    if(/^(javascript|data|vbscript):/i.test(u)) return "";
    if(/^[\\/]{2}/.test(u) || /^\\/.test(u)) return "";
    if(/^(https?:\/\/|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if(/^[a-z0-9.\-]+\.[a-z]{2,}([\/?#].*)?$/i.test(u)) return "https://"+u;
    return "";
  }
  function httpUrl(u){ u=safeUrl(u); return /^https?:\/\//i.test(u)?u:""; }

  /* tiny safe Markdown for body copy (**bold**, *italic*, [text](url), <br>, - bullets) */
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

  /* ---- analytics ---- */
  function utmParams(){ var p={}; try{ var s=new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){ var v=s.get(k); if(v) p[k]=v; }); }catch(e){} return p; }
  function track(name, params){ try{ var d=Object.assign({}, params||{}, utmParams());
    if(typeof window.gtag==="function"){ window.gtag("event", name, d); return; }
    if(window.dataLayer && typeof window.dataLayer.push==="function"){ window.dataLayer.push(Object.assign({event:name}, d)); return; } }catch(e){} }

  /* ---- deep link to the Fundraise Up form ---- */
  function donateUrl(amount, recurring, designationId){
    var q=[];
    if(amount!=null && amount!=="" && +amount>0) q.push("amount="+encodeURIComponent(Math.round(+amount)));
    if(recurring) q.push("recurring="+encodeURIComponent(recurring));
    if(designationId) q.push("designationId="+encodeURIComponent(designationId));
    return q.length ? DONATE_BASE+"?"+q.join("&") : DONATE_BASE;
  }
  function fmtMoney(n){ n=Math.round(+n||0); return "$"+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
  function heading(level, cls, text){ return '<div class="'+cls+'" role="heading" aria-level="'+level+'">'+escapeHtml(text)+'</div>'; }

  /* ---- in-widget smooth scroll for the hero CTAs: move focus to the
         destination heading so keyboard + screen-reader users land there ---- */
  function scrollToId(id){ var el=host.querySelector("#"+id); if(!el) return;
    var smooth=!(window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches);
    try{ el.scrollIntoView({behavior:smooth?"smooth":"auto", block:"start"}); }catch(e){ el.scrollIntoView(); }
    var f=el.querySelector('[role="heading"]'); if(f){ f.setAttribute("tabindex","-1"); try{ f.focus({preventScroll:true}); }catch(e2){} } }

  /* ---- polite screen-reader announcer (for dynamic updates like the freq toggle) ---- */
  function announce(msg){ var l=rootEl && rootEl.querySelector("[data-efmd-live]"); if(!l) return;
    l.textContent=""; try{ window.requestAnimationFrame(function(){ l.textContent=msg; }); }catch(e){ l.textContent=msg; } }

  /* ====================== SECTIONS ====================== */
  function secPageTitle(){ if(!PAGE_TITLE) return ""; return heading(1,"efmd-pagetitle", PAGE_TITLE); }

  function secEyebrow(){ if(!EYEBROW) return "";
    return '<div class="efmd-ribbon">'+escapeHtml(EYEBROW)+'</div>'; }

  function secHero(){
    var bg = HERO_IMAGE ? httpUrl(HERO_IMAGE) : "";
    var btns="";
    btns+='<button type="button" class="efmd-btn efmd-btn--primary" data-scroll="efmd-give">'+escapeHtml(HERO_PRIMARY_LABEL)+'</button>';
    if(waysShown()) btns+='<button type="button" class="efmd-btn efmd-btn--ghost" data-scroll="efmd-ways">'+escapeHtml(HERO_GHOST_LABEL)+'</button>';
    return '<section class="efmd-hero'+(bg?' efmd-hero--photo':'')+'"'+(bg?' style="background-image:linear-gradient(135deg,rgba(14,23,142,.86),rgba(10,17,112,.92)),url(\''+escapeHtml(bg)+'\')"':'')+'>'+
        '<div class="efmd-hero__inner">'+
          heading(2,"efmd-hero__title", HERO_TITLE)+
          (HERO_COPY?'<p class="efmd-hero__copy">'+escapeHtml(HERO_COPY)+'</p>':'')+
          '<div class="efmd-hero__actions">'+btns+'</div>'+
        '</div></section>';
  }

  function secThesis(){ if(!THESIS_TITLE && !THESIS_COPY) return "";
    return '<section class="efmd-thesis">'+
      (THESIS_TITLE?heading(2,"efmd-thesis__title", THESIS_TITLE):"")+
      (THESIS_COPY?'<p class="efmd-thesis__copy">'+escapeHtml(THESIS_COPY)+'</p>':"")+
    '</section>'; }

  function secFunds(){ if(!FUNDS.length) return "";
    var cards=FUNDS.map(function(f){ if(!f || !f.name) return "";
      var url=donateUrl("", "", f.designationId);
      /* name first in the DOM (screen-reader reading order); the "share" chip
         is floated visually above it via CSS order, so sighted order is unchanged */
      return '<div class="efmd-fund">'+
        heading(3,"efmd-fund__name", f.name)+
        (f.share?'<span class="efmd-fund__chip">'+escapeHtml(f.share)+'</span>':"")+
        (f.blurb?'<p class="efmd-fund__blurb">'+escapeHtml(f.blurb)+'</p>':"")+
        '<a class="efmd-btn efmd-btn--ink efmd-fund__btn" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer" '+
          'data-give="fund" data-fund="'+escapeHtml(f.name)+'" aria-label="'+escapeHtml(FUND_BTN_LABEL+": "+f.name)+' (opens in a new tab)">'+escapeHtml(FUND_BTN_LABEL)+'</a>'+
      '</div>'; }).join("");
    return '<section class="efmd-funds">'+
      '<div class="efmd-funds__lead">'+heading(2,"efmd-funds__title","Where your gift goes")+'</div>'+
      '<div class="efmd-funds__grid">'+cards+'</div></section>'; }

  function tierCard(t, freq){
    var url=donateUrl(t.amount, freq, t.designationId);
    return '<a class="efmd-tier'+(t.popular?' efmd-tier--pop':'')+'" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer" '+
        'data-give="tier" data-amount="'+escapeHtml(t.amount)+'" '+
        'aria-label="Give '+escapeHtml(fmtMoney(t.amount))+(freq==="monthly"?" per month":"")+(t.label?", "+escapeHtml(t.label):"")+(t.popular?", most popular":"")+' (opens in a new tab)">'+
        (t.popular?'<span class="efmd-tier__pop">Most popular</span>':'')+
        '<span class="efmd-tier__amt">'+escapeHtml(fmtMoney(t.amount))+(freq==="monthly"?'<span class="efmd-tier__per">/mo</span>':'')+'</span>'+
        (t.label?'<span class="efmd-tier__label">'+escapeHtml(t.label)+'</span>':'')+
        (t.impact?'<span class="efmd-tier__impact">'+escapeHtml(t.impact)+'</span>':'')+
      '</a>';
  }
  function ladderGridHtml(){
    var freq=activeFreq, tiers=(freq==="monthly"?TIERS_MONTHLY:TIERS_ONCE)||[];
    var cards=tiers.map(function(t){ return tierCard(t, freq); }).join("");
    var other='<a class="efmd-tier efmd-tier--other" href="'+escapeHtml(donateUrl("", freq, ""))+'" target="_blank" rel="noopener noreferrer" '+
        'data-give="other" aria-label="'+escapeHtml(OTHER_LABEL)+' (opens in a new tab)"><span class="efmd-tier__amt">'+escapeHtml(OTHER_LABEL)+'</span></a>';
    return cards+other;
  }
  function secLadder(){
    var hasMonthly=(TIERS_MONTHLY&&TIERS_MONTHLY.length), hasOnce=(TIERS_ONCE&&TIERS_ONCE.length);
    var toggle = (hasMonthly && hasOnce) ?
      '<div class="efmd-freq" role="group" aria-label="Giving frequency">'+
        '<button type="button" class="efmd-freq__btn" data-freq="monthly" aria-pressed="'+(activeFreq==="monthly")+'">Give monthly</button>'+
        '<button type="button" class="efmd-freq__btn" data-freq="once" aria-pressed="'+(activeFreq==="once")+'">Give once</button>'+
      '</div>' : "";
    return '<section class="efmd-ladder" id="efmd-give">'+
      heading(2,"efmd-ladder__title", LADDER_TITLE)+
      toggle+
      '<div class="efmd-ladder__grid" data-efmd-grid role="group" aria-label="Suggested gift amounts">'+ladderGridHtml()+'</div>'+
      (LADDER_NOTE?'<p class="efmd-ladder__note">'+escapeHtml(LADDER_NOTE)+'</p>':"")+
    '</section>'; }

  function secFounders(){ if(!FOUNDERS_TITLE && !FOUNDERS_COPY) return "";
    var circles=(FOUNDERS_CIRCLES&&FOUNDERS_CIRCLES.length)?
      '<div class="efmd-circles">'+FOUNDERS_CIRCLES.map(function(c){ if(!c||!c.name) return "";
        return '<div class="efmd-circle"><span class="efmd-circle__name">'+escapeHtml(c.name)+'</span>'+
          (c.from?'<span class="efmd-circle__from">'+escapeHtml(c.from)+'</span>':'')+
          (c.benefit?'<span class="efmd-circle__benefit">'+escapeHtml(c.benefit)+'</span>':'')+'</div>'; }).join("")+'</div>' : "";
    return '<section class="efmd-founders">'+
      '<div class="efmd-founders__inner">'+
        (FOUNDERS_TITLE?heading(2,"efmd-founders__title", FOUNDERS_TITLE):"")+
        (FOUNDERS_COPY?'<p class="efmd-founders__copy">'+escapeHtml(FOUNDERS_COPY)+'</p>':"")+
        circles+
        '<div class="efmd-founders__actions"><button type="button" class="efmd-btn efmd-btn--cream" data-scroll="efmd-give">Become a founder</button></div>'+
      '</div></section>'; }

  function secLegacy(){ if(!LEGACY_TITLE && !LEGACY_BODY && !(STATS&&STATS.length)) return "";
    var stats=(STATS&&STATS.length)?
      (STATS_CAPTION?'<div class="efmd-stats__cap">'+escapeHtml(STATS_CAPTION)+'</div>':"")+
      '<div class="efmd-stats">'+STATS.map(function(s){ if(!s||!s.big) return "";
      return '<div class="efmd-stat"><span class="efmd-stat__big">'+escapeHtml(s.big)+'</span><span class="efmd-stat__small">'+escapeHtml(s.small||"")+'</span></div>'; }).join("")+'</div>':"";
    return '<section class="efmd-legacy">'+
      (LEGACY_TITLE?heading(2,"efmd-legacy__title", LEGACY_TITLE):"")+
      (LEGACY_BODY?'<div class="efmd-legacy__body">'+mdToHtml(LEGACY_BODY)+'</div>':"")+
      stats+
    '</section>'; }

  function waysShown(){ return WAYS && WAYS.filter(function(w){ return w && w.title; }).length>0; }
  function secWays(){ if(!waysShown()) return "";
    var email=CONTACT_EMAIL?String(CONTACT_EMAIL).trim():"";
    var cards=WAYS.map(function(w){ if(!w||!w.title) return "";
      var btn=(w.contact && email)?'<a class="efmd-way__contact" href="mailto:'+escapeHtml(email)+'?subject='+encodeURIComponent("Giving: "+w.title)+'" data-way="'+escapeHtml(w.title)+'">Contact us</a>':"";
      return '<div class="efmd-way">'+heading(3,"efmd-way__title", w.title)+
        (w.how?'<p class="efmd-way__how">'+escapeHtml(w.how)+'</p>':"")+btn+'</div>'; }).join("");
    return '<section class="efmd-ways" id="efmd-ways">'+
      (WAYS_TITLE?heading(2,"efmd-ways__title", WAYS_TITLE):"")+
      '<div class="efmd-ways__grid">'+cards+'</div></section>'; }

  function secTrust(){
    var email=CONTACT_EMAIL?String(CONTACT_EMAIL).trim():"", phone=CONTACT_PHONE?String(CONTACT_PHONE).trim():"";
    var contactLine="";
    if(email||phone){ var bits=[];
      if(email) bits.push('<a href="mailto:'+escapeHtml(email)+'">'+escapeHtml(email)+'</a>');
      if(phone) bits.push('<a href="tel:'+escapeHtml(phone.replace(/[^0-9+]/g,""))+'">'+escapeHtml(phone)+'</a>');
      contactLine='<p class="efmd-trust__contact">Questions about giving? Contact us at '+bits.join(" or ")+'.</p>'; }
    var taxLine=(LEGAL_NAME && EIN)?'<p class="efmd-trust__tax">The Eastern Festival of Music is a registered 501(c)(3) nonprofit organization ('+escapeHtml(LEGAL_NAME)+', EIN '+escapeHtml(EIN)+'). Contributions are tax-deductible to the fullest extent allowed by law.</p>':"";
    if(!TRUST_ALWAYS && !contactLine && !taxLine) return "";
    return '<section class="efmd-trust">'+
      (TRUST_ALWAYS?'<p class="efmd-trust__line">'+escapeHtml(TRUST_ALWAYS)+'</p>':"")+
      contactLine+taxLine+
    '</section>'; }

  /* ====================== RENDER ====================== */
  function render(){
    var html=secPageTitle()+secEyebrow()+secHero()+secThesis()+secFunds()+secLadder()+secFounders()+secLegacy()+secWays()+secTrust();
    rootEl.innerHTML='<div class="efmd-sr-only" data-efmd-live aria-live="polite" aria-atomic="true"></div>'+html;
    if(statusEl) statusEl.hidden=true;
    wireInteractions();
    sync();
  }

  function setFreq(freq){ freq=(freq==="once")?"once":"monthly"; if(freq===activeFreq) return; activeFreq=freq;
    var grid=rootEl.querySelector("[data-efmd-grid]"); if(grid) grid.innerHTML=ladderGridHtml();
    Array.prototype.forEach.call(rootEl.querySelectorAll(".efmd-freq__btn"),function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-freq")===activeFreq)); });
    announce(activeFreq==="monthly"?"Showing monthly gift amounts.":"Showing one-time gift amounts.");
    bindGiveTracking(); sync(); }

  function bindGiveTracking(){
    Array.prototype.forEach.call(rootEl.querySelectorAll("[data-give]"),function(a){
      if(a._efmdBound) return; a._efmdBound=true;
      a.addEventListener("click",function(){
        track(EV_DONATE,{ kind:a.getAttribute("data-give"), amount:a.getAttribute("data-amount")||"", frequency:activeFreq, fund:a.getAttribute("data-fund")||"", link_url:a.href }); });
    });
  }

  function wireInteractions(){
    /* hero / founders scroll buttons */
    Array.prototype.forEach.call(rootEl.querySelectorAll("[data-scroll]"),function(b){
      b.addEventListener("click",function(){ scrollToId(b.getAttribute("data-scroll")); }); });
    /* frequency toggle */
    Array.prototype.forEach.call(rootEl.querySelectorAll(".efmd-freq__btn"),function(b){
      b.addEventListener("click",function(){ setFreq(b.getAttribute("data-freq")); }); });
    /* ways-to-give tracking */
    Array.prototype.forEach.call(rootEl.querySelectorAll("[data-way]"),function(a){
      a.addEventListener("click",function(){ track(EV_WAY,{ method:a.getAttribute("data-way") }); }); });
    bindGiveTracking();
  }

  /* ---- box sync (Duda survival) ---- */
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
  function boot(){
    host=document.getElementById("efm-donate");
    if(!host) return;
    var ov=host.getAttribute("data-efmd-donate-url"); if(ov){ ov=httpUrl(ov); if(ov) DONATE_BASE=ov; }   /* per-page campaign override */
    rootEl  = host.querySelector("[data-efmd-root]") || host;
    statusEl= host.querySelector("[data-efmd-status]"); if(statusEl) statusEl.setAttribute("role","status");
    render();
    wire();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
