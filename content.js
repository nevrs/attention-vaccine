// Jev の判定をページに表示する。サイトごとに2つのモードがある（ポップアップで選ぶ）:
//   page  … ページ1枚（見出し＋本文冒頭）を1回判定し、右下に小さなマークを出す
//   block … 一覧の1件ずつを判定し、当たった件の右上に「手口」の印を重ねる
// マークを押すと、何に当たったか・なぜか・数値が出る。当たらなかった件には何も付けない（静かに、文章をずらさない）。
// 軽さのために: 見えている状態が一定時間（既定 1.5 秒）続いた件だけ判定する（流し読みした件は判定しない）。
// スクロールを優先し、区切りを探す・マークを描くのはスクロールが止まってから。ページの変化の常時監視はしない。
// 区切りの自動検出は一度見つけた形を覚える。オンの問いは1回の呼び出しにまとめる。
const MAX_CHARS = 2000;

const DEFAULTS = { enabled: true, siteModes: {}, userSites: [], pillars: {}, rules: [], compare: {}, debug: false, dwell: 1.5, excludeAuthors: [] };
// デバッグモード（高度な設定）: 見つけた件を枠で囲み、全件にマーク、右下に内部の状態、コンソールに [Jev] の記録
const dbg = (...a) => settings.debug && console.log("[Jev]", ...a);
let itemsFrom = ""; // 区切りの出どころ（デバッグ表示用）
let SITE = null; // このサイトの設定（sites.js の組み込み ＋ 利用者が足した userSites）。無ければ null
let SITE_ITEMS = []; // 区切りの候補。利用者の設定 → 組み込み の順。どちらも0件なら自動検出
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg", "BR", "HR", "LINK", "META"]);

let settings = DEFAULTS;
let mode = null; // "page" | "block" | null
let checks = []; // { id, label, why, qs[], code, high, action, showSources }
let keyless = false; // API キーが無い: コードで判定する項目だけで動く（Jev は呼ばない）
const stats = { judged: 0, warned: 0, errors: 0, lastError: "", excluded: 0 };
const warnedSeen = new Set(); // 印を付けた投稿（本文）。X は画面外の投稿を作り直すので、要素ごとに数えると戻るたびに増える
let excludedAuthors = new Set(); // 利用者が「判定しない」と決めたアカウント（小文字、@ なし）
const excludedSeen = new Set(); // 除外した投稿（投稿者＋本文の冒頭）。X は画面外の投稿を作り直すので、要素ではなく中身で数える

// ---- 共通 ----

function buildChecks(s, mode) {
  const out = [];
  for (const [id, p] of Object.entries(JEV_PILLARS)) {
    const c = { ...p.defaults, ...(s.pillars[id] || {}) };
    if (!c.on || (p.modes && !p.modes.includes(mode)) || (keyless && !p.code)) continue;
    out.push({ id, label: p.label, short: p.short, why: p.why, tip: p.tip, qs: p.qs.map((k) => JEV_QUESTIONS[k]), code: p.code, high: c.high, action: c.action, showSources: !!p.showSources });
  }
  if (keyless) return out; // 自分で足す項目は Jev が要る
  for (const r of s.rules) {
    if (!r.condition) continue;
    const cut = (n) => (r.condition.length > n ? r.condition.slice(0, n) + "…" : r.condition);
    const pre = JEV_PRESETS.find((p) => p.condition === r.condition); // おすすめから足した項目は、その名前と説明で出す
    out.push({ id: r.id, label: pre?.label || cut(16), short: pre?.label || cut(8), why: pre?.why || "", tip: pre?.tip, qs: [r.condition], high: r.high, action: "warn" });
  }
  return out;
}

// デバッグモード: どのモードで動いているか（ブロックごと／ページ全体／動いていない）を隅の表示に出す
let debugOff = null;
const modeName = (m) => JEV_MODES[m] || "オフ";
function showDebugOff(chosen) {
  const why = !settings.enabled ? "拡張が無効です" : !chosen ? "このサイトのモードが「オフ」です" : "判定項目がありません（すべてオフ、またはこのモードで使える項目がない）";
  debugOff = createMark(true);
  document.documentElement.append(debugOff.host);
  debugOff.badge.textContent = "Jev｜オフ";
  debugOff.badge.classList.add("quiet");
  const d = document.createElement("div");
  d.className = "note";
  d.textContent = "― デバッグ ― 適用中のモード: オフ。" + why;
  debugOff.pop.append(d);
}

let loadSeq = 0;
async function load() {
  const seq = ++loadSeq; // 設定の保存で続けて呼ばれても、最後の1回だけが開始する（開始が重なるとタイマーが漏れる）
  settings = await chrome.storage.sync.get(DEFAULTS);
  Object.assign(stats, { judged: 0, warned: 0, errors: 0, lastError: "", excluded: 0 });
  excludedAuthors = new Set((settings.excludeAuthors || []).map((a) => String(a).replace(/^@/, "").toLowerCase()));
  excludedSeen.clear();
  warnedSeen.clear();
  SITE = jevSiteFor(location.hostname, settings.userSites);
  SITE_ITEMS = [...new Set([SITE?.item, jevSiteFor(location.hostname)?.item].filter(Boolean))];
  stopPage();
  stopBlock();
  debugOff?.host.remove();
  debugOff = null;
  const chosen = settings.enabled ? settings.siteModes[location.hostname] || null : null;
  mode = chosen;
  const has = (await chrome.runtime.sendMessage({ type: "hasKey" }).catch(() => null))?.has;
  if (seq !== loadSeq) return;
  keyless = !has;
  checks = mode ? buildChecks(settings, mode) : [];
  if (!checks.length) mode = null;
  if (settings.debug && !mode) showDebugOff(chosen);
  dbg("load", { host: location.hostname, mode, checks: checks.map((c) => c.id), site: SITE });
  if (mode === "page") startPage();
  if (mode === "block") startBlock();
}

