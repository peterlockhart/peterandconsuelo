/* ==========================================================================
   Peter & Consuelo — photo carousel

   The fade itself is pure CSS (see .slide / .slide.is-active). This file only
   owns state: which slide is current, whether autoplay is running, and which
   images are allowed to hold a src.
   ========================================================================== */

(function () {
  'use strict';

  var PHOTOS = window.PHOTOS || [];
  if (!PHOTOS.length) return;

  var INTERVAL = 5000;   // ms per slide
  var WINDOW = 2;        // slides either side of current that get a src
  var EVICT = 4;         // beyond this distance, drop the src again

  var carousel  = document.querySelector('.carousel');
  var slidesEl  = document.querySelector('[data-slides]');
  var thumbsEl  = document.querySelector('[data-thumbs]');
  var toggle    = document.querySelector('[data-playpause]');
  var toggleTxt = document.querySelector('[data-playpause-label]');
  var counterEl = document.querySelector('[data-counter]');

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var slides = [];
  var thumbs = [];
  var current = 0;
  var timer = null;
  var playing = false;
  var storyOpen = false;

  function src(size, id) { return 'assets/photos/' + size + '/' + id + '.webp'; }

  // The build caps the LONG edge, so a portrait variant is narrower than the
  // cap. Width descriptors must state the file's real width or the browser
  // picks the wrong one.
  function srcset(photo) {
    return window.slideSrcset(photo);
  }

  /* ---------------------------------------------------------------- build */

  function build() {
    var slideFrag = document.createDocumentFragment();
    var thumbFrag = document.createDocumentFragment();

    PHOTOS.forEach(function (photo, i) {
      var id = photo[0], w = photo[1], h = photo[2];
      var label = 'Photograph ' + (i + 1) + ' of ' + PHOTOS.length;

      // --- slide: an empty <img>; hydrate() supplies the src when it is near
      var li = document.createElement('li');
      li.className = 'slide';
      // The photo's proportions, for the corner rounding in CSS: the stylesheet
      // needs them to work out whether this photo is letterboxed at the sides
      // or running edge to edge, and CSS cannot read an image's own ratio.
      li.style.setProperty('--ratio', String(w / h));
      var img = document.createElement('img');
      img.width = w;
      img.height = h;
      img.alt = '';                 // decorative: the strip below is the control
      img.decoding = 'async';
      img.sizes = '100vw';
      li.appendChild(img);
      slideFrag.appendChild(li);
      slides.push(img);

      // --- thumbnail: native lazy loading, since the strip scrolls sideways
      var tli = document.createElement('li');
      tli.className = 'thumb';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', label);
      var timg = document.createElement('img');
      timg.src = src('thumb', id);
      timg.width = w;
      timg.height = h;              // gives the strip its aspect ratio up front
      timg.alt = '';
      timg.loading = 'lazy';
      timg.decoding = 'async';
      btn.appendChild(timg);
      tli.appendChild(btn);
      thumbFrag.appendChild(tli);
      thumbs.push(btn);

      btn.addEventListener('click', function () {
        go(i);
        restart();                  // keep playing, but give this slide a full turn
      });
    });

    slidesEl.appendChild(slideFrag);
    thumbsEl.appendChild(thumbFrag);

    var total = document.querySelector('[data-total]');
    if (total) total.textContent = String(PHOTOS.length);
  }

  /* ------------------------------------------------------------ hydration */

  // Distance between two indices on a loop, e.g. last -> first is 1.
  function distance(a, b) {
    var d = Math.abs(a - b);
    return Math.min(d, PHOTOS.length - d);
  }

  function hydrate(index) {
    slides.forEach(function (img, i) {
      var d = distance(i, index);
      if (d <= WINDOW) {
        if (!img.getAttribute('srcset')) {
          img.setAttribute('srcset', srcset(PHOTOS[i]));
          img.src = src('lg', PHOTOS[i][0]);   // fallback for no-srcset browsers
          img.fetchPriority = i === index ? 'high' : 'low';
        }
      } else if (d > EVICT && img.getAttribute('srcset')) {
        // Cap how many decoded bitmaps we hold; the bytes stay in the HTTP cache.
        img.removeAttribute('srcset');
        img.removeAttribute('src');
      }
    });
  }

  /* -------------------------------------------------------------- movement */

  function go(index) {
    index = (index + PHOTOS.length) % PHOTOS.length;

    hydrate(index);   // give the incoming image a src *before* it fades in

    slides[current].parentNode.classList.remove('is-active');
    slides[index].parentNode.classList.add('is-active');

    thumbs[current].removeAttribute('aria-current');
    thumbs[index].setAttribute('aria-current', 'true');
    thumbs[index].scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest'
    });

    current = index;
    if (counterEl) counterEl.textContent = String(index + 1);
  }

  function next() { go(current + 1); }

  /* -------------------------------------------------------------- autoplay */

  function play() {
    if (playing) return;
    playing = true;
    carousel.dataset.playing = 'true';
    toggleTxt.textContent = 'Pause slideshow';
    timer = setInterval(next, INTERVAL);
  }

  function pause() {
    playing = false;
    carousel.dataset.playing = 'false';
    toggleTxt.textContent = 'Play slideshow';
    clearInterval(timer);
    timer = null;
  }

  // Restart the countdown without changing play/pause state.
  function restart() {
    if (!playing) return;
    clearInterval(timer);
    timer = setInterval(next, INTERVAL);
  }

  // Stop and start the timer without disturbing the user's play/pause choice —
  // used for background tabs and while the story overlay is up.
  function suspend() {
    clearInterval(timer);
    timer = null;
  }

  function resume() {
    if (playing && !timer && !document.hidden && !storyOpen) {
      timer = setInterval(next, INTERVAL);
    }
  }

  /* ----------------------------------------------------------------- wire */

  build();
  go(0);

  toggle.addEventListener('click', function () {
    playing ? pause() : play();
  });

  /* Click zones over the photograph — left half back, right half forward.
     go() takes the index modulo the run, so both ends wrap and the carousel
     loops in either direction. restart() gives the incoming slide a full turn
     without disturbing the user's play/pause choice, matching the arrow keys. */
  [].forEach.call(document.querySelectorAll('[data-nav]'), function (zone) {
    var step = zone.getAttribute('data-nav') === 'prev' ? -1 : 1;
    zone.addEventListener('click', function () {
      go(current + step);
      restart();
    });
  });

  // Don't burn timers or decode images in a background tab.
  document.addEventListener('visibilitychange', function () {
    document.hidden ? suspend() : resume();
  });

  /* Space has to activate a control the user tabbed to — that is what it means
     to a keyboard user, and taking it away would break the buttons. But a
     button merely *left* focused by a mouse click must not swallow the
     shortcut, which is the common case here: click a thumbnail, then press
     Space expecting the slideshow to pause.

     :focus-visible cannot make that call from inside a keydown handler — the
     browser switches to keyboard modality as soon as a key goes down, so a
     mouse-focused button already matches by the time we are asked. Tracking
     how the focus was actually acquired is the reliable test. */
  var focusCameFromKeyboard = false;

  document.addEventListener('pointerdown', function () {
    focusCameFromKeyboard = false;
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') focusCameFromKeyboard = true;   // the only key that moves focus
  }, true);

  function focusedControlWantsSpace() {
    var el = document.activeElement;
    return !!el && el.tagName === 'BUTTON' && focusCameFromKeyboard;
  }

  document.addEventListener('keydown', function (e) {
    if (storyOpen) return;             // while the story is up, the keys are its own

    if (e.key === ' ' || e.key === 'Spacebar') {
      if (focusedControlWantsSpace()) return;
      playing ? pause() : play();
    }
    else if (e.key === 'ArrowRight') { go(current + 1); restart(); }
    else if (e.key === 'ArrowLeft') { go(current - 1); restart(); }
    else return;

    e.preventDefault();
  });

  /* ------------------------------------------------------- story overlay */

  var storyBtn = document.querySelector('[data-story]');
  var storyEl = document.querySelector('[data-story-overlay]');

  /* The chapter images stay src-less until the story is first opened.
     `loading="lazy"` cannot do this on its own: the panel is visibility:hidden
     but still sits at inset:0, so the browser counts the images as in-viewport
     and fetches all of them on page load — ~900KB competing with the opening
     photograph. Once the src is set, lazy loading does take over *within* the
     panel, so the lower chapters still wait until they are scrolled to. */
  var storyImagesRequested = false;

  function loadStoryImages() {
    if (storyImagesRequested) return;
    storyImagesRequested = true;

    var imgs = storyEl.querySelectorAll('.chapter__image[data-src]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = imgs[i].getAttribute('data-src');
      imgs[i].removeAttribute('data-src');
    }
  }

  function setStory(open) {
    storyOpen = open;
    if (open) loadStoryImages();
    storyEl.classList.toggle('is-open', open);
    storyBtn.setAttribute('aria-expanded', String(open));
    storyBtn.textContent = open ? 'Close Story' : 'Our Story';

    // The overlay is opaque, so advancing slides behind it would only fetch
    // and decode photographs nobody can see.
    open ? suspend() : resume();

    if (!open) storyEl.scrollTop = 0;
    else { measureRail(); updateActiveChapter(); }
  }

  /* Scroll spy: fill the marker of whichever chapter is currently being read.
     The overlay scrolls internally, so this measures against the panel rather
     than the window. */

  var chapters = [].slice.call(storyEl.querySelectorAll('.chapter'));
  var storyInner = storyEl.querySelector('.story__inner');

  /* The rail runs the full length of the story: from the top of the first
     chapter's image down to the bottom of the last chapter's copy. Both ends
     depend on rendered image heights and on how the text wraps, so the length
     has to be measured rather than guessed. */
  function measureRail() {
    if (!chapters.length || !storyInner) return;

    var lastChapter = chapters[chapters.length - 1];
    var paragraphs = lastChapter.querySelectorAll('p');
    var endsAt = paragraphs.length ? paragraphs[paragraphs.length - 1] : lastChapter;

    var base = storyInner.getBoundingClientRect().top;
    var end = endsAt.getBoundingClientRect().bottom - base;

    storyInner.style.setProperty('--rail-height', end + 'px');
  }

  function updateActiveChapter() {
    if (!chapters.length) return;

    var tops = chapters.map(function (ch) { return ch.offsetTop; });
    var span = tops[tops.length - 1] - tops[0];
    var maxScroll = storyEl.scrollHeight - storyEl.clientHeight;
    var progress = maxScroll > 2 ? storyEl.scrollTop / maxScroll : 0;

    /* Walk a reading position across the chapters in proportion to how far
       through the panel we have scrolled.

       Measuring against a fixed trigger line near the top of the panel does not
       work here: the copy only just overflows on most screens (149px of travel
       against ~180px between chapters), so the middle chapters would never
       reach the line and their markers would never fill. Mapping progress onto
       the chapters' own offsets makes every marker reachable at any height,
       and still gives a long chapter a proportionally longer turn. */
    var readPos = tops[0] + progress * span;

    var active = 0;
    for (var i = 0; i < tops.length; i++) {
      if (tops[i] <= readPos + 1) active = i;
    }

    chapters.forEach(function (ch, i) {
      ch.classList.toggle('is-active', i === active);
    });
  }

  var spyTicking = false;
  storyEl.addEventListener('scroll', function () {
    if (spyTicking) return;
    spyTicking = true;
    requestAnimationFrame(function () { updateActiveChapter(); spyTicking = false; });
  });
  window.addEventListener('resize', function () {
    measureRail();
    updateActiveChapter();
  });

  storyBtn.addEventListener('click', function () { setStory(!storyOpen); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && storyOpen) setStory(false);
  });

  // Auto-moving content is opt-in for anyone who has asked for less motion.
  reduceMotion ? pause() : play();
})();
