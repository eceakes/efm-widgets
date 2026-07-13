(function(){
  "use strict";

  /* ============================================================
     EFM Newsletter Signup: a "Sign up for our newsletter" trigger that opens a MODAL
     containing the form. Host id #efm-newsletter, class prefix efmn.

     TWO WAYS TO TRIGGER IT, and the widget supports both at once:
       1. data-efmn-open on ANY element. The element keeps its own styling and just
          opens the dialog. This is how the Tickets CTA does it, so its newsletter
          button is a plain <a class="efmt-btn efmt-btn--ghost"> and stays pixel
          identical to Buy Tickets, with no CSS copied between the two modules.
       2. an #efm-newsletter host div, in which case the widget renders its OWN gold
          pill button inside it (see render()).

     WHERE THE CODE CAN LIVE (this bit is hard-won, do not undo it)
     In a PAGE-BODY widget (the Tickets CTA) scripts run normally, so the code can be
     loaded there like every other EFM widget: an external <link> + <script src>.
     In the sitewide FOOTER they do NOT: the footer is a global component and Duda
     renders it such that a <script> inside it never executes (a script inserted via
     innerHTML is inert per the HTML spec). A plain <p> in that same footer widget
     renders fine. So a FOOTER button needs its code in the sitewide HEAD instead, with
     only an inert host div in the footer, and start() below has to wait for that div.

     WHY THIS EXISTS INSTEAD OF MAILCHIMP'S OWN EMBED
     Mailchimp's "Connected Sites" script (chimpstatic.com/mcjs-connected/...) is a
     TRACKING script plus the delivery channel for Mailchimp-hosted pop-ups. It is
     not a form and nothing it renders can be styled with our CSS. Their classic
     embed code IS a form, but it drags in jQuery, mc-validate.js, a Mailchimp
     stylesheet and a 200-entry country <select>, and on submit it navigates the
     visitor away to a Mailchimp page. So we post to the audience ourselves.

     The classic endpoint sends no CORS headers, so fetch()/XHR cannot read the
     response: the only way to submit AND stay on the page is JSONP (inject a
     <script> whose src is the post-json endpoint, with c=<global callback name>).
     That is what jsonp() below does. Mailchimp answers with
     {"result":"success"|"error","msg":"..."}.

     THE MODAL IS MOVED TO <body> WHEN IT OPENS. A position:fixed element is
     trapped by any ancestor with a transform/filter/perspective, and a Duda footer
     is exactly the sort of container that has one; the overlay would then be
     clipped inside the footer strip instead of covering the page. Re-parenting to
     <body> on open makes it immune to whatever the footer does. This is why the
     dialog's CSS is scoped to .efmn-modal and NOT to #efm-newsletter.

     THE AUDIENCE REQUIRES FNAME AND LNAME. Both are marked Required in Mailchimp
     (Audience > Settings > Audience fields and *|MERGE|* tags), and Mailchimp
     enforces that server-side, not just in their form markup. For an email-only
     form, un-require them in Mailchimp FIRST or every submission comes back
     "FNAME must be filled out".

     Campus note: this posts to list-manage.com. The Guilford campus wifi is known
     to block cdn.jsdelivr.net; if it also blocks list-manage.com the JSONP request
     times out and we show FAIL_MSG, which carries a mailto fallback. It fails soft.

     Per-page overrides on the host div:
       data-efmn-theme="light"    blue trigger button instead of gold (light footer)
       data-efmn-label="..."      override the trigger button's text
       data-efmn-teaser="..."     a short line of copy beside the button ("" = none)
     ============================================================ */

  /* ---------- Mailchimp audience (from Audience > Signup forms > Embedded form) ---------- */
  var DC       = "us13";                        /* data center, from the form action hostname */
  var U        = "d917e279f76de402eedf9e1a3";   /* account id */
  var LIST_ID  = "ae9b21b4a3";                  /* audience id */
  var F_ID     = "00ce27eaf0";                  /* form id */
  var TAGS     = "7215808";                     /* the hidden tag Mailchimp attached to this form */
  var ENDPOINT = "https://easternfestivalofmusic." + DC + ".list-manage.com/subscribe/post-json";
  var HONEYPOT = "b_" + U + "_" + LIST_ID;      /* Mailchimp's bot trap: must be SENT and must be EMPTY */

  /* ---------- copy ---------- */
  var CTA_LABEL = "Sign up for our newsletter";  /* the footer button */
  var CTA_ICON  = "✉";                      /* envelope; "" removes it */
  var TEASER    = "";                            /* optional line beside the button; "" hides it */

  var TITLE   = "Sign up for our newsletter";    /* the modal's heading */
  var COPY    = "Concert announcements, artist news, and ticket presales from the Eastern Festival of Music.";
  var BTN     = "Subscribe";
  var BTN_BUSY= "Subscribing...";
  var FINE    = "A few emails a season. Unsubscribe any time.";
  var CLOSE_LABEL = "Close";
  var CONTACT = "info@easternfestivalofmusic.org";   /* used in the network-failure fallback; "" drops the mailto */

  var L_EMAIL = "Email address";
  var L_FIRST = "First name";
  var L_LAST  = "Last name";

  /* Success text comes from Mailchimp's own reply when it sends one, because only
     Mailchimp knows whether this audience uses double opt-in ("check your inbox to
     confirm") or single ("you're subscribed"). This is the fallback if it says nothing. */
  var OK_MSG      = "Thank you for subscribing.";
  var ALREADY_MSG = "You are already on our list. Thank you for your support.";
  var FAIL_MSG    = "We could not reach our email service. Please try again in a moment"
                  + (CONTACT ? ", or email us at " + CONTACT + "." : ".");
  var INVALID_EMAIL = "Please enter a valid email address.";
  var REQUIRED_MSG  = "This field is required.";

  /* ---------- GA4 events (no-op without gtag/dataLayer) ---------- */
  var EV_OPEN   = "newsletter_open";
  var EV_SIGNUP = "newsletter_signup";

  var host, ctaEl, modal, panelEl, bodyEl, closeEl;
  var formEl, statusEl, btnEl;
  var fields = {};
  var lastFocus = null;
  var pending = false;
  var isOpen = false;
  var downTarget = null;      /* where the current press started (see buildModal) */
  var openedAt = 0;           /* when the dialog opened, to ignore a double-click's 2nd hit */
  var _locks = [];
  var _cbN = 0;

  function now(){ return (window.performance && performance.now) ? performance.now() : +new Date(); }

  /* Escape is bound to the DOCUMENT, not to the dialog, and only while it is open.
     Bound to the dialog it only fires when focus is inside it, so any stray focus outside
     (a click that lands behind the backdrop, a browser quirk) would leave the visitor with
     an open dialog that Escape will not close. */
  function onDocKeydown(e){
    if(e.key === "Escape" && isOpen){ e.stopPropagation(); closeModal(); }
  }

  /* ---------- helpers ---------- */
  function esc(s){ return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function track(name, params){
    try{
      var d = params || {};
      if(typeof window.gtag === "function"){ window.gtag("event", name, d); return; }
      if(window.dataLayer && typeof window.dataLayer.push === "function"){
        var o = { event:name }; for(var k in d){ if(Object.prototype.hasOwnProperty.call(d,k)) o[k]=d[k]; }
        window.dataLayer.push(o);
      }
    }catch(e){}
  }

  /* Mailchimp error strings arrive with a field-index prefix and sometimes raw HTML,
     e.g. "0 - This email address looks fake" or "x@y.com is already subscribed to
     list EFM. <a href=...>Click here to update your profile</a>". Reduce to text. */
  function plainMsg(s){
    return String(s==null?"":s)
      .replace(/<[^>]*>/g,"")          /* drop any markup Mailchimp embedded */
      .replace(/^\s*\d+\s*-\s*/,"")    /* drop the leading field index */
      .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/\s+/g," ")
      .trim();
  }

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  /* ---------- JSONP (the classic list-manage endpoint has no CORS) ---------- */
  function jsonp(url, cb){
    var name = "efmn_cb_" + (++_cbN) + "_" + String(Math.random()).slice(2,8);
    var s = document.createElement("script");
    var settled = false;
    var timer;

    function cleanup(){
      clearTimeout(timer);
      try{ delete window[name]; }catch(e){ window[name] = undefined; }
      if(s.parentNode) s.parentNode.removeChild(s);
    }
    window[name] = function(data){ if(settled) return; settled = true; cleanup(); cb(null, data); };
    s.onerror = function(){ if(settled) return; settled = true; cleanup(); cb(new Error("network")); };
    timer = setTimeout(function(){ if(settled) return; settled = true; cleanup(); cb(new Error("timeout")); }, 12000);

    s.src = url + (url.indexOf("?") < 0 ? "?" : "&") + "c=" + encodeURIComponent(name);
    (document.body || document.documentElement).appendChild(s);
  }

  function buildUrl(v){
    var q = [
      "u=" + encodeURIComponent(U),
      "id=" + encodeURIComponent(LIST_ID),
      "f_id=" + encodeURIComponent(F_ID),
      "EMAIL=" + encodeURIComponent(v.EMAIL),
      "FNAME=" + encodeURIComponent(v.FNAME),
      "LNAME=" + encodeURIComponent(v.LNAME),
      encodeURIComponent(HONEYPOT) + "="        /* sent, and deliberately empty */
    ];
    if(TAGS) q.push("tags=" + encodeURIComponent(TAGS));
    return ENDPOINT + "?" + q.join("&");
  }

  /* ---------- markup ---------- */
  function fieldHtml(key, label, type, autocomplete, cls){
    var id = "efmn-" + key.toLowerCase();
    return ''
      + '<div class="efmn__field ' + (cls||"") + '">'
      +   '<label class="efmn__label" for="' + id + '">' + esc(label)
      +     '<span class="efmn__req" aria-hidden="true">*</span>'
      +   '</label>'
      +   '<input class="efmn__input" id="' + id + '" name="' + key + '" type="' + type + '"'
      +     ' autocomplete="' + autocomplete + '" required'
      +     ' aria-describedby="' + id + '-err" data-efmn-field="' + key + '">'
      +   '<span class="efmn__err" id="' + id + '-err" data-efmn-err="' + key + '"></span>'
      + '</div>';
  }

  function formHtml(){
    return ''
      + '<form class="efmn__form" novalidate data-efmn-form>'
      +   '<div class="efmn__grid">'
      +     fieldHtml("FNAME", L_FIRST, "text",  "given-name",  "")
      +     fieldHtml("LNAME", L_LAST,  "text",  "family-name", "")
      +     fieldHtml("EMAIL", L_EMAIL, "email", "email",       "efmn__field--email")
      +     '<div class="efmn__actions">'
      +       '<button type="submit" class="efmn__btn" data-efmn-btn>' + esc(BTN) + '</button>'
      +       (FINE ? '<p class="efmn__fine">' + esc(FINE) + '</p>' : '')
      +     '</div>'
      +   '</div>'
      /* Mailchimp's honeypot. Real people never see or tab to it; bots fill it and get dropped. */
      +   '<div class="efmn__pot" aria-hidden="true">'
      +     '<label for="efmn-pot">Leave this field empty</label>'
      +     '<input type="text" id="efmn-pot" name="' + esc(HONEYPOT) + '" tabindex="-1" autocomplete="off" value="">'
      +   '</div>'
      +   '<p class="efmn__status" data-efmn-status role="status" aria-live="polite"></p>'
      + '</form>';
  }

  function buildModal(){
    modal = document.createElement("div");
    modal.className = "efmn-modal";
    modal.setAttribute("hidden", "");
    modal.innerHTML = ''
      + '<div class="efmn-modal__backdrop" data-efmn-close></div>'
      + '<div class="efmn-modal__panel" role="dialog" aria-modal="true" aria-labelledby="efmn-modal-title" data-efmn-panel>'
      +   '<button type="button" class="efmn-modal__close" data-efmn-close aria-label="' + esc(CLOSE_LABEL) + '">&times;</button>'
      +   '<div class="efmn-modal__title" role="heading" aria-level="2" id="efmn-modal-title">' + esc(TITLE) + '</div>'
      +   (COPY ? '<p class="efmn-modal__copy">' + esc(COPY) + '</p>' : '')
      +   '<div data-efmn-body></div>'
      + '</div>';

    panelEl = modal.querySelector("[data-efmn-panel]");
    bodyEl  = modal.querySelector("[data-efmn-body]");
    closeEl = modal.querySelector(".efmn-modal__close");

    /* Remember where a press STARTED. Without this, selecting text inside the panel and
       releasing the mouse outside it counts as a backdrop click and closes the dialog,
       throwing away what the visitor typed. Classic modal bug; cheap to avoid. */
    modal.addEventListener("mousedown", function(e){ downTarget = e.target; });

    modal.addEventListener("click", function(e){
      var t = e.target;
      if(!t.hasAttribute || !t.hasAttribute("data-efmn-close")) return;

      if(t === closeEl){ closeModal(); return; }        /* the X always closes */

      /* Backdrop. Two guards:
         1. the press must have started on the backdrop (see mousedown above);
         2. it must not be the tail of a DOUBLE-CLICK on the trigger. The first click
            opens the dialog, which paints the backdrop directly under the cursor, so the
            second click lands on it and would close the dialog again. The visitor sees a
            flash and nothing else. Ignore backdrop closes for a moment after opening. */
      if(downTarget !== t) return;
      if(now() - openedAt < 400) return;
      closeModal();
    });

    modal.addEventListener("keydown", function(e){
      if(e.key === "Tab") trapTab(e);
    });
  }

  /* Rebuild the form on every open, so a visitor who subscribed (or hit an error)
     and reopens the dialog gets a clean form rather than a stale thank-you panel. */
  function mountForm(){
    bodyEl.innerHTML = formHtml();
    formEl   = bodyEl.querySelector("[data-efmn-form]");
    statusEl = bodyEl.querySelector("[data-efmn-status]");
    btnEl    = bodyEl.querySelector("[data-efmn-btn]");

    fields = {};
    Array.prototype.forEach.call(bodyEl.querySelectorAll("[data-efmn-field]"), function(inp){
      var k = inp.getAttribute("data-efmn-field");
      fields[k] = { input: inp, err: bodyEl.querySelector('[data-efmn-err="' + k + '"]') };
      inp.addEventListener("input", function(){ setFieldError(k, ""); });   /* clear as they fix it */
    });

    pending = false;
    formEl.addEventListener("submit", onSubmit);
  }

  /* ---------- scroll lock ----------
     Duda does NOT scroll the window: it scrolls an inner container (on the live
     site that is div#iscrollBody, overflow-y:auto). So the usual
     "document.body.style.overflow = hidden" does nothing here and the page would
     keep scrolling behind the open dialog. Instead, find whatever element is
     ACTUALLY scrolling and lock that, restoring it exactly on close. Padding is
     topped up by the scrollbar's width so removing the scrollbar does not shift
     the page sideways, and scrollTop is saved and restored because some browsers
     reset it when overflow flips to hidden. */
  function scrollLockTargets(){
    var out = [], seen = [];
    function add(el){
      if(!el || seen.indexOf(el) >= 0) return;
      try{
        var cs = getComputedStyle(el), oy = cs.overflowY;
        var scrollable = (oy === "auto" || oy === "scroll" || oy === "overlay");
        if(scrollable && el.scrollHeight > el.clientHeight + 2){ seen.push(el); out.push(el); }
      }catch(e){}
    }
    /* Walk up from wherever the dialog was opened FROM. That is the host div when the
       widget rendered its own button, but when an external data-efmn-open trigger opened
       it (the Tickets CTA) there is no host div at all, so start from the trigger, which
       is whatever had focus. Getting this wrong would silently disable the scroll lock on
       exactly the pages that use an external trigger. */
    var from = host || ((lastFocus && lastFocus.nodeType === 1) ? lastFocus : document.body);
    for(var el = from; el && el !== document.documentElement; el = el.parentElement) add(el);
    add(document.scrollingElement || document.documentElement);   /* the normal-page case */
    return out;
  }
  function lockScroll(){
    _locks = [];
    scrollLockTargets().forEach(function(el){
      var barWidth = el.offsetWidth - el.clientWidth;
      _locks.push({ el:el, overflow:el.style.overflow, paddingRight:el.style.paddingRight, top:el.scrollTop });
      if(barWidth > 0){
        var cur = parseFloat(getComputedStyle(el).paddingRight) || 0;
        el.style.paddingRight = (cur + barWidth) + "px";
      }
      el.style.overflow = "hidden";
    });
  }
  function unlockScroll(){
    _locks.forEach(function(l){
      l.el.style.overflow = l.overflow;          /* "" restores the stylesheet value */
      l.el.style.paddingRight = l.paddingRight;
      l.el.scrollTop = l.top;
    });
    _locks = [];
  }

  /* ---------- open / close ---------- */
  /* Everything the browser will actually Tab to, in DOM order.
     The tabIndex < 0 test is load-bearing, not defensive: Mailchimp's honeypot is a
     REAL 1px input, so a size-based visibility filter happily lets it through, and it
     would then be counted as the dialog's last stop. Tab never lands there (it is
     tabindex="-1"), so the wrap-around would never fire and focus would walk straight
     out of the dialog into the page behind it. Same for the tabindex="-1" thank-you
     panel, which we focus programmatically but must never Tab to. */
  function focusables(){
    return Array.prototype.filter.call(
      panelEl.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'),
      function(el){
        if(el.disabled) return false;
        if(el.tabIndex < 0) return false;
        return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
      }
    );
  }
  function trapTab(e){
    var f = focusables();
    if(!f.length){ e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];

    /* Focus may be sitting on something that is NOT in the tab ring: after a
       successful signup we programmatically focus the tabindex="-1" thank-you panel.
       Tabbing from there matched neither the first nor the last element, so focus
       escaped into the page behind the dialog. Anything unrecognised re-enters the
       ring at the appropriate end. */
    if(f.indexOf(document.activeElement) < 0){
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }

  function openModal(){
    if(isOpen) return;
    lastFocus = document.activeElement;

    /* Built on FIRST OPEN, not at boot. Until someone clicks the button, this widget
       adds nothing to the page but its own button: no full-viewport fixed element
       exists in the DOM at all. A hidden overlay at z-index 2147483000 is the kind of
       thing that, if any host stylesheet ever overrode [hidden], would silently cover
       the whole page and swallow every click. Not creating it until it is needed
       removes that failure mode instead of relying on the host to behave. */
    if(!modal) buildModal();

    /* move the dialog OUT of the widget host and onto <body>, so no transformed or
       overflow-hidden footer ancestor can clip a position:fixed overlay */
    if(modal.parentNode !== document.body) document.body.appendChild(modal);

    mountForm();
    modal.removeAttribute("hidden");
    isOpen = true;
    openedAt = now();
    downTarget = null;
    lockScroll();
    document.addEventListener("keydown", onDocKeydown, true);

    track(EV_OPEN, {});
    var first = fields.FNAME && fields.FNAME.input;
    try{ (first || closeEl).focus(); }catch(e){}
  }

  function closeModal(){
    if(!isOpen) return;
    modal.setAttribute("hidden", "");
    isOpen = false;
    document.removeEventListener("keydown", onDocKeydown, true);
    unlockScroll();
    if(lastFocus && lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} }
  }

  /* ---------- status + field errors ---------- */
  function setStatus(msg){
    if(!statusEl) return;
    statusEl.textContent = msg || "";
  }
  function setFieldError(key, msg){
    var f = fields[key]; if(!f) return;
    f.err.textContent = msg || "";
    if(msg) f.input.setAttribute("aria-invalid","true");
    else    f.input.removeAttribute("aria-invalid");
  }
  function clearAllErrors(){
    for(var k in fields){ if(Object.prototype.hasOwnProperty.call(fields,k)) setFieldError(k,""); }
    setStatus("");
  }

  /* ---------- submit ---------- */
  function onSubmit(e){
    e.preventDefault();
    if(pending) return;
    clearAllErrors();

    var v = {
      FNAME: (fields.FNAME.input.value || "").trim(),
      LNAME: (fields.LNAME.input.value || "").trim(),
      EMAIL: (fields.EMAIL.input.value || "").trim()
    };

    /* if the honeypot came back filled, a bot did it: pretend all is well, send nothing */
    var pot = bodyEl.querySelector("#efmn-pot");
    if(pot && pot.value){ showDone(OK_MSG); return; }

    var firstBad = null;
    if(!v.FNAME){ setFieldError("FNAME", REQUIRED_MSG); firstBad = firstBad || fields.FNAME.input; }
    if(!v.LNAME){ setFieldError("LNAME", REQUIRED_MSG); firstBad = firstBad || fields.LNAME.input; }
    if(!v.EMAIL){ setFieldError("EMAIL", REQUIRED_MSG); firstBad = firstBad || fields.EMAIL.input; }
    else if(!validEmail(v.EMAIL)){ setFieldError("EMAIL", INVALID_EMAIL); firstBad = firstBad || fields.EMAIL.input; }
    if(firstBad){
      setStatus("Please check the highlighted fields.");
      try{ firstBad.focus(); }catch(_e){}
      return;
    }

    setPending(true);
    setStatus("");

    jsonp(buildUrl(v), function(err, data){
      setPending(false);

      if(err || !data){ setStatus(FAIL_MSG); return; }

      if(data.result === "success"){
        track(EV_SIGNUP, { status:"subscribed" });
        showDone(plainMsg(data.msg) || OK_MSG);
        return;
      }

      var msg = plainMsg(data.msg);

      /* "already subscribed" is not the visitor's mistake: answer warmly, and count it */
      if(/already subscribed/i.test(msg)){
        track(EV_SIGNUP, { status:"already_subscribed" });
        showDone(ALREADY_MSG);
        return;
      }

      /* point the message at the field it belongs to when we can tell */
      if(/e-?mail/i.test(msg))               setFieldError("EMAIL", msg);
      else if(/FNAME|first name/i.test(msg)) setFieldError("FNAME", msg);
      else if(/LNAME|last name/i.test(msg))  setFieldError("LNAME", msg);

      track(EV_SIGNUP, { status:"error" });
      setStatus(msg || FAIL_MSG);
      try{ fields.EMAIL.input.focus(); }catch(_e){}
    });
  }

  function setPending(on){
    pending = !!on;
    if(!btnEl) return;
    btnEl.disabled = pending;
    btnEl.textContent = pending ? BTN_BUSY : BTN;
  }

  /* Replace the form with a thank-you panel and move focus to it, so a screen reader
     lands on the outcome instead of a form that is no longer there. The dialog stays
     open: the visitor closes it themselves. */
  function showDone(msg){
    bodyEl.innerHTML = '<div class="efmn__done" role="status" tabindex="-1" data-efmn-done>'
                     +   '<span class="efmn__done-mark" aria-hidden="true">&#10003;</span>'
                     +   '<p class="efmn__done-text">' + esc(msg) + '</p>'
                     + '</div>';
    formEl = null; statusEl = null; btnEl = null; fields = {};
    var done = bodyEl.querySelector("[data-efmn-done]");
    try{ done.focus(); }catch(e){}
  }

  /* ---- box sync (Duda survival) ---- */
  /* Duda's scroll animations can leave an ancestor faded out, which would hide the
     button. Force those back to visible. This only ever REVEALS things, it never
     changes geometry, so unlike the height rewriting above it cannot collapse a
     layout. It is also skipped entirely once the button is actually on screen, so on
     a normal page (and in the editor) it does nothing at all after the first frames. */
  function defuse(){
    try{ if(host.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(host).opacity) === 1) return; }catch(e){}
    for(var el=host; el && el!==document.body; el=el.parentElement){ try{ var cs=getComputedStyle(el);
      if(parseFloat(cs.opacity)<1) el.style.setProperty("opacity","1","important");
      if(cs.visibility==="hidden") el.style.setProperty("visibility","visible","important");
      if(el.classList && el.classList.contains("animated")) el.classList.add("revealed"); }catch(e){} }
  }
  /* NO ANCESTOR HEIGHT REWRITING IN THIS WIDGET. The other EFM widgets carry an
     autoHeight() that walks up to <body> forcing height:auto !important on any
     ancestor that clips OR that has an inline pixel height. In a FOOTER that is
     destructive, not defensive: a Duda footer is a RESIZABLE region and therefore
     carries an inline pixel height, which trips that second condition on its own,
     with nothing actually being clipped. The widget then collapses the footer and
     every container above it, repeatedly (it re-runs on an interval, on resize and
     on every ResizeObserver tick). In the Duda editor that blanks the canvas.

     It is also pointless here: the trigger is one button that cannot overflow, and
     the dialog is re-parented to <body>, so nothing of ours is ever clipped by an
     ancestor. The ONLY geometry we touch is our own iframe, if Duda puts us in one. */
  function frameFit(){
    try{
      var f = window.frameElement;
      if(!f) return;
      var h = Math.ceil(host.getBoundingClientRect().height) + 8;
      if(parseInt(f.style.height,10) !== h){ f.style.height = h + "px"; f.style.minHeight = h + "px"; }
    }catch(e){}
  }
  var _wired=false; function sync(){ if(!host) return; defuse(); frameFit(); }
  function wire(){ if(_wired) return; _wired=true; window.addEventListener("resize",sync);
    if(window.ResizeObserver){ try{ new ResizeObserver(sync).observe(host); }catch(e){} }
    var n=0,iv=setInterval(function(){ sync(); if(++n>=16) clearInterval(iv); },250); }

  /* ---- external triggers: ANY element with data-efmn-open ----
     Lets an existing button elsewhere on the site open this dialog, so it can borrow
     that module's own button styling instead of importing ours. The Tickets CTA uses
     this: its "Sign up for our newsletter" trigger is a plain <a class="efmt-btn
     efmt-btn--ghost" data-efmn-open>, so it inherits efm-tickets.css and stays pixel
     identical to Buy Tickets / Become a Subscriber, with no CSS copied anywhere.

     Delegated on document, so it also catches triggers Duda paints in later (the whole
     reason the footer version needed a MutationObserver). The trigger is an <a> with no
     href, because the tickets rules are scoped to `a.efmt-btn`: a <button> would get no
     styling at all. No href means no navigation, but it also means the browser will not
     fire Enter/Space for us, so we do it here and keep role="button" honest. */
  function isTrigger(el){
    return el && el.closest ? el.closest("[data-efmn-open]") : null;
  }
  function wireTriggers(){
    document.addEventListener("click", function(e){
      var t = isTrigger(e.target);
      if(!t) return;
      e.preventDefault();
      openModal();
    });
    document.addEventListener("keydown", function(e){
      if(e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var t = isTrigger(e.target);
      if(!t) return;
      e.preventDefault();                 /* Space would otherwise scroll the page */
      openModal();
    });
  }

  /* ---- boot ---- */
  function render(){
    var label  = host.getAttribute("data-efmn-label");  if(label  == null) label  = CTA_LABEL;
    var teaser = host.getAttribute("data-efmn-teaser"); if(teaser == null) teaser = TEASER;

    host.innerHTML =
        (teaser ? '<p class="efmn__teaser">' + esc(teaser) + '</p>' : '')
      + '<button type="button" class="efmn__cta" data-efmn-cta>'
      +   (CTA_ICON ? '<span class="efmn__cta-icon" aria-hidden="true">' + esc(CTA_ICON) + '</span>' : '')
      +   '<span>' + esc(label) + '</span>'
      + '</button>';

    ctaEl = host.querySelector("[data-efmn-cta]");
    ctaEl.addEventListener("click", openModal);
  }

  function boot(){
    if(host) return true;                            /* already booted */
    host = document.getElementById("efm-newsletter");
    if(!host) return false;                          /* host not here (yet) */
    render();                                        /* the dialog is built lazily, on first open */
    wire();
    return true;
  }

  /* The host div may not exist when this script first runs. That is the norm, not an
     edge case: when the button is in the FOOTER, the code has to load from the sitewide
     HEAD (see the header comment), and Duda paints the footer well after the head runs,
     sometimes after DOMContentLoaded. Without the observer below the widget would
     silently no-op on every page. Harmless in the page-body case, where boot() succeeds
     on the first try and the observer is never installed. */
  function start(){
    /* Always first, and independent of the host div: an external data-efmn-open trigger
       (the Tickets CTA) must work on pages that have no #efm-newsletter div at all. */
    wireTriggers();

    if(boot()) return;

    if(!window.MutationObserver) return;             /* ancient browser: nothing more to try */
    var mo = new MutationObserver(function(){ if(boot()) mo.disconnect(); });
    try{ mo.observe(document.documentElement, { childList:true, subtree:true }); }catch(e){ return; }

    /* Stop watching eventually: on a page with no signup div (which is fine, the widget
       is a no-op there) we must not leave a subtree observer running for the session. */
    window.setTimeout(function(){ mo.disconnect(); }, 20000);
    window.addEventListener("load", function(){ if(boot()) mo.disconnect(); });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
