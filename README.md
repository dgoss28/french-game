# Être & Avoir — French Practice

A tiny, mobile-first browser game for practicing the **present tense** of the French verbs
**être** and **avoir** by filling in the blanks. ~120 examples, each with an explanation of *why*
that conjugation is correct. Pure HTML/CSS/JS — no build step, no dependencies, no server.

## Run locally
Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages (free)

All paths in this project are relative, so it works fine from a Pages subpath
(`https://<you>.github.io/french-game/`). No build step needed.

1. Push the folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "French être/avoir practice game"
   git branch -M main
   git remote add origin https://github.com/<you>/french-game.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, **Branch = `main`**,
   folder = **`/ (root)`**, then **Save**.
4. Wait ~1 minute; your site appears at `https://<you>.github.io/french-game/`.

Every future `git push` to `main` redeploys automatically.

## Files
| File | Purpose |
|------|---------|
| `index.html` | Markup |
| `styles.css` | Mobile-first styling + dark mode |
| `script.js` | Game engine |
| `data.js` | The ~120 examples + explanations |
| `favicon.svg` | App icon |
| `site.webmanifest` | "Add to Home Screen" support on mobile |

## Add more questions
Append objects to `EXAMPLES` in `data.js`:
```js
{
  verb: "être",                 // "être" or "avoir"
  subject: "Je",                // for reference
  answer: "suis",               // the correct present-tense form
  prompt: "Je ___ étudiant.",   // blank marked with ___
  translation: "I am a student.",
  explanation: "Why this form is correct…"
}
```
