"""Build the website pages from site/src.

    python site/build.py

Outputs
    site/dist/      index.html (the report), play.html (Bramble Dice), helper.html (the helper)
                    + the three .js files. Upload this folder to any static host as-is.
    site/artifact/  the same pages as fragments, for publishing as Claude artifacts.

Embedding on another page of your site:
    <script src="jbf-engine.js"></script>
    <script src="bramble-dice.js"></script>      <bramble-dice></bramble-dice>
    <script src="jbf-advisor.js"></script>       <jbf-advisor></jbf-advisor>
"""
import json
import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
PAGES = {'index.html': 'report.html', 'play.html': 'play.html', 'helper.html': 'helper.html', 'method.html': 'method.html',
         'cheatsheet.html': 'cheatsheet.html'}
SCRIPTS = ['jbf-engine.js', 'bramble-dice.js', 'jbf-advisor.js', 'jbf-camera.js', 'leaderboard-config.js', 'phone-link.js']
LINKS = {
    'dist': {'REPORT_URL': 'index.html', 'PLAY_URL': 'play.html', 'HELPER_URL': 'helper.html', 'METHOD_URL': 'method.html',
             'CHEAT_URL': 'cheatsheet.html'},
    # Published artifact URLs (only used for the artifact copies)
    'artifact': {'REPORT_URL': 'https://claude.ai/artifact/G6XuavWsJKufDTzWWGGS9q',
                 'PLAY_URL': 'https://claude.ai/artifact/Dy3rDMF2tWwgMcifCDBRXU',
                 'HELPER_URL': 'https://claude.ai/artifact/93LfVzgRCrgkEeougjQnhz',
                 'METHOD_URL': 'https://claude.ai/artifact/NWKdqFG88ohnUyj7qodZ3V',
                 'CHEAT_URL': 'https://claude.ai/artifact/7cFk2ygixuoB1tKfT7nyt8'},
}
# Where the website lives. Link previews (Discord, Reddit, iMessage) need full addresses for the
# page and its preview image. Change this if the site moves.
SITE_URL = 'https://carterkowel.github.io/webkinz/'
# One-line descriptions for search results and link previews
DESCRIPTIONS = {
    'index.html': 'Perfect play for the Webkinz dice game Jumbleberry Fields: the real odds of 1 and 2 Moonberries, '
                  'a 9-number par sheet, a live phone helper and a free practice game.',
    'helper.html': 'Point your phone at Jumbleberry Fields and it shows which jars to lock and which box to click, '
                   'using perfect-play math. Free, unofficial fan tool.',
    'play.html': 'Bramble Dice: a free berry dice game with a coach, a trainer and a leaderboard. '
                 'Same odds and scoring math as Jumbleberry Fields.',
    'method.html': 'How Jumbleberry Fields was solved exactly, step by step, with a live "ask the solver" panel.',
    'cheatsheet.html': 'A one-page cheat sheet for playing Jumbleberry Fields well.',
}
SHARE = """<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jumbleberry Fields, Solved">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Jumbleberry Fields, solved: perfect play averages 121.8 points">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">"""
DOC = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head}
</head>
<body>
{body}
</body>
</html>
"""


def render(page_src: str, target: str, name: str = '') -> str:
    html = open(os.path.join(SRC, page_src), encoding='utf-8').read()
    data_path = os.path.join(HERE, 'page_data.json')
    if '/*DATA*/' in html:
        data = open(data_path, encoding='utf-8').read().replace('</', r'<\/')
        html = html.replace('/*DATA*/', data)
    for k, v in LINKS[target].items():
        html = html.replace('{{' + k + '}}', v)
    if target == 'artifact':
        # Artifact previews can't reach outside servers, so the leaderboard stays off there.
        html = html.replace('<script src="leaderboard-config.js"></script>\n', '')
        # claude.ai links can need a sign-in, so the "scan with your phone" QR card is website-only
        html = re.sub(r' *<phone-link[^>]*></phone-link>\n', '', html).replace('<script src="phone-link.js"></script>\n', '')
        # printing is blocked inside artifacts, so drop the cheat sheet's Print button there
        return html.replace('<button class="printbtn" type="button" id="print">Print</button>', '')
    # split the fragment: everything before the first <main>/<div class="page|sheet"> is <head> material
    m = re.search(r'<(main|div class="page"|div class="sheet")', html)
    head, body = html[:m.start()], html[m.start():]
    head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    title = re.search(r'<title>(.*?)</title>', head).group(1)
    url = SITE_URL + ('' if name == 'index.html' else name)
    head = head.replace('</title>\n', '</title>\n' + SHARE.format(desc=DESCRIPTIONS[name], title=title, url=url, site=SITE_URL) + '\n', 1)
    return DOC.format(head=head.strip(), body=body.strip())


def main():
    for target in ('dist', 'artifact'):
        out = os.path.join(HERE, target)
        os.makedirs(out, exist_ok=True)
        for name, src in PAGES.items():
            with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
                f.write(render(src, target, name))
        for s in SCRIPTS:
            if target == 'artifact' and s in ('leaderboard-config.js', 'phone-link.js'):
                continue
            shutil.copy(os.path.join(SRC, s), os.path.join(out, s))
        if target == 'dist':
            shutil.copy(os.path.join(SRC, 'favicon.svg'), os.path.join(out, 'favicon.svg'))
        print('built', out, sorted(os.listdir(out)))
    render_cheatsheet_png()
    render_card_png()


def find_chrome():
    candidates = [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                  r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    return next((c for c in candidates if os.path.exists(c)), None)


def render_card_png():
    """Save dist/card.png, the 1200 x 630 image shown when someone shares a link to the site."""
    import subprocess
    chrome = find_chrome()
    if not chrome:
        print('skipped card.png (no Chrome or Edge found)')
        return
    src = os.path.join(SRC, 'card.html')
    out = os.path.join(HERE, 'dist', 'card.png')
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=6000',
                    '--window-size=1200,630', f'--screenshot={out}', 'file:///' + src.replace(os.sep, '/')],
                   capture_output=True, timeout=120)
    print('rendered', out if os.path.exists(out) else 'card.png FAILED')


def render_cheatsheet_png():
    """Save dist/cheatsheet.png (for forums and Discord) with headless Chrome or Edge, if installed."""
    import subprocess
    chrome = find_chrome()
    if not chrome:
        print('skipped cheatsheet.png (no Chrome or Edge found)')
        return
    src = os.path.join(HERE, 'dist', 'cheatsheet.html')
    out = os.path.join(HERE, 'dist', 'cheatsheet.png')
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--blink-settings=preferredColorScheme=1', '--virtual-time-budget=6000', '--window-size=1200,770',
                    f'--screenshot={out}', 'file:///' + src.replace(os.sep, '/') + '?png=1'], capture_output=True, timeout=120)
    print('rendered', out if os.path.exists(out) else 'cheatsheet.png FAILED')


if __name__ == '__main__':
    main()
