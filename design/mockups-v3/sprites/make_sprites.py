"""Real USF Tampa buildings as 3/4 pixel sprites in Caua's palette (design/js/palette.js).
Writes <out>/<id>.png (native size), buildings-sheet.png, buildings.json. Run: uv run --with pillow design/mockups-v3/sprites/make_sprites.py design/mockups-v3/sprites"""
import json, sys, pathlib
from PIL import Image

P = dict(green='#006747', gold='#CFC493', white='#FFFFFF', evergreen='#005432', sand='#EDEBD1', lemongrass='#DBE442',
         apple='#9CCB3B', teal='#009374', seaglass='#80B0A6', storm='#006484', sky='#29AFCE', silver='#CAD2D8', gray='#7E96A0',
         slate='#466069', deep='#003822', ink='#0D231B', turfL='#A9C97E', turfM='#7FA95B', turfD='#4E7F47', bL='#F3D99C',
         bM='#E2BE74', bD='#A68344', roadL='#E6EAE7', roadM='#C8D1CC', roadD='#8B9B95', orange='#E86A17', craneGold='#F2B705',
         red='#D64045', brick='#B5523B', brickD='#8A3A2A', brickL='#CF6E52', bronze='#7A5033', bronzeD='#5C3A21', concrete='#D9D4C0',
         concreteD='#B3AD97', glass='#3C8FA8', glassD='#245E73')


