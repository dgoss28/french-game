# French Practice — Fill in the Blank

A tiny, mobile-first browser game for practicing French beginner grammar by filling in the blanks.
Covers the **present tense** of **être**, **avoir** and regular **-er** verbs, plus **possessive
adjectives** (mon/ma/mes …), **demonstratives** (ce/cet/cette/ces), **c'est / ce sont**, and
**questions** (est-ce que / qu'est-ce que). Every example comes with an explanation of *why* that
answer is correct. Pure HTML/CSS/JS — no build step, no dependencies, no server.

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
  verb: "être",                 // the "form family" — see below
  subject: "Je",                // for reference
  answer: "suis",               // the correct answer that fills the blank
  prompt: "Je ___ étudiant.",   // blank marked with ___
  translation: "I am a student.",
  explanation: "Why this form is correct…"
}
```

The `verb` field names a **form family** — the pool the multiple-choice distractors are drawn
from (see `FORMS` in `script.js`). Use a verb (`être`, `avoir`, or any `-er` verb), or one of the
grammar families: `possessif-mon` / `possessif-ton` / `possessif-son` / `possessif-notre` /
`possessif-votre` / `possessif-leur`, `demonstratif`, `cest`, `question`. Each family is mapped to
a filter button via `TOPIC_GROUP` and to a friendly chip label via `FAMILY_LABEL` in `script.js`.

For a sentence with several blanks, use a `blanks` array instead of `answer` (families may differ):
```js
{
  prompt: "Elle ___ ___ chien.",
  translation: "She has her dog.",
  blanks: [ { verb: "avoir", answer: "a" }, { verb: "possessif-son", answer: "son" } ],
  explanation: "avoir → elle a; chien is masculine → son chien."
}
```
