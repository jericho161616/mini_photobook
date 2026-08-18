# Moments — Mini Photobook

A local-first photobook designer. Point it at a folder of photos, pick a trim
size, and it lays out a book you can rearrange by hand and export as a
print-ready PDF.

**Nothing is uploaded.** No account, no server, no paid tier. Your photos never
leave your machine — they live in your browser's IndexedDB and are read straight
off disk. The app works with the network switched off, and there is no asset it
needs to fetch: every sticker, texture and frame is drawn in code at render time.

---

## Contents

- [Running it](#running-it)
- [The idea in one minute](#the-idea-in-one-minute)
- [How the layout engine works](#how-the-layout-engine-works)
  - [Sizes, shapes and templates](#sizes-shapes-and-templates)
  - [How a page picks its layout](#how-a-page-picks-its-layout)
  - [Slots, placements and the two render paths](#slots-placements-and-the-two-render-paths)
  - [Folded sheets and halves](#folded-sheets-and-halves)
- [Working with books](#working-with-books)
- [Photos](#photos)
- [Pages](#pages)
- [Layouts](#layouts)
- [Decorating a page](#decorating-a-page)
- [Text](#text)
- [Colour](#colour)
- [Placing things precisely](#placing-things-precisely)
- [Viewing](#viewing)
- [Exporting](#exporting)
- [How it's built](#how-its-built)
- [Not built yet](#not-built-yet)

---

## Running it

```bash
npm install
npm run dev
```

That opens `http://localhost:5173`. For a static build:

```bash
npm run build
npm run preview
```

There is nothing else to configure — no keys, no env file, no backend.

---

## The idea in one minute

A **book** has a **trim size** (say 8×8 in) and an ordered list of **pages**.
Each page has one **template**, which is a set of **slots** — rectangles given
in percentages of the page. A **placement** puts one photo in one slot, along
with how it's cropped and how it's treated.

Everything else — stickers, text boxes, background photos, frames — hangs off
that. The layout engine's job is only to choose sensible templates and pour
photos into them; from there you rearrange by hand.

Two rules explain most of the behaviour:

1. **Percentages, not pixels.** Every slot, sticker and text box is stored as a
   percentage of its container, so the same book renders correctly at editor
   size, at full-screen size, and at 300 DPI for print.
2. **Two render paths that must agree.** The editor draws with React and CSS;
   the export draws the same page onto a `<canvas>`. Anything visual has to be
   implemented in both, and shared constants live in `src/lib/imageUtils.ts` so
   the two can't drift.

---

## How the layout engine works

### Sizes, shapes and templates

There are **20 trim sizes**: 18 ordinary ones across five groups — squares,
landscapes, portraits, the A-series (A6 to A3), and digital/print oddities
(Polaroid, Instagram Story, 4R) — plus two **folded sheets** (see below).

Each size carries its dimensions in inches, a `maxPhotosPerPage` ceiling, and
optionally a `minPages` floor (Instagram Story can be a single page; everything
else starts at 10).

Every size resolves to one of three **shapes**, purely from its aspect ratio:

| Ratio | Shape |
|---|---|
| > 1.15 | `wide` |
| 0.87 – 1.15 | `square` |
| < 0.87 | `tall` |

There are **55 templates** in three families:

- **Minimal** (21) — quiet grids and single-photo pages.
- **Portfolio** (25) — the ones with character: Poster Overlay, Circle Inset,
  Postage Stamp Duo, Instant Grid, Confetti Scatter, Before/After.
- **Instagram** (9) — vertical story layouts, only offered on Instagram Story.

A template declares which shapes it `fits`, how many slots it has, and
optionally a caption area, a note area, a decoration style, and per-slot
rotations.

### How a page picks its layout

When you create a book or press **Re-flow**, `layoutPages()` walks the pages in
order and, for each one, scores every eligible template:

1. **Photo count.** A page may take at most `maxPhotosPerPage`, and never so
   many that later pages would run dry — every remaining page should get at
   least one photo.
2. **Aspect fit.** The main cost. Each of the template's slots is compared
   against the photo that would land in it, and the average mismatch between
   the photo's aspect ratio and the slot's is the score. A tall portrait in a
   wide letterbox slot scores badly.
3. **Shape penalty.** A template that doesn't list the book's shape gets
   `+1.5`. That's a strong nudge, not a ban — an unusual trim size never runs
   out of options.
4. **Cover bias.** Page one prefers a template with a caption area, so the book
   opens with its title. No other page does.
5. **Variety.** Repeating the previous page's template is penalised, so a book
   doesn't come out as twenty identical grids.

The lowest score wins. **Locked pages are skipped entirely** — Re-flow relays
out everything else around them.

### Slots, placements and the two render paths

A `SlotRect` is `{ x, y, w, h }` in percent, measured **inside** the page
margin (9% by default, adjustable per page). A `Placement` is what actually
sits in a slot:

```
photoId, offsetX, offsetY, zoom      — the crop
filter, opacity, grain               — the treatment
frame, frameColor                    — polaroid / hairline / stamp card
attachment, attachmentColor          — tape / clip / paperclip
rotation, overlayPosition            — for overlay templates
```

Because a placement holds all of that, **one photo in the library can appear on
many pages with a different crop and treatment each time.** There's no need to
import it twice.

`resolveSlotStyle()` in `src/lib/imageUtils.ts` is the single place that decides
which frame and decoration a given slot gets, combining the template's own
design with the placement's choices. `PageView` and `exportPdf` both call it, so
the screen and the PDF can't disagree.

### Folded sheets and halves

**A4 Folded — Portrait** and **A4 Folded — Landscape** are single sheets meant
to be folded down the middle. They offer exactly two layouts:

- **One photo across the whole sheet**, running over the fold.
- **Split at Fold**, where each half becomes an independent mini-page with its
  own template, photos, note, and stickers.

A split page stores a `halves: [HalfLayout, HalfLayout]` tuple, and the Layout
panel gains half tabs. `decorationHost()` is the helper that answers "which
object do stickers belong to here" — the page, or one of its halves.

---

## Working with books

**My Books** is the front door. Every book keeps its own photo library, pages,
fonts, drawings and colours — nothing is shared between them. From a card you
can rename inline, **duplicate** (a true independent copy), or delete.

**Deleting moves to Trash**, not oblivion. A trashed book is restorable for 30
days, after which it's cleaned up automatically. *Delete Forever* and *Empty
Trash* skip the wait.

**Reset book** wipes one book's photos and pages. Because that can't be undone
— the photo files themselves are gone — it asks you to **type `DELETE`**, and
tells you exactly how many photos and pages will go.

---

## Photos

Drop files onto the tray, or use **Add photos**. Accepted: JPEG, PNG, WebP,
AVIF. Each import produces a full-resolution blob (kept for print) and a
downscaled thumbnail (used everywhere else), so scrolling a large library
doesn't decode originals.

### Duplicate detection

Every incoming file is checked three ways, and anything that matches is shown to
you rather than silently dropped:

| Kind | How it's found | Default |
|---|---|---|
| **Same file** | SHA-256 of the bytes | skip |
| **Same picture** | a dHash fingerprint of the image itself | skip |
| **Same name** | filename match | keep |

**"Same picture" catches what a byte hash can't** — a re-export, a screenshot,
a copy that came back through a chat app. It shrinks the image to 9×8 greyscale
and records whether each pixel is brighter than its right-hand neighbour; those
64 bits survive resizing and recompression. Two pictures match within a Hamming
distance of 6.

A shared filename is treated as weak evidence (two cameras both produce
`IMG_0042`), so those default to being kept while confident matches default to
being skipped. Nothing is saved or dropped until you answer.

### Placing photos

Three ways, because dragging isn't always convenient:

- **Drag** a photo from the tray onto a slot.
- **Click a slot** for a quick picker of recently unplaced photos.
- **Click photos in the tray first**, then click slots — they're placed in the
  order you picked them up. Escape cancels.

Click a filled slot to adjust it; **Delete** clears it.

---

## Pages

The **filmstrip** along the bottom is the page list. The active page is marked
with a thick ring and a filled number badge.

- **Reorder** by dragging. An insertion line shows exactly which gap the page
  will land in — the left half of a thumbnail means *before*, the right half
  *after*. The page being carried fades out.
- **Jump** a page to the front or back with the ⇤ / ⇥ buttons that appear on
  hover — faster than dragging past thirty thumbnails.
- **Insert** a page at any gap with the `+` between thumbnails.
- **Delete** a page with its ×, or press Delete with it selected.
- **Lock** a page (🔒 on its thumbnail) to protect it from Re-flow, drops,
  panning and reordering. The pinned button at the left end locks or unlocks
  **every** page at once.

**Re-flow** in the top bar lays the book out again from scratch, leaving locked
pages untouched. It grows a warning dot when you have more photos than the
current page count can hold.

Pages in the A4 family can individually switch between portrait and landscape,
so one book can mix them.

---

## Layouts

The **Layout** panel shows the current template and a **Change** button that
opens the full picker — 55 templates, filterable by family and by photo count.
Folded sheets skip the picker entirely and show their two choices inline, since
a binary choice doesn't need a modal built for 55 options.

Some templates have distinctive behaviour worth knowing:

- **Poster Overlay** and friends tape a second photo on top at an angle. The
  pin can be tape, a paperclip, or nothing, per template.
- **Circle Inset** cuts the second photo into a centred circular portrait.
- **Before/After** draws a divider and small labels between two photos.
- **Window** forces the first photo to greyscale and cuts a sharp colour window
  through it at the second.
- **Split at Fold** gives each half of a folded sheet its own layout.

---

## Decorating a page

**Page background.** A tinted cardstock colour, or a photo. A background photo
gets its own controls: which portion of the page it **covers** (whole / left /
right / top / bottom), a **filter**, **opacity**, **grain**, and **darken**.

Opacity and darken do different things and both are useful: opacity fades the
photo towards the paper (keeping its colour), while darken lays a scrim over it.

**Filters** apply to any photo — in a slot or as a background:

| Filter | What it does |
|---|---|
| B&W, Sepia, Negative | straightforward colour treatments |
| **Film** | warm shift, boosted saturation, plus fine grain |
| **Paper** | a creased-printed-paper texture, no colour change |

Film and Paper are drawn as blend-mode overlays rather than CSS `filter: url()`,
which silently no-ops in some browsers. The export draws the equivalent with
canvas composite operations, and scales the grain by export DPI so a 300 DPI
print gets the texture you saw rather than one four times finer.

**Stickers.** Washi tape in three colours, plus a heart, star and arrow. Select
one and a floating toolbar appears with rotate, flip, colour and opacity.

**Draw your own.** The drawing pad offers pen, pencil and marker with an
adjustable nib. Strokes are smoothed through quadratic curves rather than
straight segments, and translucent pens composite once per stroke so overlaps
don't blotch. A saved drawing joins the book's own sticker library and can be
stamped on any number of pages.

**Frames and attachments.** Any photo can take a polaroid card, a hairline rule
or a scalloped postage-stamp edge, in any of seven colours — a white polaroid on
white paper is nearly invisible, which is what the colour option is for. Photos
can also be pinned with tape, a binder clip or a paperclip.

---

## Text

Two kinds:

- **Page notes** sit in the area a template reserves for them. Not every layout
  has one; the panel says so when it doesn't. Templates style them differently —
  `ruled` draws diary lines, `quote` sets it large and italic, `stamp` puts it
  in a scalloped card.
- **Text boxes** go anywhere, on any page, at any size.

**Size is a number** — a percentage of the size the layout would pick on its
own, so it still adapts to the page — with S / M / L / XL beside it as presets.

### Fonts

Eight built-ins that are on every machine already. Beyond those, two ways to add
your own:

- **Add a font file** (`.ttf`, `.otf`, `.woff`, `.woff2`). Works everywhere and
  **travels with the book**, so opening it on another computer still shows the
  right typeface.
- **Scan my fonts** reads the families installed on your machine. Quicker, but
  Chromium-only and permission-gated, so the button doesn't appear elsewhere. A
  scanned font stores only its name and falls back to serif on a machine that
  hasn't got it.

Added fonts appear in every font menu in the book **and in the exported PDF** —
no font embedding needed, because the export rasterises each page to canvas.

---

## Colour

Every colour control — text, stickers, page background, photo frames, tape, and
the drawing pad's ink — is the same field:

- **Swatches** for speed.
- **A hex box.** Type `7B3F00`. Accepts `#fff` shorthand, with or without the
  `#`. It applies as you type, but only once the code is valid: a half-finished
  `7B3` changes nothing rather than flashing the page through wrong colours.
- **A colour wheel** — the OS picker, which on most systems also gives you an
  eyedropper to lift a colour off your own photo.
- **Recent colours**, remembered per book. Only colours you mixed by hand; a
  palette swatch is already one click away.

**Tape keeps its transparency.** Those colours are deliberately semi-opaque so
the photo shows through like real washi tape, so a typed hex is applied *at the
existing transparency* rather than turning the tape solid.

**Text colour overrides automatic contrast.** Notes normally flip between dark
ink and light parchment to stay legible; once you set a colour, that stops and
your choice wins.

---

## Placing things precisely

**Snapping.** While you drag a sticker or text box, its edges and centre are
compared against the page's edges and centre, against every other decoration,
and against your own guides. Anything within six pixels pulls it exactly onto
that line and draws a guide showing why it stopped. **Hold Alt** to drag freely.

**Rulers** (⋯ menu) run in **inches** — the unit the book is quoted and printed
in — with tick spacing chosen from how large the page is currently drawn.

**Guides.** Drag off a ruler to leave a guide line. Drag it to move; drag it off
the page to remove. Decorations snap to guides like any other line. Guides
belong to the **book**, not one page, so the same line falls in the same place
throughout — which is the whole point of placing one.

**Grid** (⋯ menu) marks tenths of the page with the centre lines picked out.

Rulers, guides and the grid are editor-only. **None of them ever prints.**

---

## Viewing

**Focus mode** (top bar) hides the browser's own chrome and collapses the drawer
so the page gets the room. The rail stays — click any section and the drawer
slides back without leaving focus. Leaving restores the drawer to how you had it.

**Full-screen page** (⤢ on the page corner) opens one page large over a dark
backdrop, with ‹ › and arrow keys to page through and a counter. For looking
rather than editing.

**Slideshow** (▶) plays the book with a cross-fade between pages.

**Preview whole book** (⋯ menu) renders a contact sheet of every page in order,
as a downloadable image.

**Dark mode** (☾) themes the app — but never the page. A page is paper in both
themes, because a printed page has no dark mode.

---

## Exporting

**Export PDF** renders every page at 300 DPI onto a canvas and embeds it, so
what you see is what prints. You can export the whole book or a page range.

The export re-implements everything the editor draws: filters, textures, grain,
frames, tape, stickers, custom drawings, notes, text boxes and background
photos. Where a value is shared between the two paths it lives in
`src/lib/imageUtils.ts` rather than being written twice.

---

## How it's built

React 19 + TypeScript + Vite. Zustand for state, Dexie over IndexedDB for
storage, jsPDF for assembly. No UI framework, no CSS framework, no icon package
— the icon set is drawn in `src/components/Icon.tsx` at one stroke weight.

### Layout of the source

```
src/
  data/
    sizes.ts        trim sizes, shapes, the A4 family
    templates.ts    all 66 templates
    fonts.ts        built-in font stacks and size scaling
  lib/
    autoLayout.ts   template scoring, page creation, re-flow
    imageUtils.ts   import, cropping maths, slot styles, shared constants
    exportPdf.ts    the canvas render of every page
    snap.ts         alignment targets and snapping
    colors.ts       hex parsing, alpha-preserving recolour, palettes
    fonts.ts        font registration (FontFace, local font scanning)
    perceptualHash.ts   dHash fingerprints for duplicate detection
    db.ts           Dexie schema and project persistence
  components/       36 components; PageView and exportPdf are the two
                    render paths that must stay in agreement
  state/useStore.ts single Zustand store — the whole editor's state
```

### Things worth knowing before changing it

- **Anything visual must be done twice** — once in `PageView`/`SlotView`, once
  in `exportPdf`. Shared numbers go in `imageUtils.ts`.
- **The page is paper in both themes.** Never paint text on a page with
  `var(--ink)`; it flips light in dark mode and vanishes on white paper.
- **Theme tokens are defined in four blocks** (`:root`, the
  `prefers-color-scheme` media query, `[data-theme='dark']`,
  `[data-theme='light']`). Miss one and the app half-themes.
- **Undo covers the layout, not the library.** Photos, fonts, guides and recent
  colours sit outside it — a deleted photo's file is genuinely gone, and undoing
  a caption edit shouldn't uninstall a font.

---

## Not built yet

- A mirror/flip photo effect (one photo duplicated with a strip flipped).
- A scrapbook direction: page paper textures, photo corners, torn edges, and a
  Scrapbook template family.
- Keyboard reordering of pages (`Alt` + arrows).
- Perceptual duplicate detection across *different books*, not just within one.
