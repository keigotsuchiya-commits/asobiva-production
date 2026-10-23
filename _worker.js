// ASOBIVA 公開設定（ASOBIVA builder v7.1 が書き出し）
// 日本時間のその日の日付で、公開期間の外のカード・メニュー・ページを外します。
// 期間外・非表示のページを直接開いたときは、トップへ移します。ほかのファイルはそのまま返します。
const PAGES = {"asobiva.html":["2026-11-17",""],"asobiva-lab.html":["2027-03-01",""],"music.html":["2026-11-17",""],"filmography.html":["2027-03-01",""],"one-shot.html":["2027-01-01",""],"ehon.html":["2026-11-17",""],"project-supana.html":["2027-01-01",""],"oborogi.html":["2026-12-01",""],"marumaru.html":["2026-11-17",""],"n.html":["2027-01-01",""],"yokai.html":["2026-11-17",""],"page-13.html":["2027-01-01",""],"page-14.html":["2027-01-01",""],"shikaku.html":["2027-05-01",""],"timelapse.html":["2027-05-01",""],"game.html":["2026-11-17",""],"pazle.html":["2027-05-01",""],"uranai.html":["2026-11-17",""],"page-20.html":["2027-05-01",""]};
// 確認用の書き出し：下見のアドレス（〇〇.プロジェクト名.pages.dev）では 2027-05-01 の見え方にします。本番のアドレスでは今日の日付のままです。
const FIX_DAY = '2027-05-01';
function isPreview(url) { const h = url.hostname.toLowerCase(); return /\.pages\.dev$/.test(h) && h.split('.').length >= 4; }
function today(env, url) {
  if (url && isPreview(url)) return FIX_DAY;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env.ASOBIVA_TODAY || '')) return env.ASOBIVA_TODAY; // 確認用（ふだんは設定しない）
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function inPeriod(f, t, d) { return (!f || f <= d) && (!t || d <= t); }
// いいね（v6.8）：Cloudflare の D1 データベース（変数名 DB）に、カードごとの数を記録します。DB がなければ数を返しません。
const LIKE_IDS = ["cmutb22kwfmmzq","cmv8uqjyb1zr1u","cmv9do33e4iau5","cmv0mookxrmpr2","cmuv2qpm2jk0ej","cmuwvqfz5ffpao","cmuwvs5om3k9sr","cmuwuja9nrmmif","cmuv2nfjgcsn2k","cmuwvupr3gt7gs","cmuwun1b560gdr","cmuv2rkjicpke1","cmuv2sc4d8p4sm","cmvbemvpbz8rfu","cmur49tn4cshe9","cmuzu09b0wg6me","cmus58dl7tmput","cmus58sk1c2qr3","cmus58sk5dwh3y","cmux59rgqn2lhf","cmux7n840ogq4o","cmuq5kubwdbkca","cmuwonb2wdeo26","cmusr1kkab1kcc","cmvb2bz8lhiui6","cmvb31mvvjpard","cmutvd1dbmn42f","cmuy19w23d5tw4"];
let likeReady = false;
async function likeDb(env) {
  if (!env || !env.DB) return null;
  if (!likeReady) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)').run(); likeReady = true; }
  return env.DB;
}
function likeJson(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
async function likeApi(request, env, url) {
  let db;
  try { db = await likeDb(env); } catch (e) { db = null; }
  if (!db) return likeJson({ error: 'no-db' }, 503);
  if (url.pathname === '/api/likes' && request.method === 'GET') {
    const ids = (url.searchParams.get('ids') || '').split(',').filter(x => LIKE_IDS.includes(x)).slice(0, 90);
    const out = {}; ids.forEach(x => { out[x] = 0; });
    if (ids.length) {
      const r = await db.prepare('SELECT id, n FROM likes WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
      (r.results || []).forEach(x => { out[x.id] = x.n; });
    }
    return likeJson(out);
  }
  if (url.pathname === '/api/like' && request.method === 'POST') {
    let b = null;
    try { b = await request.json(); } catch (e) {}
    const id = String((b && b.id) || ''), d = b && b.d === -1 ? -1 : 1;
    if (!LIKE_IDS.includes(id)) return likeJson({ error: 'bad-id' }, 400);
    const r = await db.prepare('INSERT INTO likes (id, n) VALUES (?1, MAX(?2, 0)) ON CONFLICT(id) DO UPDATE SET n = MAX(n + ?2, 0) RETURNING n').bind(id, d).first();
    return likeJson({ n: r ? r.n : 0 });
  }
  return likeJson({ error: 'not-found' }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/likes' || url.pathname === '/api/like') return likeApi(request, env, url);
    const m = url.pathname.match(/^\/([^\/]*)$/); // サイトの一番上の階層だけ（ビルダーのページ）
    if (!m) return env.ASSETS.fetch(request);
    const d = today(env, url);
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