// 個人間のやり取り（DM・メール・チャット）の画面は判定しない。本文を接続先に送らないため。
// サイト別の区切りが合わない画面では自動検出に落ちるので、その前にここで止める（X の DM で起きうる）
const PRIVATE_PATH = /\/(messages?|inbox|chats?|dm|direct|mail)(\/|$)|^\/i\/grok(\/|$)/i; // /i/grok は X の Grok との会話
// アドレスの形では見分けられないチャット・メールのサービスは、サイトごと判定しない
const PRIVATE_HOSTS = ["discord.com", "slack.com", "messenger.com", "teams.microsoft.com", "teams.live.com", "web.whatsapp.com", "web.telegram.org",
  "chat.line.me", "chatwork.com", "mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.co.jp", "mail.yahoo.com", "proton.me",
  // AI とのチャット（自分の相談内容が載る）
  "chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "grok.com", "copilot.microsoft.com", "perplexity.ai", "chat.deepseek.com"];
const isPrivatePage = () =>
  PRIVATE_PATH.test(location.pathname) || PRIVATE_HOSTS.some((h) => location.hostname === h || location.hostname.endsWith("." + h));

async function ask(text) {
  const questions = [...new Set(checks.flatMap((c) => c.qs))];
  try {
    // Jev の問いが無い（キーなし・コードの項目だけ）ときは呼ばない
    const answers = questions.length ? await chrome.runtime.sendMessage({ type: "judge", text, questions }) : { answers: {} };
    if (answers.error) throw new Error(answers.error);
    stats.judged++;
    dbg("judge", text.slice(0, 40).replace(/\n/g, " "), score(answers.answers, text).map((r) => `${r.c.id} ${r.pct.toFixed(0)}%${r.hit ? "!" : ""}`).join(" "));
    return answers.answers;
  } catch (e) {
    stats.errors++; // 失敗したら何も付けない（表示はそのまま）
    stats.lastError = String(e.message || e);
    dbg("error", stats.lastError);
    return null;
  }
}

// 各判定項目の確率（%）と、閾値を超えたかどうか。コードの項目は確率ではなく、当たり／外れと理由（detail）。
// answers が null（Jev の判定がまだ）なら Jev の項目は出さない。同じ文言は本文ではなく、画面に流れてきた投稿どうしで決まる
function score(answers, text, el) {
  const rows = [];
  for (const c of checks) {
    if (c.code === "dup") {
      const d = dupOf(el);
      rows.push({
        c, pct: d.hit ? 100 : 0, hit: d.hit,
        badge: d.hit ? `同じ文 ${d.authors.length}アカウント` : null,
        detail: d.hit ? "同じ文を投稿しているアカウント: " + d.authors.slice(0, 10).map((a) => "@" + a).join(" ") + (d.authors.length > 10 ? ` ほか${d.authors.length - 10}` : "") : null,
      });
    } else if (c.code) {
      if (text == null) continue;
      const r = JEV_CODE[c.code](text);
      rows.push({ c, pct: r.hit ? 100 : 0, hit: r.hit, detail: r.matches.length ? "見つかった言い回し: " + r.matches.map((m) => `「${m}」`).join("") : null });
    } else if (answers) {
      const pct = c.qs.reduce((acc, q) => acc * answers[q], 1) * 100;
      rows.push({ c, pct, hit: pct >= c.high });
    }
  }
  return rows;
}

// 範囲内の、一次ソース（論文・公的機関）へのリンク。判定は Jev ではなくアドレスだけで行う
function primaryLinks(root) {
  const seen = new Set();
  for (const a of root.querySelectorAll("a[href]")) {
    let u;
    try { u = new URL(a.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.hostname === location.hostname) continue; // 自サイト内の案内リンクは除く
    const h = u.hostname.replace(/^www\./, "");
    if (JEV_PRIMARY_HOSTS.some((d) => h === d || h.endsWith("." + d))) seen.add(u.href.split("#")[0]);
  }
  return [...seen];
}

function shortUrl(href) {
  const u = new URL(href);
  const s = u.hostname.replace(/^www\./, "") + u.pathname;
  return s.length > 48 ? s.slice(0, 47) + "…" : s;
}

// リンクから論文の DOI を取り出す。doi.org 以外でも、出版社の URL に DOI が入っていることが多い。arXiv は DataCite の DOI に直す
function doiOf(href) {
  let decoded = href;
  try { decoded = decodeURIComponent(href); } catch {} // 壊れた % を含むリンクでも落とさない
  const m = decoded.match(/(10\.\d{4,9}\/[^?#\s]+)/);
  if (m) return m[1].replace(/[.,;)]+$/, "").replace(/\/(full|abstract|pdf|epdf)$/i, "");
  const a = href.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/);
  if (a) return "10.48550/arXiv." + a[1];
  const n = href.match(/nature\.com\/articles\/([a-z0-9.-]+)/i); // Nature は記事番号＝DOI の後半
  return n ? "10.1038/" + n[1] : null;
}

// ---- マーク: 「手口」の小さなボタン。押すと詳細が開く。サイトの CSS に影響されないよう shadow DOM に閉じる ----

const MARK_CSS = `
  .b { all: initial; font: 12px/1 system-ui, sans-serif; cursor: pointer; background: #fffaf0; color: #5c4400; border: 1px solid #d9b45a;
       border-radius: 12px; padding: 4px 8px; box-shadow: 0 1px 3px #0002; }
  .b .k { font-weight: 700; margin-right: 4px; padding-right: 5px; border-right: 1px solid #e3c98a; }
  .b.quiet { background: #fff; border-color: #ccc; color: #888; font-size: 11px; }
  .pop { position: absolute; right: 0; top: 28px; width: 320px; max-height: 60vh; overflow: auto; background: #fff; color: #222;
         border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px #0003; padding: 8px 10px;
         font: 12px/1.5 system-ui, sans-serif; text-align: left; white-space: normal; }
  :host(.fixed) .pop { top: auto; bottom: 30px; }
  :host(.left) .pop { right: auto; left: 0; }
  .hit { color: #5c4400; font-weight: 700; font-size: 13px; margin-top: 6px; }
  .hit:first-child { margin-top: 0; }
  .why { color: #333; }
  .tip { color: #1f5130; background: #f1f8f3; border-radius: 6px; padding: 4px 6px; margin-top: 4px; }
  .more { margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px; }
  .more > summary { cursor: pointer; color: #555; font-size: 11px; }
  .note { color: #777; font-size: 11px; }
  .all { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #ddd; color: #777; font-size: 11px; }
  a { color: #0b57d0; word-break: break-all; }
  .act { all: initial; display: inline-block; margin-top: 6px; font: 12px/1.4 system-ui, sans-serif; color: #0b57d0; cursor: pointer;
         border: 1px solid #0b57d0; border-radius: 10px; padding: 2px 8px; }
  textarea { box-sizing: border-box; width: 100%; margin-top: 4px; font: 11px/1.4 system-ui, sans-serif; color: #222; background: #fafafa; }
  [hidden] { display: none; }
`;

// at: 1件の印の位置（既定は SITE.markAt）。引用の枠にはサイトのボタンが無いので、既定の右上の角に置く
function createMark(fixed, at = SITE?.markAt) {
  const host = document.createElement("jev-mark");
  host.style.cssText = fixed
    ? `all:initial;position:fixed;right:12px;bottom:12px;z-index:2147483646;${SITE?.cornerAt || ""}`
    : `all:initial;position:absolute;top:4px;right:4px;z-index:2147483646;${at || ""}`;
  if (fixed) host.classList.add("fixed");
  if (fixed && /left:\s*\d/.test(SITE?.cornerAt || "")) host.classList.add("left"); // 詳細を画面の外にはみ出させない
  const sh = host.attachShadow({ mode: "closed" }); // open だとページ側のプログラムが印を書き換えられる
  sh.innerHTML = `<style>${MARK_CSS}</style><button class="b"></button><div class="pop" hidden></div>`;
  const badge = sh.querySelector(".b");
  const pop = sh.querySelector(".pop");
  badge.onclick = () => {
    pop.hidden = !pop.hidden;
    host.style.zIndex = pop.hidden ? "2147483646" : "2147483647"; // 開いた詳細を、下の投稿の印より上に
  };
  // マークへの操作はページ側（投稿を包むリンクの移動など）に渡さない。ただし詳細の中の自分のリンク（出典・論文）は開く。
  // 外枠（host）で preventDefault すると、内側の <a> の移動まで打ち消された。closed の内側を見分けるため shadow root で受ける
  for (const t of ["click", "mousedown", "mouseup", "pointerdown", "pointerup"]) {
    sh.addEventListener(t, (e) => {
      e.stopPropagation();
      if (t !== "click" || e.target.closest?.("a[href]")) return;
      e.preventDefault(); // 投稿を包むリンクへの移動を止める
      // 止めると「詳しく」（details）の開閉も止まるので、ここで開け閉めする
      const sum = e.target.closest?.("summary");
      if (sum) sum.parentElement.open = !sum.parentElement.open;
    });
  }
  return { host, badge, pop };
}

// 印の文字: 「手口｜いちばん確率の高い手口の名前」。ほかにも当たっていれば「ほかN」。
// % は出さない（「95% うそ」と読まれる。2026-10-04 UI レビュー）。コードの項目は Jev の項目より後ろに回す
function badgeText(hits) {
  const top = [...hits].sort((a, b) => !!a.c.code - !!b.c.code || b.pct - a.pct)[0];
  return (top.badge || top.c.short) + (hits.length > 1 ? ` ほか${hits.length - 1}` : "");
}
function setBadge(badge, hits, prefix = "") {
  badge.textContent = prefix;
  badge.append(Object.assign(document.createElement("span"), { className: "k", textContent: JEV_MARK }), badgeText(hits));
  badge.setAttribute("aria-label", `注意: ${hits.map((r) => r.c.label || r.c.short).join("、")} の手口の可能性。押すと説明が出ます`);
}

function rowValue(r) {
  return r.c.code ? (r.hit ? "あり" : "なし") : `${r.pct.toFixed(0)}%`;
}

// 詳細の中身: 手口ごとに「名前 → 仕組み → 向き合い方」（出典のリンクがあれば添える）。
// 判定の中身（確率・閾値・問いの原文・全項目）と、直すための操作（AI に相談・違うと思う）は「詳しく」の中
function fillDetails(pop, rows, links, extra, text) {
  pop.textContent = "";
  const add = (cls, text, parent = pop) => {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    parent.append(d);
    return d;
  };
  const link = (href, text, parent = pop) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    add("note", "", parent).append(a);
  };
  const hits = rows.filter((r) => r.hit);
  if (!hits.length) add("note", "目立った手口は見つかりませんでした。手口が無いことは、内容が正しいという意味ではありません");
  for (const r of hits) {
    add("hit", r.c.label);
    if (r.c.why) add("why", r.c.why);
    if (r.detail) add("note", r.detail);
    if (r.c.showSources) {
      if (!links.length) add("note", "範囲内に一次ソースへのリンクは見当たりません");
      for (const href of links.slice(0, 3)) link(href, "出典: " + shortUrl(href));
    }
    if (r.c.tip) add("tip", "向き合い方: " + r.c.tip);
  }
  extra?.(add, link);
  const more = document.createElement("details");
  more.className = "more";
  more.append(Object.assign(document.createElement("summary"), { textContent: "詳しく（判定の中身・直し方）" }));
  pop.append(more);
  for (const r of hits) {
    if (r.c.code) continue;
    add("note", `${r.c.label}: 当てはまる確率 ${r.pct.toFixed(0)}%（${r.c.high}% 以上で印を付けます）`, more);
    add("note", jevQuestionNote(r.c.qs), more);
  }
  if (keyless) add("note", "API キーが無いので、コードで判定できる項目だけを見ています。キーを入れると Jev の判定も加わります", more);
  add("all", rows.map((r) => `${r.c.label} ${rowValue(r)}`).join(" ・ "), more);
  if (rows.some((r) => !r.c.code)) add("note", JEV_PCT_NOTE, more);
  addConsult(more, rows, text);
  addDisagree(more, rows, text);
}

// 「違うと思う」: この件を手元（このブラウザの中だけ）に残す。「問いを試す」画面で、AI の例文に加えて本人の実例で測れる。
// 印が付いた件は誤検知の、付かなかった件は取りこぼしの例として残す
function addDisagree(pop, rows, text) {
  if (!rows.some((r) => !r.c.code) || !text) return; // 測るのは Jev の問いだけ
  const hits = rows.filter((r) => r.hit); // コードの項目だけで印が付いた件も「付いた件」
  const btn = document.createElement("button");
  btn.className = "act";
  btn.textContent = hits.length ? "誤検知だと思う（記録する）" : "取りこぼしだと思う（記録する）";
  btn.onclick = async () => {
    // 取りこぼしは、どの項目が拾うべきだったかが分からないので、その時の値を全部残す（試す画面で選ぶ手がかり）
    const item = { kind: hits.length ? "fp" : "miss", text, checks: (hits.length ? hits : rows.filter((r) => !r.c.code)).map((r) => `${r.c.label} ${rowValue(r)}`), host: location.hostname };
    const res = await chrome.runtime.sendMessage({ type: "disagree", item }).catch(() => null);
    btn.textContent = res?.ok ? "記録しました（設定画面の「問いを試す」で例文に使えます）" : "記録できませんでした";
    btn.disabled = true;
  };
  pop.append(" ", btn);
}

// 「AI に相談」: 押すと、AI に貼る文をその場に出す（本文が入るので、何が渡るかをコピーの前に見せる）。
// 欄は読むだけ。ページの中で書かせると、描き直し（比較の結果・同じ文言の更新・設定の保存）で消え、
// X などのショートカットが打った文字を拾いうる（ページ側が capture で受けると shadow root では止められない）。考えは AI に貼ってから書く
function addConsult(pop, rows, text) {
  const items = rows.filter((r) => !r.c.code).map((r) => ({ label: r.c.label, qs: r.c.qs, high: r.c.high, pct: r.pct }));
  if (!items.length || !text) return;
  const btn = document.createElement("button");
  btn.className = "act";
  btn.textContent = "この判定を AI に相談する";
  pop.append(btn);
  btn.onclick = () => {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = "下の文をコピーして、ChatGPT などの AI に貼ってください。この文章の本文が入っています。貼ったあと【】の中に考えを書き足すと話が早くなります";
    const ta = document.createElement("textarea");
    ta.rows = 8;
    ta.readOnly = true;
    ta.value = jevConsultPrompt({ items, text, mode });
    const copy = document.createElement("button");
    copy.className = "act";
    copy.textContent = "コピー";
    copy.onclick = async () => {
      let ok = true;
      try {
        await navigator.clipboard.writeText(ta.value);
      } catch {
        ta.select();
        ok = document.execCommand("copy");
      }
      copy.textContent = ok ? "コピーしました" : "コピーできませんでした。欄の中を全選択してコピーしてください";
    };
    btn.replaceWith(note, ta, copy);
  };
}

// ---- ページ全体モード ----

let pageMark = null;
let pageUrl = "";
let pageTimer = null;
let pageView = null; // { rows, links, cmp, error, text }
let pageLastText = ""; // 前のページで判定した本文。SPA の切り替え直後は画面がまだ前のページのままのことがある

function startPage() {
  judgePage();
  // SPA でページが切り替わったら判定し直す
  clearInterval(pageTimer);
  pageTimer = setInterval(() => { if (location.href !== pageUrl) judgePage(); }, 1000);
}

function stopPage() {
  clearInterval(pageTimer);
  pageMark?.host.remove();
  pageMark = null;
  pageUrl = "";
  pageView = null;
  pageLastText = "";
}

// ページ全体モードの除外: 判定範囲の最初の投稿者（X・Bluesky の投稿ページなら、その投稿の主）で決める
function pageAuthorExcluded() {
  if (!excludedAuthors.size || !SITE?.author) return false;
  const who = authorOf(pageRoot());
  return !!who && excludedAuthors.has(who.toLowerCase());
}

// 本文の範囲: サイト別の設定 → h1 を含む article → main → body
function pageRoot() {
  return (
    (SITE?.page && document.querySelector(SITE.page)) ||
    document.querySelector("h1")?.closest("article") ||
    document.querySelector("article, main, [role=main]") ||
    document.body
  );
}

// 見出しと本文の冒頭
function pageText() {
  const h1 = document.querySelector("h1");
  const root = pageRoot();
  const head = (h1?.innerText || document.title || "").trim();
  // 15字未満の行（パンくず・「TOP」「COPIED!」などの切れ端）は落とす。ナゾロジーで要ソース確認が 0.58 → 0.64
  const body = (root.innerText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 15)
    .join("\n");
  return (head && !body.startsWith(head) ? head + "\n" : "") + body;
}

async function judgePage(retry = 0) {
  const url = location.href;
  pageUrl = url;
  pageView = null;
  pageMark?.host.remove();
  pageMark = null;
  if (isPrivatePage() || pageAuthorExcluded()) return;
  const text = pageText().slice(0, MAX_CHARS);
  const root = pageRoot();
  dbg("page", { root: root.tagName + (root.className ? "." + String(root.className).split(" ")[0] : ""), chars: text.length, head: text.slice(0, 40) });
  if (!text) return;
  // アドレスが変わったのに本文が前のページと同じなら、画面の書き換えがまだ。少し待って読み直す（前のページを判定してしまう）
  if (text === pageLastText && retry < 3) {
    setTimeout(() => { if (mode === "page" && location.href === url) judgePage(retry + 1); }, 1500);
    return;
  }
  pageLastText = text;
  const answers = await ask(text);
  if (pageUrl !== location.href || mode !== "page") return; // 判定中に移動・設定変更
  if (!answers) { // 失敗も見せる（何も出ないと、動いているのか分からない）
    pageView = { rows: [], links: [], cmp: null, error: stats.lastError };
    return renderPage();
  }
  // 出典は本文の範囲から探し、無ければページ全体から（参考文献欄が本文の外にあるサイトがある）
  let links = primaryLinks(pageRoot());
  if (!links.length) links = primaryLinks(document.body);
  pageView = { rows: score(answers, text), links, cmp: null, text };
  renderPage();
  comparePage(text, links);
}

// ページ全体は右下に1つだけ。当たれば「手口｜名前」、当たらなければ控えめな Jev 読んだ（押せば数値が見られる）
function renderPage() {
  if (!pageView) return;
  if (!pageMark) {
    pageMark = createMark(true);
    document.documentElement.append(pageMark.host);
  }
  const tag = (text) => (settings.debug ? `${modeName(mode)}｜${text}` : text);
  const debugLines = () => {
    if (!settings.debug) return;
    const d = document.createElement("div");
    d.className = "all";
    d.textContent = `― デバッグ ― 適用中のモード: ${modeName(mode)} / 判定項目: ${checks.map((c) => c.id).join(", ")}`;
    pageMark.pop.append(d);
  };
  if (pageView.error) {
    pageMark.badge.textContent = tag("Jev ⚠");
    pageMark.badge.removeAttribute("aria-label");
    pageMark.badge.classList.add("quiet");
    pageMark.pop.textContent = "";
    const d = document.createElement("div");
    d.className = "hit";
    d.textContent = "判定に失敗しました: " + pageView.error;
    pageMark.pop.append(d);
    debugLines();
    return;
  }
  const { rows, links, cmp } = pageView;
  // 元論文との比較で当たったものも、手口の1つとして並べる
  const hits = rows.filter((r) => r.hit).concat(cmp?.hit ? [{ c: { short: "元の研究を盛っている", label: JEV_COMPARE.label }, pct: cmp.pct }] : []);
  if (hits.length) setBadge(pageMark.badge, hits, settings.debug ? `${modeName(mode)}｜` : "");
  else {
    pageMark.badge.textContent = tag("Jev 読んだ");
    pageMark.badge.removeAttribute("aria-label"); // 前の当たりの読み上げを残さない
  }
  pageMark.badge.classList.toggle("quiet", !hits.length);
  fillDetails(pageMark.pop, rows, links, (add, link) => {
    if (!cmp) return;
    add("hit", cmp.message ? "元論文（要旨）との比較" : `元論文（要旨）との比較: 誇張・歪曲 ${cmp.pct.toFixed(0)}%${cmp.hit ? "（手口あり）" : ""}`);
    if (cmp.message) return add("note", cmp.message);
    add("why", `いちばん近い評価: ${cmp.level}（${(cmp.levelP * 100).toFixed(0)}%）` + (cmp.hit ? `。手口: ${JEV_COMPARE.label}` : ""));
    link(cmp.paper.url, `論文: ${cmp.paper.title}${cmp.paper.year ? `（${cmp.paper.year}）` : ""}`);
    add("note", "要旨だけとの比較です。要旨にない数字や、数字の細かいずれは確かめられません");
  }, pageView.text);
  debugLines();
}

// 一次ソース比較（オプション）: 最初に見つかった論文1本だけ。1ページにつき Jev 1回＋OpenAlex 1回
async function comparePage(text, links) {
  const opt = { ...JEV_COMPARE.defaults, ...settings.compare };
  const doi = links.map(doiOf).find(Boolean);
  if (!opt.on || !doi || keyless) return; // 比較は Jev が要る
  const url = pageUrl;
  let res;
  try {
    res = await chrome.runtime.sendMessage({ type: "compare", doi, text });
  } catch (e) {
    res = { error: String(e.message || e) };
  }
  if (url !== location.href || mode !== "page" || !pageView) return;
  if (res.error) pageView.cmp = { message: "比較できませんでした：" + res.error };
  else if (!res.paper) pageView.cmp = { message: "論文の要旨が取得できなかったので比較していません（" + doi + "）" };
  else pageView.cmp = { ...res, pct: res.distort * 100, hit: res.distort * 100 >= opt.high };
  renderPage();
}

// ---- ブロックごとモード ----

const state = new Map(); // Element -> { answers, pending, timer, mark }
const revealed = new WeakSet(); // クリックでぼかしを解いた要素
// 「読んでいる」候補: 6割以上見えている件（背の高い件は、画面の4割以上を占めている件）。
// 「画面の中ほど」で判定すると、ページ末尾の件が中ほどに入れず、いつまでも判定されなかった
const io = new IntersectionObserver(onView, { threshold: [0, 0.3, 0.6, 1] });
const inView = (e) => e.intersectionRatio >= 0.6 || e.intersectionRect.height >= innerHeight * 0.4;
let autoSel = null; // 自動検出で一度見つけた区切りの形。以後はこの形だけで探す（全体の走査を繰り返さない）
let autoHref = "";
let autoMissAt = 0; // 自動検出で見つからなかった時刻。10 秒は探し直さない（毎回ページ全体を走査して重かった）
let pollTimer = null;

// ---- スクロール優先: 区切りを探す・マークを描く・隅の表示を直す、はスクロールが止まってから ----
// 以前はページの変化を常に監視していたが、X は時刻・動画・いいね数で絶えず書き換わり、休みなく動いて重かった
// （2026-09-29 ユーザー「重く感じる」）。新しい投稿はスクロールで現れるので、止まったときに探せば足りる
const IDLE_MS = 300;
let lastScroll = 0;
let idleTimer = null;
const idleJobs = new Set();

function whenIdle(fn) {
  idleJobs.delete(fn); // 入れ直して最後に回す。隅の件数（updateCounter）が、後から積んだ印の描画より先に走ると古いまま残った
  idleJobs.add(fn);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(runIdle, Math.max(0, IDLE_MS - (Date.now() - lastScroll)));
}

function runIdle() {
  if (Date.now() - lastScroll < IDLE_MS) return whenIdle(() => {}); // まだ動いている: 待ち直す
  const jobs = [...idleJobs];
  idleJobs.clear();
  const run = () => jobs.forEach((f) => f());
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 500 }) : run();
}

