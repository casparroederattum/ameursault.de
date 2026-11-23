# ameursault.de

My personal website. Plain HTML, CSS and a little JavaScript: no framework, no build step.
Hosted on GitHub Pages from the `main` branch.

## Change things

| I want to…                  | Edit                                                     |
| --------------------------- | -------------------------------------------------------- |
| change a project            | `projects.json` (title, one line, tags, longer text, links) |
| change the About text       | `index.html`, the `<div class="about">` block            |
| change colours              | `css/style.css`, the `:root` block at the top            |
| connect my Substack         | `scripts/fetch_substack.py`, the `FEED_URL` line         |
| fill in Impressum/Datenschutz | `impressum.html`, `datenschutz.html` (every `[BRACKETED]` part) |

Then commit and push. The site updates within a minute or two.

## See it locally (fish)

```fish
cd ~/Documents/01_Studium/04_Veranstaltungen/Website/ameursault.de
python3 -m http.server 8000
```

Open http://localhost:8000. (Opening `index.html` directly does not load the projects:
browsers block reading `projects.json` from a `file://` page.)

## Substack posts

`.github/workflows/substack.yml` runs `scripts/fetch_substack.py` every day and on every push.
It writes the latest 5 posts to `posts.json` and commits it only if something changed.
With no feed yet, `posts.json` stays `[]` and the page shows "Writing soon.".

## Credits

Font: Oswald by The Oswald Project Authors, SIL Open Font License 1.1 (`fonts/OFL.txt`),
subset to Latin and self-hosted. The boat is my own linocut.
