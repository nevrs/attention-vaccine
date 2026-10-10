// 判定の問い合わせを一手に引き受ける。並列数の制限・429 の再試行・結果のキャッシュをここに置く。
// 接続先は利用者が設定画面で選ぶ。
importScripts("techniques.js", "checks.js"); // JEV_COMPARE・JEV_PRESETS・JEV_CONTENT

// 判定する部分（バックエンド）。どれも ask(acc, 文章, [問いの原文]) で { 問いの原文: 当てはまる確率 0〜1 } を返す。
// キャッシュ・並列制限・1日の上限・ページ側・問いを試す画面は、この形だけに頼っている。
// 今は Jev の API（TypeSafe と Vercel、同じ形）だけ。手元で動く判定（将来のブラウザ内蔵など）を足すときは、同じ形の項目を足し、
// 設定画面の接続先の選択肢に加える。needsKey: キーが要るか。compare: 一次ソース比較（Jev の score 型の問い）に使えるか
const BACKENDS = {
  // バージョン固定。latest は閾値の前提を無言で変える（Jev は問いの文面と版で確率の出方が変わる）
  typesafe: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-1.13.0", needsKey: true, compare: true, ask: askJevApi },
  // Vercel 側のモデル名は docs の表記どおり。版の固定方法は未確認
  vercel: { url: "https://ai-gateway.vercel.sh/typesafe/v1/systemone", model: "typesafe-ai/jev", needsKey: true, compare: true, ask: askJevApi },
};
const MAX_PARALLEL = 6;

// API キーは local にある。ページ側（content script）からは読めないようにする
chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});

let running = 0;
const waiting = [];
const inflight = new Map();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // 入れた直後は、キーなしで何をする道具かが分かる体験ページを開く（そこから設定画面へ案内する）
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
  // 0.2 までの「このサイトでフィルタする」（sites）は、今の「ブロックごと」と同じ動き
  const { sites, siteModes = {} } = await chrome.storage.sync.get(["sites", "siteModes"]);
  if (sites) {
    for (const h of sites) siteModes[h] ??= "block";
    await chrome.storage.sync.set({ siteModes });
    await chrome.storage.sync.remove(["sites", "showScores"]);
  }
  // 0.5 までクリックで保存した区切り（siteSelectors: {ホスト: セレクタ}）は、userSites の item に移す
  const { siteSelectors, userSites = [] } = await chrome.storage.sync.get(["siteSelectors", "userSites"]);
  if (siteSelectors) {
    for (const [h, item] of Object.entries(siteSelectors)) {
      const e = userSites.find((s) => (s.hosts || []).includes(h));
      if (e) e.item ??= item;
      else userSites.push({ hosts: [h], item });
    }
    await chrome.storage.sync.set({ userSites });
    await chrome.storage.sync.remove("siteSelectors");
  }
  // おすすめの問いを変えたとき、旧い文のまま足してある項目を今の文に入れ替える。閾値は旧の初期値のままなら今の初期値に
  const { rules } = await chrome.storage.sync.get("rules");
  let changed = false;
  for (const r of rules || []) {
    for (const p of JEV_PRESETS) {
      const o = p.old?.find((o) => o.condition === r.condition);
      if (!o) continue;
      r.condition = p.condition;
      if (r.high === o.high) r.high = p.high;
      changed = true;
    }
  }
  // 0.22 までは、設定を保存すると全手口の on / high / action を丸ごと保存していた。初期値と同じ項目を消し、今後の初期値の変更が届くようにする。
  // 当時の初期値（今と違うもの）は、利用者が選んだ値と見分けられないので残す
  const { pillars } = await chrome.storage.sync.get("pillars");
  if (pillars) {
    const slim = {};
    for (const [id, c] of Object.entries(pillars)) {
      if (!JEV_PILLARS[id]) continue; // 消えた手口
      const o = jevPillarOverrides(id, c);
      if (Object.keys(o).length) slim[id] = o;
    }
    if (JSON.stringify(slim) !== JSON.stringify(pillars)) await chrome.storage.sync.set({ pillars: slim }).catch(() => {});
  }
  // rules が変われば開いているページは storage.onChanged で読み直す。容量超えで失敗したら旧い文のまま（次の更新で再試行）
  if (changed) await chrome.storage.sync.set({ rules }).catch(() => {});
  await syncContentScripts();
});