addEventListener(
  "scroll",
  () => {
    lastScroll = Date.now();
    if (mode === "block") whenIdle(scan);
  },
  { capture: true, passive: true },
);

function dwellMs() {
  const s = Number(settings.dwell);
  return Math.round((s >= 0.5 && s <= 5 ? s : 1.5) * 1000);
}

function startBlock() {
  scan();
  updateCounter();
  clearInterval(pollTimer);
  // スクロールせずに増える件（読み込みの遅い一覧など）のために、3 秒に1回だけ軽く見る
  pollTimer = setInterval(() => { if (!document.hidden) whenIdle(scan); }, 3000);
}

function stopBlock() {
  counter?.host.remove();
  counter = null;
  clearInterval(pollTimer);
  idleJobs.clear();
  io.disconnect();
  for (const [el, st] of state) {
    clearTimeout(st.timer);
    clearMarks(el);
  }
  state.clear();
  autoSel = null;
  corpus.length = 0;
  groups.clear();
}

// ---- 同じ文言の大量投稿: 画面に流れてきた投稿を覚え、ほぼ同じ文を投稿したアカウントを数える ----
// 覚えるのは本文の3文字の切れ端と投稿者だけ（手元のみ、外には送らない）。直近 JEV_DUP.keep 件まで。
// Jev と違って費用がかからないので、流し読みした投稿も見つけた時点で数える
const corpus = []; // { author, sh, group, el }
const groups = new Map(); // グループ番号 -> { authors: Set, els: Set }
const dupEntry = new WeakMap(); // 要素 -> corpus の項目
let groupSeq = 0;

