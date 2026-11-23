/*!
 * <phone-link href="helper.html#live" label="Heading" note="Line under it"></phone-link>
 * Shows a QR code that opens `href` on a phone. Only appears on computers (a QR code is no use on the
 * phone itself), and only when the link resolves to a real web address (not a local file:// copy).
 */
(function () {
  'use strict';
  const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  let libPromise = null;
  const loadLib = () => libPromise || (libPromise = new Promise((res, rej) => {
    if (window.qrcode) return res(window.qrcode);
    const s = document.createElement('script');
    s.src = LIB; s.async = true;
    s.onload = () => res(window.qrcode); s.onerror = () => rej(new Error('QR library failed to load'));
    document.head.appendChild(s);
  }));

  function svgFor(qrcode, text) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), q = 2, size = n + 2 * q;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + q} ${r + q}h1v1h-1z`;
    // always dark-on-white, even in dark mode: phone cameras read that most reliably
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code for ${text}" shape-rendering="crispEdges">` +
      `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
  }

  class PhoneLink extends HTMLElement {
    connectedCallback() {
      if (this._done) return; this._done = true;
      let url;
      try { url = new URL(this.getAttribute('href') || location.href, location.href); } catch (e) { return; }
      if (!/^https?:$/.test(url.protocol)) return;                     // local file: nothing a phone can open
      const onComputer = matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 700;
      if (!onComputer) return;
      const root = this.attachShadow({ mode: 'open' });
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const note = this.getAttribute('note') || "Point your phone's camera at the code. No app or sign-in needed.";
      loadLib().then((qrcode) => {
        root.innerHTML = `<style>
          :host { display:block; }
          .card { display:flex; gap:1rem; align-items:center; border:1px solid var(--line, #ddd); border-radius:14px;
            padding:.8rem 1rem; background:var(--surface, transparent); max-width:30rem; }
          svg { width:112px; height:112px; flex:none; border-radius:6px; }
          b { display:block; color:var(--ink, inherit); font-size:1rem; }
          p { margin:.2rem 0 0; color:var(--ink-2, var(--ink2, inherit)); font-size:.9rem; line-height:1.4; }
          a { color:var(--accent, inherit); word-break:break-all; }
        </style>
        <div class="card">${svgFor(qrcode, url.href)}
          <div><b>${esc(this.getAttribute('label') || 'Open this on your phone')}</b>
          <p>${esc(note)} Or type <a href="${esc(url.href)}">${esc(url.host + url.pathname + url.hash)}</a></p></div>
        </div>`;
      }).catch(() => {});
    }
  }
  if (!customElements.get('phone-link')) customElements.define('phone-link', PhoneLink);
})();