class S:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    def r(s, x, y, w, h, c):  # filled rect, clipped
        col = c if isinstance(c, tuple) else tuple(int(P.get(c, c)[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
        for yy in range(max(0, y), min(s.h, y + h)):
            for xx in range(max(0, x), min(s.w, x + w)):
                s.im.putpixel((xx, yy), col)

    def box(s, x, y, w, h, fill, ink='ink'):  # 1px ink outline + fill
        s.r(x, y, w, h, ink); s.r(x + 1, y + 1, w - 2, h - 2, fill)

    def windows(s, x0, x1, y, ww, wh, gap, c='storm', hi='sky', skip=None):
        x = x0
        while x + ww <= x1:
            if not (skip and skip[0] <= x + ww // 2 <= skip[1]):
                s.r(x, y, ww, wh, c); s.r(x, y, ww, 1, hi)
            x += ww + gap

    def ellipse(s, cx, cy, rx, ry, c, top_only=False):
        for yy in range(int(cy - ry), int(cy + ry) + 1):
            if top_only and yy > cy: break
            for xx in range(int(cx - rx), int(cx + rx) + 1):
                if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0:
                    s.r(xx, yy, 1, 1, c)

    def text(s, t, x, y, c):  # 3x5 caps
        F = {'M': ['101', '111', '111', '101', '101'], 'S': ['111', '100', '111', '001', '111'], 'C': ['111', '100', '100', '100', '111'],
             'U': ['101', '101', '101', '101', '111'], 'A': ['111', '101', '111', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
             'I': ['111', '010', '010', '010', '111'], 'B': ['110', '101', '110', '101', '110'], 'R': ['110', '101', '110', '101', '101'],
             'Y': ['101', '101', '010', '010', '010'], 'E': ['111', '100', '110', '100', '111'], 'N': ['101', '111', '111', '111', '101'],
             'K': ['101', '110', '100', '110', '101'], 'F': ['111', '100', '110', '100', '100'], 'D': ['110', '101', '101', '101', '110'],
             ' ': ['000'] * 5}
        for i, ch in enumerate(t):
            for yy, row in enumerate(F[ch]):
                for xx, v in enumerate(row):
                    if v == '1': s.r(x + i * 4 + xx, y + yy, 1, 1, c)


def library(w=52, h=42):
    # USF Tampa Library: tall tan tower, vertical concrete fins with dark glass slots, penthouse, canopy entrance
    s = S(w, h)
    s.box(0, 0, w, 14, 'concrete')              # roof slab (seen from above)
    s.r(1, 1, w - 2, 2, 'white')
    s.box(14, 3, w - 28, 8, 'concreteD')        # mechanical penthouse
    s.r(16, 5, w - 32, 2, 'gray')
    s.box(0, 13, w, h - 13, 'bM')                # 7-story facade
    for x in range(3, w - 3, 4):                 # vertical fins + dark slot windows
        s.r(x, 15, 1, h - 22, 'bL'); s.r(x + 1, 15, 2, h - 22, 'glassD')
        for y in range(16, h - 8, 4): s.r(x + 1, y, 2, 1, 'glass')
    s.r(1, 13, w - 2, 1, 'bL')
    s.box(w // 2 - 9, h - 8, 18, 8, 'evergreen')  # entrance canopy
    s.r(w // 2 - 8, h - 8, 16, 2, 'gold')
    s.r(w // 2 - 4, h - 5, 8, 4, 'sky')
    return s


def msc(w=68, h=44):
    # Marshall Student Center: sandstone wings, huge curved glass atrium, MSC letters, green USF banners
    s = S(w, h)
    s.box(0, 0, w, 16, 'bL'); s.r(1, 1, w - 2, 2, 'sand')
    s.box(5, 4, 8, 6, 'silver'); s.box(w - 13, 4, 8, 6, 'silver')   # rooftop units
    s.box(0, 15, w, h - 15, 'bM')
    s.windows(3, 22, 19, 4, 5, 2, 'storm', 'sky'); s.windows(w - 22, w - 3, 19, 4, 5, 2, 'storm', 'sky')
    s.windows(3, 22, 28, 4, 5, 2, 'storm', 'sky'); s.windows(w - 22, w - 3, 28, 4, 5, 2, 'storm', 'sky')
    cx = w // 2
    s.ellipse(cx, 16, 13, 9, 'ink', top_only=True)                  # glass rotunda (roof dome)
    s.ellipse(cx, 16, 12, 8, 'sky', top_only=True)
    s.r(cx - 6, 10, 5, 2, 'white')
    s.box(cx - 13, 15, 26, h - 15, 'glass')                          # curtain wall atrium
    for x in range(cx - 10, cx + 12, 4): s.r(x, 16, 1, h - 18, 'glassD')
    for y in range(20, h - 2, 5): s.r(cx - 12, y, 24, 1, 'glassD')
    s.r(cx - 12, 17, 6, 1, 'white')
    s.box(cx - 8, 15, 16, 7, 'evergreen'); s.text('MSC', cx - 6, 16, 'gold')
    s.box(cx - 5, h - 8, 10, 8, 'evergreen'); s.r(cx - 4, h - 6, 8, 5, 'lemongrass')
    for bx in (cx - 17, cx + 15): s.r(bx, 18, 3, 9, 'green'); s.r(bx + 1, 19, 1, 7, 'gold')  # banners
    return s


def enb(w=72, h=46):
    # Engineering Building II: tan concrete, solar array roof, 3 ribbon window floors, gear crest
    s = S(w, h)
    s.box(0, 0, w, 18, 'concrete')
    for x in range(4, w - 8, 9):                                    # solar panels
        s.box(x, 3, 8, 6, 'storm'); s.r(x + 1, 4, 6, 1, 'sky'); s.r(x + 4, 4, 1, 4, 'glassD')
        s.box(x, 10, 8, 6, 'storm'); s.r(x + 1, 11, 6, 1, 'sky'); s.r(x + 4, 11, 1, 4, 'glassD')
    s.box(0, 17, w, h - 17, 'bM')
    for y in (20, 27, 34): s.r(3, y, w - 6, 4, 'glassD'); s.r(3, y, w - 6, 1, 'glass')
    for x in range(8, w - 4, 8): s.r(x, 20, 1, 18, 'bL')
    cx = w // 2
    s.box(cx - 6, h - 9, 12, 9, 'evergreen'); s.r(cx - 5, h - 7, 10, 6, 'sky')
    s.ellipse(cx, 41 - 20, 3, 3, 'gold'); s.r(cx - 1, 20, 2, 2, 'ink')  # gear crest over the entry
    return s


def enc(w=52, h=38):
    # Engineering III: red brick lab block, HVAC fans and vents on the roof
    s = S(w, h)
    s.box(0, 0, w, 15, 'concreteD')
    for x in (5, 19, 33):
        s.box(x, 3, 10, 9, 'silver'); s.ellipse(x + 5, 7.5, 3, 3, 'gray'); s.r(x + 4, 7, 2, 1, 'ink')
    s.box(0, 14, w, h - 14, 'brick')
    for y in (17, 24): s.windows(3, w - 3, y, 5, 4, 2, 'glassD', 'glass')
    s.r(1, 14, w - 2, 1, 'brickL')
    cx = w // 2
    s.box(cx - 5, h - 8, 10, 8, 'evergreen'); s.r(cx - 4, h - 6, 8, 5, 'sky')
    return s


def muma(w=56, h=52):
    # Muma College of Business: red brick, tall glass corner atrium, gold MUMA band, courtyard fountain
    s = S(w, h)
    s.box(0, 0, w, 22, 'brickD')
    s.box(10, 4, w - 20, 14, 'turfL')                                # courtyard
    s.ellipse(w // 2, 11, 4, 3, 'sky'); s.r(w // 2, 9, 1, 2, 'white')
    s.r(12, 6, 3, 3, 'turfD'); s.r(w - 15, 13, 3, 3, 'turfD')
    s.box(0, 21, w, h - 21, 'brick')
    s.windows(3, w - 20, 25, 4, 5, 3, 'glassD', 'glass'); s.windows(3, w - 20, 33, 4, 5, 3, 'glassD', 'glass')
    s.box(w - 18, 10, 18, h - 10, 'glass')                           # glass corner atrium rising above the roof
    for y in range(13, h - 2, 5): s.r(w - 17, y, 16, 1, 'glassD')
    s.r(w - 16, 12, 5, 1, 'white')
    s.box(0, 21, w - 17, 6, 'evergreen'); s.text('MUMA', 4, 21 + 0, 'gold')
    s.box(14, h - 9, 12, 9, 'evergreen'); s.r(15, h - 7, 10, 6, 'sky')
    return s


def cooper(w=50, h=26):
    # Cooper Hall: long low brutalist block, concrete grid facade
    s = S(w, h)
    s.box(0, 0, w, 10, 'concreteD'); s.r(1, 1, w - 2, 1, 'concrete')
    s.box(0, 9, w, h - 9, 'concrete')
    for x in range(2, w - 3, 4):
        for y in (11, 16): s.r(x, y, 3, 3, 'slate'); s.r(x, y, 3, 1, 'seaglass')
    s.box(w // 2 - 4, h - 6, 8, 6, 'evergreen')
    return s


def rec(w=66, h=38):
    # Campus Recreation Center: silver barrel-vault roof, tall glass front, green sport stripe
    s = S(w, h)
    s.box(0, 0, w, 20, 'silver')
    for y in range(2, 19, 3): s.r(1, y, w - 2, 1, 'gray')            # barrel ribs
    s.r(1, 1, w - 2, 1, 'white')
    s.box(0, 19, w, h - 19, 'bM')
    s.box(6, 21, w - 12, 10, 'glass')
    for x in range(10, w - 6, 6): s.r(x, 22, 1, 8, 'glassD')
    s.r(7, 22, 10, 1, 'white')
    s.r(1, h - 6, w - 2, 2, 'green')
    s.box(w // 2 - 6, h - 8, 12, 8, 'evergreen'); s.r(w // 2 - 5, h - 6, 10, 5, 'lemongrass')
    return s


def sundome(w=76, h=62):
    # Sun Dome (Yuengling Center): white ribbed dome on a concrete drum, green ring, east entrance
    s = S(w, h)
    cx = w // 2
    s.box(2, 40, w - 4, h - 40, 'concrete')                          # drum facade
    for x in range(6, w - 6, 6): s.r(x, 44, 2, h - 52, 'concreteD')  # buttress columns
    s.ellipse(cx, 41, cx - 1, 40, 'ink', top_only=True)              # dome
    s.ellipse(cx, 41, cx - 3, 38, 'white', top_only=True)
    s.ellipse(cx - 9, 22, 12, 9, 'sand', top_only=True)                 # soft shading on the lit side
    for k in range(-3, 4):                                           # ribs
        xx = cx + k * 9
        for y in range(5 + abs(k) * 4, 41): s.r(xx, y, 1, 1, 'silver')
    s.r(3, 40, w - 6, 2, 'green'); s.r(3, 42, w - 6, 1, 'evergreen')
    s.ellipse(cx, 6, 6, 3, 'gold')                                   # oculus crown
    s.r(cx - 3, 5, 6, 1, 'lemongrass')
    s.box(cx - 10, h - 10, 20, 10, 'evergreen'); s.r(cx - 9, h - 8, 18, 7, 'sky')
    s.r(cx - 9, h - 10, 18, 1, 'gold')
    return s


def juniper(w=44, h=38):
    # Juniper-Poplar Hall: residence hall, rows of dorm windows with green balconies
    s = S(w, h)
    s.box(0, 0, w, 10, 'bL'); s.box(6, 2, 10, 5, 'silver')
    s.box(0, 9, w, h - 9, 'sand')
    for y in (12, 18, 24):
        s.windows(3, w - 3, y, 4, 4, 2, 'storm', 'sky'); s.r(2, y + 4, w - 4, 1, 'green')
    s.box(w // 2 - 4, h - 7, 8, 7, 'evergreen')
    return s


def mlk(w=48, h=34):
    # MLK Plaza: round paved plaza, fountain, palms, and the bronze Bull statue on a pedestal
    s = S(w, h)
    s.ellipse(w / 2 - 0.5, h / 2 - 0.5, w / 2 - 0.5, h / 2 - 0.5, 'roadD')
    s.ellipse(w / 2 - 0.5, h / 2 - 0.5, w / 2 - 1.5, h / 2 - 1.5, 'roadL')
    for i in range(0, w, 4): s.r(i, h // 2, 2, 1, 'roadM')
    s.ellipse(14, 17, 8, 6, 'storm'); s.ellipse(14, 17, 7, 5, 'sky'); s.r(13, 13, 2, 6, 'white'); s.r(11, 15, 6, 1, 'white')
    # pedestal + bull statue (bronze, gold horns)
    s.box(27, 20, 16, 6, 'concrete')
    bull = ['..........h.h.', '....bbbbb.hbh.', '..bbbbbbbbbbbb', '.bbbbbbbbbbbbd', '.dbbbbbbbbbb..', '..b..b...b..b.', '..b..b...b..b.']
    for yy, row in enumerate(bull):
        for xx, ch in enumerate(row):
            if ch != '.': s.r(28 + xx, 13 + yy, 1, 1, {'b': 'bronze', 'd': 'bronzeD', 'h': 'gold'}[ch])
    for px_, py_ in ((4, 6), (w - 6, 6), (5, h - 8), (w - 7, h - 9)):  # palms
        s.r(px_, py_, 1, 4, 'bronzeD'); s.r(px_ - 2, py_ - 1, 5, 1, 'turfD'); s.r(px_ - 1, py_ - 2, 3, 1, 'turfM')
    return s


def bullrunner(w=44, h=26):
    # Bull Runner stop: green shelter and a green and gold campus bus
    s = S(w, h)
    s.box(0, 0, 18, 8, 'green'); s.r(1, 1, 16, 1, 'apple'); s.r(2, 8, 1, 8, 'ink'); s.r(15, 8, 1, 8, 'ink')
    s.r(3, 13, 12, 2, 'bD')
    s.box(18, 6, 26, 16, 'green'); s.r(19, 7, 24, 3, 'gold')
    s.windows(20, 42, 11, 4, 4, 2, 'storm', 'sky')
    s.r(19, 18, 24, 1, 'gold')
    s.box(21, 20, 6, 6, 'ink'); s.box(35, 20, 6, 6, 'ink'); s.r(23, 22, 2, 2, 'gray'); s.r(37, 22, 2, 2, 'gray')
    return s


SPRITES = [
    ('library', 'USF Tampa Library', library, 'shared/'), ('msc', 'Marshall Student Center', msc, 'web/'),
    ('enb', 'Engineering Building II', enb, 'api/'), ('enc', 'Engineering Building III', enc, 'tests/'),
    ('muma', 'Muma College of Business', muma, 'config/'), ('cooper', 'Cooper Hall', cooper, 'docs/'),
    ('rec', 'Campus Recreation Center', rec, 'scripts/'), ('sundome', 'Sun Dome (Yuengling Center)', sundome, 'db/'),
    ('juniper', 'Juniper-Poplar Hall', juniper, None), ('bullrunner', 'Bull Runner stop', bullrunner, ''),
    ('mlk-plaza', 'MLK Plaza and the Bull statue', mlk, None),
]

if __name__ == '__main__':
    out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    imgs, frames, x = [], {}, 0
    for sid, name, fn, folder in SPRITES:
        s = fn(); s.im.save(out / f'{sid}.png'); imgs.append((sid, s.im))
        frames[sid] = {'name': name, 'folder': folder, 'x': x, 'y': 0, 'w': s.w, 'h': s.h, 'door': {'x': s.w // 2, 'y': s.h}}
        x += s.w + 2
    sheet = Image.new('RGBA', (x - 2, max(i.height for _, i in imgs)), (0, 0, 0, 0))
    for sid, im in imgs: sheet.paste(im, (frames[sid]['x'], 0))
    sheet.save(out / 'buildings-sheet.png')
    (out / 'buildings.json').write_text(json.dumps({'image': 'buildings-sheet.png', 'scale_note': '1 sprite px = 1 px at native size; draw at 2x or 3x with pixelArt: true', 'frames': frames}, indent=1))
    print('wrote', len(imgs), 'sprites +', sheet.size)