function authorOf(el) {
  const a = SITE?.author && el.querySelector(SITE.author);
  if (!a) return null;
  const parts = new URL(a.href, location.href).pathname.split("/").filter(Boolean);
  return (parts[0] === "profile" ? parts[1] : parts[0]) || null;
}

// 新しく見つけた投稿を覚える。同じ文言のグループに入ったらその番号を返す
function remember(el) {
  if (!checks.some((c) => c.code === "dup")) return null;
  const author = authorOf(el);
  if (!author) return null;
  const parts = SITE?.text ? ownParts(el).map((e) => e.textContent) : [el.textContent];
  const norm = JEV_DUP.normalize(parts.join(" "));
  if (norm.length < JEV_DUP.minChars) return null;
  const sh = JEV_DUP.shingles(norm);
  let gid = null;
  for (const e of corpus) {
    if (JEV_DUP.similarity(sh, e.sh) < JEV_DUP.similar) continue;
    if (gid === null) gid = e.group;
    else if (e.group !== gid) mergeGroups(e.group, gid); // 2つのグループの橋渡しになった
  }
  if (gid === null) groups.set((gid = ++groupSeq), { authors: new Set(), els: new Set() });
  const entry = { author, sh, group: gid, el };
  corpus.push(entry);
  dupEntry.set(el, entry);
  const g = groups.get(gid);
  g.authors.add(author);
  g.els.add(el);
  if (corpus.length > JEV_DUP.keep) {
    const old = corpus.shift();
    groups.get(old.group)?.els.delete(old.el); // 数えたアカウントは残す（画面から流れても事実は変わらない）
  }
  return gid;
}