// ページ側のスクリプトは、利用者が許可したサイトにだけ入れる。許可はポップアップ・設定画面でサイトをオンにしたときに
// Chrome の確認で求める。許可が増減したら登録し直す（登録は Chrome を閉じても残る）
let syncing = Promise.resolve();
function syncContentScripts() {
  // 続けて呼ばれても順に（同時だと両方が「未登録」と見て register し、ID の重複で失敗する）
  return (syncing = syncing.then(syncOnce, syncOnce));
}
async function syncOnce() {
  const api = chrome.runtime.getManifest().host_permissions; // 接続先の許可は除く
  const { origins = [] } = await chrome.permissions.getAll();
  const matches = origins.filter((o) => !api.includes(o));
  const had = (await chrome.scripting.getRegisteredContentScripts({ ids: [JEV_CONTENT.id] })).length > 0;
  if (!matches.length) return had && chrome.scripting.unregisterContentScripts({ ids: [JEV_CONTENT.id] });
  const script = { ...JEV_CONTENT, matches };
  await (had ? chrome.scripting.updateContentScripts([script]) : chrome.scripting.registerContentScripts([script]));
}

// 許可した直後は、そのサイトの開いているタブにも入れる（読み込み直さなくても動くように）。既に入っているタブには入れない
async function injectInto(origins) {
  const tabs = await chrome.tabs.query({ url: origins }).catch(() => []);
  for (const t of tabs) {
    if (await chrome.tabs.sendMessage(t.id, { type: "stats" }).catch(() => null)) continue;
    await chrome.scripting.insertCSS({ target: { tabId: t.id }, files: JEV_CONTENT.css }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: JEV_CONTENT.js }).catch(() => {});
  }
}

chrome.permissions.onAdded.addListener(async ({ origins = [] }) => {
  await syncContentScripts().catch(() => {}); // 登録に失敗しても、開いているタブには入れる
  await injectInto(origins);
});
chrome.permissions.onRemoved.addListener(() => syncContentScripts());

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  const job =
    msg.type === "judge" ? judge(msg.text, msg.questions).then((answers) => ({ answers })) :
    msg.type === "peek" ? judge(msg.text, msg.questions, true).then((answers) => ({ answers })) : // 保存済みの結果だけ。無ければ null
    msg.type === "test" ? testConnection(msg.provider, msg.apiKey) :
    msg.type === "compare" ? compareWithPaper(msg.doi, msg.text) :
    msg.type === "hasKey" ? account().then((a) => ({ has: !a.needsKey || !!a.apiKey })) : // ページ側にはキーそのものを渡さない
    msg.type === "disagree" ? addDisagree(msg.item) : // ページ側は storage.local を読めないので、ここで書く
    null;
  if (!job) return;
  job.then(send, (e) => send({ error: String(e.message || e) }));
  return true; // 非同期で返す
});

// 「違うと思う」の記録。ページから来た値なので、形と長さを決めてから残す。同じ本文は新しいほうだけ。
// 読んで書き戻すので、続けて押されても上書きで消えないよう順に
let disagreeQueue = Promise.resolve();
function addDisagree(item) {
  const run = () => addDisagreeOnce(item);
  return (disagreeQueue = disagreeQueue.then(run, run));
}
async function addDisagreeOnce(item) {
  const text = String(item?.text || "").slice(0, JEV_CONSULT_MAX);
  if (!text) throw new Error("本文がありません");
  const { disagree = [] } = await chrome.storage.local.get("disagree");
  const list = disagree.filter((d) => d.text !== text);
  list.unshift({
    kind: item.kind === "miss" ? "miss" : "fp",
    text,
    checks: (Array.isArray(item.checks) ? item.checks : []).map(String).slice(0, 10),
    host: String(item.host || "").slice(0, 100),
    at: Date.now(),
  });
  await chrome.storage.local.set({ disagree: list.slice(0, JEV_DISAGREE_MAX) });
  return { ok: true };
}

