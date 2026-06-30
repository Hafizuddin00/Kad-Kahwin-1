# 💍 Dinie & Fatihqa — Wedding Invitation Website

A modern, elegant **static** single-page wedding invitation website built with vanilla HTML, CSS, and JavaScript.

## Features

- Fullscreen hero with parallax & petal animations
- Event details section
- Live countdown timer to the wedding date
- Guest photo gallery — upload, filter by category, paginated carousel with lightbox
- Google Maps embed for venue location
- RSVP form with conditional fields (attendance, guest count, dietary, notes)
- Live guestbook powered by Google Sheets
- Scroll-reveal animations
- Mobile responsive
- Fully static — no build step required

## Project Structure

```
/
├── index.html
├── netlify.toml
├── .nojekyll
├── components/
│   ├── hero.html
│   ├── event.html
│   ├── countdown.html
│   ├── gallery.html
│   ├── location.html
│   ├── rsvp.html
│   ├── guestbook.html
│   └── footer.html
├── css/
│   ├── global.css
│   ├── hero.css
│   ├── event.css
│   ├── countdown.css
│   ├── gallery.css
│   ├── location.css
│   ├── rsvp.css
│   ├── guestbook.css
│   └── footer.css
├── js/
│   ├── config.js        — single place to set the Google Sheets URL
│   ├── main.js          — entry point, component loader, RSVP logic, Apps Script code
│   ├── scroll.js        — scroll-reveal observer
│   ├── countdown.js     — live countdown timer
│   ├── gallery.js       — photo gallery, upload, carousel, lightbox
│   └── guestbook.js     — live guestbook via Google Sheets
└── assets/
    ├── images/
    └── fonts/
```

## Customisation

### 1. Couple names, date & title
- `index.html` — page `<title>` and loading screen names
- `components/hero.html` — names, wedding date label, venue
- `components/countdown.html` — date label 
- `js/countdown.js` — `WEDDING_DATE` constant
- `components/footer.html` — names, hashtag

### 2. Event details
Edit `components/event.html` for ceremony time, venue name and dress code.

### 3. RSVP deadline
Update the deadline text in `components/rsvp.html`:
```html
<strong>1 September 2026</strong>
```

### 4. Google Maps
Replace the iframe `src` URL in `components/location.html` with your actual venue coordinates.

### 5. Google Sheets — one workbook for everything

RSVP, Guestbook, and Gallery all share **one Google Sheets workbook** and **one Apps Script deployment**. You only need to configure a single URL.

**Step 1 — Create the workbook**

Create a new Google Sheet and add three tabs named exactly:
- `RSVP`
- `Guestbook`
- `Gallery`

Add these column headers (row 1) to each tab:

| Sheet | Columns |
|---|---|
| RSVP | Timestamp · Name · Phone · Attendance · Guests · Dietary · Message |
| Guestbook | Timestamp · Name · Message |
| Gallery | Timestamp · Uploader · Category · Caption · ImageBase64 |

**Step 2 — Add the Apps Script**

Go to **Extensions → Apps Script**, replace all existing code with the script in the top comment of `js/main.js`, then save.

**Step 3 — Deploy**

Deploy → New deployment → Type: Web App
- Execute as: Me
- Who has access: Anyone

Copy the Web App URL.

**Step 4 — Set the URL**

Paste the URL into `js/config.js` — this is the only file you need to edit:

```js
// js/config.js
export const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

All three features (RSVP, Guestbook, Gallery) will pick it up automatically.

> **Demo mode:** When `SCRIPT_URL` is empty, everything runs in demo/in-memory mode — the UI is fully functional but data is not persisted.

## Gallery behaviour

- **Desktop** — shows 8 photos per page
- **Mobile** (≤ 768px) — shows 6 photos per page
- Overflow navigates via ‹ › arrow buttons, dot indicators, or left/right swipe
- Clicking any photo opens the full lightbox with keyboard (← →, Esc) and swipe navigation across all filtered photos

## Local Development

The component loader uses `fetch()`, so the site must be served over HTTP — opening `index.html` directly via `file://` will not work.

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080`

## Deployment

### Netlify
1. Connect the repo or drag-and-drop the folder at [netlify.com](https://netlify.com)
2. Publish directory: `.` (root)
3. The `netlify.toml` handles security headers and cache rules automatically

### GitHub Pages
1. Push to a GitHub repository
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. The `.nojekyll` file ensures all static files are served correctly
