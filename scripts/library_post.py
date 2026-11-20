#!/usr/bin/env python3
"""Finishing steps for a book already taken in with ingest_pdf.py. Run from the repository root.

    python3 scripts/library_post.py renumber <book-id> <offset>
        The book's own page numbers: page = PDF page - offset. Pages that fall at or below zero (covers,
        contents) are dropped, with their pictures, and picture files are renamed to match.
    python3 scripts/library_post.py chapter <book-id> "<Chapter name>"
        One chapter name for every page: for a paper, which has no chapters.
    python3 scripts/library_post.py figures <book-id> <first-printed-page-offset> part1.pdf [part2.pdf ...]
        Many papers and books draw their figures as lines, not as embedded pictures, so ingest_pdf.py finds
        none. This renders each whole page that has a figure caption ("Figure 3:", "Fig. 2.") and no picture
        yet, as p<page>-1.webp, so the guide can show the figure with the page it cites. Needs pdftoppm.
        With --graphics, a page also counts when the PDF lists a sizeable picture or one-bit "stencil" on it
        that ingest_pdf.py could not keep (old manuals draw their diagrams that way).
"""
import json, os, re, subprocess, sys, tempfile
from PIL import Image

def load(book):
    doc = json.load(open(f"library/{book}.json"))
    idx_path = f"library/images/{book}/index.json"
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {"source": doc["title"], "note": "", "images": []}
    return doc, idx

def save(book, doc, idx):
    json.dump(doc, open(f"library/{book}.json", "w"), ensure_ascii=False)
    os.makedirs(f"library/images/{book}", exist_ok=True)
    idx["images"].sort(key=lambda i: i["file"])
    json.dump(idx, open(f"library/images/{book}/index.json", "w"), ensure_ascii=False, indent=0)

def renumber(book, offset):
    doc, idx = load(book); folder = f"library/images/{book}"
    doc["pages"] = [{**p, "page": p["page"] - offset} for p in doc["pages"] if p["page"] > offset]
    kept, moves = [], []
    for im in idx["images"]:
        if im["page"] <= offset: os.remove(f"{folder}/{im['file']}"); continue
        new = re.sub(r"^p\d+", f"p{im['page'] - offset:03d}", im["file"])
        moves.append((im["file"], new)); kept.append({**im, "file": new, "page": im["page"] - offset})
    for old, _ in moves: os.rename(f"{folder}/{old}", f"{folder}/{old}.tmp")
    for old, new in moves: os.rename(f"{folder}/{old}.tmp", f"{folder}/{new}")
    idx["images"] = kept; save(book, doc, idx)
    print(f"{book}: pages now {doc['pages'][0]['page']} to {doc['pages'][-1]['page']}, {len(kept)} pictures")

def chapter(book, name):
    doc, idx = load(book)
    for p in doc["pages"]: p["chapter"] = name
    for im in idx["images"]: im["chapter"] = name
    save(book, doc, idx)

CAPTION = re.compile(r"^\s*(Figure|Fig\.|FIG\.|FIGURE)\s*\d", re.M)
def figures(book, offset, parts):
    doc, idx = load(book); folder = f"library/images/{book}"; os.makedirs(folder, exist_ok=True)
    have = {im["page"] for im in idx["images"]}; by_page = {p["page"]: p for p in doc["pages"]}
    made, at = 0, 0
    for pdf in parts:
        count = int(re.search(rb"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], check=True, capture_output=True).stdout).group(1))
        drawn = set()
        if "--graphics" in sys.argv:
            for l in subprocess.run(["pdfimages", "-list", pdf], check=True, capture_output=True).stdout.decode().split("\n")[2:]:
                f = l.split()
                if len(f) > 4 and int(f[3]) * int(f[4]) >= 150000: drawn.add(int(f[0]))
        for n in range(1, count + 1):
            page = at + n - offset; p = by_page.get(page)
            if not p or page in have or not (CAPTION.search(p["text"]) or n in drawn): continue
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(["pdftoppm", "-f", str(n), "-l", str(n), "-r", "110", "-gray", "-png", pdf, f"{tmp}/pg"], check=True)
                im = Image.open(f"{tmp}/{os.listdir(tmp)[0]}").convert("L"); im.thumbnail((1400, 1400), Image.LANCZOS)
                file = f"p{page:03d}-1.webp"; im.save(f"{folder}/{file}", "WEBP", quality=60, method=6)
            idx["images"].append({"file": file, "page": page, "chapter": p["chapter"], "width": im.size[0], "height": im.size[1], "captions_on_page": [], "whole_page": True}); made += 1
        at += count
    if "whole page" not in idx.get("note", ""): idx["note"] = (idx.get("note", "") + " Entries marked whole_page are the whole page rendered as a picture, because its figures are drawn as lines and are not embedded pictures.").strip()
    save(book, doc, idx)
    size = sum(os.path.getsize(f"{folder}/{f}") for f in os.listdir(folder))
    print(f"{book}: {made} figure pages rendered, {len(idx['images'])} pictures in all, {size / 1e6:.1f} MB")

if __name__ == "__main__":
    cmd, book = sys.argv[1], sys.argv[2]
    if cmd == "renumber": renumber(book, int(sys.argv[3]))
    elif cmd == "chapter": chapter(book, sys.argv[3])
    elif cmd == "figures": figures(book, int(sys.argv[3]), [a for a in sys.argv[4:] if not a.startswith("--")])
    else: sys.exit(__doc__)
