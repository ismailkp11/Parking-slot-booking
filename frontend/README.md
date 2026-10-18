# Frontend

The frontend is plain HTML, CSS, and JavaScript. Files are separated by responsibility:

- `index.html` — page structure
- `css/style.css` — visual design and responsive layout
- `js/app.js` — API calls, availability rendering, booking, lookup, cancellation

Start the backend first, then serve this folder (recommended):

```bash
npx serve . -l 5173
```

The API base URL is at the top of `js/app.js` and defaults to `http://localhost:3000`.
