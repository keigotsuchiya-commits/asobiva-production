// ASOBIVA 公開設定（ASOBIVA builder v6.2 が書き出し）
// 日本時間のその日の日付で、公開期間の外のカード・メニュー・ページを外します。
// 期間外・非表示のページを直接開いたときは、トップへ移します。ほかのファイルはそのまま返します。
const PAGES = {"asobiva.html":["2026-11-17",""],"music.html":["2026-11-17",""],"ehon.html":["2026-11-17",""],"marumaru.html":["2026-11-17",""],"yokai.html":["2026-11-17",""],"project-supana.html":["2027-01-01",""],"game.html":["2026-11-17",""],"uranai.html":["2026-11-17",""],"n.html":["2027-01-01",""],"page-11.html":["2027-01-01",""],"page-12.html":["2027-01-01",""],"oborogi.html":["2027-01-01",""]};
function today(env) {
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env.ASOBIVA_TODAY || '')) return env.ASOBIVA_TODAY; // 確認用（ふだんは設定しない）
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function inPeriod(f, t, d) { return (!f || f <= d) && (!t || d <= t); }
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/([^\/]*)$/); // サイトの一番上の階層だけ（ビルダーのページ）
    if (!m) return env.ASSETS.fetch(request);
    const d = today(env);
    let f = m[1];
    try { f = decodeURIComponent(f); } catch (e) {}
    f = f.toLowerCase();
    if (!f) f = 'index.html'; else if (!/\.html?$/.test(f)) f += '.html';
    const p = PAGES[f];
    if (p && (p === 'hide' || !inPeriod(p[0], p[1], d))) return Response.redirect(new URL('/', url).toString(), 302);
    // 日によって中身が変わるので、ブラウザの「変わっていない（304）」を使わない
    const h = new Headers(request.headers);
    h.delete('If-None-Match'); h.delete('If-Modified-Since');
    const res = await env.ASSETS.fetch(new Request(request, { headers: h }));
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const out = new HTMLRewriter().on('[data-pf],[data-pt]', {
      element(el) { if (!inPeriod(el.getAttribute('data-pf'), el.getAttribute('data-pt'), d)) el.remove(); }
    }).transform(res);
    const oh = new Headers(out.headers);
    oh.delete('ETag'); oh.delete('Last-Modified'); oh.set('Cache-Control', 'no-cache');
    return new Response(out.body, { status: out.status, statusText: out.statusText, headers: oh });
  }
};
