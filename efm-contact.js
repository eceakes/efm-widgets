(function(){
  "use strict";

  /* ============================================================
     EFM Contact page. Host id #efm-contact, class prefix efmc.

     Config-driven, no sheet: every string below is a var. BLANK HIDES ITS SECTION, so
     you can turn a card, the phone line, the newsletter band or the socials off by
     emptying the value. Editing copy is a code change (push, re-upload, re-paste), the
     same as the Donate widget.

     NO CONTACT FORM, by decision. A form that sends mail needs a backend, and we chose
     not to add one: the page routes people to a real mailto instead. If a form is ever
     wanted, the natural home is a Google Apps Script web app (we already run one for
     the calendar feed) which can email and log to a Sheet.

     THE NEWSLETTER BUTTON is not this widget's code. It carries data-efmn-open, which is
     the newsletter widget's hook, so it opens that modal. The page's embed must therefore
     load efm-newsletter.css + efm-newsletter.js alongside this widget. If the newsletter
     files are absent the button simply does nothing, so keep them together.

     WHAT THIS REPLACES: the live /contact page is a heading, one line of text, an
     "Email Us" button, and, in public, Duda's default lorem placeholder ("This is
     paragraph text. Click it or hit the Manage Text button..."). Delete those Duda
     elements when pasting this in, or they will sit above the widget.
     ============================================================ */

  /* ---------- page title ---------- */
  /* The page's H1. Rendered above the hero, the same way efm-donate does it.
     "" hides it, in which case the hero title becomes the H1 instead, so the page always
     has exactly one H1 and never zero. That matters: the H1 the page has TODAY is Duda's
     "CONTACT" heading, and the deploy instructions say to delete it. Without this, the
     page would ship with no H1 at all, which is an SEO regression. */
  var PAGE_TITLE = "Contact";

  /* ---------- hero ---------- */
  var EYEBROW = "Eastern Festival of Music";
  var TITLE   = "Get in touch";
  var LEDE    = "Questions about tickets, the school, auditions, or supporting the festival? "
              + "We would love to hear from you.";

  /* ---------- primary contact ---------- */
  var EMAIL       = "info@easternfestivalofmusic.org";   /* "" hides the Email Us button */
  var EMAIL_LABEL = "Email Us";
  var EMAIL_SUBJECT = "";        /* optional mailto subject prefill; "" = none */

  /* DELIBERATELY BLANK. Eric confirmed 2026-07-13: EFM has no official phone number for
     public release. Blank hides the Call Us button entirely (verified: it is absent from
     the DOM, not merely invisible). Do not invent one. If a real number is ever published,
     putting it here is the only change needed. */
  var PHONE       = "";
  var PHONE_LABEL = "Call Us";

  /* ---------- cards ---------- */
  /* Mailing address: what is already in the site footer. */
  var MAIL_TITLE = "Mailing address";
  var MAIL_LINES = [
    "Eastern Festival of Music",
    "3912 Battleground Ave, Suite 112, Box 323",
    "Greensboro, NC 27410"
  ];
  var MAIL_NOTE  = "For all post, including gifts by check.";
  var MAIL_MAP   = "";   /* optional directions link; "" hides it. Post is not a destination, so this is usually blank. */

  /* Campus: where the festival actually happens each summer.
     Address CONFIRMED CORRECT by Eric, 2026-07-13. (It started as one I looked up rather
     than one he supplied, hence this note: it has since been checked, so do not flag it
     as unverified again.) */
  var CAMPUS_TITLE = "Find us in the summer";
  var CAMPUS_LINES = [
    "Guilford College",
    "5800 W Friendly Ave",
    "Greensboro, NC 27410"
  ];
  var CAMPUS_NOTE  = "Concerts, classes, and rehearsals take place on the Guilford College campus during the festival season.";
  var CAMPUS_MAP   = "https://www.google.com/maps/search/?api=1&query=Guilford+College%2C+5800+W+Friendly+Ave%2C+Greensboro%2C+NC+27410";
  var MAP_LABEL    = "Get directions";

  /* ---------- "ways to help" row: giving + newsletter, side by side ---------- */

  /* Points at OUR /donate page, not straight at Fundraise Up. That is what the site's
     HEADER nav does, and /donate is the designed giving experience (tiers, named funds,
     monthly toggle). The FOOTER's Give Today jumps directly to
     ahrpferd.donorsupport.co, which skips all of that; do not copy the footer here.
     A relative path stays in the same tab; set a full https url instead and it will open
     in a new tab automatically. "" hides the whole card. */
  var DONATE_URL   = "/donate";
  var DONATE_TITLE = "Support the festival";
  var DONATE_COPY  = "Your gift keeps great music accessible in Greensboro and opens the door for young artists.";
  var DONATE_LABEL = "Give Today";

  /* The button carries data-efmn-open: the newsletter widget's own hook. See the header. */
  var NEWS_TITLE = "Stay in the loop";
  var NEWS_COPY  = "Concert announcements, artist news, and ticket presales, a few times a season.";
  var NEWS_LABEL = "Sign up for our newsletter";

  /* ---------- social ---------- */
  var SOCIAL_TITLE = "Follow the festival";
  var SOCIAL = [
    { name:"Facebook",  url:"https://www.facebook.com/efmsummermusic/" },
    { name:"Instagram", url:"https://www.instagram.com/efmsummermusic/" }   /* footer has http://; https is correct */
  ];

  var host, rootEl;

  /* ---------- helpers ---------- */
  function esc(s){ return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  /* REAL <h1>/<h2>, NOT role="heading" DIVs.
     Every other EFM widget uses role=heading divs, because Duda's global theme recolors
     real headings (white/gold/serif) and can make them invisible. That convention is
     over-cautious, and it costs SEO: search engines weight a real <h1> far more than an
     ARIA heading, and this page's only <h1> today is Duda's "CONTACT" element, which the
     deploy deletes.

     Tested on the LIVE Duda page before changing this: a real <h1> on the dark hero and a
     real <h2> on a light card both render byte-identical to the equivalent role=heading
     div (same colour, font, size, margins; 12.7:1 contrast on the card). Our !important
     colour guards already beat Duda's theme. The ONLY thing Duda's UA styles change is
     font-weight, so every heading rule below pins font-weight explicitly.

     Do NOT convert the other widgets on the strength of this: they are live and working,
     and their heading styles differ. This was verified for THIS widget's styles only. */
  function heading(level, cls, text, id){
    var t = "h" + level;
    return '<' + t + ' class="' + cls + '"' + (id ? ' id="' + id + '"' : '') + '>'
         + esc(text) + '</' + t + '>';
  }

  /* Block javascript:/data:/vbscript: before anything reaches an href. */
  function safeUrl(u){
    u = String(u==null?"":u).trim();
    if(/^\s*(javascript|data|vbscript):/i.test(u)) return "";
    return u;
  }
  function httpUrl(u){ u = safeUrl(u); return /^https?:\/\//i.test(u) ? u : ""; }

  /* Like httpUrl, but also allows a SAME-SITE path ("/donate"). httpUrl alone would
     silently drop it and the button would vanish with no clue why. */
  function linkUrl(u){
    u = safeUrl(u);
    if(/^https?:\/\//i.test(u)) return u;
    if(/^\/(?!\/)/.test(u)) return u;      /* "/donate" yes, "//evil.com" no */
    return "";
  }
  function isExternal(u){ return /^https?:\/\//i.test(u); }

  function mailHref(){
    if(!EMAIL) return "";
    var h = "mailto:" + EMAIL;
    if(EMAIL_SUBJECT) h += "?subject=" + encodeURIComponent(EMAIL_SUBJECT);
    return h;
  }
  function telHref(){
    if(!PHONE) return "";
    return "tel:" + PHONE.replace(/[^0-9+]/g, "");   /* strip formatting: tel: wants digits */
  }

  /* Inline SVG throughout, because an icon font or a remote image would be one more thing
     to load and one more thing to be blocked on campus. All use currentColor so they
     inherit their container's colour and need no separate theming.

     The card icons were Unicode glyphs (an envelope and a flag) at first. They render as
     thin text, at the mercy of whatever font the page has, and sat badly next to the
     crisp social SVGs. Real paths instead. */
  var CARD_ICONS = {
    mail: '<svg class="efmc__card-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13zm2.2.5 6.8 5.1L18.8 6H5.2zM19 7.6l-6.4 4.8a1 1 0 0 1-1.2 0L5 7.6V18h14V7.6z"/></svg>',
    pin:  '<svg class="efmc__card-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 6.3 12.4 6.6 12.7a.5.5 0 0 0 .8 0C12.7 21.4 19 14 19 9a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>'
  };

  var ICONS = {
    Facebook:  '<svg class="efmc__social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>',
    Instagram: '<svg class="efmc__social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1 0-1.7.2-2.1.3-.5.2-.9.4-1.2.8-.4.3-.6.7-.8 1.2-.1.4-.3 1-.3 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c0 1.1.2 1.7.3 2.1.2.5.4.9.8 1.2.3.4.7.6 1.2.8.4.1 1 .3 2.1.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1 0 1.7-.2 2.1-.3.5-.2.9-.4 1.2-.8.4-.3.6-.7.8-1.2.1-.4.3-1 .3-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-1.1-.2-1.7-.3-2.1-.2-.5-.4-.9-.8-1.2-.3-.4-.7-.6-1.2-.8-.4-.1-1-.3-2.1-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2zm6.3-8.2a1.2 1.2 0 1 1-2.3 0 1.2 1.2 0 0 1 2.3 0z"/></svg>'
  };

  /* ---------- render ---------- */
  function heroHtml(){
    var mail = mailHref(), tel = telHref();
    var actions = "";
    if(mail) actions += '<a class="efmc-btn efmc-btn--primary" href="' + esc(mail) + '">' + esc(EMAIL_LABEL) + '</a>';
    if(tel)  actions += '<a class="efmc-btn efmc-btn--ghost" href="' + esc(tel) + '">' + esc(PHONE_LABEL) + '</a>';

    /* exactly one H1 on the page: PAGE_TITLE if set, otherwise the hero title */
    var heroLevel = PAGE_TITLE ? 2 : 1;

    return ''
      + (PAGE_TITLE ? heading(1, "efmc__page-title", PAGE_TITLE) : '')
      + '<div class="efmc__hero">'
      +   (EYEBROW ? '<p class="efmc__eyebrow">' + esc(EYEBROW) + '</p>' : '')
      +   (TITLE ? heading(heroLevel, "efmc__title", TITLE) : '')
      +   (LEDE ? '<p class="efmc__lede">' + esc(LEDE) + '</p>' : '')
      +   (actions ? '<div class="efmc__hero-actions">' + actions + '</div>' : '')
      + '</div>';
  }

  function cardHtml(icon, title, lines, note, mapUrl){
    if(!title || !lines || !lines.length) return "";
    var map = httpUrl(mapUrl);
    return ''
      + '<div class="efmc__card">'
      +   '<div class="efmc__card-icon" aria-hidden="true">' + icon + '</div>'
      +   heading(2, "efmc__card-title", title)
      +   '<p class="efmc__card-body">' + lines.map(esc).join("<br>") + '</p>'
      +   (note ? '<p class="efmc__card-note">' + esc(note) + '</p>' : '')
      +   (map ? '<a class="efmc__card-link" href="' + esc(map) + '" target="_blank" rel="noopener">'
                 + esc(MAP_LABEL) + ' <span aria-hidden="true">&rarr;</span>'
                 + '<span class="efmc-sr-only"> (opens in a new tab)</span></a>' : '')
      + '</div>';
  }

  /* One "way to help" card: a title, a line of copy, and its action. */
  function bandHtml(title, copy, action){
    if(!action) return "";
    return ''
      + '<div class="efmc__band">'
      +   '<div class="efmc__band-text">'
      +     (title ? heading(2, "efmc__band-title", title) : '')
      +     (copy ? '<p class="efmc__band-copy">' + esc(copy) + '</p>' : '')
      +   '</div>'
      +   action
      + '</div>';
  }

  function donateAction(){
    var url = linkUrl(DONATE_URL);
    if(!url || !DONATE_LABEL) return "";
    /* An external giving platform opens in a new tab; our own /donate page does not. */
    var ext = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
    return '<a class="efmc-btn efmc-btn--ink" href="' + esc(url) + '"' + ext + '>' + esc(DONATE_LABEL)
         + (ext ? '<span class="efmc-sr-only"> (opens in a new tab)</span>' : '')
         + '</a>';
  }

  /* data-efmn-open is the NEWSLETTER widget's hook, not ours. A real <button> works here,
     since nothing in this stylesheet is scoped to a.<something> the way the Tickets CTA's
     rules are (there, the trigger HAD to be an <a> to inherit any styling at all). */
  function newsAction(){
    if(!NEWS_LABEL) return "";
    return '<button type="button" class="efmc-btn efmc-btn--gold" data-efmn-open>' + esc(NEWS_LABEL) + '</button>';
  }

  function waysHtml(){
    var cards = bandHtml(DONATE_TITLE, DONATE_COPY, donateAction())
              + bandHtml(NEWS_TITLE, NEWS_COPY, newsAction());
    if(!cards) return "";
    return '<div class="efmc__ways">' + cards + '</div>';
  }

  function socialHtml(){
    var links = (SOCIAL || []).map(function(s){
      var url = httpUrl(s.url);
      if(!url || !s.name) return "";
      return '<a class="efmc__social-link" href="' + esc(url) + '" target="_blank" rel="noopener">'
           + (ICONS[s.name] || "")
           + '<span>' + esc(s.name) + '</span>'
           + '<span class="efmc-sr-only"> (opens in a new tab)</span>'
           + '</a>';
    }).filter(Boolean).join("");

    if(!links) return "";
    return ''
      + '<div class="efmc__social">'
      +   (SOCIAL_TITLE ? heading(2, "efmc__social-title", SOCIAL_TITLE) : '')
      +   '<div class="efmc__social-row">' + links + '</div>'
      + '</div>';
  }

  /* ---------- structured data (SEO) ----------
     The site currently has NO JSON-LD anywhere. This gives search engines the machine
     readable version of what the page says in prose: who the organisation is, how to
     reach it, where it is, and which social profiles are really ours (sameAs is what lets
     Google tie the Facebook/Instagram accounts to the organisation).

     Injected as a real <script type="application/ld+json"> element, NOT via innerHTML.
     JSON-LD is data, not code, so it never executes; it only has to be present in the
     rendered DOM, which Google reads. Built with JSON.stringify so a stray quote or angle
     bracket in the copy can never break out of the block. */
  function injectStructuredData(){
    if(document.getElementById("efmc-jsonld")) return;   /* never emit it twice */

    var data = {
      "@context": "https://schema.org",
      "@type": "PerformingGroup",
      "name": "Eastern Festival of Music",
      "url": "https://www.easternfestivalofmusic.org/",
      "sameAs": (SOCIAL || []).map(function(s){ return httpUrl(s.url); }).filter(Boolean)
    };
    if(EMAIL) data.email = EMAIL;
    if(PHONE) data.telephone = PHONE;

    if(MAIL_LINES && MAIL_LINES.length >= 3){
      data.address = {
        "@type": "PostalAddress",
        "streetAddress": MAIL_LINES[1],
        "addressLocality": "Greensboro",
        "addressRegion": "NC",
        "postalCode": "27410",
        "addressCountry": "US"
      };
    }
    if(EMAIL){
      data.contactPoint = {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": EMAIL,
        "areaServed": "US",
        "availableLanguage": "English"
      };
    }
    if(CAMPUS_LINES && CAMPUS_LINES.length){
      data.location = {
        "@type": "Place",
        "name": CAMPUS_LINES[0],
        "address": {
          "@type": "PostalAddress",
          "streetAddress": CAMPUS_LINES[1],
          "addressLocality": "Greensboro",
          "addressRegion": "NC",
          "postalCode": "27410",
          "addressCountry": "US"
        }
      };
    }

    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "efmc-jsonld";
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  function render(){
    var cards = cardHtml(CARD_ICONS.mail, MAIL_TITLE, MAIL_LINES, MAIL_NOTE, MAIL_MAP)
              + cardHtml(CARD_ICONS.pin,  CAMPUS_TITLE, CAMPUS_LINES, CAMPUS_NOTE, CAMPUS_MAP);

    host.innerHTML = ''
      + '<div data-efmc-root>'
      +   heroHtml()
      +   (cards ? '<div class="efmc__grid">' + cards + '</div>' : '')
      +   waysHtml()
      +   socialHtml()
      + '</div>';

    rootEl = host.querySelector("[data-efmc-root]");
  }

  /* ---- box sync (Duda survival) ----
     defuse() only ever REVEALS an ancestor Duda's scroll animation left faded out.
     unclip() relaxes an ancestor that is genuinely CUTTING OFF our content.

     NOTE the missing condition: the other EFM widgets also force height:auto on any
     ancestor merely carrying an INLINE PIXEL HEIGHT, with nothing being clipped. That
     clause is destructive (it collapses a Duda footer, which is a resizable region and
     therefore always has one) and it is deliberately absent here. We only relax an
     ancestor that is actually clipping us. */
  function defuse(){
    for(var el=host; el && el!==document.body; el=el.parentElement){ try{ var cs=getComputedStyle(el);
      if(parseFloat(cs.opacity)<1) el.style.setProperty("opacity","1","important");
      if(cs.visibility==="hidden") el.style.setProperty("visibility","visible","important");
      if(el.classList && el.classList.contains("animated")) el.classList.add("revealed"); }catch(e){} }
  }
  function unclip(){
    for(var el=host.parentElement; el && el!==document.body; el=el.parentElement){ try{
      var cs = getComputedStyle(el);
      var hides = cs.overflowY==="hidden" || cs.overflowY==="clip" || cs.overflow==="hidden";
      if(hides && el.scrollHeight > el.clientHeight + 2){
        el.style.setProperty("height","auto","important");
        el.style.setProperty("max-height","none","important");
      }
    }catch(e){} }
    try{ var f=window.frameElement; if(f){ var h=Math.ceil(host.getBoundingClientRect().height)+8;
      if(parseInt(f.style.height,10)!==h){ f.style.height=h+"px"; f.style.minHeight=h+"px"; } } }catch(e){}
  }
  var _wired=false; function sync(){ if(!host) return; defuse(); unclip(); }
  function wire(){ if(_wired) return; _wired=true; window.addEventListener("resize",sync);
    if(window.ResizeObserver){ try{ new ResizeObserver(sync).observe(host); }catch(e){} }
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- boot ---- */
  function boot(){
    host = document.getElementById("efm-contact");
    if(!host) return;            /* not on this page: do nothing */
    render();
    injectStructuredData();
    wire();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
