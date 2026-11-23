# Website files

Everything here runs in the visitor's browser, and the exact solver is built into `jbf-engine.js`. The only server involved is the optional shared leaderboard (free Firebase, set up below).

## Put it on your website

This repo publishes **`dist/`** to GitHub Pages with [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): every push to `main` that changes `dist/` updates the live site. One-time setup is **Settings → Pages → Source: GitHub Actions**. You can also upload the contents of `dist/` to any other static host (Netlify, your own server).

**Link previews.** Each page carries a description, an icon (`favicon.svg`) and a preview image (`card.png`, rendered from `src/card.html`) for Discord, Reddit and messaging apps. Previews need full addresses, so `SITE_URL` at the top of `build.py` must match where the site lives; change it and rebuild if the site moves.

| File | What it is |
|---|---|
| `index.html` | The *Jumbleberry Fields, Solved* report, with the helper and Bramble Dice embedded |
| `play.html` | Bramble Dice on its own page |
| `helper.html` | The Jumbleberry Fields helper on its own page (good for phones), with a live odds meter |
| `method.html` | How the game was solved, step by step, with a live “ask the solver” panel |
| `cheatsheet.html` / `cheatsheet.png` | One-page cheat sheet (prints on one landscape page with Ctrl+P) and a ready-made image for forums and Discord |
| `jbf-engine.js` | Rules and exact solver, shared by everything |
| `bramble-dice.js` | The `<bramble-dice>` game element |
| `jbf-advisor.js` | The `<jbf-advisor>` helper element |
| `jbf-camera.js` | Reads the five jars from a photo of the game screen (runs on the device; optional for the helper) |
| `leaderboard-config.js` | Your Firebase project id and key for the shared leaderboard (empty = leaderboard hidden) |
| `phone-link.js` | The "scan with your phone" QR code shown on computers |
| `favicon.svg`, `card.png` | The browser-tab icon and the link-preview image |

## Embed the game or helper in any page

```html
<script src="jbf-engine.js"></script>
<script src="leaderboard-config.js"></script>
<script src="bramble-dice.js"></script>
<bramble-dice></bramble-dice>

<script src="jbf-advisor.js"></script>
<jbf-advisor></jbf-advisor>
```

Both elements style themselves (shadow DOM), so they won't clash with your site's CSS. They follow the visitor's light/dark setting, or you can force one with `theme="light"` or `theme="dark"`.

## Leaderboard setup (about 10 minutes, free)

The leaderboard uses **Google Firebase Firestore** on the free **Spark** plan. It needs no credit card, and unlike some free databases it never pauses a quiet project. The free daily allowance is 50,000 reads and 20,000 writes. Each leaderboard view reads at most 15 entries and each submitted game writes one, so a small community won't come close.

1. Go to <https://console.firebase.google.com>, click **Add project**, and name it (for example `bramble-dice`). Google Analytics can stay off.
2. Open **Build → Firestore Database → Create database**. Choose **production mode** and a location near your players.
3. Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
4. Open **Project settings** (gear icon) → **General** → **Your apps** → the **Web** icon (`</>`). Register an app (no hosting needed) and copy `apiKey` and `projectId` from the config it shows.
5. Paste both into `src/leaderboard-config.js`, run `python ../site/build.py`, and upload `dist/`. You can also edit `dist/leaderboard-config.js` directly.
6. Optional but recommended: in the Google Cloud console, under **APIs & Services → Credentials**, restrict that API key to your website's address (HTTP referrers), for example `https://carterkowel.github.io/*`.

What the rules allow:
* Anyone can read the board and add one entry per finished game.
* A name must be 1–20 letters, numbers, spaces, dots, dashes or underscores, and can't contain any word on a short list of rude words. Many players are kids, so the page asks for a nickname rather than a real name. The page checks the same list (`BLOCKED` in `bramble-dice.js`, which also catches look-alike spellings such as `sh1t`); keep the two lists in step. If you change `firestore.rules`, paste it into the Firebase console again and click **Publish**.
* A score must be 0–237, and points given away 0–150.
* Nobody can edit or delete entries from the page.

Only games played with the coach off can be submitted.

**Moderation and honesty.** Because the game runs in the browser, a determined person could post a fake score. The rules block impossible values, but they can't prove a game was really played. To remove an entry, go to Firebase console → Firestore Database → `scores` → the entry → **Delete document**.

The artifact preview copies (`artifact/`) leave the leaderboard out, because published Claude artifacts can't reach outside servers.

## Rebuild after changing anything

```bash
cd jumbleberry_fields
python ../site/export_page_data.py ../site/page_data.json   # refresh the report's numbers
python ../site/build.py                                     # writes site/dist and site/artifact
```

Edit the pages in `src/`. `report.html` gets its numbers from `page_data.json` at build time.

## Notes

* **Personal stats are local.** Each player's own game history and an in-progress helper game live in their browser (`localStorage`).
* **Original theme.** Bramble Dice has its own name, fruit, art and layout. Its colours line up with Jumbleberry Fields (red, yellow, green, purple, black) and the dice math matches, but nothing else is copied. Keep it that way if you change it: don't add Webkinz names, art or screenshots to the game.
* **The helper is labelled unofficial.** It names Jumbleberry Fields because it's a companion for that game, and it says it's a fan tool not affiliated with Webkinz or Ganz. Keep that line.
* **Phone QR code.** On a computer, the helper page and the report (top of the page and the helper section) show a QR code (`phone-link.js`, drawn with `qrcode-generator` from cdnjs). It opens `helper.html#live` on the phone, which puts a big **Start the camera** button at the top, so the live camera is one tap away. The code is built from the page's own address, so it works on any host with no setup. It stays hidden on phones, on local `file://` copies, and in the Claude artifact copies.
* **Live camera needs https.** Phone browsers only allow a live camera feed on `https://` pages (or `localhost`). Any real host (Netlify, GitHub Pages) is https. On a plain `http://` address, such as a laptop on home Wi-Fi, the helper explains this and the photo button still works.
* **What the live camera reads.** From the row of jars it locates the rest of the game screen: the scorecard (which boxes show points), the ROLL button (greyed out means no rolls are left) and the red lids on locked jars. A box only counts as scored once the jars clear, because hovering the mouse over a box shows its points too.
* **Reading the SCORE number.** `jbf-camera.js` cuts the SCORE field out of the frame, straightens it and matches each digit against built-in digit shapes (17 bold fonts plus the game's own 0 and 7 from photos). There is no OCR library to download, and it takes a few milliseconds a frame. It only reports a number when every digit is a clear match, and the helper only uses it once it has held for about a second. When you join mid-game, the SCORE fills in the points of the boxes already used, as long as it is a possible total for those boxes; otherwise, or if it can't be read within a few seconds, the helper asks you to type it. During a game, if the game's SCORE and the helper's total disagree for a few seconds, it offers a one-tap fix. And if glare hides which box was clicked, the jump in SCORE identifies it when only one open box scores that much. Most of the game's own digits weren't in the test photos (they all show 0 or 7), so photos with other SCORE values would help check it.
