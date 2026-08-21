# Peter & Consuelo

A single-page static wedding site: a fixed header over a full-viewport photo
carousel of 189 photographs. No framework, no build step for the site itself —
just `index.html`, one stylesheet and one script, deployed to GitHub Pages.

Live at <https://peterlockhart.github.io/peterandconsuelo/> once Pages is
enabled (Settings → Pages → deploy from `main`, root).

## Running locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. It has to be served over HTTP rather than
opened as a `file://` URL, or the relative asset paths won't resolve.

## Layout

```
┌────────────────────────────────────┐
│ Peter & Consuelo       [Our Story] │  60px
├────────────────────────────────────┤
│                                    │
│             [ photo ]              │  calc(100dvh - 60px)
│   1/189                       ⏸    │
│ ▭▭▭▭▭▭▭▭ thumbnails ▭▭▭▭▭▭▭       │
└────────────────────────────────────┘
```

Header and carousel fill the viewport exactly; the page itself never scrolls.
Photos are `object-fit: contain`, so they are never cropped — the letterboxing
falls back to the near-black stage colour.

## Files

| Path | |
|---|---|
| `index.html` | Markup, plus an inline script that preloads the opening photo |
| `assets/css/styles.css` | All styling. The palette lives in `:root` custom properties |
| `assets/js/carousel.js` | Carousel state: current slide, autoplay, image hydration |
| `assets/js/photos.js` | **Generated.** `window.PHOTOS = [[id, width, height], …]` |
| `assets/photos/{thumb,md,lg}/` | **Generated.** 189 WebP files each |
| `scripts/build-images.sh` | Regenerates the two above from the masters |
| `.nojekyll` | Stops GitHub Pages running the files through Jekyll |

## Photos

The 189 masters (~98 MB of 2048px JPEGs) are **deliberately not in this repo**.
They live alongside it, untracked:

```
peterandconsuelo/                  ← this repo
peterandconsuelo-photo-masters/    ← the masters
```

> [!IMPORTANT]
> That folder is the only copy. It is not backed up by this repo, and it is not
> in git history. Keep a copy somewhere else.

Only the optimised derivatives are committed (~36 MB total). To regenerate them
after adding or removing photos:

```sh
./scripts/build-images.sh                 # uses ../peterandconsuelo-photo-masters
./scripts/build-images.sh /path/to/photos # or point it somewhere else
PHOTO_MASTERS=/path/to/photos ./scripts/build-images.sh
```

Requires `cwebp` (`brew install webp`) and `sips` (built into macOS). The script
is incremental — it skips any derivative that is already newer than its master,
so re-running after adding a few photos is quick. It also rewrites
`assets/js/photos.js`, so commit that alongside the new images.

Three variants are produced, each capping the photo's **long** edge:

| Variant | Long edge | Quality | Typical size | Used for |
|---|---|---|---|---|
| `thumb` | 240px | 68 | ~7 KB | Thumbnail rail |
| `md` | 1000px | 74 | ~51 KB | `srcset` candidate |
| `lg` | 1800px | 78 | ~138 KB | `srcset` candidate |

## How the carousel works

**The crossfade is pure CSS.** A slide that loses `.is-active` gets
`transition: opacity 0s linear var(--fade)` — it holds fully opaque *underneath*
the incoming slide for the length of the fade, then snaps out. That gives a true
crossfade with no dip to the background colour, without JavaScript animating
anything. JS only toggles a class.

**Only five images are ever loaded.** Putting 189 `<img>` tags on the page with
`loading="lazy"` would not work: every slide is stacked in the same position, so
the browser considers all of them in-viewport and fetches the lot. Instead the
slides start with no `src` at all, and `carousel.js` hydrates the current slide
±2, evicting anything beyond ±4. The thumbnail rail *can* use native
`loading="lazy"`, because it genuinely scrolls horizontally.

**Width descriptors are computed per photo.** Since the build caps the long
edge, a portrait `lg` file is 1199px wide, not 1800. `window.slideSrcset()` in
`index.html` derives the real width from each photo's aspect ratio, and is
shared by both the preload `<link>` and the `<img>` so the two can never
disagree and trigger a double fetch.

Other behaviour: autoplay advances every 5s and stops entirely in a background
tab; left/right arrow keys work; under `prefers-reduced-motion` the crossfade is
disabled and autoplay **starts paused**.

## Theming

The palette is a handful of custom properties at the top of `styles.css`:

```css
--paper:  #171410;   /* header + thumbnail rail */
--stage:  #0b0908;   /* letterbox behind a contained photo */
--ink:    #f0e9df;
--accent: #cba97b;   /* "Our Story", active thumbnail */
```

The floating play/pause and counter sit on *photographs* rather than on the
theme background, so they use separate `--scrim` / `--on-scrim` tokens and stay
dark whichever way the theme goes. Changing `--ink` will not break them.

Two things live outside the stylesheet and need updating by hand if the palette
changes: the `theme-color` meta tag and the inline SVG favicon, both in
`index.html`.

## Gotchas

- **`min-width: 0` on the carousel grid items is load-bearing.** Grid and flex
  items default to `min-width: auto`, so the 189-item thumbnail track will
  happily set the page width to ~17,000px, pushing the header button and
  play/pause off-screen. Removing it looks like a blank page.
- **Typography is a system serif stack**, so there are zero font requests. An
  obvious place to drop in a real typeface later.
- **The "Our Story" button has no handler yet** — the markup carries a
  `data-story` hook for it.
