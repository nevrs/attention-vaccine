# 拡張のアイコン（盾の中に釣り針）を icons/ に作る。要 Pillow:  python tools/make_icons.py
# 針は盾の内側（余白 60/1024）に収まる大きさまで自動で縮め、見た目の重心に合わせて右へ 24/1024 ずらす。16・32 px は線を太くした版
import os, sys
from PIL import Image, ImageDraw
S = 1024
def bez(p0, p1, p2, n=40):
    return [((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0], (1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]) for t in [i/n for i in range(n+1)]]
def shield(d, inset, fill):
    L, R, T = 150 + inset, S - 150 - inset, 110 + inset
    mid = S / 2
    pts = [(L, T + 60)]
    pts += bez((L, T + 60), (mid - 120, T + 40), (mid, T - 10))[1:]
    pts += bez((mid, T - 10), (mid + 120, T + 40), (R, T + 60))[1:]
    pts += bez((R, T + 60), (R + 10, 640 - inset * 0.3), (mid, S - 80 - inset))[1:]
    pts += bez((mid, S - 80 - inset), (L - 10, 640 - inset * 0.3), (L, T + 60))[1:]
    d.polygon(pts, fill=fill)
def hook_layer(col, w):
    L = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(L)
    cx, top, bend, r = 590, 230, 600, 160
    d.ellipse([cx - 58, top - 58, cx + 58, top + 58], outline=col, width=int(w * 0.8))   # eye
    d.line([(cx, top + 50), (cx, bend)], fill=col, width=w)                                # shank
    ccx = cx - r
    d.arc([ccx - r, bend - r, ccx + r, bend + r], start=0, end=180, fill=col, width=w)     # bend
    tx = ccx - r
    rise = bend - 190
    d.line([(tx, bend), (tx, rise)], fill=col, width=w)                                    # point shaft
    d.polygon([(tx - w / 2, rise + 4), (tx + w / 2, rise + 4), (tx - w * 0.15, rise - 110)], fill=col)  # sharp tip
    d.polygon([(tx + w / 2 - 6, rise + 10), (tx + w / 2 + 70, rise + 120), (tx + w / 2 - 6, rise + 110)], fill=col)  # barb (inner side)
    for x, y in [(cx, bend), (tx, bend)]:
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    return L.rotate(-18, resample=Image.BICUBIC, center=(S / 2, S / 2 + 20))
def compose(w, margin):
    """Shield + hook, with the hook scaled down until every hook pixel sits inside the shield inset by `margin`."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shield(ImageDraw.Draw(img), 0, (232, 160, 0, 255))
    safe = Image.new("L", (S, S), 0)
    shield(ImageDraw.Draw(safe), margin, 255)
    raw = hook_layer((255, 255, 255, 255), w)
    raw = raw.crop(raw.getbbox())
    # visual centre of the shield: a bit above the geometric middle because the bottom is a point
    cx, cy = S / 2 + 24, S * 0.47  # +24 = 3px at 128: the hook looks left-heavy (point and barb on the left), so nudge it right
    for k in range(100):
        scale = 0.95 - k * 0.01
        h = raw.resize((int(raw.width * scale), int(raw.height * scale)), Image.LANCZOS)
        x0, y0 = int(cx - h.width / 2), int(cy - h.height / 2)
        a = Image.new("L", (S, S), 0); a.paste(h.getchannel("A"), (x0, y0))
        outside = sum(1 for v_a, v_s in zip(a.tobytes(), safe.tobytes()) if v_a > 8 and v_s == 0)
        if outside == 0:
            img.alpha_composite(h, (x0, y0))
            return img, scale
    raise SystemExit("hook does not fit")
img, sc_big = compose(58, 60)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
# 16/32 px: thicker strokes so the hook survives downscaling
small, sc_small = compose(100, 60)
print("scale", round(sc_big, 2), round(sc_small, 2))
sizes = {}
for n in (16, 32, 48, 128):
    im = (small if n <= 32 else img).resize((n, n), Image.LANCZOS)
    im.save(f"{out}/icon{n}.png"); sizes[n] = im
print("ok")
