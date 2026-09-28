"""Regenerate the labeled photo placeholders in assets/photos/.

Run from the allgood-website folder:  python3 tools/placeholders.py [file ...]
With no arguments it rebuilds every placeholder. It never touches a file
that is not listed below, so real photos under other names are safe, but it
WILL overwrite a listed file, so pass only the names you still need.
"""
import sys
import textwrap
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

PROJECTS = [
    ("1-turaif", "Turaif", "the Turaif wind farm"),
    ("2-saidawi", "Saidawi", "the Saidawi solar plant"),
    ("3-qassim", "Qassim", "the Qassim CCGT power plant"),
    ("4-wadi", "Wadi", "the Wadi solar plant"),
    ("5-pp12", "PP12", "the PP12 project camp"),
    ("6-qiddiya", "Qiddiya", "your work at Qiddiya"),
]
SITE_2 = {
    "1-turaif": "Your cable drums delivered to site.",
    "2-saidawi": "Cable trays installed across the solar field.",
    "3-qassim": "Steel structure components on site.",
    "4-wadi": "The steel structure erected on site.",
    "5-pp12": "Prefabricated cafeteria and dormitories.",
    "6-qiddiya": "Your materials installed on site.",
}
SITE_3 = {
    "1-turaif": "Cable laying or grid connection work.",
    "2-saidawi": "Cables and trays arriving on site.",
    "3-qassim": "Pipes and flanges you supplied.",
    "4-wadi": "Flanges, fittings and fasteners supplied.",
    "5-pp12": "Steel structures under construction.",
    "6-qiddiya": "Installation or handover on site.",
}
# our role on each project decides which photo rows its details window has
SUPPLIER = {"1-turaif", "2-saidawi", "3-qassim", "4-wadi", "5-pp12"}
SUBCONTRACTOR = {"5-pp12", "6-qiddiya"}
WORKS = [
    "Your crew working inside the project.",
    "Work in progress: installation or construction.",
    "The finished work handed over.",
]
DELIVERY = [
    "Trucks loaded with the order leaving your yard.",
    "Materials unloaded at the project site.",
    "Delivery handover with the client's team.",
]

SLOTS = [
    ("hero.jpg", "Main photo", "Your strongest photo: a major project, your yard or your crew at work.", 1000, 1000),
    ("about.jpg", "About us", "Your team together, or the front of the Riyadh office or warehouse.", 1200, 900),
    ("unit-01-1.jpg", "Electrical 1", "Bahra Electric cable drums in your yard.", 1200, 900),
    ("unit-01-2.jpg", "Electrical 2", "Cable trays and conduits installed on site.", 1200, 900),
    ("unit-01-3.jpg", "Electrical 3", "Switchgear or distribution panels.", 1200, 900),
    ("unit-01-4.jpg", "Electrical 4", "Cable pulling or installation on site.", 1200, 900),
    ("unit-02-1.jpg", "Steel 1", "Steel structures being fabricated in your workshop.", 1200, 900),
    ("unit-02-2.jpg", "Steel 2", "Pipes, flanges and fittings in stock.", 1200, 900),
    ("unit-02-3.jpg", "Steel 3", "Industrial valves on warehouse racks.", 1200, 900),
    ("unit-02-4.jpg", "Steel 4", "Fasteners, stud bolts or anchor bolts.", 1200, 900),
    ("unit-03-1.jpg", "Construction 1", "Your crew doing waterproofing on site.", 1200, 900),
    ("unit-03-2.jpg", "Construction 2", "Anti-corrosion or insulation work.", 1200, 900),
    ("unit-03-3.jpg", "Construction 3", "Scaffolding erected on a project.", 1200, 900),
    ("unit-03-4.jpg", "Construction 4", "A temporary camp or pipeline you built.", 1200, 900),
    ("unit-04-1.jpg", "Equipment 1", "A Cummins generator set on site.", 1200, 900),
    ("unit-04-2.jpg", "Equipment 2", "A truck crane or man lift at work.", 1200, 900),
    ("unit-04-3.jpg", "Equipment 3", "A loader, excavator or grader.", 1200, 900),
    ("unit-04-4.jpg", "Equipment 4", "Your trucks and low-bed trailers.", 1200, 900),
    ("unit-05-1.jpg", "Manufacturing 1", "The cable tray factory building or site.", 1200, 900),
    ("unit-05-2.jpg", "Manufacturing 2", "The production line or machinery.", 1200, 900),
    ("unit-05-3.jpg", "Manufacturing 3", "Finished cable trays (trough, ladder).", 1200, 900),
    ("unit-05-4.jpg", "Manufacturing 4", "Bahra cable and ALL GOOD trays together.", 1200, 900),
]
for key, name, overview in PROJECTS:
    SLOTS += [
        (f"project-{key}.jpg", f"{name} · cover", f"Overview of {overview}.", 1200, 800),
        (f"project-{key}-2.jpg", f"{name} · site 2", SITE_2[key], 1200, 800),
        (f"project-{key}-3.jpg", f"{name} · site 3", SITE_3[key], 1200, 800),
    ]
    if key in SUPPLIER:
        SLOTS += [(f"project-{key}-delivery-{i}.jpg", f"{name} · delivery {i}", d, 1200, 800)
                  for i, d in enumerate(DELIVERY, 1)]
    if key in SUBCONTRACTOR:
        SLOTS += [(f"project-{key}-works-{i}.jpg", f"{name} · our works {i}", d, 1200, 800)
                  for i, d in enumerate(WORKS, 1)]