function mergeGroups(from, to) {
  const a = groups.get(from);
  const b = groups.get(to);
  if (!a || !b) return;
  for (const e of corpus) if (e.group === from) e.group = to;
  a.authors.forEach((x) => b.authors.add(x));
  a.els.forEach((x) => b.els.add(x));
  groups.delete(from);
}

function dupOf(el) {
  const e = el && dupEntry.get(el);
  const g = e && groups.get(e.group);
  const authors = g ? [...g.authors] : [];
  return { hit: authors.length >= JEV_DUP.minAuthors, authors };
}

// 右下の小さな表示。普段は出さない（動作確認はポップアップの「読んだ投稿 N 件」で見られる）。
// 手口が見つかったとき・失敗しているとき・デバッグ中だけ出し、条件が外れたら取り除く
let counter = null;
function updateCounter() {
  if (mode !== "block") return;
  const failing = stats.errors && !stats.judged;
  if (!stats.warned && !stats.errors && !settings.debug) { // 一部だけ失敗した場合も、隅に出して詳細で失敗の内容を見せる
    counter?.host.remove();
    counter = null;
    return;
  }
  if (!counter) {
    counter = createMark(true);
    document.documentElement.append(counter.host);
  }
  const label = failing ? "Jev ⚠" : stats.warned ? `${JEV_MARK} ${stats.warned}` : `Jev 読んだ ${stats.judged}`;
  counter.badge.textContent = settings.debug ? `${modeName(mode)}｜${label}` : label;
  counter.badge.classList.toggle("quiet", !stats.warned && !failing);
  counter.pop.textContent = "";
  const add = (text, cls) => {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    counter.pop.append(d);
  };
  add(`手口が見つかった投稿は ${stats.warned} 件です（Jev で読んだ投稿 ${stats.judged} 件）。`);
  add("「手口」の印は、手口が見つかった投稿の右上に付きます。誘導の決まり文句は投稿が現れた時点で、Jev の項目は画面に少しとどまった投稿だけを判定しています。", "note");
  if (keyless) add("API キーが無いので、コードで判定できる項目（誘導の決まり文句・同じ文言の大量投稿）だけを見ています。キーを入れると Jev の判定も加わります。", "note");
  if (stats.excluded) add(`除外リストのアカウントの投稿 ${stats.excluded} 件は判定していません。`, "note");
  if (stats.errors) add(`判定の失敗 ${stats.errors} 件: ${stats.lastError}`, "hit");
  if (settings.debug) {
    const waiting = [...state.values()].filter((s) => s.timer && !s.answers).length;
    add("― デバッグ ―", "all");
    add(`適用中のモード: ${modeName(mode)} / 判定項目: ${checks.map((c) => c.id).join(", ")}`, "note");
    add(`区切り: ${itemsFrom || "（未検出）"}`, "note");
    add(`見つけた件: ${state.size} / 判定待ち: ${waiting} / 判定済み: ${stats.judged} / 失敗: ${stats.errors}`, "note");
  }
}

