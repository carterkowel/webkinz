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

### Embedded on carterkowel.github.io

Bramble Dice is also embedded on the personal site at <https://carterkowel.github.io/projects/jumbleberry-fields/>. That page loads these three files by full address, in this order, and uses `<bramble-dice theme="light|dark">`:

```html
<script src="https://carterkowel.github.io/webkinz/jbf-engine.js"></script>
<script src="https://carterkowel.github.io/webkinz/leaderboard-config.js"></script>
<script src="https://carterkowel.github.io/webkinz/bramble-dice.js"></script>
```

So that page keeps working:
* **Keep the names stable.** Don't rename `jbf-engine.js`, `leaderboard-config.js`, `bramble-dice.js`, the `<bramble-dice>` tag or the `theme` attribute without updating the personal site too.
* **No relative paths in the component.** `bramble-dice.js` must not load anything (images, fonts, data, other scripts) by a relative path, because on the personal site it would resolve against `/projects/`, not `/webkinz/`. Today it draws everything inline and only calls the Firestore API by full address.
* **Leaderboard from any page on the host.** The API key's HTTP-referrer restriction must cover the whole host (`https://carterkowel.github.io/*`), not just `/webkinz/*`. The Firestore rules don't look at which page sent a request.

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

## Tests

```bash
node site/test_engine.js       # the browser solver matches the Python one
node site/test_live.js         # whole games through the live camera helper, with misreads
```

`test_live.js` plays games with a scripted perfect player and feeds the helper what the camera would report each frame, with bursts of misreads (the x3 sign, ROLL, lids, jars, scorecard, SCORE, losing the game for a moment). It reports how often the helper's round runs ahead of the game, how often its advice comes from the wrong scorecard (and the longest such stretch), and whether the final total is right. A perfect camera must be perfect; everyday wobble must stay within one round, under 3% wrong advice, and right at the end in 90% of games. `SEED=n` plays a different set of games; `ADVISOR=path` tests another copy of `jbf-advisor.js`. Run it after any change to the live camera logic.

## Notes

* **Personal stats are local.** Each player's own game history and an in-progress helper game live in their browser (`localStorage`).
* **Original theme.** Bramble Dice has its own name, fruit, art and layout. Its colours line up with Jumbleberry Fields (red, yellow, green, purple, black) and the dice math matches, but nothing else is copied. Keep it that way if you change it: don't add Webkinz names, art or screenshots to the game.
* **The helper is labelled unofficial.** It names Jumbleberry Fields because it's a companion for that game, and it says it's a fan tool not affiliated with Webkinz or Ganz. Keep that line.
* **Phone QR code.** On a computer, the helper page and the report (top of the page and the helper section) show a QR code (`phone-link.js`, drawn with `qrcode-generator` from cdnjs). It opens `helper.html#live` on the phone, which puts a big **Start the camera** button at the top, so the live camera is one tap away. The code is built from the page's own address, so it works on any host with no setup. It stays hidden on phones, on local `file://` copies, and in the Claude artifact copies. On a computer the helper's own camera buttons sit folded away at the bottom (**Camera options**), since the camera is meant for a phone pointed at the game.
* **Live camera needs https.** Phone browsers only allow a live camera feed on `https://` pages (or `localhost`). Any real host (Netlify, GitHub Pages) is https. On a plain `http://` address, such as a laptop on home Wi-Fi, the helper explains this and the photo button still works.
* **What the live camera reads.** From the row of jars it locates the rest of the game screen: the red lids on locked jars, the ROLL button (greyed out means no rolls are left), the x3 / x2 / x1 sign next to it (rolls left this round), the scorecard (which boxes show points) and the SCORE. Nothing needs confirming:
  * **A box was clicked** when the sign goes back to x3, a greyed-out ROLL lights up, the lids unlock or the SCORE goes up (the berries stay in the jars). Any one of these can be misread for a moment, so it takes two that agree, or one that holds for a few seconds, and nothing else on screen saying otherwise (the sign still showing rolls left, ROLL still greyed out, or the SCORE not moving). The SCORE's jump or the scorecard says which box. Hovering the mouse over a box also shows its points, so a box only counts as filled once it has shown points for 1.5 seconds.
  * **Taking a click back:** until the game confirms a click (the SCORE goes up, or the x3 sign holds), the helper keeps the game as it was. If the sign still shows the rolls left from before, or the SCORE doesn't move, or the box stays blank on the scorecard, it puts the berries back and says "No box was clicked yet."
  * **A new round** needs proof too: a click puts up x3 before the next roll, so x2 with no x3 in between is the same round (and a jar that changed is a misread). Without the sign in view, the helper waits for the SCORE to say whether a box was clicked first.
  * **A roll** that brings up the same berries shows on the sign (x3, then a roll sign for a few seconds).
  * **The game is over** when the end screen replaces the board in round 9.
  * **Catching up:** if the camera missed a few rounds, the helper takes the used boxes from the scorecard and the total from the SCORE. A box the helper has as used but the scorecard keeps showing blank (2 to 6 seconds) is opened again. If the game's SCORE and the helper's total disagree for 4 seconds, it uses the game's, but only once the scorecard and the helper agree on which boxes are used, so a wrong box is fixed rather than hidden.
  * **Edges of the picture:** a box or the ROLL button cut off by the edge of the camera picture counts as "can't tell", not blank or greyed out.
  * **Boxes scored 0** don't move the SCORE, but the game shows "0" in the box, so the scorecard settles them: a "0" box the helper missed is filled in after 5 seconds (longer than a hover), and a box the helper filled that stays blank is opened again.
  * **Steady advice:** what to do stays on screen while the camera wobbles; it only asks you to point the camera after about 2.5 seconds without the game.
  * **Fixing by hand:** the roll and the score in the camera view's top line can be tapped, for the rare time the camera can't tell.
* **Hold the phone sideways.** The game is wider than it is tall, so sideways it fills more of the camera picture and reads better; upright, the x3 sign is often cut off. Sideways, the advice moves to a side panel so nothing covers the game. The helper gives tips when the game is cut off or too small ("Turn your phone sideways", "Aim a little lower", "Move a little closer").
* **Reading the SCORE and the x3 sign.** `jbf-camera.js` cuts the SCORE field out of the frame, straightens it and matches each digit against built-in digit shapes (17 bold fonts plus the game's own 0, 1, 2, 3, 5, 6, 7 and 9 from photos). The x3 sign's digit is matched the same way. There is no OCR library to download, and it takes a few milliseconds a frame. A number only counts when every digit is a clear match and it holds for a few frames. Tested with each photo left out of the game digits in turn, the SCORE read right on 22 of 27 photos and was unsure on the rest (none wrong), and the sign read right wherever it was fully in view. The game's 4 and 8 haven't been seen yet, so photos with a 4 or an 8 in the SCORE would help check them.
