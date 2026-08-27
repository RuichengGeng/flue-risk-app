"""Pure-stdlib PNG pie chart worker (no matplotlib/numpy).

Follows the harness worker pattern: reads a JSON payload from --input
(rows: [{group, component_var}, ...]) and writes a rendered pie chart
to --output as a PNG. Prints {"path": ..., "row_count": ...} to stdout.
"""
import argparse
import json
import math
import struct
import zlib
from pathlib import Path

# --------------------------------------------------------------------------
# Canvas
# --------------------------------------------------------------------------
WIDTH, HEIGHT = 840, 620
BG = (255, 255, 255, 255)
INK = (40, 44, 52, 255)

PALETTE = [
    (76, 114, 176, 255),   # blue   - Brent
    (85, 168, 104, 255),   # green  - Equity
    (196, 78, 82, 255),    # red    - WTI
]


def clamp(v):
    return 0 if v < 0 else (255 if v > 255 else v)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [BG] * (w * h)

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = c

    def fill_rect(self, x0, y0, x1, y1, c):
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)):
                self.px[y * self.w + x] = c


# --------------------------------------------------------------------------
# 5x7 bitmap font (subset)
# --------------------------------------------------------------------------
FONT = {
    "A": [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    "B": [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
    "C": [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
    "D": [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
    "E": [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
    "F": [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
    "G": [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
    "H": [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    "I": [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
    "J": [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
    "K": [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    "L": [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
    "M": [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
    "N": [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    "O": [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    "P": [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
    "Q": [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
    "R": [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
    "S": [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
    "T": [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    "U": [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    "V": [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
    "W": [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
    "X": [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
    "Y": [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
    "Z": [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
    "0": [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
    "1": [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
    "2": [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
    "3": [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
    "4": [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
    "5": [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
    "6": [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
    "7": [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    "8": [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
    "9": [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    "$": [0x04, 0x0F, 0x14, 0x0E, 0x05, 0x1E, 0x04],
    "%": [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
    ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
    ",": [0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C, 0x08],
    "-": [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
    "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    " ": [0] * 7,
}


def text_width(s, scale):
    return max(0, len(s) * 6 * scale - scale)


def draw_text(canvas, x, y, s, color, scale=2):
    for ch in s.upper():
        glyph = FONT.get(ch, FONT[" "])
        if ch != " ":
            for gy, row in enumerate(glyph):
                for gx in range(5):
                    if row & (1 << (4 - gx)):
                        canvas.fill_rect(x + gx * scale, y + gy * scale,
                                         x + (gx + 1) * scale, y + (gy + 1) * scale, color)
        x += 6 * scale


def draw_centered(canvas, cx, y, s, color, scale=2):
    draw_text(canvas, cx - text_width(s, scale) // 2, y, s, color, scale)


# --------------------------------------------------------------------------
# Pie rendering
# --------------------------------------------------------------------------
def angle_of(dx, dy):
    """Degrees clockwise from 12 o'clock, normalized to [0, 360)."""
    return (math.degrees(math.atan2(dx, -dy)) + 360.0) % 360.0


def draw_pie(canvas, cx, cy, radius, slices, gap_deg=0.8):
    """slices: list of (start_deg, end_deg, color) clockwise from 12."""
    S = 2  # supersampling
    for py in range(cy - radius, cy + radius + 1):
        for px in range(cx - radius, cx + radius + 1):
            rsum = [0, 0, 0, 0]
            n = 0
            for sy in range(S):
                for sx in range(S):
                    fx = px + (sx + 0.5) / S - cx
                    fy = py + (sy + 0.5) / S - cy
                    if fx * fx + fy * fy > radius * radius:
                        continue
                    a = angle_of(fx, fy)
                    col = None
                    for a0, a1, c in slices:
                        if a0 + gap_deg <= a <= a1 - gap_deg:
                            col = c
                            break
                    if col is None:
                        col = BG
                    for i in range(4):
                        rsum[i] += col[i]
                    n += 1
            if n:
                canvas.set(px, py, tuple(clamp(int(v / n)) for v in rsum))


def fmt_usd(v):
    return "${:,}".format(v)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    rows = payload.get("rows", [])
    total = sum(float(r.get("component_var", 0) or 0) for r in rows)
    total = int(total)

    canvas = Canvas(WIDTH, HEIGHT)

    # Title + subtitle
    draw_centered(canvas, WIDTH // 2, 28, "Alice VaR by Group", INK, scale=2)
    draw_centered(canvas, WIDTH // 2, 54, "(Component VaR, USD, as of 2026-08-22)", (90, 96, 108, 255), scale=1)

    # Pie geometry
    cx, cy, radius = 320, 370, 200

    # Build slices clockwise from 12 o'clock, largest first
    ordered = sorted(rows, key=lambda r: -float(r.get("component_var", 0) or 0))
    fracs = [float(r.get("component_var", 0) or 0) / total for r in ordered]
    slices = []
    start = 0.0
    for i, f in enumerate(fracs):
        end = start + f * 360.0
        slices.append((start, end, PALETTE[i % len(PALETTE)]))
        start = end

    draw_pie(canvas, cx, cy, radius, slices)

    # Percentage labels inside slices
    for i, (a0, a1, color) in enumerate(slices):
        mid = math.radians((a0 + a1) / 2.0)
        r = radius * 0.62
        px = cx + r * math.sin(mid)
        py = cy - r * math.cos(mid)
        pct = "{:.1f}%".format(fracs[i] * 100.0)
        draw_centered(canvas, int(px), int(py) - 7, pct, (255, 255, 255, 255), scale=2)

    # Legend
    lx_swatch, lx_text = 575, 605
    y = 240
    for i, row in enumerate(ordered):
        color = PALETTE[i % len(PALETTE)]
        canvas.fill_rect(lx_swatch, y, lx_swatch + 20, y + 20, color)
        name = str(row.get("group", "?"))
        val = int(float(row.get("component_var", 0) or 0))
        pct = "{:.1f}%".format(fracs[i] * 100.0)
        draw_text(canvas, lx_text, y - 2, name, INK, scale=2)
        draw_text(canvas, lx_text, y + 24, "{}  {}".format(fmt_usd(val), pct), (90, 96, 108, 255), scale=1)
        y += 78

    # Total line
    draw_text(canvas, lx_swatch, y, "Total  {}".format(fmt_usd(total)), INK, scale=2)

    # ----------------------------------------------------------------------
    # Write PNG
    # ----------------------------------------------------------------------
    w, h = canvas.w, canvas.h
    raw = bytearray()
    for yy in range(h):
        raw.append(0)  # filter: None
        for xx in range(w):
            raw += bytes(canvas.px[yy * w + xx])

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        out += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return out

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(png)

    print(json.dumps({"path": str(out), "row_count": len(rows)}))


if __name__ == "__main__":
    main()
