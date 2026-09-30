// 体験ページ: demo-data.js の見本と判定結果を、本番と同じ見た目の ‼️ で表示する（通信なし・キー不要）。
// ‼️ の見た目と詳細の中身は content.js の createMark / fillDetails / badgeText に合わせている。
const $ = (id) => document.getElementById(id);

const MARK_CSS = `
  .b { all: initial; font: 13px/1 system-ui, sans-serif; cursor: pointer; background: #fff; border: 1px solid #e0a000;
       border-radius: 12px; padding: 3px 6px; box-shadow: 0 1px 4px #0003; }
  .b.quiet { border-color: #ccc; color: #888; font-size: 11px; }
  .pop { position: absolute; right: 0; top: 26px; width: 300px; background: #fff; color: #222; z-index: 10;
         border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px #0003; padding: 8px 10px;
         font: 12px/1.5 system-ui, sans-serif; text-align: left; }
  :host(.up) .pop { top: auto; bottom: 30px; }
  .hit { color: #8a5300; font-weight: 700; margin-top: 4px; }
  .why { color: #444; }
  .note { color: #777; font-size: 11px; }
  .all { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #ddd; color: #777; font-size: 11px; }
  [hidden] { display: none; }
`;

// 利用者の今の設定（オン・オフと感度）で見せる。読めなければ初期値
async function loadPillars() {
  try {
    const { pillars = {} } = await chrome.storage.sync.get({ pillars: {} });
    return pillars;
  } catch {
    return {};
  }
}

// コードの項目（誘導の決まり文句）は、見本の本文からその場で判定する（本番と同じ関数）
function rowsFor(answers, mode, saved, text) {
  const rows = [];
  for (const [id, p] of Object.entries(JEV_PILLARS)) {
    const c = { ...p.defaults, ...(saved[id] || {}) };
    if (!c.on || p.advanced || (p.modes && !p.modes.includes(mode))) continue;
    if (p.code) {
      if (!JEV_CODE[p.code]) continue; // 同じ文言の大量投稿は投稿どうしの比較なので、見本1件ずつでは出せない
      const r = JEV_CODE[p.code](text);
      rows.push({ c: p, pct: r.hit ? 100 : 0, hit: r.hit, matches: r.matches });
      continue;
    }
    if (!p.qs.every((k) => k in answers)) continue;
    const pct = p.qs.reduce((acc, k) => acc * answers[k], 1) * 100;
    rows.push({ c: { ...p, high: c.high }, pct, hit: pct >= c.high });
  }
  return rows;
}

function badgeText(hits) {
  const top = [...hits].sort((a, b) => !!a.c.code - !!b.c.code || b.pct - a.pct)[0];
  return `‼️ ${top.c.short}${top.c.code ? "" : ` ${top.pct.toFixed(0)}%`}` + (hits.length > 1 ? ` ほか${hits.length - 1}` : "");
}

const rowValue = (r) => (r.c.code ? (r.hit ? "あり" : "なし") : `${r.pct.toFixed(0)}%`);

function createMark(rows, style, extraNote) {
  const host = document.createElement("span");
  host.style.cssText = `position:absolute;${style};`;
  const sh = host.attachShadow({ mode: "open" });
  sh.innerHTML = `<style>${MARK_CSS}</style><button class="b"></button><div class="pop" hidden></div>`;
  const badge = sh.querySelector(".b");
  const pop = sh.querySelector(".pop");
  const hits = rows.filter((r) => r.hit);
  badge.textContent = hits.length ? badgeText(hits) : "✓";
  badge.classList.toggle("quiet", !hits.length);
  const add = (cls, text) => {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    pop.append(d);
  };
  if (!hits.length) add("note", "目立った手口は見つかりませんでした");
  for (const r of hits) {
    add("hit", `‼️ ${r.c.label}（${r.c.code ? "決まり文句" : r.pct.toFixed(0) + "%"}）`);
    if (r.c.why) add("why", r.c.why);
    if (r.matches?.length) add("note", "見つかった言い回し: " + r.matches.map((m) => `「${m}」`).join(""));
    if (r.c.showSources) add("note", "範囲内に一次ソースへのリンクは見当たりません");
  }
  if (extraNote) add("note", extraNote);
  add("all", rows.map((r) => `${r.c.label} ${rowValue(r)}`).join(" ・ "));
  badge.onclick = () => (pop.hidden = !pop.hidden);
  return { host, hits };
}

async function render() {
  const saved = await loadPillars();
  $("measured").textContent = `（判定した日: ${JEV_DEMO.measured}、モデル: ${JEV_DEMO.model}）`;

  const feed = $("feed");
  feed.textContent = "";
  JEV_DEMO.posts.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "post";
    li.innerHTML = `<div class="who"></div><div class="txt"></div>`;
    li.querySelector(".who").textContent = `見本の投稿 ${i + 1}`;
    li.querySelector(".txt").textContent = p.text;
    const { host, hits } = createMark(rowsFor(p.answers, "block", saved, p.text), "top:10px;right:10px");
    if (hits.length || $("showAll").checked) li.append(host);
    feed.append(li);
  });

  const art = $("article");
  art.innerHTML = `<h3></h3><p class="body"></p><div class="src">見本の記事（架空）</div>`;
  const [head, ...rest] = JEV_DEMO.article.text.split("。");
  art.querySelector("h3").textContent = head + "。";
  art.querySelector(".body").textContent = rest.join("。");
  const m = createMark(rowsFor(JEV_DEMO.article.answers, "page", saved, JEV_DEMO.article.text), "right:12px;bottom:12px", "本番では、記事内に論文や公的機関へのリンクがあれば、ここに出典として添えます");
  m.host.shadowRoot.host.classList.add("up");
  art.append(m.host);
}

$("showAll").onchange = render;
$("goOptions").onclick = () => chrome.runtime.openOptionsPage();
render();
