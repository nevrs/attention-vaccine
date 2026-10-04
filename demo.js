// 体験ページ: demo-data.js の見本と判定結果を、本番と同じ見た目の「手口」の印で表示する（通信なし・キー不要）。
// 印の見た目と詳細の中身は content.js の createMark / fillDetails / badgeText に合わせている（「AI に相談」は本文の判定が無いので出さない）。
const $ = (id) => document.getElementById(id);

const MARK_CSS = `
  .b { all: initial; font: 12px/1 system-ui, sans-serif; cursor: pointer; background: #fffaf0; color: #5c4400; border: 1px solid #d9b45a;
       border-radius: 12px; padding: 4px 8px; box-shadow: 0 1px 3px #0002; }
  .b .k { font-weight: 700; margin-right: 4px; padding-right: 5px; border-right: 1px solid #e3c98a; }
  .b.quiet { background: #fff; border-color: #ccc; color: #888; font-size: 11px; }
  .pop { position: absolute; right: 0; top: 28px; width: 320px; background: #fff; color: #222; z-index: 10;
         border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px #0003; padding: 8px 10px;
         font: 12px/1.5 system-ui, sans-serif; text-align: left; }
  :host(.up) .pop { top: auto; bottom: 30px; }
  .hit { color: #5c4400; font-weight: 700; font-size: 13px; margin-top: 6px; }
  .hit:first-child { margin-top: 0; }
  .why { color: #333; }
  .tip { color: #1f5130; background: #f1f8f3; border-radius: 6px; padding: 4px 6px; margin-top: 4px; }
  .more { margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px; }
  .more > summary { cursor: pointer; color: #555; font-size: 11px; }
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
  return top.c.short + (hits.length > 1 ? ` ほか${hits.length - 1}` : "");
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
  if (hits.length) {
    badge.append(Object.assign(document.createElement("span"), { className: "k", textContent: JEV_MARK }), badgeText(hits));
    badge.setAttribute("aria-label", `注意: ${hits.map((r) => r.c.label).join("、")} の手口の可能性。押すと説明が出ます`);
  } else badge.textContent = "読んだ";
  badge.classList.toggle("quiet", !hits.length);
  const add = (cls, text, parent = pop) => {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    parent.append(d);
  };
  if (!hits.length) add("note", "目立った手口は見つかりませんでした。手口が無いことは、内容が正しいという意味ではありません");
  for (const r of hits) {
    add("hit", r.c.label);
    if (r.c.why) add("why", r.c.why);
    if (r.matches?.length) add("note", "見つかった言い回し: " + r.matches.map((m) => `「${m}」`).join(""));
    if (r.c.showSources) add("note", "範囲内に一次ソースへのリンクは見当たりません");
    if (r.c.tip) add("tip", "向き合い方: " + r.c.tip);
  }
  if (extraNote) add("note", extraNote);
  const more = document.createElement("details");
  more.className = "more";
  more.append(Object.assign(document.createElement("summary"), { textContent: "詳しく（判定の中身）" }));
  pop.append(more);
  for (const r of hits) {
    if (r.c.code) continue;
    add("note", `${r.c.label}: 当てはまる確率 ${r.pct.toFixed(0)}%（${r.c.high}% 以上で印を付けます）`, more);
    add("note", jevQuestionNote(r.c.qs.map((k) => JEV_QUESTIONS[k])), more);
  }
  add("all", rows.map((r) => `${r.c.label} ${rowValue(r)}`).join(" ・ "), more);
  if (rows.some((r) => !r.c.code)) add("note", JEV_PCT_NOTE, more);
  badge.onclick = () => (pop.hidden = !pop.hidden);
  return { host, hits };
}

async function render() {
  const saved = await loadPillars();
  $("measured").textContent = `（判定した日: ${JEV_DEMO.measured}、モデル: ${JEV_DEMO.model}）`;
  // 「しくみ」の図の数値は見本1から入れる（手で書くと、問いを変えて測り直したときに食い違った）
  const a0 = JEV_DEMO.posts[0].answers;
  const pct = (qs) => `${(qs.reduce((acc, k) => acc * a0[k], 1) * 100).toFixed(0)}%`;
  $("figBait").textContent = pct(JEV_PILLARS.bait.qs);
  $("figFlame").textContent = pct(JEV_PILLARS.flame.qs);
  $("figDema").textContent = pct(JEV_PILLARS.dema.qs);
  $("figBadge").textContent = `${JEV_MARK}｜${JEV_PILLARS.bait.short}`;

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