async function account() {
  const { provider = "typesafe", apiKeys = {} } = await chrome.storage.local.get(["provider", "apiKeys"]);
  const id = BACKENDS[provider] ? provider : "typesafe";
  return { ...BACKENDS[id], id, apiKey: apiKeys[id] || "" };
}

// 1件の本文に複数の問いを投げる。キャッシュは問いごと。足りない問いだけを1回の呼び出しにまとめる
// （Jev は1回で複数の問いに答え、時間も1問のときと変わらない）。返り値は { 問い: 確率 }。
// peek なら呼び出さず、全部の問いが保存済みのときだけ返す（足りなければ null）
async function judge(text, questions, peek = false) {
  const acc = await account();
  if (acc.needsKey && !acc.apiKey) throw new Error("API キーが未設定");
  const keys = {};
  for (const q of questions) keys[q] = "c:" + (await sha256(acc.id + "\n" + acc.model + "\n" + q + "\n" + text));
  const hits = await chrome.storage.session.get(Object.values(keys));
  const out = {};
  const missing = [];
  for (const q of questions) (hits[keys[q]] !== undefined ? (out[q] = hits[keys[q]]) : missing.push(q));
  if (!missing.length) return out;
  if (peek) return null;
  const flightKey = missing.map((q) => keys[q]).join("|"); // 問いの組が同じときだけ相乗りする
  if (!inflight.has(flightKey)) {
    const pr = queued(() => acc.ask(acc, text, missing))
      .then(async (ps) => {
        // 保存に失敗しても（容量など）、取れた答えは捨てない
        await chrome.storage.session.set(Object.fromEntries(missing.map((q) => [keys[q], ps[q]]))).catch(() => {});
        return ps;
      })
      .finally(() => inflight.delete(flightKey));
    inflight.set(flightKey, pr);
  }
  return { ...out, ...(await inflight.get(flightKey)) };
}

// 一次ソース比較: DOI から論文の要旨を取り（OpenAlex、無料・キー不要）、記事と並べて Jev に1回聞く。
// 要旨が取れなければ paper: null を返す（比較しない）
async function compareWithPaper(doi, text) {
  const acc = await account();
  if (acc.needsKey && !acc.apiKey) throw new Error("API キーが未設定");
  if (!acc.compare) throw new Error("この接続先では一次ソース比較を使えません");
  const paper = await fetchPaper(doi);
  if (!paper) return { paper: null };
  const key = "cmp:" + (await sha256(acc.id + "\n" + acc.model + "\n" + doi + "\n" + text));
  const hit = (await chrome.storage.session.get(key))[key];
  if (hit) return { paper, ...hit };
  const answers = await queued(() =>
    post(acc, {
      state: `【元論文の要旨】\n${paper.abstract.slice(0, 3000)}\n\n【記事】\n${text}`,
      model: acc.model,
      questions: {
        distort: { type: "noul", instructions: JEV_COMPARE.distort },
        level: { type: "score", instructions: JEV_COMPARE.level, criteria: JEV_COMPARE.levels },
      },
    }),
  );
  const probs = answers.level?.probabilities || {};
  const top = Object.keys(probs).reduce((a, b) => (probs[b] > probs[a] ? b : a), "0");
  const result = { distort: answers.distort?.noul, level: JEV_COMPARE.levels[Number(top)], levelP: probs[top] };
  if (typeof result.distort !== "number") throw new Error("想定外の返り値");
  await chrome.storage.session.set({ [key]: result });
  return { paper, ...result };
}

// OpenAlex は要旨を「単語 → 出現位置」の形で持っているので、並べ直して文章に戻す
// DOI はページのリンク由来で信用できないので、形を確かめ、パスの区切りごとにエスケープしてから URL に入れる
const DOI_SHAPE = /^10\.\d{4,9}\/\S{1,200}$/;
function safeDoiPath(doi) {
  if (typeof doi !== "string" || !DOI_SHAPE.test(doi)) return null;
  const segs = doi.split("/");
  if (segs.some((x) => x === "." || x === "..")) return null; // ../ で別のパスに出ない
  return segs.map(encodeURIComponent).join("/");
}

