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

**Suggests a layout from your photos.** Import a set and the auto-layout engine
picks a template per page by comparing each photo's aspect ratio to the shape of
the slots available, so portraits land in upright slots and panoramas in wide
ones. Consecutive pages are nudged toward different templates so the book doesn't
read as one layout repeated.

**Fourteen sizes across three groups.** Nine standard photobook trims (6×6 up to
14×11), the ISO paper sizes a home printer actually takes (A6–A3), and a
Polaroid-style 3.5×4.2 frame for a single instant-photo page. Larger sizes allow
denser pages — a 6×6 caps at three photos per page where a 14×11 allows five.
Changing size re-fits any page whose layout no longer suits the trim.

**Two layout families.** *Minimal* is one to three photos with room around them.
*Portfolio* is editorial — rows, collages, and covers. Filter either by page
shape (square / tall / wide) and mix shapes freely from page to page.

**Full manual control.** Drag photos from the tray into any slot, swap the
template on any page, drag within a slot to reframe, zoom from 1× to 3×, and
reorder pages by dragging thumbnails in the filmstrip.

**Page count from 10 to 30**, adjustable at any time. Resizing keeps the pages
you have already worked on and only adds or trims from the end.

**Titled cover.** Page one uses a cover layout carrying the book title, which
renders in the editor and in the exported PDF.

**A photo library for managing the set.** The sidebar tray stays compact for
dragging into slots; "View & manage all photos" opens a larger grid where you
can check off several photos and remove them at once, and see at a glance
which ones aren't placed on any page yet.

**Light and dark themes**, matching your OS by default with a manual toggle in
the top bar that's remembered next time you open the app.

**300 DPI PDF export** at true trim dimensions. Pages are drawn programmatically
onto a canvas rather than screenshotting the editor, so the output is genuinely
print resolution and every crop matches what you arranged on screen.

Work is saved to the browser's IndexedDB as you go and restored when you reopen
the app.

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
    db          Dexie schema
  state/        the Zustand store
  components/   editor UI
```

`coverGeometry` in `lib/imageUtils.ts` is deliberately shared between the
on-screen editor and the PDF exporter — it is the single definition of how a
photo sits inside its slot, which is what keeps the preview and the print
identical.

## Ideas not yet built

- Text/caption blocks on interior pages, not just the cover
- Background colour or paper stock per book
- Bleed and safe-area guides for commercial printers
- Exporting the project to a file so books move between machines
