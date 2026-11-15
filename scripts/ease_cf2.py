"""Read a loudspeaker's measured directivity out of EASE "CF2" files and write it compactly for the app.

    python3 scripts/ease_cf2.py <out.json> <MF.CF2> <HF.CF2>

The CF2 layout below was worked out by inspecting the maker's own files (library/cad/funktion-one/
RES2SH_EaseData.zip) and is confirmed by a check built into the files themselves: the beamwidths this
script computes from the level data equal the beamwidth table stored in each file's header.

  - 32-bit little-endian floats throughout; a text header (maker, model, date) comes first.
  - float 1188 onwards: eight rows of 30 values, one value per third-octave band from 25 Hz to 20 kHz.
    Row 0 sensitivity (dB at 1 m), row 1 impedance, rows 2-3 half the horizontal -6 dB angle, rows 4-5 half
    the vertical one, row 6 directivity factor. Bands the driver does not cover are zero.
  - float 3558 onwards: 30 bands x 72 meridians x 37 points: level in dB relative to straight ahead, every
    5 degrees away from the axis (0 to 180) on each meridian, meridians every 5 degrees round the axis.
    Meridians 0 and 180 are the vertical plane, 90 and 270 the horizontal plane.
"""
import base64, json, struct, sys

BANDS = [25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000]
HEADER, DATA, PER_BAND = 1188, 3558, 72 * 37
LOW, STEP = -58.0, 0.25          # stored as one byte: (dB - LOW) / STEP

def read(path):
    raw = open(path, "rb").read(); n = len(raw) // 4
    a = struct.unpack(f"<{n}f", raw[: n * 4])
    rows = [a[HEADER + r * 30: HEADER + r * 30 + 30] for r in range(8)]
    used = [b for b in range(30) if rows[1][b] != 0]
    return rows, used, a

def half_width(curve):
    """Degrees from straight ahead at which a curve first falls 6 dB."""
    for i in range(1, 37):
        if curve[i] <= -6: return 5 * (i - 1) + 5 * (curve[i - 1] + 6) / (curve[i - 1] - curve[i])
    return 180.0

out = {"source": "Funktion-One EASE data for the Res 2SH (the mid-high section of a Res 2): R2SH_MF.CF2 and R2SH_HF.CF2, dated 2016-AUG-25",
       "low": LOW, "step": STEP, "meridians": 72, "points": 37, "bands": []}
blob = bytearray()
for name, path in (("8-inch", sys.argv[2]), ("1-inch", sys.argv[3])):
    rows, used, a = read(path)
    for b in used:
        level = a[DATA + b * PER_BAND: DATA + (b + 1) * PER_BAND]
        # the check: this file's own beamwidth table must agree with its level data
        across = half_width(level[18 * 37: 19 * 37]) + half_width(level[54 * 37: 55 * 37])
        updown = half_width(level[0:37]) + half_width(level[36 * 37: 37 * 37])
        assert abs(across - 2 * min(rows[2][b], 180)) < 0.2 and abs(updown - 2 * min(rows[4][b], 180)) < 0.2, (name, BANDS[b], across, rows[2][b], updown, rows[4][b])
        out["bands"].append({"hz": BANDS[b], "driver": name, "sensitivity": round(rows[0][b], 1), "across": round(min(across, 360), 1), "upDown": round(min(updown, 360), 1)})
        blob += bytes(max(0, min(255, round((v - LOW) / STEP))) for v in level)
out["data"] = base64.b64encode(bytes(blob)).decode()
json.dump(out, open(sys.argv[1], "w"), separators=(",", ":"))
print(len(out["bands"]), "bands", [(b["hz"], b["driver"], b["across"], b["upDown"]) for b in out["bands"]])
