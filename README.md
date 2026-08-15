# Moments — Mini Photobook

A local-first layout generator for photos. Point it at a folder, pick a size,
and it lays out something you can rearrange by hand and export — a photobook as
a print-ready PDF, or a social post as PNGs at exact Instagram dimensions.

Nothing is uploaded. There is no account, no server, and no paid service — the
photos never leave your machine.

## Running it

```bash
npm install
npm run dev
```

That opens `http://localhost:5173`. For a static build you can open from disk or
serve locally:

```bash
npm run build
npm run preview
```

## What it does

**My Books.** The app opens to a library of every book you've started —
click "Moments" in the top bar any time to come back to it. Each book keeps
its own separate photo library and pages; nothing is shared between them.
From a book's card you can rename it inline, duplicate it (a true
independent copy — editing the duplicate never touches the original), or
delete it. There's no limit on how many books you can keep beyond your
browser's own IndexedDB storage quota.

**Undo a mistaken delete.** Deleting a book doesn't erase it — it moves to
Trash (the button next to "+ New Book"), stays there for 30 days, and can be
restored back to My Books at any time before that. "Delete Forever" on a
trashed book (or "Empty Trash") skips the wait for when you're sure. Past 30
days a trashed book is quietly cleaned up on its own the next time you open
the app.

**You decide where every photo goes.** Importing photos only adds them to your
library — nothing gets placed automatically. A new book opens at the minimum
10 pages, empty, and there are three ways to fill a slot: drag a photo onto
it; click the empty slot for a quick picker of your still-unplaced photos
(newest first, with an "Open full library" way out for anything further
back); or click a photo first — in the tray, or via a "Place" button on each
thumbnail in "View & manage all photos" — then click the slot to drop it
there. Clicking more than one photo before placing queues them in the order
you clicked, so clicking a run of empty slots afterward — say, both halves
of a Split at Fold page — fills them one after another instead of one at a
time. Esc, or clicking a photo again, clears the pick-up list. Click a filled
slot to select it, then press Delete or Backspace to clear it (same as the
Remove button) — ignored while you're typing in a note, so it never eats a
keystroke by accident. An auto-layout engine exists (the "Re-flow" button)
for when you want a starting point or want to fill in the rest quickly: it
picks a template per page by comparing each photo's aspect ratio to the
shape of the slots available, and it skips any page you've locked.

**Photobook or social post.** Starting a new project asks which of the two
you're making before it asks anything else, because the answer changes what
the rest of the app offers. It isn't stored as a setting — the size decides
everything downstream — so switching a project to an Instagram format later
turns it into a post, and switching it back to a trim turns it into a book
again, with the same photos and layouts either way.

**Social posts export as PNGs.** Five formats, each pinned to the exact canvas
the platform expects: Portrait 1080×1350 (4:5, the safe default), Tall Portrait
1080×1440 (3:4, the shape of a profile-grid tile, so the post isn't cropped
when someone browses your grid), Square 1080×1080, Story 1080×1920, and
Landscape 1080×566. A post starts at one slide and grows to at most 20, which
is where Instagram and Facebook stop accepting them. Export writes one PNG per
slide — a single slide downloads on its own, several arrive as one zip named
after the post, numbered in posting order. PNG rather than JPEG because a slide
is often flat colour and type, which is exactly what JPEG smears.

Throughout a post the editor says "slides" where a book says "pages", and shows
pixels where a book shows inches. Everything else — the templates, the filters,
frames, tape, stickers, drawing pad, text boxes — is the same editor.

**Single-slide layouts.** Alongside the seamless ones there's a set for
ordinary slides: contact sheets at 3×3 and 4×3, a 2×2 Quad with a wide gutter
(set a dark page background and the gaps become heavy borders), a Triptych of
three landscape frames stacked down the middle with a line of type in the
corner, Short Over Tall for an uneven grid, a Ragged Grid whose rows don't
agree with each other and leaves one gap open on purpose, an Editorial Scatter
where nothing shares an edge with anything, and a Framed Pair — two bordered
prints laid square on a full-bleed photo behind them.

The feed formats allow up to twelve photos on one slide where no print trim
goes past nine: on paper a dozen photos reads as crowded, but on a phone a
contact sheet is a look people recognise, so the cap follows the medium.

