# Draw labels on a render: names and one-line jobs in two columns, each joined to its part by a line.
import json, sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src + ".png").convert("RGB"); W, H = im.size
anchors = json.load(open(src + ".json"))
JOBS = {
 "Cone": "Pushes the air. It moves in and out with the coil.",
 "Dust cap": "Covers the centre and keeps dust out of the gap.",
 "Surround": "Flexible edge. Lets the cone move and keeps it centred.",
 "Spider": "Springy ridged disc. Keeps the coil centred in the gap.",
 "Basket (frame)": "Rigid frame that holds every part in line.",
 "Voice coil": "Wire winding that carries the signal's current.",
 "Former": "Thin tube the coil is wound on. Joins coil to cone.",
 "Magnet": "Permanent magnet. Supplies the magnetic field.",
 "Top plate": "Steel. Guides the field to the outside of the gap.",
 "Pole piece": "Steel. Guides the field to the inside of the gap.",
 "Back plate": "Steel. Carries the field from magnet to pole piece.",
 "Magnetic gap": "Narrow ring-shaped slot where the coil sits in the field.",
}
bold = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 30)
body = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 22)
title = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Bold.otf", 44)
PAD = 0
COL = 500
canvas = im.copy()
d = ImageDraw.Draw(canvas)
d.text((44, 30), "Inside a cone loudspeaker driver", font=title, fill=(30, 20, 40))
INK, LINE = (30, 20, 40), (194, 24, 107)
def wrap(text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]
for side in ("left", "right"):
    items = sorted(((n, p) for n, p in anchors.items() if (p[0] < 0.5) == (side == "left")), key=lambda x: x[1][1])
    top, bottom = 170, H - 60; step = (bottom - top) / max(1, len(items))
    for k, (name, (x, y)) in enumerate(items):
        ax, ay = x * W, y * H
        ty = top + k * step
        tx = 44 if side == "left" else W - COL + 30
        width = COL - 90
        d.text((tx, ty), name, font=bold, fill=INK)
        for j, line in enumerate(wrap(JOBS[name], body, width)): d.text((tx, ty + 38 + j * 28), line, font=body, fill=(70, 60, 80))
        # out from the label along a level line to the edge of its column, then straight to the part
        ex = tx + d.textlength(name, font=bold) + 12 if side == "left" else tx - 12
        elbow = COL + 10 if side == "left" else W - COL - 10
        d.line([(ex, ty + 18), (elbow, ty + 18), (ax, ay)], fill=LINE, width=3, joint="curve")
        d.ellipse([ax - 7, ay - 7, ax + 7, ay + 7], fill=LINE, outline=(255, 255, 255), width=2)
canvas.save(out, quality=90)
print(canvas.size)
