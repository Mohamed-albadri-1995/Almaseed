# ALL GOOD Power Construction website

A static, single-page company website: plain HTML, CSS and a little JavaScript, with no build step.

- `index.html`: all page content
- `styles.css`: styles (brand colors are the variables at the top)
- `script.js`: mobile menu and partner tabs
- `assets/`: logo and favicon
- `assets/photos/`: all page photos (see below)

The content comes from the *ALL GOOD Company Profile 2026* presentation.

## Photos and logos

Every photo is a file in `assets/photos/`, and every partner logo is a file in
`assets/logos/`. To change one, replace the file with your own **using the same file
name**. Grey images that say "Replace …" are placeholders waiting for a real image.

| File | Where it appears | Suggested size |
|---|---|---|
| `hero.jpg` | Top of the page | 1000×1000 |
| `about.jpg` | About us | 1200×900 |
| `unit-01-1.jpg` … `unit-01-4.jpg` | Electrical materials photo row | 1200×900 |
| `unit-02-1.jpg` … `unit-02-4.jpg` | Steel & metal fabrication photo row | 1200×900 |
| `unit-03-1.jpg` … `unit-03-4.jpg` | Engineering construction photo row | 1200×900 |
| `unit-04-1.jpg` … `unit-04-4.jpg` | Equipment & site support photo row | 1200×900 |
| `unit-05-1.jpg` … `unit-05-4.jpg` | Local manufacturing photo row | 1200×900 |
| `project-1-turaif.jpg` … `project-5-pp12.jpg` | Selected projects row | 1200×800 |
| `project-N-….jpg`, `project-N-…-2.jpg`, `-3.jpg` | Photos inside each project's details window | 1200×800 |
| `team-1.jpg` … `team-4.jpg` | Meet the team (shown as circles) | 600×600 |
| `wechat-qr.png` | WeChat QR code in Contact | 600×600 |
| `assets/logos/*.png` | Partners section | 480×240, transparent or white background |

To add a fifth photo to a unit's row, copy one `<img … unit-0X-4.jpg …>` line in
`index.html` and change the number.

## Things to fill in

- **WeChat:** replace the text `WeChat ID` in `index.html` with the real ID, and replace
  `assets/photos/wechat-qr.png` with the real QR code.
- **Map:** the map shows Riyadh. For the exact office pin, replace `Riyadh%2C%20Saudi%20Arabia`
  in the map `src` in `index.html` with the office address (or a Google Maps place name).
- **Team:** replace "Team member name", "Position" and the short biography for each person.

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