function scan() {
  // 画面外の件を消して作り直すサイト（X など）では、消えた件の記録が溜まるので外す
  for (const [el, st] of state) {
    if (el.isConnected) continue;
    clearTimeout(st.timer);
    io.unobserve(el);
    state.delete(el);
  }
  const touched = new Set(); // 同じ文言のグループに新しく加わった分
  // DM・メールなどの画面では、手元だけで済むコードの判定（決まり文句・同じ文言）もしない（judgeBlock と同じ扱い）
  const priv = isPrivatePage();
  const track = (el, quote) => {
    const st = state.get(el);
    if (st) {
      if (st.mark && !st.mark.host.isConnected) el.append(st.mark.host); // サイト側の描き直しで消えたマークを戻す
      return;
    }
    if (!quote && isMainArticle(el)) return;
    // 除外リストのアカウントは判定しない（送らない・数えない・同じ文言にも入れない）
    const who = excludedAuthors.size ? authorOf(el) : null;
    if (who && excludedAuthors.has(who.toLowerCase())) {
      state.set(el, { excluded: true, answers: null, pending: false, timer: null, mark: null });
      excludedSeen.add(who.toLowerCase() + "\n" + el.textContent.slice(0, 200));
      stats.excluded = excludedSeen.size;
      return;
    }
    const fresh = { answers: null, pending: false, timer: null, mark: null, quote };
    state.set(el, fresh);
    if (settings.debug) el.classList.add("jev-debug");
    if (!priv) {
      // 引用元は同じ文言に数えない（同じ投稿を引用した3人が「同じ文の3アカウント」に見える）
      const gid = quote ? null : remember(el);
      if (gid !== null) touched.add(gid);
      codeFirst(el, fresh);
    }
    io.observe(el);
  };
  for (const el of currentItems()) {
    track(el, false);
    for (const q of quotesIn(el)) track(q, true);
  }
  // 3アカウント目がそろったら、それまでの投稿にもさかのぼって印を付ける（まだ Jev の判定が無くても出す）
  for (const gid of touched) {
    const g = groups.get(gid);
    if (!g || g.authors.size < JEV_DUP.minAuthors) continue;
    for (const el of g.els) if (el.isConnected && state.has(el)) apply(el);
    updateCounter();
  }
  if (settings.debug) updateCounter();
}

