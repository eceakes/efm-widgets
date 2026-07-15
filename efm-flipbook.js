(function(){
  "use strict";

  /* ============================================================
     EFM Flipbook: our own page-flipping PDF viewer. Prefix efmfb.

     WHY THIS EXISTS
     We were paying FlippingBook, and in a single day it (a) DELETED a program book that
     was still embedded on the live /programs page, so every visitor saw "Sorry, but this
     online flipbook was deleted", and (b) locked two replacement books in "Protected
     embed" mode, which cannot be shown in a plain iframe at all. On top of that,
     flippingbook.com is exactly the kind of third-party domain the Guilford campus wifi
     blocks (it already blocks cdn.jsdelivr.net).

     This renders the SAME PDF you already upload to Duda, from our own origin. Nothing
     here can be deleted from under us, locked behind someone's privacy setting, or
     blocked as a third-party domain.

     HOW IT WORKS
     PDF.js (Mozilla's, the engine inside Firefox's PDF viewer) renders each page to a
     <canvas>. The turn is a CSS 3D rotation of a "leaf" whose FRONT is the page you are
     leaving and whose BACK is the page you are turning to, which is what makes one
     rotation reveal the next page the way a real sheet does.

     Pages are rendered lazily and cached: we only ever rasterise the spread you are
     looking at, plus the one on either side. That matters because the full program book
     is a 62 MB, 11x17 PDF; rendering all of it up front would melt a phone.

     Duda's CDN sends accept-ranges: bytes (verified), so PDF.js streams the file page by
     page instead of downloading all 62 MB before showing page one. Without that this
     whole approach would be a non-starter.

     USAGE
       <div class="efmfb" data-efmfb-pdf="https://.../book.pdf" data-efmfb-title="..."></div>
     then call EFMFlipbook.mount(el) — or just leave it, and it self-mounts on DOMContentLoaded.
     ============================================================ */

  /* WHERE PDF.js LIVES.
     These MUST be served from Duda, not from a public CDN: the Guilford campus wifi blocks
     cdn.jsdelivr.net, and a viewer that dies on campus is no better than the FlippingBook
     embed we are replacing. Override per page with
        <script>window.EFM_PDFJS = { src:"...", worker:"..." };</script>
     or per widget with data-efmfb-pdfjs / data-efmfb-pdfjs-worker on the host div.

     We use the v3 UMD build (plain .js), NOT the v4 ES-module build (.mjs), on purpose:
     an ES module import fails unless the server sends a JavaScript content-type, and we do
     not control what Duda's file manager serves an unusual extension as. A plain <script>
     tag has no such requirement, so this cannot be broken by a content-type quirk. */
  var CDN_FALLBACK = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
  var PDFJS_SRC    = CDN_FALLBACK + "pdf.min.js";
  var PDFJS_WORKER = CDN_FALLBACK + "pdf.worker.min.js";

  var SPREAD_MIN_WIDTH = 720;    /* below this we show one page at a time, not a spread */
  var RENDER_SCALE_CAP = 2;      /* cap devicePixelRatio: an 11x17 page at 3x is enormous */
  var MAX_CANVAS_PX    = 4096;   /* iOS Safari refuses to allocate canvases much beyond this */
  var CACHE_MAX_PAGES  = 8;      /* the 62 MB book is 11x17: keeping every page is a memory leak */
  var MAX_ZOOM         = 4;      /* how far in you can zoom to read fine print */
  var ZOOM_STEP        = 1.5;    /* per click of the + / - buttons */

  var libPromise=null;

  function pdfjsUrls(host){
    var cfg = window.EFM_PDFJS || {};
    return {
      src:    (host && host.getAttribute("data-efmfb-pdfjs"))        || cfg.src    || PDFJS_SRC,
      worker: (host && host.getAttribute("data-efmfb-pdfjs-worker")) || cfg.worker || PDFJS_WORKER
    };
  }

  function loadScript(url){
    return new Promise(function(res, rej){
      var s=document.createElement("script");
      s.src=url; s.async=true;
      s.onload=function(){ res(); };
      s.onerror=function(){ rej(new Error("Could not load "+url)); };
      document.head.appendChild(s);
    });
  }

  function loadPdfJs(host){
    if(libPromise) return libPromise;
    var urls=pdfjsUrls(host);
    libPromise = loadScript(urls.src).then(function(){
      var pdfjs = window.pdfjsLib;
      if(!pdfjs || !pdfjs.getDocument) throw new Error("PDF.js loaded but pdfjsLib is missing");
      pdfjs.GlobalWorkerOptions.workerSrc = urls.worker;
      return pdfjs;
    });
    return libPromise;
  }

  function el(tag, cls, attrs){
    var n=document.createElement(tag);
    if(cls) n.className=cls;
    if(attrs) for(var k in attrs){ if(Object.prototype.hasOwnProperty.call(attrs,k)) n.setAttribute(k, attrs[k]); }
    return n;
  }

  /* cloneNode() on a <canvas> copies the ELEMENT but NOT the bitmap: you get a blank
     canvas of the right size, which looks exactly like a page that failed to render.
     A page can be on screen twice at once (in the spread and on the turning leaf), so we
     genuinely need copies, and each one has to be blitted. */
  function copyCanvas(src){
    var c=document.createElement("canvas");
    c.width=src.width; c.height=src.height;
    c.getContext("2d").drawImage(src, 0, 0);
    return c;
  }

  function Flipbook(host){
    this.host=host;
    this.url=host.getAttribute("data-efmfb-pdf")||"";
    this.title=host.getAttribute("data-efmfb-title")||"Program book";
    this.doc=null;
    this.pageCount=0;
    this.index=0;                  /* index of the LEFT page of the current spread (0-based) */
    this.cache={};                 /* pageNo -> canvas */
    this.pending={};               /* pageNo -> in-flight render, so we never render twice */
    this.lru=[];
    this.zoom=1;                   /* 1 = fit; up to MAX_ZOOM, re-rendered crisp at each step */
    this.hasText=false;            /* set after we look: an image-only PDF has none */
    this.busy=false;
    this.spread=false;
    this.pageW=0; this.pageH=0;
  }

  Flipbook.prototype.mount=function(){
    var self=this;
    if(!this.url){ this.fail("No PDF to show."); return; }

    this.host.innerHTML="";
    this.msg=el("div","efmfb__msg");
    this.msg.appendChild(el("span","efmfb__spinner"));
    this.msg.appendChild(document.createTextNode("Loading the program book…"));
    this.host.appendChild(this.msg);

    loadPdfJs()
      .then(function(pdfjs){ return pdfjs.getDocument({ url:self.url }).promise; })
      .then(function(doc){ self.doc=doc; self.pageCount=doc.numPages; return self.firstPageSize(); })
      .then(function(){ self.build(); })
      .catch(function(err){
        /* Fail soft, exactly like the FlippingBook path: the PDF download always works,
           so a viewer failure must never leave the visitor with nothing. */
        self.fail("The book viewer could not load.");
        if(window.console&&console.warn) console.warn("[efm-flipbook]", err);
      });
  };

  Flipbook.prototype.firstPageSize=function(){
    var self=this;
    return this.doc.getPage(1).then(function(p){
      var vp=p.getViewport({scale:1});
      self.pageW=vp.width; self.pageH=vp.height;

      /* Does this PDF actually contain text, or is it flattened page images? It matters:
         a text layer over an image-only PDF is an empty box that adds nothing and lets a
         screen reader announce a page as blank. The 2026 full program book is image-only
         (16 flattened scans, zero extractable characters); the Week 3 book is real text.
         So we look, rather than assume, and only build the text layer when there is text. */
      return p.getTextContent().then(function(tc){
        self.hasText = !!(tc && tc.items && tc.items.length > 3);
      }).catch(function(){ self.hasText=false; });
    });
  };

  Flipbook.prototype.fail=function(text){
    this.host.innerHTML="";
    var m=el("div","efmfb__msg");
    m.textContent=text+" ";
    var a=el("a","efmfb__btn efmfb__btn--primary",{ href:this.url, target:"_blank", rel:"noopener", download:"" });
    a.textContent="Download the PDF";
    m.appendChild(a);
    this.host.appendChild(m);
  };

  /* ---- rendering ---- */
  Flipbook.prototype.renderPage=function(n){
    var self=this;
    if(n<1||n>this.pageCount) return Promise.resolve(null);
    if(this.cache[n]){ this.touch(n); return Promise.resolve(this.cache[n]); }
    if(this.pending[n]) return this.pending[n];

    var p = this.doc.getPage(n).then(function(page){
      var dpr=Math.min(window.devicePixelRatio||1, RENDER_SCALE_CAP);
      var css=self.sheetSize();
      var base=page.getViewport({scale:1});
      var scale=(css.w/base.width)*dpr;

      /* iOS Safari silently fails to allocate a canvas past roughly 4096px on a side, and
         the full program book is 11x17, so at 2x DPI it sails past that. Clamp instead of
         handing the browser something it will quietly refuse to draw. */
      var probe=page.getViewport({scale:scale});
      var over=Math.max(probe.width, probe.height)/MAX_CANVAS_PX;
      if(over>1) scale=scale/over;

      var vp=page.getViewport({scale:scale});
      var c=document.createElement("canvas");
      c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);

      return page.render({ canvasContext:c.getContext("2d", {alpha:false}), viewport:vp }).promise
        .then(function(){
          self.cache[n]=c;
          self.touch(n);
          self.evict();
          delete self.pending[n];
          return c;
        });
    }).catch(function(e){
      delete self.pending[n];
      if(window.console&&console.warn) console.warn("[efm-flipbook] page "+n, e);
      return null;
    });

    this.pending[n]=p;
    return p;
  };

  /* An 11x17 page at 2x is roughly 25 MB of bitmap. Keeping all 60-odd pages of the full
     book resident would be hundreds of megabytes, which is how you get a phone to kill the
     tab. Keep only the pages near where the reader actually is. */
  Flipbook.prototype.touch=function(n){
    var i=this.lru.indexOf(n);
    if(i>=0) this.lru.splice(i,1);
    this.lru.push(n);
  };
  Flipbook.prototype.evict=function(){
    while(this.lru.length>CACHE_MAX_PAGES){
      var old=this.lru.shift();
      var c=this.cache[old];
      if(c){ c.width=0; c.height=0; }     /* actually release the bitmap, not just the ref */
      delete this.cache[old];
    }
  };

  /* The FIT size: one page at zoom 1, bounded by the container and the viewport height. */
  Flipbook.prototype.fitSize=function(){
    var avail=Math.max(280, this.host.clientWidth-32);
    var maxH=Math.max(320, Math.min(window.innerHeight*0.72, 900));
    var ratio=this.pageH/this.pageW;

    var w = this.spread ? Math.floor((avail-8)/2) : avail;
    var h = Math.round(w*ratio);
    if(h>maxH){ h=Math.round(maxH); w=Math.round(h/ratio); }
    return { w:w, h:h };
  };

  /* The DISPLAY size: fit * zoom. Everything (canvas render, page elements, text layer)
     uses this, so zooming RE-RENDERS the page bigger and crisp rather than stretching a
     fixed bitmap, which is the whole point: browser zoom just enlarges a blurry image, this
     draws the page at the new size. */
  Flipbook.prototype.sheetSize=function(){
    var f=this.fitSize();
    return { w:Math.round(f.w*this.zoom), h:Math.round(f.h*this.zoom) };
  };

  Flipbook.prototype.build=function(){
    var self=this;
    this.spread = this.host.clientWidth >= SPREAD_MIN_WIDTH && this.pageCount > 1;
    this.host.innerHTML="";

    this.stage=el("div","efmfb__stage");
    this.book=el("div","efmfb__book"+(this.spread?" efmfb__book--spread":""));
    this.stage.appendChild(this.book);

    this.left =el("div","efmfb__sheet efmfb__sheet--left");
    this.right=el("div","efmfb__sheet efmfb__sheet--right");
    this.book.appendChild(this.left);
    if(this.spread) this.book.appendChild(this.right);

    this.leaf=el("div","efmfb__leaf",{ hidden:"" });
    this.leafFront=el("div","efmfb__face efmfb__face--front");
    this.leafBack =el("div","efmfb__face efmfb__face--back");
    this.leaf.appendChild(this.leafFront);
    this.leaf.appendChild(this.leafBack);
    this.book.appendChild(this.leaf);

    /* controls */
    this.bar=el("div","efmfb__bar");
    this.prevBtn=el("button","efmfb__btn",{ type:"button" });
    this.prevBtn.innerHTML='<span aria-hidden="true">&larr;</span><span>Previous</span>';
    this.nextBtn=el("button","efmfb__btn",{ type:"button" });
    this.nextBtn.innerHTML='<span>Next</span><span aria-hidden="true">&rarr;</span>';
    this.count=el("div","efmfb__count",{ role:"status", "aria-live":"polite" });

    var dl=el("a","efmfb__btn efmfb__btn--primary",{ href:this.url, target:"_blank", rel:"noopener", download:"" });
    dl.textContent="Download PDF";

    this.bar.appendChild(this.prevBtn);
    this.bar.appendChild(this.count);
    this.bar.appendChild(this.nextBtn);

    /* Zoom. The site nav is real text and scales with browser zoom, but a program page is a
       canvas at a fixed resolution, so browser zoom only blurs it. These controls RE-RENDER
       the page at the new size, so it stays sharp, and let the reader pan a zoomed page. */
    this.zoomOutBtn=el("button","efmfb__btn",{ type:"button", "aria-label":"Zoom out" });
    this.zoomOutBtn.innerHTML='<span aria-hidden="true">&minus;</span>';
    this.zoomLabel=el("button","efmfb__btn efmfb__zoomlabel",{ type:"button", "aria-label":"Reset zoom", title:"Reset zoom" });
    this.zoomInBtn=el("button","efmfb__btn",{ type:"button", "aria-label":"Zoom in" });
    this.zoomInBtn.innerHTML='<span aria-hidden="true">+</span>';
    this.zoomOutBtn.addEventListener("click", function(){ self.zoomBy(1/ZOOM_STEP); });
    this.zoomInBtn.addEventListener("click", function(){ self.zoomBy(ZOOM_STEP); });
    this.zoomLabel.addEventListener("click", function(){ self.setZoom(1); });
    this.bar.appendChild(this.zoomOutBtn);
    this.bar.appendChild(this.zoomLabel);
    this.bar.appendChild(this.zoomInBtn);

    /* Fullscreen, but only offer it if the browser will actually do it: a button that
       does nothing is worse than no button. iOS Safari on iPhone has no element
       fullscreen, so this correctly hides itself there. */
    if(this.host.requestFullscreen || this.host.webkitRequestFullscreen){
      this.fsBtn=el("button","efmfb__btn",{ type:"button" });
      this.fsBtn.textContent="Fullscreen";
      this.fsBtn.addEventListener("click", function(){ self.toggleFullscreen(); });
      this.bar.appendChild(this.fsBtn);
      document.addEventListener("fullscreenchange", this._onFs=function(){
        var on = document.fullscreenElement===self.host;
        self.fsBtn.textContent = on ? "Exit fullscreen" : "Fullscreen";
        self.host.classList.toggle("efmfb--fs", on);
        self.zoom=1;                     /* fit to the new frame; a carried-over zoom is disorienting */
        self.cache={}; self.lru=[];      /* the page is a different size now: re-rasterise */
        self.applyZoomState(); self.layout(); self.paint(); self.updateZoomUI();
      });
    }

    this.bar.appendChild(dl);

    this.host.appendChild(this.stage);
    this.host.appendChild(this.bar);

    this.prevBtn.addEventListener("click", function(){ self.turn(-1); });
    this.nextBtn.addEventListener("click", function(){ self.turn(1); });

    this.host.setAttribute("tabindex","0");
    this.host.setAttribute("role","group");
    this.host.setAttribute("aria-label", this.title+" (page viewer). Use the arrow keys to turn pages.");
    this.host.addEventListener("keydown", function(e){
      if(e.key==="ArrowRight"||e.key==="PageDown"){ e.preventDefault(); self.turn(1); }
      else if(e.key==="ArrowLeft"||e.key==="PageUp"){ e.preventDefault(); self.turn(-1); }
      else if(e.key==="Home"){ e.preventDefault(); self.goto(0); }
      else if(e.key==="End"){ e.preventDefault(); self.goto(self.lastIndex()); }
      else if(e.key==="+"||e.key==="="){ e.preventDefault(); self.zoomBy(ZOOM_STEP); }
      else if(e.key==="-"||e.key==="_"){ e.preventDefault(); self.zoomBy(1/ZOOM_STEP); }
      else if(e.key==="0"){ e.preventDefault(); self.setZoom(1); }
    });

    this.wireInput();
    this.applyZoomState();
    this.updateZoomUI();

    var t=null;
    this._onResize=function(){ clearTimeout(t); t=setTimeout(function(){
      var wantSpread = self.host.clientWidth>=SPREAD_MIN_WIDTH && self.pageCount>1;
      self.zoom=1;                         /* the container changed size: reset to fit */
      self.cache={};                       /* size changed: the rasterised pages are stale */
      if(wantSpread!==self.spread){ self.build(); } else { self.applyZoomState(); self.layout(); self.paint(); self.updateZoomUI(); }
    },180); };
    window.addEventListener("resize", this._onResize);

    this.layout();
    this.paint();
  };

  /* ---- zoom ---- */
  Flipbook.prototype.zoomBy=function(factor){ this.setZoom(this.zoom*factor); };
  Flipbook.prototype.setZoom=function(z){
    z=Math.max(1, Math.min(MAX_ZOOM, z));
    if(Math.abs(z-this.zoom)<0.001) return;
    if(this.busy) return;                         /* not mid page-turn */

    /* keep the CENTRE of what you are looking at fixed as the page grows/shrinks */
    var st=this.stage, prevW=this.book?this.book.offsetWidth:0, prevH=this.book?this.book.offsetHeight:0;
    var cx=(st.scrollLeft+st.clientWidth/2), cy=(st.scrollTop+st.clientHeight/2);
    var fx=prevW?cx/prevW:0.5, fy=prevH?cy/prevH:0.5;

    this.zoom=z;
    this.cache={}; this.lru=[];                   /* re-render every visible page at the new size */
    this.applyZoomState();
    this.layout();
    this.paint();
    this.updateZoomUI();

    var self=this;
    /* recentre after the new sizes are in the DOM */
    window.requestAnimationFrame(function(){
      var nw=self.book.offsetWidth, nh=self.book.offsetHeight;
      st.scrollLeft=Math.max(0, fx*nw - st.clientWidth/2);
      st.scrollTop =Math.max(0, fy*nh - st.clientHeight/2);
    });
  };
  Flipbook.prototype.applyZoomState=function(){
    var zoomed=this.zoom>1.001;
    this.host.classList.toggle("efmfb--zoomed", zoomed);
    /* a zoomed page is a pannable surface; unzoomed it is a book you flip, so let vertical
       page-scroll through but claim horizontal for our own gestures */
    this.stage.style.touchAction = zoomed ? "none" : "pan-y";
  };
  Flipbook.prototype.updateZoomUI=function(){
    if(this.zoomLabel) this.zoomLabel.textContent=Math.round(this.zoom*100)+"%";
    if(this.zoomInBtn)  this.zoomInBtn.disabled  = this.zoom>=MAX_ZOOM-0.001;
    if(this.zoomOutBtn) this.zoomOutBtn.disabled = this.zoom<=1.001;
    /* turning pages while zoomed in is disorienting; nudge back to fit to flip */
    var zoomed=this.zoom>1.001;
    if(this.prevBtn) this.prevBtn.disabled = zoomed || this.index<=0;
    if(this.nextBtn) this.nextBtn.disabled = zoomed || this.index>=this.lastIndex();
  };

  /* ---- pointer / touch / wheel input ---- */
  Flipbook.prototype.wireInput=function(){
    var self=this, st=this.stage;

    /* MOUSE DRAG to pan when zoomed */
    var dragging=false, sx=0, sy=0, sl=0, stp=0;
    st.addEventListener("mousedown", function(e){
      if(self.zoom<=1.001) return;
      dragging=true; sx=e.clientX; sy=e.clientY; sl=st.scrollLeft; stp=st.scrollTop;
      st.classList.add("is-grabbing"); e.preventDefault();
    });
    window.addEventListener("mousemove", function(e){
      if(!dragging) return;
      st.scrollLeft=sl-(e.clientX-sx); st.scrollTop=stp-(e.clientY-sy);
    });
    window.addEventListener("mouseup", function(){ dragging=false; st.classList.remove("is-grabbing"); });

    /* CTRL/CMD + WHEEL to zoom (this is also what a trackpad pinch sends) */
    st.addEventListener("wheel", function(e){
      if(!(e.ctrlKey||e.metaKey)) return;
      e.preventDefault();
      self.zoomBy(e.deltaY<0 ? 1.12 : 1/1.12);
    }, {passive:false});

    /* TOUCH: 1 finger = swipe-to-turn (at fit) or pan (zoomed); 2 fingers = pinch-zoom */
    var t0x=null, t0y=null, tsl=0, tst=0, pinchStart=0, pinchZoom0=1;
    function dist(t){ var dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY; return Math.sqrt(dx*dx+dy*dy); }

    st.addEventListener("touchstart", function(e){
      if(e.touches.length===2){
        pinchStart=dist(e.touches); pinchZoom0=self.zoom; t0x=null;
      } else if(e.touches.length===1){
        t0x=e.touches[0].clientX; t0y=e.touches[0].clientY; tsl=st.scrollLeft; tst=st.scrollTop;
      }
    }, {passive:true});

    st.addEventListener("touchmove", function(e){
      if(e.touches.length===2 && pinchStart){
        e.preventDefault();
        self.setZoom(pinchZoom0 * (dist(e.touches)/pinchStart));
      } else if(e.touches.length===1 && t0x!==null && self.zoom>1.001){
        e.preventDefault();                       /* pan the zoomed page */
        st.scrollLeft=tsl-(e.touches[0].clientX-t0x);
        st.scrollTop =tst-(e.touches[0].clientY-t0y);
      }
    }, {passive:false});

    st.addEventListener("touchend", function(e){
      if(t0x!==null && self.zoom<=1.001 && e.changedTouches.length){
        var dx=e.changedTouches[0].clientX-t0x;
        if(Math.abs(dx)>45) self.turn(dx<0?1:-1); /* swipe turns only when not zoomed */
      }
      if(e.touches.length<2) pinchStart=0;
      if(e.touches.length===0) t0x=null;
    }, {passive:true});
  };

  Flipbook.prototype.lastIndex=function(){
    return this.spread ? Math.max(0, this.pageCount-1 - ((this.pageCount-1)%2)) : this.pageCount-1;
  };

  Flipbook.prototype.layout=function(){
    var s=this.sheetSize();
    [this.left,this.right].forEach(function(n){ if(!n) return; n.style.width=s.w+"px"; n.style.height=s.h+"px"; });
    this.leaf.style.width=s.w+"px"; this.leaf.style.height=s.h+"px";
    this.leaf.style.left=(this.spread ? s.w : 0)+"px";
  };

  /* Draw the current spread. Pages are 1-based; index is the 0-based LEFT page. */
  Flipbook.prototype.paint=function(){
    var self=this;
    var leftNo  = this.index+1;
    var rightNo = this.spread ? this.index+2 : null;

    function put(slot, n){
      if(!slot) return Promise.resolve();
      slot.innerHTML="";
      if(!n || n>self.pageCount) return Promise.resolve();
      return self.renderPage(n).then(function(c){
        if(!c) return;
        slot.appendChild(copyCanvas(c));
        self.addTextLayer(slot, n);      /* selectable, screen-readable text over the page */
      });
    }

    put(this.left, leftNo);
    if(this.spread) put(this.right, rightNo);

    this.count.textContent = this.spread && rightNo && rightNo<=this.pageCount
      ? "Pages "+leftNo+"–"+rightNo+" of "+this.pageCount
      : "Page "+leftNo+" of "+this.pageCount;

    this.updateZoomUI();          /* prev/next reflect both page position AND zoom state */

    /* warm the neighbours so the next turn is instant (only at fit: a zoomed page is huge
       and you cannot turn while zoomed anyway) */
    if(this.zoom<=1.001){
      var step=this.spread?2:1;
      this.renderPage(leftNo+step); this.renderPage(leftNo+step+1);
      this.renderPage(leftNo-step);
    }
  };

  /* An invisible, selectable text layer positioned over the canvas. This is the thing a
     FlippingBook embed can NEVER give you: the page becomes real text that a screen reader
     can read, a visitor can select and copy, and the browser can find with Ctrl+F.
     Only built when the PDF actually has text (see firstPageSize): laying an empty text
     layer over a scanned image would be worse than nothing, because it tells assistive
     tech there is text and then hands it none. */
  Flipbook.prototype.addTextLayer=function(slot, n){
    var self=this;
    var pdfjs=window.pdfjsLib;
    if(!this.hasText || !pdfjs || !pdfjs.renderTextLayer) return;

    var s=this.sheetSize();
    this.doc.getPage(n).then(function(page){
      var vp=page.getViewport({ scale: s.w/self.pageW });
      return page.getTextContent().then(function(tc){
        if(!slot.isConnected) return;                 /* the reader moved on already */
        var layer=el("div","efmfb__text");
        layer.style.width=s.w+"px";
        layer.style.height=s.h+"px";
        /* PDF.js positions each text span with transforms scaled by this variable. Without
           it, it logs "The --scale-factor CSS-variable must be set" and the invisible text
           lands in the wrong place, so a screen reader reads the page in the wrong order
           and selection highlights the wrong words. It is not decorative. */
        layer.style.setProperty("--scale-factor", String(s.w/self.pageW));
        slot.appendChild(layer);
        var task=pdfjs.renderTextLayer({ textContent:tc, container:layer, viewport:vp, textDivs:[] });
        return task && task.promise;
      });
    }).catch(function(){ /* a missing text layer must never break the page */ });
  };

  Flipbook.prototype.goto=function(i){
    i=Math.max(0, Math.min(this.lastIndex(), i));
    if(i===this.index) return;
    this.index=i;
    this.paint();
  };

  /* The turn itself.
     The leaf's FRONT is the page you are leaving and its BACK is the page you are turning
     to, so one rotation reveals the next page the way a real sheet does.

     AND, crucially, THE PAGE REVEALED UNDERNEATH IS PAINTED BEFORE THE TURN STARTS.
     Without that you see the page you are leaving TWICE, once on the turning leaf and once
     still sitting in the slot beneath it, and then it pops to the new page the instant the
     animation ends. Think about what a real book does: as the sheet lifts, what appears in
     the gap is already the NEXT page, not the one in your hand. */
  Flipbook.prototype.turn=function(dir){
    var self=this;
    if(this.busy) return;
    var step=this.spread?2:1;
    var target=this.index+dir*step;
    if(target<0 || target>this.lastIndex()) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if(reduce){ this.goto(target); return; }

    var frontNo, backNo, revealSlot, revealNo;

    if(dir>0){
      /* Turning forward. The right-hand page lifts and swings left.
         front = the right page you are leaving; back = the new left page.
         Underneath, the RIGHT slot must already show the new right page. */
      frontNo = this.spread ? this.index+2 : this.index+1;
      backNo  = this.spread ? this.index+3 : this.index+2;
      revealSlot = this.spread ? this.right : this.left;
      revealNo   = this.spread ? target+2 : target+1;
    } else {
      /* Turning back. The left-hand page lifts and swings right.
         front = the left page you are leaving; back = the new right page.
         Underneath, the LEFT slot must already show the new left page.
         (target+2 and target+1 both happen to equal this.index here, but write what we
         MEAN, not the coincidence: pages are 1-based and target is a 0-based left index.) */
      frontNo = this.index+1;
      backNo  = this.spread ? target+2 : target+1;
      revealSlot = this.left;
      revealNo   = target+1;
    }

    this.busy=true;
    Promise.all([ this.renderPage(frontNo), this.renderPage(backNo), this.renderPage(revealNo) ]).then(function(cs){
      /* paint the revealed page FIRST, under the leaf, before anything moves */
      if(revealSlot && cs[2]){
        revealSlot.innerHTML="";
        revealSlot.appendChild(copyCanvas(cs[2]));
        self.addTextLayer(revealSlot, revealNo);
      }

      self.leafFront.innerHTML=""; self.leafBack.innerHTML="";
      if(cs[0]) self.leafFront.appendChild(copyCanvas(cs[0]));
      if(cs[1]) self.leafBack.appendChild(copyCanvas(cs[1]));

      self.leaf.className="efmfb__leaf "+(dir>0?"efmfb__leaf--fwd":"efmfb__leaf--back");
      self.leaf.style.left=(self.spread ? (dir>0 ? self.sheetSize().w : 0) : 0)+"px";
      self.leaf.removeAttribute("hidden");

      /* force a reflow so the browser sees the start state before we animate */
      void self.leaf.offsetWidth;
      self.leaf.classList.add("is-turning");

      var done=function(){
        self.leaf.removeEventListener("transitionend", done);
        self.leaf.classList.remove("is-turning");
        self.leaf.setAttribute("hidden","");
        self.index=target;
        self.paint();
        self.busy=false;
      };
      self.leaf.addEventListener("transitionend", done);

      /* Safety net, in case transitionend never fires (it does not if the element is
         hidden mid-flight, or on some older browsers). READ the duration rather than
         hardcoding it: a hardcoded timeout silently truncates the animation the moment
         anyone changes the CSS, which is exactly what happened the first time we tried to
         film this in slow motion. */
      var cs=getComputedStyle(self.leaf);
      var secs=parseFloat(cs.transitionDuration||"0")||0;
      var delay=parseFloat(cs.transitionDelay||"0")||0;
      setTimeout(function(){ if(self.busy) done(); }, (secs+delay)*1000 + 250);
    });
  };

  Flipbook.prototype.toggleFullscreen=function(){
    var h=this.host;
    if(document.fullscreenElement===h || document.webkitFullscreenElement===h){
      (document.exitFullscreen||document.webkitExitFullscreen).call(document);
    } else {
      (h.requestFullscreen||h.webkitRequestFullscreen).call(h);
    }
  };

  /* ---- boot ---- */
  function mountAll(root){
    var nodes=(root||document).querySelectorAll(".efmfb[data-efmfb-pdf]");
    [].slice.call(nodes).forEach(function(n){
      if(n.__efmfb) return;
      n.__efmfb=new Flipbook(n);
      n.__efmfb.mount();
    });
  }

  window.EFMFlipbook={ mount:function(node){ if(!node.__efmfb){ node.__efmfb=new Flipbook(node); node.__efmfb.mount(); } }, mountAll:mountAll };

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", function(){ mountAll(); });
  else mountAll();
})();
