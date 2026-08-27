"""Pure-stdlib PNG line chart worker: option MTM PnL vs underlying spot.

Follows the harness worker pattern: reads a JSON payload from --input
(rows: [{spot, premium}, ...] plus option parameters and baseline_premium)
and writes a rendered line chart to --output as a PNG.
Prints {"path": ..., "row_count": ...} to stdout.

PnL is computed as premium(spot) - baseline_premium. A dense Black-Scholes
curve is overlaid using quant.bs_price (the same engine the pricing tool
uses). No matplotlib/numpy - canvas + 5x7 bitmap font only.
"""
import argparse
import json
import math
import struct
import zlib
from pathlib import Path

from quant import bs_price

# --------------------------------------------------------------------------
# Canvas
# --------------------------------------------------------------------------
WIDTH, HEIGHT = 900, 640
BG = (255, 255, 255, 255)
INK = (40, 44, 52, 255)
GRAY = (90, 96, 108, 255)
GRID = (228, 231, 238, 255)
ZERO = (150, 155, 165, 255)
ENTRY = (150, 150, 150, 255)
BLUE = (76, 114, 176, 255)    # BS curve
RED = (196, 78, 82, 255)      # stress points


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
# 5x7 bitmap font (same subset as pie_chart.py)
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


def draw_line(canvas, x0, y0, x1, y1, c):
    """Bresenham line, clipped implicitly by Canvas.set."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        canvas.set(x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def draw_marker(canvas, x, y, color, size=7):
    """Filled square marker centered at (x, y)."""
    r = size // 2
    canvas.fill_rect(int(x) - r, int(y) - r, int(x) + r + 1, int(y) + r + 1, color)


# --------------------------------------------------------------------------
# Plot mapping
# --------------------------------------------------------------------------
LEFT, RIGHT, TOP, BOTTOM = 95, 45, 100, 80


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    rows = payload.get("rows", [])
    baseline = float(payload.get("baseline_premium", 0.0) or 0.0)
    strike = float(payload.get("strike", 105))
    rate = float(payload.get("rate", 0.04))
    vol = float(payload.get("vol", 0.2))
    maturity = float(payload.get("maturity", 1.0))
    opt = payload.get("option_type", "call")

    pts = [(float(r["spot"]), float(r["premium"]) - baseline) for r in rows]
    xmin = min(p for p, _ in pts)
    xmax = max(p for p, _ in pts)
    pnls = [pnl for _, pnl in pts] + [0.0]
    ymin = math.floor(min(pnls) / 2.0) * 2.0 - 2.0
    ymax = math.ceil(max(pnls) / 2.0) * 2.0 + 2.0

    plot_w = WIDTH - LEFT - RIGHT
    plot_h = HEIGHT - TOP - BOTTOM

    def to_xy(spot, pnl):
        x = LEFT + (spot - xmin) / (xmax - xmin) * plot_w
        y = TOP + (ymax - pnl) / (ymax - ymin) * plot_h
        return x, y

    canvas = Canvas(WIDTH, HEIGHT)

    # Title + subtitle
    draw_centered(canvas, WIDTH // 2, 26, "Call Option MTM PnL vs Underlying Price", INK, scale=3)
    draw_centered(canvas, WIDTH // 2, 60,
                  "(1Y call  K=105  r=4%  vol=20%  entry premium ${:.2f})".format(baseline), GRAY, scale=1)

    # Grid + axes
    x0, y0 = to_xy(xmin, ymin)
    x1, y1 = to_xy(xmax, ymax)
    for tick in range(int(ymin), int(ymax) + 1, 2):
        tx, ty = to_xy(xmin, float(tick))
        draw_line(canvas, LEFT, ty, LEFT + plot_w, ty, GRID)
        draw_line(canvas, LEFT - 4, ty, LEFT, ty, INK)
        draw_text(canvas, LEFT - 10 - text_width(str(tick), 2), int(ty) - 7, str(tick), GRAY, scale=2)
    for tick in range(int(xmin), int(xmax) + 1, 5):
        tx, ty = to_xy(float(tick), ymin)
        draw_line(canvas, tx, TOP, tx, TOP + plot_h, GRID)
        draw_line(canvas, tx, TOP + plot_h, tx, TOP + plot_h + 4, INK)
        draw_centered(canvas, int(tx), TOP + plot_h + 12, str(tick), GRAY, scale=2)

    # Zero-PnL line (emphasized)
    zx, zy = to_xy(xmin, 0.0)
    draw_line(canvas, LEFT, zy, LEFT + plot_w, zy, ZERO)
    draw_centered(canvas, LEFT + plot_w - 30, int(zy) - 20, "Zero PnL", GRAY, scale=1)

    # Axes frame
    draw_line(canvas, LEFT, TOP, LEFT, TOP + plot_h, INK)
    draw_line(canvas, LEFT, TOP + plot_h, LEFT + plot_w, TOP + plot_h, INK)

    # Entry spot vertical line
    ex, _ = to_xy(100.0, 0.0)
    draw_line(canvas, ex, TOP, ex, TOP + plot_h, ENTRY)
    draw_centered(canvas, int(ex), TOP + 4, "Entry 100", GRAY, scale=1)

    # Dense BS curve
    n = int((xmax - xmin) / 0.5) + 1
    curve = [(xmin + i * 0.5, bs_price(xmin + i * 0.5, strike, rate, vol, maturity, opt) - baseline)
             for i in range(n)]
    for (px, py), (qx, qy) in zip(curve, curve[1:]):
        draw_line(canvas, *to_xy(px, py), *to_xy(qx, qy), BLUE)

    # Stress points connected
    for (px, py), (qx, qy) in zip(pts, pts[1:]):
        draw_line(canvas, *to_xy(px, py), *to_xy(qx, qy), RED)
    for spot, pnl in pts:
        draw_marker(canvas, *to_xy(spot, pnl), RED, size=7)

    # Axis labels
    draw_centered(canvas, WIDTH // 2, HEIGHT - 34, "Underlying price (spot)", INK, scale=2)
    draw_text(canvas, LEFT + 8, TOP + 6, "PnL (USD)", INK, scale=2)

    # Legend (top-left inside plot area)
    lx, ly = LEFT + 16, TOP + 30
    canvas.fill_rect(lx, ly, lx + 14, ly + 14, RED)
    draw_text(canvas, lx + 22, ly - 4, "Stress points (9)", GRAY, scale=1)
    canvas.fill_rect(lx, ly + 26, lx + 14, ly + 40, BLUE)
    draw_text(canvas, lx + 22, ly + 22, "BS curve (dense grid)", GRAY, scale=1)
    canvas.fill_rect(lx, ly + 52, lx + 14, ly + 66, ENTRY)
    draw_text(canvas, lx + 22, ly + 48, "Entry spot 100", GRAY, scale=1)
    draw_line(canvas, lx, ly + 80, lx + 14, ly + 80, ZERO)
    draw_text(canvas, lx + 22, ly + 74, "Zero PnL", GRAY, scale=1)

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