// コードで判定する項目（誘導の決まり文句）は費用がかからないので、見つけた時点で判定し、当たれば印をすぐ付ける。
// Jev の判定（見えてから待ち時間＋問い合わせ）を待つと、印が出るのは読み終わった後になる。手口は読む前に知らせたい。
// Jev の結果が返ったら apply で描き直し、両方の当たりをまとめて出す。前に判定した本文なら、保存済みの結果もすぐ出す（peek）
function codeFirst(el, st) {
  const text = blockText(el);
  if (!text) return; // まだ本文が描かれていない件は、Jev の判定のときに見る
  peek(el, st, text);
  if (!checks.some((c) => c.code && c.code !== "dup")) return;
  st.text = text;
  if (!score(null, text, el).some((r) => r.hit)) return;
  apply(el);
  whenIdle(updateCounter);
}

// 前に判定した本文は、保存済みの結果で印をすぐ戻す（問い合わせはしない。保存に無ければ何もしない）。
// X は画面外の投稿を作り直すので、スクロールで戻るたびに待ち時間からやり直しになっていた。別の人が同じ文を投稿した場合も同じ
async function peek(el, st, text) {
  const questions = [...new Set(checks.flatMap((c) => c.qs))];
  if (keyless || !questions.length || isPrivatePage()) return;
  const r = await chrome.runtime.sendMessage({ type: "peek", text, questions }).catch(() => null);
  if (!r?.answers || state.get(el) !== st || st.answers) return;
  clearTimeout(st.timer);
  st.timer = null;
  st.answers = r.answers;
  st.text = text;
  io.unobserve(el);
  whenIdle(() => {
    if (state.get(el) !== st) return;
    apply(el);
    updateCounter();
  });
}

// 見えている状態が待ち時間（既定 1.5 秒、高度な設定）続いたら判定。その前に外れたら取りやめ（流し読み）
function onView(entries) {
  for (const e of entries) {
    const st = state.get(e.target);
    if (!st || st.answers || st.excluded) continue;
    const seen = inView(e);
    if (seen && st.timer) continue; // 見えたまま比率だけ変わった: 待ちを続ける
    clearTimeout(st.timer);
    st.timer = seen ? setTimeout(() => judgeBlock(e.target), dwellMs()) : null;
  }
}

// 記事ページの本文そのものは判定しない（見出しが煽り気味だと、読みに来た本文ごと判定される。jprime で確認）
function isMainArticle(el) {
  return !!el.querySelector("h1") || el.textContent.length > 6000;
}

// サイトの区切り: 利用者が足したもの（picker.js・設定画面）> sites.js の組み込み > 自動検出。
// 0件になったら（サイトの改版など）次の候補に落ちる
function currentItems() {
  for (const sel of SITE_ITEMS) {
    const got = selectAll(sel);
    itemsFrom = `サイト設定 ${sel}`;
    if (got.length) return got;
  }
  if (autoHref !== location.href) {
    autoSel = null; // SPA でページの種類が変わったら探し直す
    autoMissAt = 0;
  }
  autoHref = location.href;
  if (autoSel) {
    const got = selectAll(autoSel);
    itemsFrom = `自動検出（覚えた形）${autoSel}`;
    if (got.length) return got;
  }
  if (Date.now() - autoMissAt < 10000) return [];
  const items = autoItems();
  if (items.length < 3) autoMissAt = Date.now();
  else if (typeof buildSelector === "function") autoSel = buildSelector(items); // picker.js
  itemsFrom = `自動検出（全体を走査）${autoSel || ""}`;
  dbg("autoItems", items.length, autoSel);
  return items;
}

// 1件の中で Jev に渡す文字。サイト別の設定に本文の場所があればそこだけ。
// 無ければ全文から、数字だけの行（いいね数・再生数）と2文字以下の行（「返信」などの部品）を落とす
function blockText(el) {
  // 画面に出ていない要素は除く（Yahoo!コメントの「このコメントを削除しますか？」のような隠れた確認文）
  const parts = SITE?.text ? ownParts(el).filter(isShown).map((e) => e.innerText.trim()).filter(Boolean) : [];
  if (SITE?.text && !parts.length && !SITE.textFallback) return ""; // 画像だけの投稿など: ユーザー名や日時だけで判定しない
  const text = parts.length
    ? [...new Set(parts)].join("\n")
    : (el.innerText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 2 && !/^[\d,.\s万千億KkMm件回人+:：/()（）-]+$/.test(l))
        .join("\n");
  return text.slice(0, MAX_CHARS);
}

// 1件の中の本文の場所のうち、引用として埋め込まれたほかの投稿（sites.js の quote）の中にあるものを除く。
// 引用元だけで本文の無い投稿は、空になって判定しない（書いたのは引用元の人）。el が引用の枠そのものなら、その中の本文を使う
function ownParts(el) {
  const parts = [...el.querySelectorAll(SITE.text)];
  if (!SITE.quote) return parts;
  return parts.filter((p) => {
    const q = p.closest(SITE.quote);
    return !q || q === el || !el.contains(q);
  });
}

