/* ==========================================================================
   Peter & Consuelo — opening sequence

   Red field, wordmark, photograph, then the photograph settling into its place
   as the carousel's first slide. The fades are all CSS (see .intro in
   styles.css); this file owns the order they happen in, waits on the two
   things that can be slow — the fonts and the opening photograph — and drives
   the one move CSS cannot express on its own, the morph at the end.

   Nothing here is on a fixed clock. Each beat starts where the last one
   finished, so retiming the sequence means editing the custom properties in
   the stylesheet and nothing else.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  // Either JavaScript put the curtain up and it is still there, or the failsafe
  // in the head has already taken it down. Both mean there is nothing to run.
  if (!root.classList.contains('is-intro')) return;

  var intro = document.querySelector('[data-intro]');
  var frame = document.querySelector('[data-intro-frame]');
  var photo = document.querySelector('[data-intro-photo]');
  var PHOTOS = window.PHOTOS || [];

  /* Take over the failsafe armed inline in the head. That one has to assume the
     worst — that this file never arrived — so it is on a short fixed timer.
     From here the sequence knows what it is about to play and how long it is
     willing to wait, and arms a stop sized to that instead. */
  clearTimeout(window.introFailsafe);

  if (!intro || !frame || !photo || !PHOTOS.length) { finish(); return; }

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------- timings */

  /* Read straight off .intro, so the stylesheet is the only place any of these
     are written down. Values arrive as '850ms' or '0.85s'. */
  var css = getComputedStyle(intro);

  function ms(name) {
    var value = css.getPropertyValue(name).trim();
    if (!value) return 0;
    var n = parseFloat(value);
    if (isNaN(n)) return 0;
    return value.slice(-2) === 'ms' ? n : n * 1000;
  }

  var T = {
    throbberIn: ms('--intro-throbber-in'),
    hold:       ms('--intro-hold'),
    nameIn:     ms('--intro-name-in'),
    nameHold:   ms('--intro-name-hold'),
    photoIn:    ms('--intro-photo-in'),
    photoHold:  ms('--intro-photo-hold'),
    nameOut:    ms('--intro-name-out'),
    roundAt:    ms('--intro-round-at'),
    round:      ms('--intro-round'),
    morph:      ms('--intro-morph'),
    reveal:     ms('--intro-reveal'),
    revealIn:   ms('--intro-reveal-in'),
    photoWait:  ms('--intro-photo-wait')
  };

  var EASE = css.getPropertyValue('--intro-ease').trim() || 'ease';

  /* --------------------------------------------------------------- tools */

  function wait(delay) {
    return new Promise(function (resolve) { setTimeout(resolve, delay); });
  }

  /* Ready means *decoded*, not merely fetched. Fading in a photograph the
     browser has yet to decode drops frames at exactly the wrong moment, and at
     this size the decode is not free.

     Capped, because a photograph that never arrives must not strand the page
     behind a red curtain — and resolves false when the cap is what ended the
     wait, so the caller can tell "here it is" from "it never came". */
  function ready(img, cap) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(ok) {
        if (settled) return;
        settled = true;
        resolve(ok === true);
      }

      setTimeout(function () { done(false); }, cap);

      if (img.decode) {
        img.decode().then(function () { done(true); }, function () { done(false); });
        return;
      }
      if (img.complete) { done(true); return; }
      img.addEventListener('load', function () { done(true); });
      img.addEventListener('error', function () { done(false); });
    });
  }

  /* ---------------------------------------------------------- the wait */

  /* Nothing in the sequence can begin until the Typekit faces are usable, and
     on a cold cache that is a real wait with nothing on screen but red. The
     throbber owns that gap — but only if the gap turns out to be long enough
     to be worth admitting to, which is what the timer is for.

     Whichever comes first wins: the fonts settle and the timer is cancelled
     before the throbber was ever shown, or the timer fires and the throbber
     stands there until they do. */
  var throbberTimer = setTimeout(function () {
    intro.classList.add('is-waiting');
  }, T.throbberIn);

  function doneWaiting() {
    clearTimeout(throbberTimer);
    // A no-op if it never came up, and a fade if it did — the class is the
    // only thing holding it visible either way.
    intro.classList.remove('is-waiting');
  }

  /* ------------------------------------------------------- the photograph */

  /* The same candidates the <link rel="preload"> in the head asked for, so this
     is a cache hit rather than a second download of the same photograph. */
  var first = PHOTOS[0];
  photo.srcset = window.slideSrcset(first);
  photo.src = 'assets/photos/lg/' + first[0] + '.webp';

  /* How much bigger than "contained in the viewport" the photograph has to be
     drawn to cover it. Kept in a custom property because CSS holds the resting
     state and this is part of it.

     Deliberately not `object-fit: cover`: cover crops, and the morph at the end
     has to grow the visible photograph back out to its whole self. Pixels cover
     has thrown away cannot come back. Contain keeps the entire photograph in
     the element and lets the frame's clip decide how much of it shows. */
  function coverScale() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var pw = photo.naturalWidth || first[1];
    var ph = photo.naturalHeight || first[2];
    var contain = Math.min(vw / pw, vh / ph);
    var cover = Math.max(vw / pw, vh / ph);
    return contain > 0 ? cover / contain : 1;
  }

  function sizeToViewport() {
    frame.style.setProperty('--intro-cover-scale', String(coverScale()));
  }

  sizeToViewport();
  window.addEventListener('resize', sizeToViewport);

  /* -------------------------------------------------------- the corners */

  /* The slide rounds its corners only while the photograph is letterboxed, and
     works the radius out in CSS — 12px, or 0 once the photograph runs the full
     width of the stage. Whatever it settled on is what the intro has to arrive
     wearing.

     This is a beat of its own rather than something folded into the morph. The
     photograph is holding still at full bleed, so the corners lifting off the
     four corners of the screen is the only thing moving and reads clearly; the
     same 12px arriving *during* the morph is lost against a photograph racing
     down to a fifth of its size. */
  var destRadius = 0;

  function roundCorners() {
    var dest = window.Carousel && window.Carousel.slideImage
      ? window.Carousel.slideImage()
      : null;

    if (!dest) return Promise.resolve();

    destRadius = parseFloat(getComputedStyle(dest).borderTopLeftRadius) || 0;

    // Nothing to round to: on a narrow screen the slide drops its corners
    // entirely, so this beat simply does not happen.
    if (!destRadius) return Promise.resolve();

    var rounding = frame.animate([
      { clipPath: 'inset(0px round 0px)' },
      { clipPath: 'inset(0px round ' + destRadius + 'px)' }
    ], { duration: T.round, easing: EASE, fill: 'forwards' });

    return rounding.finished
      ? rounding.finished.catch(function () {})
      : wait(T.round);
  }

  /* ---------------------------------------------------------- the morph */

  /* Full bleed to the slide's own box. Two animations in step:

       - the photograph scales down and travels to the slide's centre
       - the frame's clip closes in from the viewport onto the slide's box

     The photograph is drawn at `contain` scale x a factor, so its scale factor
     alone decides how big the whole photograph is: at the end it is exactly the
     size the slide draws it, sitting exactly where the slide draws it. The clip
     is what turns a full-bleed crop into a letterboxed photograph — by the time
     it lands the frame is the same rectangle the photograph fills, so there is
     nothing left to crop, and the two images coincide pixel for pixel. */
  function morph() {
    var dest = window.Carousel && window.Carousel.slideImage
      ? window.Carousel.slideImage()
      : null;

    if (!dest) return Promise.resolve();

    // Landing on a slide that has not painted yet would blink when the curtain
    // comes off. Same file as ours, so this is normally already settled.
    return ready(dest, T.photoWait).then(function () {
      var box = dest.getBoundingClientRect();
      if (!box.width || !box.height) return;

      var vw = window.innerWidth, vh = window.innerHeight;
      var pw = photo.naturalWidth || first[1];
      var ph = photo.naturalHeight || first[2];

      var contain = Math.min(vw / pw, vh / ph);
      if (!contain) return;

      var from = coverScale();          // covering the page
      var to = (box.width / pw) / contain;  // the size the slide draws it

      // Both boxes are centred on their own container, so only their centres
      // need to meet.
      var dx = (box.left + box.width / 2) - vw / 2;
      var dy = (box.top + box.height / 2) - vh / 2;

      // Already rounded by the beat before this one, so the radius is simply
      // carried across the move rather than animated again. Re-read as a
      // fallback in case that beat was skipped.
      var radius = destRadius ||
        parseFloat(getComputedStyle(dest).borderTopLeftRadius) || 0;

      /* The frame is the viewport and is never transformed, so the clip is just
         the slide's box written as insets from each edge.

         Both animations are handed the same easing and left to the browser.
         That matters: down the axis the cover crop does *not* overflow, the
         clip edge and the photograph's edge sit exactly on top of each other
         for the whole morph, and easing them identically is what keeps a
         sliver of backdrop from opening up between them. */
      var clip = 'inset(' +
        box.top + 'px ' +
        (vw - box.right) + 'px ' +
        (vh - box.bottom) + 'px ' +
        box.left + 'px round ' + radius + 'px)';

      var options = { duration: T.morph, easing: EASE, fill: 'forwards' };

      var moving = photo.animate([
        { transform: 'scale(' + from + ')' },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + to + ')' }
      ], options);

      frame.animate([
        { clipPath: 'inset(0px 0px 0px 0px round ' + radius + 'px)' },
        { clipPath: clip }
      ], options);

      // The page arrives underneath while the photograph is still on its way in.
      setTimeout(reveal, T.revealIn);

      return moving.finished ? moving.finished.catch(function () {}) : wait(T.morph);
    });
  }

  /* ---------------------------------------------------------------- end */

  function reveal() { intro.classList.add('is-revealing'); }

  var over = false;
  var abandoned = false;   // the photograph never turned up; see the sequence below
  var hardStop = null;

  function finish() {
    if (over) return;
    over = true;

    clearTimeout(hardStop);
    clearTimeout(throbberTimer);
    window.removeEventListener('resize', sizeToViewport);
    root.classList.remove('is-intro');
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);

    // The photograph the sequence has been holding and the carousel's first
    // slide are the same photograph in the same place, so taking the curtain
    // away changes nothing on screen. Now the slideshow can have it.
    if (window.Carousel) window.Carousel.start();
  }

  /* ----------------------------------------------------------- sequence */

  /* Every beat, plus both waits on a slow photograph, plus room to spare. If
     the chain below has not reached finish() by then, something in it has hung
     and the page gets handed over regardless. */
  hardStop = setTimeout(finish,
    T.hold + T.nameIn + T.nameHold + T.photoIn + T.photoHold +
    T.nameOut + T.roundAt + T.round + T.morph + T.photoWait * 2 + 3000);

  /* Motion from end to end, so there is no gentler version of this to play for
     anyone who has asked for less of it. Clear the red and hand over. */
  if (reduceMotion) {
    window.fontsReady
      .then(function () { doneWaiting(); reveal(); return wait(T.reveal); })
      .then(finish, finish);
    return;
  }

  window.fontsReady
    /* Held until the real face is usable, so the wordmark is painted once. The
       throbber leaves as the hold begins, so the two cross in the middle of the
       screen rather than one waiting on the other. */
    .then(function () { doneWaiting(); return wait(T.hold); })

    .then(function () {
      intro.classList.add('is-name-in');
      return wait(T.nameIn + T.nameHold);
    })

    /* The photograph gates the rest of the sequence rather than being timed
       into it: on a slow connection the red holds a little longer, which is a
       poised opening, where playing the remaining beats out over an empty frame
       would be a broken one. */
    .then(function () { return ready(photo, T.photoWait); })

    .then(function (arrived) {
      if (arrived) {
        sizeToViewport();             // the viewport may have moved by now
        intro.classList.add('is-photo-in');
        return wait(T.photoIn + T.photoHold);
      }

      /* It never came. The rest of the sequence is *about* the photograph, so
         there is nothing left to perform: take the wordmark and the red away
         together and let the page have it. The carousel shows the photograph
         itself the moment it lands. */
      abandoned = true;
      intro.classList.add('is-name-out');
      reveal();
      return wait(Math.max(T.reveal, T.nameOut));
    })

    .then(function () {
      if (abandoned) return;
      intro.classList.add('is-name-out');

      /* The photograph starts changing as the wordmark starts clearing rather
         than waiting for it to finish. --intro-round-at is 0, so this is the
         same frame; it exists so the two can be pulled apart again from the
         stylesheet alone. */
      var rounding = T.roundAt
        ? wait(T.roundAt).then(function () { return abandoned ? null : roundCorners(); })
        /* Called straight out rather than through wait(0): a zero timeout is
           still a macrotask, and would put the corners a whole frame behind the
           class that starts the wordmark fading. */
        : roundCorners();

      /* The morph then waits on *both*, so the photograph never starts moving
         while the wordmark is still fading over it — even at 5% that is a
         ghost of the type sliding across a photograph, which reads as a fault
         rather than as a fade.

         Which of the two runs longer depends entirely on how they are timed in
         the stylesheet, and those numbers are meant to be played with, so
         neither is assumed to be the slower one. */
      return Promise.all([rounding, wait(T.nameOut)]);
    })

    .then(function () { return abandoned ? null : morph(); })
    .then(finish, finish);
})();
