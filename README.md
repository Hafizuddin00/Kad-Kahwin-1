# 💍 Sarah & James — Wedding Invitation Website

A modern, elegant **static** single-page wedding invitation website.

## Features

- ✅ Fullscreen hero with parallax & petal animations
- ✅ Event details cards (Ceremony, Reception, After Party)
- ✅ Live countdown timer
- ✅ Photo gallery with masonry grid, filters & lightbox
- ✅ Google Maps embeds for both venues
- ✅ RSVP form (client-side only)
- ✅ Live guestbook powered by Google Sheets API
- ✅ Scroll-reveal animations
- ✅ Mobile responsive
- ✅ Fully static (HTML + CSS + JS)

## Project Structure

```
/
├── index.html
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
│   ├── main.js
│   ├── scroll.js
│   ├── countdown.js
│   ├── gallery.js
│   └── guestbook.js
└── assets/
    ├── images/
    └── fonts/
```

## Customisation

### 1. Couple Names & Date
Edit the names and date across these files:
- `components/hero.html` — names, date, venue
- `components/event.html` — event details
- `components/countdown.html` — label
- `js/countdown.js` — `WEDDING_DATE` constant
- `components/footer.html` — names, hashtag

### 2. Gallery Images
Replace the Unsplash URLs in `components/gallery.html` with your own images.

### 3. Google Maps
Update the iframe `src` URLs in `components/location.html` with your actual venue coordinates.

### 4. RSVP Backend
The RSVP form is UI-only by default. To connect it to a backend, modify the submit handler in `js/main.js`.

### 5. Guestbook — Google Sheets Setup

1. Create a Google Sheet with columns: `Timestamp | Name | Message`
2. Go to **Extensions → Apps Script** and paste the Apps Script code from `js/guestbook.js` (top comment)
3. Deploy as **Web App** → Execute as: Me → Access: Anyone
4. Copy the Web App URL
5. Paste it into `js/guestbook.js`:
   ```js
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
   ```

## Deployment

### GitHub Pages
1. Push to a GitHub repo
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. The `.nojekyll` file ensures static files are served correctly

### Netlify
1. Connect repo or drag-and-drop the folder to [netlify.com](https://netlify.com)
2. Publish directory: `.` (root)
3. Deploy!

> **Note:** The `fetch()` component loader requires a web server (not `file://`).
> For local development use: `npx serve .` or VS Code Live Server.

## Local Development

```bash
npx serve .
# or
python -m http.server 8080
```

Then open http://localhost:8080
