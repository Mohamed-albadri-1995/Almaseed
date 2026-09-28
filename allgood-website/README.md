# ALL GOOD Power Construction website

A static, single-page company website: plain HTML, CSS and a little JavaScript, with no build step.

- `index.html`: all page content
- `styles.css`: styles (brand colors are the variables at the top)
- `script.js`: mobile menu and partner tabs
- `assets/`: logo and favicon
- `assets/photos/`: all page photos (see below)

The content comes from the *ALL GOOD Company Profile 2026* presentation.

## Photos

Every photo on the page is a file in `assets/photos/`. To change one, replace the file
with your own photo **using the same file name**. Grey images that say "Replace: …" are
placeholders waiting for a real photo.

| File | Where it appears | Suggested size |
|---|---|---|
| `hero.jpg` | Top of the page | 1000×1000 |
| `about.jpg` | About us | 1200×900 |
| `unit-01-electrical.jpg` | Electrical materials | 1200×900 |
| `unit-02-steel.jpg` | Steel & metal fabrication | 1200×900 |
| `unit-03-construction.jpg` | Engineering construction | 1200×900 |
| `unit-04-equipment.jpg` | Equipment & site support | 1200×900 |
| `unit-05-manufacturing.jpg` | Local manufacturing | 1200×900 |
| `project-1-turaif.jpg` … `project-5-pp12.jpg` | Selected projects | 1200×800 |
| `contact-person.jpg` | Contact (shown as a circle) | 600×600 |

## Preview

Open `index.html` in a browser.

## Publish

Upload the whole folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages
or ordinary shared hosting), then point the domain at it.

## Before going live

- [ ] Confirm the domain `allgoodpower.com` is registered to the company. The site and the
      email address `info@allgoodpower.com` depend on it.
- [ ] Add the Commercial Registration (CR) number to the footer (see the comment in `index.html`).
- [ ] Optional: add an Arabic version of the page.