**Seamless carousels.** A layout can be several slides wide. Pick one from the
Seamless group and the page becomes a single artboard that size; export cuts
the finished picture into that many images, so a photo lying across a cut
arrives as two halves on two consecutive slides and swiping reassembles it. The
cut is a crop of something drawn in one piece, which is why the join is
pixel-exact rather than nearly right. The editor and the filmstrip draw the
cuts as dashed guides so you can see what a photo is about to be split by while
you're still placing it, and one page counts as all of its slides towards the
20 — a three-slide artboard is labelled 3–5 in the strip.

There are three ways to use one, and they read very differently:

- **Panorama** puts a single picture behind every cut, in 2, 3, 4 or 5 slides
  wide. Best with something genuinely wide.
- **Across the Cuts** puts a separate photo *on* each cut, so the carousel is
  a set of distinct pictures that happen to be stitched together — each one
  half on one slide and half on the next. Alternating mixes those with photos
  sitting whole inside a slide, so every swipe changes what you're looking at.
- **Mosaic** tiles the whole strip edge to edge with no gutters, in columns of
  mixed width whose boundaries deliberately don't line up with the cuts. Every
  slide then opens on a partial photo and closes on another. In 2, 3, 4 or 5
  slides — five to eleven photos, since the tile count can't just scale with
  the width: a two-slide artboard is only 1.6× as wide as it is tall, so a
  full-height column there is nearly half the strip where on a five-slide one
  it's a sixth. **Mosaic Band** floats the same wall between 22% and 78% of the
  height with ground above and below, which is where a page background colour
  from the Decorate panel does most of the work.

Every one of these is placed by arithmetic rather than by eye — a box centred
on the cut at 33⅓% starts at `33.333 − w/2` — and they all bleed, because a
page margin would shift the percentages inward and every box would drift off
its cut.

**Photo layers.** A photo can also be placed on top of a page rather than into
a slot: drag it anywhere, resize it from the corner, overlap it with others,
let it hang off the edge, and restack it with bring-to-front and send-to-back.
Slots are a cage — the template decides where they are and two slots never
share ground — so this is the only way to get the scattered, overlapping
collage looks. Add them from the Decorate panel's "Photo layers" section. A
layer arrives sized to the photo's own shape, so it isn't cropped until you
crop it, and it carries the same filters, frames and tilt a slotted photo does.

