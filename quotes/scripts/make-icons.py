#!/usr/bin/env python3
"""Generate the app icons (PNG) without any third-party dependency.

Renders a rounded-square badge with a pair of quotation marks at 2x and
box-downsamples for antialiasing. Run: python3 scripts/make-icons.py
"""
import os
import struct
import zlib

BG = (31, 29, 27)        # ink
FG = (232, 176, 75)      # warm gold
SIZES = {
    "icons/icon-192.png": 192,
    "icons/icon-512.png": 512,
    "icons/apple-touch-icon.png": 180,
    "icons/favicon-32.png": 32,
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def inside_round_rect(x, y, size, radius):
    if x < radius and y < radius:
        return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x > size - radius and y < radius:
        return (x - (size - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x < radius and y > size - radius:
        return (x - radius) ** 2 + (y - (size - radius)) ** 2 <= radius ** 2
    if x > size - radius and y > size - radius:
        return (x - (size - radius)) ** 2 + (y - (size - radius)) ** 2 <= radius ** 2
    return True


def in_triangle(px, py, a, b, c):
    def sign(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])

    d1, d2, d3 = sign((px, py), a, b), sign((px, py), b, c), sign((px, py), c, a)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def in_comma(x, y, cx, cy, r):
    if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
        return True
    return in_triangle(x, y, (cx - r, cy), (cx + r * 0.25, cy), (cx - r * 0.85, cy + r * 1.9))


def render(size):
    ss = size * 2  # supersample factor 2
    radius = ss * 0.22
    r = ss * 0.115
    gap = ss * 0.30
    cy = ss * 0.40
    centers = (ss / 2 - gap / 2, ss / 2 + gap / 2)

    rows = []
    for y in range(ss):
        row = []
        for x in range(ss):
            px, py = x + 0.5, y + 0.5
            if not inside_round_rect(px, py, ss, radius):
                row.append(None)
            elif any(in_comma(px, py, cx, cy, r) for cx in centers):
                row.append(FG)
            else:
                row.append(BG)
        rows.append(row)

    # box downsample 2x -> straight alpha RGBA
    out = bytearray()
    for y in range(size):
        out.append(0)  # PNG filter type: none
        for x in range(size):
            acc_r = acc_g = acc_b = acc_a = 0
            for dy in range(2):
                for dx in range(2):
                    px = rows[y * 2 + dy][x * 2 + dx]
                    if px is not None:
                        acc_r += px[0]
                        acc_g += px[1]
                        acc_b += px[2]
                        acc_a += 255
            if acc_a == 0:
                out += b"\x00\x00\x00\x00"
                continue
            n = acc_a / 255
            out += bytes((round(acc_r / n), round(acc_g / n), round(acc_b / n), round(acc_a / 4)))
    return bytes(out)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def write_png(path, size):
    raw = render(size)
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(os.path.join(ROOT, path), "wb") as fh:
        fh.write(png)
    print(f"{path}  {size}x{size}  {len(png)} bytes")


if __name__ == "__main__":
    for path, size in SIZES.items():
        write_png(path, size)
