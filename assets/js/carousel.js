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

  // Don't burn timers or decode images in a background tab.
  document.addEventListener('visibilitychange', function () {
    document.hidden ? suspend() : resume();
  });

  document.addEventListener('keydown', function (e) {
    if (storyOpen) return;                                     // arrows belong to the story while it is up
    if (e.target.closest('button') && e.key === ' ') return;   // let buttons be buttons
    if (e.key === 'ArrowRight') { go(current + 1); restart(); }
    else if (e.key === 'ArrowLeft') { go(current - 1); restart(); }
    else return;
    e.preventDefault();
  });

  /* ------------------------------------------------------- story overlay */

  var storyBtn = document.querySelector('[data-story]');
  var storyEl = document.querySelector('[data-story-overlay]');

  function setStory(open) {
    storyOpen = open;
    storyEl.classList.toggle('is-open', open);
    storyBtn.setAttribute('aria-expanded', String(open));
    storyBtn.textContent = open ? 'Close Story' : 'Our Story';

    // The overlay is opaque, so advancing slides behind it would only fetch
    // and decode photographs nobody can see.
    open ? suspend() : resume();

    if (!open) storyEl.scrollTop = 0;
  }

  storyBtn.addEventListener('click', function () { setStory(!storyOpen); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && storyOpen) setStory(false);
  });

  // Auto-moving content is opt-in for anyone who has asked for less motion.
  reduceMotion ? pause() : play();
})();
