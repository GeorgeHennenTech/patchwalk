#!/usr/bin/env python3
"""Take a book supplied as one or more PDF parts into the private library: text and pictures together.

    python3 scripts/ingest_pdf.py <book-id> "<Title>" part1.pdf part2.pdf ... [--skip-pages 3-22]

Writes library/<book-id>.json            { id, title, pages: [{ page, chapter, text }] }
       library/images/<book-id>/*.webp   pictures embedded in the PDF, named p<page>-<n>.webp
       library/images/<book-id>/index.json

Parts are read in the order given and their pages numbered straight through, so a manual split into
100-page files keeps its own page numbers. Text is taken in reading order (plain pdftotext, not -layout).
The chapter of a page is read from its running header ("<Chapter title> <page number>"). Masks, tiny
pictures and exact repeats are dropped. Needs poppler-utils (pdftotext, pdfimages, pdfinfo) and Pillow.
Same privacy rules as the rest of library/: private repository only.
"""
import hashlib, io, json, os, re, subprocess, sys, tempfile
from PIL import Image

MIN_W, MIN_H, MIN_AREA, MAX_SIDE = 140, 60, 20000, 1400

def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True).stdout

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    skip = set()
    for i, a in enumerate(sys.argv):
        if a == "--skip-pages":
            for part in sys.argv[i + 1].split(","):
                lo, _, hi = part.partition("-")
                skip.update(range(int(lo), int(hi or lo) + 1))
            args.remove(sys.argv[i + 1])
    if "--append" in sys.argv:
        args.remove(sys.argv[sys.argv.index("--append") + 1])
    book, title, parts = args[0], args[1], args[2:]
    out_json, out_img = f"library/{book}.json", f"library/images/{book}"
    os.makedirs(out_img, exist_ok=True)
    pages, images, seen, offset, chapter = [], [], set(), 0, ""
    # when adding later parts to a book already taken in, keep what is there and continue the numbering
    if os.path.exists(out_json) and "--append" in sys.argv:
        old = json.load(open(out_json)); pages = old["pages"]
        images = json.load(open(f"{out_img}/index.json"))["images"]
        offset = int(sys.argv[sys.argv.index("--append") + 1])
        assert offset >= max(p["page"] for p in pages), "these pages are already in the book"
        chapter = pages[-1]["chapter"]
        seen = {hashlib.sha1(open(f"{out_img}/{im['file']}", "rb").read()).hexdigest() for im in images}
    for pdf in parts:
        count = int(re.search(rb"Pages:\s+(\d+)", run("pdfinfo", pdf)).group(1))
        text = run("pdftotext", pdf, "-").decode("utf-8", "replace").split("\f")
        captions = {}
        for n in range(1, count + 1):
            page = offset + n
            raw = text[n - 1].replace("﻿", "").strip() if n - 1 < len(text) else ""
            lines = raw.split("\n")
            head = re.match(rf"^(.*\S)\s+{page}$", lines[0].strip()) if lines else None
            if head:
                chapter, lines = head.group(1).strip(), lines[1:]
            body = "\n".join(lines).strip()
            captions[page] = [l.strip() for l in lines if 12 <= len(l.strip()) <= 90 and re.match(r"^[A-Z][^.?!]*\.$", l.strip()) and "(page" not in l][:8]
            if page in skip or len(body) < 40:
                continue
            pages.append({"page": page, "chapter": chapter, "text": body})
        chapters = {p["page"]: p["chapter"] for p in pages}
        listing = run("pdfimages", "-list", pdf).decode().split("\n")[2:]
        kinds = [l.split()[2] for l in listing if l.strip()]
        with tempfile.TemporaryDirectory() as tmp:
            run("pdfimages", "-all", "-p", pdf, f"{tmp}/im")
            files = sorted(os.listdir(tmp))
            assert len(files) == len(kinds), (len(files), len(kinds))
            per_page = {}
            for name, kind in zip(files, kinds):
                page = offset + int(name.split("-")[1])
                if kind != "image" or page in skip:
                    continue
                try:
                    im = Image.open(f"{tmp}/{name}"); im.load()
                except Exception as e:
                    print("unreadable picture skipped:", name, e, file=sys.stderr); continue
                w, h = im.size
                if w < MIN_W or h < MIN_H or w * h < MIN_AREA:
                    continue
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGB")
                if max(w, h) > MAX_SIDE:
                    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
                buf = io.BytesIO(); im.save(buf, "WEBP", quality=80, method=6)
                digest = hashlib.sha1(buf.getvalue()).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                per_page[page] = per_page.get(page, 0) + 1
                file = f"p{page:03d}-{per_page[page]}.webp"
                open(f"{out_img}/{file}", "wb").write(buf.getvalue())
                images.append({"file": file, "page": page, "chapter": chapters.get(page, chapter), "width": im.size[0], "height": im.size[1], "captions_on_page": captions.get(page, [])})
        offset += count
    json.dump({"id": book, "title": title, "pages": pages}, open(out_json, "w"), ensure_ascii=False)
    json.dump({"source": title, "note": "Images embedded in the PDF, one file per image, named p<page>-<n>.webp. 'captions_on_page' lists short title-like lines found on the same page; they are candidates, not matched to a specific image. Private reference material: same rules as library text.", "images": images}, open(f"{out_img}/index.json", "w"), ensure_ascii=False, indent=0)
    size = sum(os.path.getsize(f"{out_img}/{f}") for f in os.listdir(out_img))
    print(f"{book}: {len(pages)} pages of text (last page {offset}), {len(images)} pictures on {len({i['page'] for i in images})} pages, {size / 1e6:.1f} MB of pictures")

main()