**Draw your own layout.** You don't have to start from a template at all. The
Layout panel offers **Draw your own** beside the templates: one click empties
the slide and hands you the rectangle, which are the two steps drawing a layout
always begins with. (The same blank slide is in the picker as **Blank Canvas**
if you'd rather get there that way.) From then on you work with the tools
floating beside the page: rectangle, rounded box, ellipse, text. Drag anywhere
on the page to draw one, hold **Shift** to constrain a shape to a perfect
square or circle, and press **V**, **R**, **O** or **T** to switch tools
without reaching for them.

The tools sit on the canvas rather than in a sidebar for two reasons. Arming
one puts the editor in a mode — a drag draws instead of panning — and a mode
needs something visibly lit next to the thing it changes. And with the tools on
the canvas, drawing a layout needs no panel open at all, so the artboard stays
as large as the window allows.

Drawn boxes start empty, showing "Drop a photo" — fill one by dragging a photo
onto it, by clicking a photo in the tray and then the box, or by double-clicking
it to open the library. All three work just the same on a box that already has
a photo, so swapping one out never means redrawing the box, and the toolbar
adds **Replace photo** and **Remove photo** for when you'd rather say so
outright. Removing takes the picture out and leaves the box: the shape you drew
is the work, the photo in it isn't.

Boxes move, resize, overlap and restack exactly like any other photo layer, and
selecting one offers its shape and corner radius alongside the usual filters
and frames.

Corner radius is 0–50 measured against the box's *shorter* side, so a radius
looks the same on a wide box as a tall one and 50 always means fully rounded
rather than something different on each shape. An ellipse is its own shape
rather than a rectangle at maximum radius, because the two resize differently:
a rounded rectangle keeps its corner radius while the straight edges grow, an
ellipse restretches entirely. Both clip identically on screen and in the
exported PNG — `border-radius` one side, `roundRect`/`ellipse` the other, from
the same number.

Boxes land on a half-percent grid, which is fine enough not to fight you and
coarse enough that two boxes drawn to look aligned actually are. A drag that
turns out to be a click makes nothing rather than leaving a sliver behind, and
the tool returns to Select after each shape so it can't be left on by accident.

**Sizes across five groups.** Nine standard photobook trims (6×6 up to 14×11),
the ISO paper sizes a home printer actually takes (A6–A3, including A4
Landscape), the standard 4R photo-lab print in both orientations, a Polaroid-style
3.5×4.2 frame, and A4 Folded — a single A4 sheet folded once down the middle
into a small card, in a Portrait fold (fold a landscape sheet top-to-bottom)
or a Landscape fold (fold a portrait sheet left-to-right). A folded page can
carry two different photos, one on each side of the fold, or one photo
spanning the whole sheet — the fold line itself is always shown in the editor
as a dashed guide so you know where it lands, but it's never printed. A folded
page still offers the full general layout library too (grids, rows, collages),
not just its two fold-aware ones. Larger sizes allow denser pages — a 6×6 caps
at three photos per page where a 14×11 allows five. Changing size re-fits any
page whose layout no longer suits the trim.

**Each half of a folded page is its own little page.** On a folded sheet the
only page-level choice is how the sheet is divided — "Split at Fold" or one
photo across the whole thing. Everything else happens per half: pick Split at
Fold and each half gets its own Layout panel offering the whole general
template library, exactly as a standalone page would. One side can be a
Polaroid with a note while the other is a 2×2 grid or a three-tier column —
up to four photos per half, chosen independently, with the shape chips
filtering both halves the same way they filter a whole page.

You work one half at a time: a **Left half / Right half** toggle (or Top /
Bottom, depending on which way the sheet folds) switches which half the
sidebar is laying out, so the panel stays short and there's no reaching past
one half's options to get at the other's. The Page Note follows the same
toggle — each half keeps its own note, so a Polaroid + Note on one side and a
different note on the other both print in their own half.

This is deliberate rather than a restriction: a general layout applied across
a folded sheet would put a photo right over the crease, and folding the print
would ruin it. Keeping layouts inside a half means nothing ever lands on the
fold. Flipping the page's fold orientation keeps both halves' photos and
layouts; choosing "Full Sheet" collapses them into one photo spanning the
sheet, for when crossing the fold is what you actually want.

**Mix any A4 size, page by page.** A page sized A4, A4 Landscape, A4 Folded —
Portrait, or A4 Folded — Landscape gets a small per-page size picker, so a
single book can freely combine a plain full-sheet page, a landscape page, and
a folded-card page wherever you want them — not just two fixed orientations.
Locking a page also locks in whichever of the four it's currently set to.

**Five more layouts, and a black & white / sepia filter per photo.** Instant Grid
(six small photos, each in its own white card mount), Poster Overlay (a second
photo taped on top of the first at an angle), Circle Inset (a second photo set
into a centered white-ringed circle — always a true circle, whatever the
book's own shape), Full + Caption (a full photo with a quiet centered line
underneath), and Note Cover (a small centered photo with your own note below,
no title) round out the template library. Any photo in any slot can also be
set to black & white or sepia from the Selected Photo panel — useful on its
own, or paired with Poster Overlay or Circle Inset so the background photo
goes muted while the one on top stays in color.

**Fonts, bold, and size, on every note.** The Page Note — and a Split at Fold
half's own note — can be set to any of five fonts (a serif, the plain system
font, a typewriter face, and two handwritten-style scripts), toggled bold,
and sized from S to XL, all from a small picker right under the text box.
The three plain fonts are already on every computer; the two handwritten
ones fall back to a similar system font if the exact one isn't installed —
either way, nothing is ever downloaded. Free-placed text boxes (below) get
the same size control.