async function fetchPaper(doi) {
  const path = safeDoiPath(doi);
  if (!path) return null;
  const key = "paper:" + doi;
  const hit = (await chrome.storage.session.get(key))[key];
  if (hit !== undefined) return hit;
  let paper = null;
  const r = await fetch("https://api.openalex.org/works/doi:" + path);
  if (r.ok) {
    const w = await r.json();
    const words = [];
    for (const [word, positions] of Object.entries(w.abstract_inverted_index || {})) for (const p of positions) words[p] = word;
    const abstract = words.filter(Boolean).join(" ");
    if (abstract.length >= 200) paper = { title: w.title || "", year: w.publication_year || "", url: "https://doi.org/" + path, abstract };
  }
  await chrome.storage.session.set({ [key]: paper });
  return paper;
}

// 保存前のキーで1回だけ呼ぶ。キャッシュも並列制限も1日の上限も通さない
async function testConnection(provider, apiKey) {
  const p = BACKENDS[provider];
  if (!p) throw new Error("接続先が不明");
  if (p.needsKey && !apiKey) throw new Error("API キーが空です");
  const t0 = performance.now();
  const q = "食べ物の話か";
  const ps = await p.ask({ ...p, id: provider, apiKey, uncounted: true }, "今日の夕飯は鶏むね肉の南蛮漬けにした", [q]);
  return { p: ps[q], ms: Math.round(performance.now() - t0) };
}

function queued(fn) {
  return new Promise((resolve, reject) => {
    waiting.push({ fn, resolve, reject });
    pump();
  });
}

function pump() {
  while (running < MAX_PARALLEL && waiting.length) {
    const { fn, resolve, reject } = waiting.shift();
    running++;
    fn().then(resolve, reject).finally(() => {
      running--;
      pump();
    });
  }
}

const HTTP_REASON = {
  401: "API キーが正しくありません",
  402: "残高・支払い設定を確認してください",
  403: "このキーでは使えません（権限・順番待ち）",
  404: "接続先が見つかりません",
};

// Jev の API（TypeSafe と Vercel）。noul の問いを q0, q1 … の名前で1回にまとめて投げ、{ 問い: 確率 } で返す
async function askJevApi(acc, text, questions) {
  const answers = await post(acc, {
    state: text,
    model: acc.model,
    questions: Object.fromEntries(questions.map((q, i) => ["q" + i, { type: "noul", instructions: q }])),
  });
  const out = {};
  questions.forEach((q, i) => {
    const p = answers["q" + i]?.noul;
    if (typeof p !== "number") throw new Error("想定外の返り値");
    out[q] = p;
  });
  return out;
}

// 呼び出しを1回数える。上限を超えたら呼ばない。並列の呼び出しで数え漏れないよう、1つずつ順に処理する
let spendChain = Promise.resolve();
function spend() {
  const p = spendChain.then(async () => {
    const day = new Date().toLocaleDateString("sv");
    const { dailyCap = JEV_DAILY_CAP } = await chrome.storage.sync.get("dailyCap");
    const { usage } = await chrome.storage.local.get("usage");
    const n = usage?.day === day ? usage.n : 0;
    if (n >= dailyCap) throw new Error(`今日の上限（${dailyCap} 回）に達しました。設定画面で変えられます`);
    await chrome.storage.local.set({ usage: { day, n: n + 1 } });
  });
  spendChain = p.catch(() => {});
  return p;
}

async function post({ url, apiKey, uncounted }, body) {
  for (let attempt = 0; ; attempt++) {
    if (!uncounted) await spend();
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if ((r.status === 429 || r.status === 529) && attempt < 3) {
      await new Promise((ok) => setTimeout(ok, 500 * 2 ** attempt));
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}` + (HTTP_REASON[r.status] ? ` ${HTTP_REASON[r.status]}` : ""));
    return (await r.json())?.answers || {};
  }
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