// 1件の中に埋め込まれた引用元の投稿（本文のあるもの）。引用した人の判定からは外すので、引用元として別に判定する。
// 外したままだと、ヘイトやデマを一言添えて引用するだけで、タイムラインのどこにも印が付かない
function quotesIn(el) {
  if (!SITE?.quote || !SITE.text) return [];
  return [...el.querySelectorAll(SITE.quote)].filter((q) => q.querySelector(SITE.text));
}

function selectAll(sel) {
  try { return outermost([...document.querySelectorAll(sel)]); } catch { return []; } // 不正なセレクタは0件扱い
}

// 「1件分」を推測する。まず意味の付いたタグ、無ければ「同じタグの兄弟が3つ以上並ぶ」ところのうち、
// 文章量が一番多い並び（と、同じ形の親の下にある並び）を採る。
// クラス名で揃えないのは、Amazon のように広告と通常で1件ごとにクラスが違うサイトがあるため。
// ページ全体を走査して重いので、currentItems が結果をセレクタにして覚え、繰り返し呼ばない。
function autoItems() {
  const semantic = outermost([...document.querySelectorAll('article, [role="article"]')].filter(isShown));
  if (semantic.length >= 3) return semantic;
  const cands = [];
  for (const parent of [document.body, ...document.body.querySelectorAll("*")]) {
    if (parent.children.length < 3) continue;
    const byTag = new Map();
    for (const c of parent.children) {
      if (SKIP_TAGS.has(c.tagName)) continue;
      if (!byTag.has(c.tagName)) byTag.set(c.tagName, []);
      byTag.get(c.tagName).push(c);
    }
    for (const g of byTag.values()) {
      if (g.length < 3) continue;
      const shown = g.filter(isShown);
      if (shown.length < 3) continue;
      const lens = shown.map((e) => e.textContent.trim().length).sort((a, b) => a - b);
      const median = lens[lens.length >> 1];
      if (median < 20 || median > 5000) continue; // 短すぎる=メニュー、長すぎる=ページの骨組み
      cands.push({ parent, els: shown, score: shown.length * Math.min(median, 400) });
    }
  }
  if (!cands.length) return [];
  const best = cands.reduce((a, b) => (b.score > a.score ? b : a));
  const shape = (p) => p.tagName + "." + p.className;
  return outermost(cands.filter((c) => c === best || shape(c.parent) === shape(best.parent)).flatMap((c) => c.els));
}

function isShown(e) {
  return e.getClientRects().length > 0;
}

function outermost(els) {
  const set = new Set(els);
  return els.filter((e) => {
    for (let p = e.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
    return true;
  });
}

async function judgeBlock(el) {
  const st = state.get(el);
  if (!st || st.pending || st.answers || isPrivatePage()) return;
  const text = blockText(el);
  if (!text) return;
  st.pending = true;
  const answers = await ask(text);
  st.pending = false;
  if (state.get(el) === st && answers) {
    st.answers = answers;
    st.text = text; // コードの項目は本文から判定する
    io.unobserve(el);
    whenIdle(() => state.get(el) === st && apply(el)); // スクロール中に返ってきた結果は、止まってから描く
  }
  whenIdle(updateCounter); // 失敗も数える
}

// 当たった件にだけ「手口」の印を重ねる（「判定した全件にマーク」がオンなら、当たらない件にも控えめな「読んだ」。✓ は「安全」と読まれるので使わない）
function apply(el) {
  clearMarks(el);
  const st = state.get(el);
  const rows = score(st.answers, st.text, el);
  const hits = rows.filter((r) => r.hit);
  if (hits.length) {
    warnedSeen.add((st.quote ? "引用\n" : "") + (st.text ?? blockText(el)));
    stats.warned = warnedSeen.size;
  }
  if (hits.some((r) => r.c.action === "blur") && !revealed.has(el)) el.classList.add("jev-blur");
  if (settings.debug) el.classList.add("jev-debug", ...(st.answers ? ["jev-debug-done"] : [])); // clearMarks で外れた分も付け直す。Jev の判定前（コードの項目だけ）は判定済みにしない
  if (!hits.length && !settings.debug) return;
  if (getComputedStyle(el).position === "static") el.classList.add("jev-anchor"); // マークを右上に置く基準
  st.mark = createMark(false, st.quote ? "" : SITE?.markAt);
  if (hits.length) setBadge(st.mark.badge, hits, st.quote ? "引用元 " : "");
  else st.mark.badge.textContent = "読んだ";
  st.mark.badge.classList.toggle("quiet", !hits.length);
  fillDetails(st.mark.pop, rows, hits.some((r) => r.c.showSources) ? primaryLinks(el) : [], (add) => {
    if (st.quote) add("note", "引用された投稿の手口です。引用した人の文章の判定ではありません");
    if (el.classList.contains("jev-blur")) add("note", "本文はぼかしています。本文を押すと表示します");
  }, st.text);
  el.append(st.mark.host);
}

function clearMarks(el) {
  el.classList.remove("jev-blur", "jev-anchor", "jev-debug", "jev-debug-done");
  const st = state.get(el);
  st?.mark?.host.remove();
  if (st) st.mark = null;
}

// ぼかしはクリック1回で解く。そのクリックはリンク移動などに使わせない（マークへのクリックは除く）
addEventListener(
  "click",
  (e) => {
    const el = e.target.closest?.(".jev-blur");
    if (!el || e.target.closest?.("jev-mark")) return;
    e.preventDefault();
    e.stopPropagation();
    revealed.add(el);
    apply(el);
  },
  true,
);

// キーや接続先の変更は、設定画面が local と同時に sync も保存するので、sync の通知で読み直せる
// （local はページ側から読めないようにしてある。background.js）
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") load();
});

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg.type !== "stats") return;
  const pageHits = pageView ? pageView.rows.filter((r) => r.hit).length : 0;
  send({ host: location.hostname, mode, checks: checks.map((c) => c.label), blocks: state.size, pageHits, ...stats });
});

load();
