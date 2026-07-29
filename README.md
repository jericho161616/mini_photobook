# Moments — Mini Photobook

A local-first photobook layout generator. Point it at a folder of photos, pick a
trim size, and it lays out a book you can then rearrange by hand and export as a
print-ready PDF.

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

**You decide where every photo goes.** Importing photos only adds them to your
library — nothing gets placed automatically. A new book opens at the minimum
10 pages, empty, and you drag each photo onto the slot you want it in. An
auto-layout engine exists (the "Re-flow" button) for when you want a starting
point or want to fill in the rest quickly: it picks a template per page by
comparing each photo's aspect ratio to the shape of the slots available, and
it skips any page you've locked.

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

**Each half of a folded page can hold its own arrangement.** Split at Fold
doesn't limit you to one photo per side — pick "Split at Fold," and each half
gets its own Layout panel underneath the main one, offering the same general
templates (filtered to what actually fits that half) so one side can be a
single photo while the other is a small grid or collage. Flipping the page's
fold orientation keeps both halves' photos and layouts; switching the whole
page to a different layout collapses them back into one shared arrangement.

**Mix any A4 size, page by page.** A page sized A4, A4 Landscape, A4 Folded —
Portrait, or A4 Folded — Landscape gets a small per-page size picker, so a
single book can freely combine a plain full-sheet page, a landscape page, and
a folded-card page wherever you want them — not just two fixed orientations.
Locking a page also locks in whichever of the four it's currently set to.

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

**Titled cover.** Page one uses a cover layout carrying the book title, which
renders in the editor and in the exported PDF.

**A photo tray that only shows what you still need.** Once a photo is placed
on a page it drops out of the tray — there's no reason to keep dragging past
photos you've already used. "View & manage all photos" opens a larger grid
of the full library, where you can check off several photos and remove them
at once, and see which ones aren't placed anywhere yet.

**Book size is a one-time decision.** The sidebar shows your current size and
a "Change" button rather than the full picker sitting there permanently —
that space goes to photos and layout instead. The picker itself is grouped
into Photobook trims, printer paper (A6–A3), and novelty (Polaroid).

**Light and dark themes**, matching your OS by default with a manual toggle in
the top bar that's remembered next time you open the app.

**300 DPI PDF export** at true trim dimensions. Pages are drawn programmatically
onto a canvas rather than screenshotting the editor, so the output is genuinely
print resolution and every crop matches what you arranged on screen.

Work is saved to the browser's IndexedDB as you go and restored when you reopen
the app.

**Thumbnails are actually thumbnails.** Each photo gets a small (320px)
downscaled copy generated once at import; the tray, filmstrip, and library
grid all use that instead of decoding the full-resolution original at
postage-stamp size. Only the main editing canvas and the PDF export touch
the full-resolution file.

## How it's built

| Piece | Choice | Why |
| --- | --- | --- |
| UI | React 18 + TypeScript + Vite | Fast local dev, no build server |
| State | Zustand | Small store, no boilerplate |
| Storage | Dexie (IndexedDB) | Photo blobs and project state, offline |
| Export | jsPDF | Loaded on demand, only when you export |
| Editor surface | Plain DOM + CSS | No canvas library needed; crisper text and simpler hit-testing |

All dependencies are MIT or Apache-2.0. `npm audit` reports no vulnerabilities.

### Layout of the source

```
src/
  data/         trim sizes and the template library
  lib/
    autoLayout  page/template assignment and aspect-ratio fitting
    imageUtils  import, measurement, and the shared cover-fit geometry
    exportPdf   300 DPI page rendering and PDF assembly
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

## Ideas not yet built

- Text/caption blocks on interior pages, not just the cover
- Background colour or paper stock per book
- Bleed and safe-area guides for commercial printers (the full-bleed and
  diptych templates skip the *page* margin, but don't yet add printer-specific
  trim/safe zones)
- Exporting the project to a file so books move between machines