ROUND = [("team-1.jpg", "Yu Peng Peng", "Portrait photo")]
ROUND += [(f"team-{i}.jpg", f"Member {i}", "Portrait photo") for i in (2, 3, 4)]
ROUND += [("wechat-qr.png", "WeChat QR", "Me › QR code › Save")]


def draw(file, title, desc, w, h, round_=False):
    im = Image.new("RGB", (w, h), "#eef2f6")
    d = ImageDraw.Draw(im)
    cx = w // 2
    if round_:
        t, ds, fs, wrap, icon = 64, 44, 24, 16, 110
    else:
        t, ds, fs, wrap, icon = int(w * .058), int(w * .042), int(w * .022), 30, int(w * .09)
    f1, f2, f3 = ImageFont.truetype(FONT_BOLD, t), ImageFont.truetype(FONT, ds), ImageFont.truetype(FONT, fs)
    lines = textwrap.wrap(desc, wrap)
    bh, c, lw = int(icon * .7), "#8fa3ba", max(3, icon // 25)
    foot = file if round_ else f"REPLACE: {file}  ·  {w}×{h}"
    blocks = [("icon", None, bh + int(t * .9)), ("t", title, int(t * 1.35))]
    blocks += [("d", l, int(ds * 1.3)) for l in lines]
    blocks += [("gap", None, int(fs * .8)), ("f", foot, int(fs * 1.4))]
    y = (h - sum(b[2] for b in blocks)) // 2
    for kind, txt, hh in blocks:
        if kind == "icon":
            cy = y + bh // 2 + 10
            d.rounded_rectangle([cx - icon // 2, cy - bh // 2, cx + icon // 2, cy + bh // 2], radius=icon // 12, outline=c, width=lw)
            d.rectangle([cx - icon // 5, cy - bh // 2 - icon // 10, cx + icon // 5, cy - bh // 2], fill=c)
            r = icon // 5
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=lw)
        elif kind in "tdf":
            f = {"t": f1, "d": f2, "f": f3}[kind]
            col = {"t": "#00346a", "d": "#1b5897", "f": "#7d8fa5"}[kind]
            d.text((cx - d.textlength(txt, font=f) / 2, y), txt, font=f, fill=col)
        y += hh
    opts = {"quality": 85} if file.endswith(".jpg") else {}
    im.save("assets/photos/" + file, **opts)


wanted = set(sys.argv[1:])
for slot in SLOTS:
    if not wanted or slot[0] in wanted:
        draw(*slot)
for file, title, desc in ROUND:
    if not wanted or file in wanted:
        draw(file, title, desc, 600, 600, True)