**Stickers and free-placed text.** A Decorate panel adds tape and simple
line-drawn heart/star/arrow stickers, plus text boxes you can drop anywhere
on a page — over a photo, off to the side, wherever — instead of being tied
to a template's fixed caption slot. Drag a sticker or text box to move it,
resize from the corner handle, click the × to remove it, and edit a text
box's words, font, bold, italic, and alignment right in place. A freshly
added text box opens straight into typing; after that, double-click it (or
click it again once it's already selected) to go back into edit mode —
otherwise a plain click-and-drag always just moves it, since it's easy to
mean "move this" and land on "edit this" when both share the same click.
On a Split at Fold page, stickers and text stay confined to whichever half
they were added to, so nothing ever lands on the physical crease.
Everything is drawn with plain CSS/SVG shapes — no downloaded images, icon
packs, or fonts — so it stays just as free and offline as the rest of the
app.

**Draw your own sticker.** "✏️ Draw a Sticker" in the Decorate panel opens a
small pad — pick from 8 colors, draw with mouse, touch, or stylus, then "Save
as Sticker" trims it to your drawing and adds it to this book's own sticker
library, right alongside the built-in tape/heart/star/arrow ones. Click it
from the tray any time to stamp another copy onto a page — draw once, reuse
everywhere. Deleting a drawing from the library also clears out any copies
already placed on a page, so nothing is left behind pointing at artwork that
no longer exists. Saved as a plain PNG on your own device — nothing is ever
uploaded anywhere.

**Per-photo frame and tilt, per-page tint and margin.** From the Selected
Photo panel's "Photo" tab, any photo can get a thin Hairline border or a
Polaroid-style white card mount, plus a manual tilt from -20° to 20° — on top
of whatever fixed tilt the template itself already applies (Confetti Scatter,
below). From the Layout panel, a whole page can take a tinted "cardstock"
background (a handful of warm/cool swatches, or back to plain paper) and a
Margin slider that loosens or tightens the template's own margin, from a
tight 30% up to a loose 200%. All of it prints exactly as shown, pixel for
pixel, in the exported PDF.

**Four more layouts.** Contact Sheet (nine small photos in a tight 3×3 grid),
Diary (three stacked photos beside a note on faint ruled-paper lines),
Confetti Scatter (seven photos tossed at their own fixed angles, like loose
prints on a table), and Before & After (two edge-to-edge photos split by a
quiet divider line, labeled accordingly) round out the template library —
Contact Sheet and Confetti Scatter need a Large-trim size or bigger to fit
their photo count.

**One page on screen, always.** The canvas shows exactly one page at a time,
sized to fill as much of it as it can, rather than pairing pages up like an
open book — a two-page spread mostly wasted space (a blank placeholder next
to a lone opening page, or dead air below a short, wide A4 Folded sheet)
without actually helping you work on either page faster. The ‹ › arrows
beside the page (or the filmstrip below) move to the page before or after,
one at a time — you never see two at once. A small ⤢ button in the corner
still opens it even larger in a full-screen overlay, for checking crops and
details up close — the same live page underneath, click the × or press Esc
to close it.

**Insert a page anywhere, not just at the end.** Small "+" gaps between the
filmstrip's page thumbnails (and one before the first page) drop a new blank
page in exactly that spot, shifting everything after it back by one — for
slotting a page in between two existing ones without disturbing either.

**Undo and redo.** Ctrl+Z (Cmd+Z on Mac) steps back through layout, text,
photo-placement, and decoration changes; Ctrl+Shift+Z or Ctrl+Y steps forward
again — matching toolbar ↺/↻ buttons sit next to Reset. A whole drag or
slider sweep collapses into one step rather than one per pixel. Typing in a
text field keeps its own native undo instead, so it doesn't fight this.
Photo library changes (importing or deleting a photo outright) aren't part
of this history, since a deleted photo's file is genuinely gone.

**Night and tinted page backgrounds.** Alongside the warm/cool cardstock
tints, a page background can go all the way to Night or Midnight navy — the
caption and note automatically switch to light parchment text whenever the
chosen background is dark enough to need it, so nothing goes unreadable.

**Two layout families, including full-bleed.** *Minimal* is one to a few photos
with room around them — including an edge-to-edge Full Bleed option with no
margin at all. *Portfolio* is editorial — rows, collages, covers, and a
bleed diptych where two photos touch with no gutter between them. Filter
either family by page shape (square / tall / wide) and mix shapes freely
from page to page.

**Lock a page.** Once a page is the way you want it, lock it — a locked page
ignores template changes, photo drops, panning, reordering, and even the
"Re-flow" button, so a stray click elsewhere in the book can't disturb it.

**Full manual control.** Drag photos from the tray into any slot, swap the
template on any page, drag within a slot to reframe, zoom from 1× to 3×, and
reorder pages by dragging thumbnails in the filmstrip.

**Page count from 10 to 30**, adjustable at any time. Resizing keeps the pages
you have already worked on and only adds or trims from the end.

**Duplicate photos are caught automatically.** Each imported photo is
fingerprinted from its own file bytes (a quick hash, computed locally —
nothing leaves your device), so re-importing the same file — even under a
different name, or selected twice in the same batch — is skipped instead of
adding a visible second copy. A small note under the "Add photos" button
says how many were skipped, if any.

**Five more layouts.** Polaroid Strip (three prints stacked on a dark page,
like a contact strip — pairs well with the Night background), Overlapping
Duo (two tilted taped photos layered over a full background photo), Postage
Stamp Duo (a photo and a short line of text, each in a scalloped stamp
frame), Quote Card (one photo, a big italic line doing the talking), Photo
Window (a grayscale background with a sharp color window cut into it — no
tape, no rotation, just an inset), and Text Divider (no photo at all — a
title/quote page to open or close a section of the book).

**Tape, clips, and a stamp frame — all customizable.** Any photo taped on
top of another (Poster Overlay, Overlapping Duo) now has its own tape color,
picked from a small swatch row, and its own spot to sit in — a 3×3 grid of
preset positions instead of one fixed place. Any photo can also carry a
Binder Clip or Paperclip instead of tape, and a fourth Frame option, Stamp,
cuts a scalloped postage-stamp edge around the photo. All of it — the tape
color, the clip, the stamp's scalloped cut — prints exactly as shown.

**A Negative filter** joins Color / B&W / Sepia in the Selected Photo panel.

**PNG stickers from your own files.** An "Upload Image" button next to "Draw
a Sticker" in the Decorate panel lets you add any image — a graphic you
downloaded, a transparent PNG — as a draggable, resizable sticker, stored
alongside your own drawings in this book's sticker library. Large images are
downscaled on the way in so the book's own storage stays small.

**Three more font stacks**: Brush Script, Condensed, and Slab Serif, joining
the original five — still every one either already on your computer or a
close, free system equivalent, so nothing is ever downloaded.

**Titled cover.** Page one uses a cover layout carrying the book title, which
renders in the editor and in the exported PDF.

**A photo tray that only shows what you still need.** Once a photo is placed
on a page it drops out of the tray — there's no reason to keep dragging past
photos you've already used. "View & manage all photos" opens a larger grid
of the full library, defaulting to the Unplaced filter (since that's almost
always what you're there to find), with Placed and All alongside it. Check
off several photos to remove them at once — or to place them all in one go
with "Fill Next", which drops them into the next empty slots in order,
starting from the page you're on and continuing into later pages as needed,
skipping locked pages and slots that already have a photo.

**Book size is a one-time decision.** The sidebar shows your current size and
a "Change" button rather than the full picker sitting there permanently —
that space goes to photos and layout instead. The picker itself is grouped
into Photobook trims, printer paper (A6–A3), and novelty (Polaroid).

**Light and dark themes**, matching your OS by default with a manual toggle in
the top bar that's remembered next time you open the app. Both themes use an
"Ink & Parchment" palette — aged-paper cream with a deep ink accent in light
mode, a near-black ground with parchment panels and antique gold in dark
mode — carried through the editor, exported PDFs, and the on-page note text.

**A tabbed editing panel**, not one long stack you scroll through. Selected
Photo, Page Note, Layout, and Decorate live behind Photo/Note/Layout/Decorate
tabs on the right, so the panel stays a fixed height no matter how much any
one section grows — the doodle pad, say — instead of pushing everything below
it further down the page.

**300 DPI PDF export** at true trim dimensions. Pages are drawn programmatically
onto a canvas rather than screenshotting the editor, so the output is genuinely
print resolution and every crop matches what you arranged on screen.

**Export just a page range.** Export PDF opens a small dialog asking which
pages to include — the whole book by default, or a "From – To" range (say,
pages 5–18) for a proof of one section or a reprint of only what changed.

Work is saved to the browser's IndexedDB as you go and restored when you reopen
the app.

**Thumbnails are actually thumbnails.** Each photo gets a small (320px)
downscaled copy generated once at import; the tray, filmstrip, and library
grid all use that instead of decoding the full-resolution original at
postage-stamp size. Only the main editing canvas and the PDF export touch
the full-resolution file.

**A reorganized Layout panel and Selected Photo panel**, once both had grown
long enough to make the thing you wanted hard to find. The Layout panel now
splits into two collapsible sections — "Choose a template" (open by default)
and "Page styling" (background tint and margin, collapsed by default since
it's changed far less often) — and a second "style" filter (Classic / Grids
/ Overlays / Text-forward / Novelty) sits alongside the existing shape filter
so ~40 templates stay browsable. The Selected Photo panel's controls are now
grouped under Crop / Style / Position headers instead of one flat stack, with
no change to what any control does.

**A background photo for any page**, alongside the existing tinted-cardstock
option — pick any photo (even one already placed in a slot elsewhere) to fill
the page behind its slots, with a Darken slider so foreground photos and
captions stay legible. A Covers control picks how much of the page it
fills — the whole page, or just its left/right/top/bottom half, leaving the
rest plain background. Not offered on Full Bleed or Full Sheet templates,
since those pages are already entirely one photo with nothing behind them to
layer. Prints exactly as shown, same as everything else. Lives in the
Decorate tab's Page Styling section, open by default, alongside the Margin
slider.

**Preview Book**, next to Export PDF, renders every page in order into one
downloadable image — a quick way to check the whole book's flow without
paging through it one screen at a time. It reuses the exact same per-page
drawing code as the real PDF export, just at thumbnail resolution.

**"Slate Studio" — a flatter, quieter interface.** The whole app's chrome was
redone: flat panels with hairline dividers instead of card borders and
shadows, a plain sans-serif in place of the old serif headings, and one quiet
slate-blue accent reserved for whatever's active — a tab underline, a
selected template, the primary button — instead of two competing warm
accents. None of it touches the book itself: every template, decoration,
font choice for your own page text, and feature works exactly as before.

## How it's built

| Piece | Choice | Why |
| --- | --- | --- |
| UI | React 18 + TypeScript + Vite | Fast local dev, no build server |
| State | Zustand | Small store, no boilerplate |
| Storage | Dexie (IndexedDB) | Photo blobs and project state, offline |
| PDF export | jsPDF | Loaded on demand, only when you export |
| PNG export | Canvas `toBlob` + a 60-line zip writer | Nothing to add; see `lib/zip.ts` |
| Editor surface | Plain DOM + CSS | No canvas library needed; crisper text and simpler hit-testing |

All dependencies are MIT or Apache-2.0. `npm audit` reports no vulnerabilities.

Zipping a carousel would normally mean another dependency. `lib/zip.ts` writes
the format's stored (uncompressed) mode instead, which is about sixty lines —
PNGs are already DEFLATE-compressed internally, so compressing them a second
time saves a percent or two and isn't worth a library for.

### Layout of the source

```
src/
  data/         trim sizes and the template library
  lib/
    autoLayout  page/template assignment and aspect-ratio fitting
    imageUtils  import, measurement, and the shared cover-fit geometry
    exportPdf   300 DPI page rendering and PDF assembly
    exportImages one PNG per slide at exact pixel size, zipped past the first
    zip         a minimal stored-only ZIP writer, so no dependency is needed
    db          Dexie schema (photos + projects, scoped by projectId)
  state/
    useStore         the active book's editor state
    useLibraryStore  the My Books list (create/rename/duplicate/delete)
  components/   editor UI + My Books screen
```

`coverGeometry` in `lib/imageUtils.ts` is deliberately shared between the
on-screen editor and the PDF exporter — it is the single definition of how a
photo sits inside its slot, which is what keeps the preview and the print
identical.

`renderPageCanvas` in `lib/exportPdf.ts` plays the same role one level up: the
PDF export, the PNG export, and the whole-book overview grid all draw through
it, so a slide and a page are the same picture at different resolutions rather
than three drawing paths that can drift apart. A spanning artboard is drawn
through it too, at its full strip width, and only cut afterwards — the seam is
a crop, never a second render.

Two ideas in the codebase are the same shape one level apart, which is worth
knowing before changing either. `halfSplit` divides one page into independent
regions; `span` multiplies one page into several output files. And a
`PhotoBox` is a `TextBox` carrying a picture — which is why photo layers,
stickers and free text are all handled as "decorations" and share their drag,
resize and selection behaviour.

## Ideas not yet built

- A profile-grid planner: the same spanning artboard turned ninety degrees, so
  photos cross tile boundaries and nine posts assemble into one composition
- A warning when a photo straddles a cut, so a face never lands on a seam by
  accident
- Turning a finished carousel into photobook pages, and back
- Templates as an importable/exportable file, so layouts can be shared without
  an account or a server
- Text/caption blocks on interior pages, not just the cover
- Background colour or paper stock per book
- Bleed and safe-area guides for commercial printers (the full-bleed and
  diptych templates skip the *page* margin, but don't yet add printer-specific
  trim/safe zones)
- Exporting the project to a file so books move between machines
