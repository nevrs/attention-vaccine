// 体験ページ: demo-data.js の見本と判定結果を、本番と同じ見た目の「手口」の印で表示する（通信なし・キー不要）。
const $ = (id) => document.getElementById(id);

// 利用者の今の設定（オン・オフと感度）で見せる。読めなければ初期値
async function loadPillars() {
  try {
    const { pillars = {} } = await chrome.storage.sync.get({ pillars: {} });
    return pillars;
  } catch {
    return {};
  }
}

// コードの項目（誘導の決まり文句）は、見本の本文からその場で判定する（本番と同じ関数）。見本の answers は問いのキーで引く
function rowsFor(answers, mode, saved, text) {
  const rows = [];
  for (const [id, p] of Object.entries(JEV_PILLARS)) {
    const cfg = jevPillarConfig(id, saved);
    if (!cfg.on || p.advanced || (p.modes && !p.modes.includes(mode))) continue;
    const c = { ...p, high: cfg.high, qs: p.qs.map((k) => JEV_QUESTIONS[k]) };
    if (p.code) {
      if (JEV_CODE[p.code]) rows.push(jevCodeRow(c, text)); // 同じ文言の大量投稿は投稿どうしの比較なので、見本1件ずつでは出せない
      continue;
    }
    if (!p.qs.every((k) => k in answers)) continue;
    const pct = jevPct(p.qs, answers);
    rows.push({ c, pct, hit: pct >= c.high });
  }
  return rows;
}

// 印の見た目と詳細の中身は mark.js（本番と共通）。本番と違い、出典のリンクと「AI に相談」は出さない（見本には無い）
function createMark(rows, style, extraNote) {
  const host = document.createElement("span");
  host.style.cssText = `position:absolute;${style};`;
  const sh = host.attachShadow({ mode: "open" });
  sh.innerHTML = `<style>${JEV_MARK_CSS}</style><button class="b"></button><div class="pop" hidden></div>`;
  const badge = sh.querySelector(".b");
  const pop = sh.querySelector(".pop");
  const hits = rows.filter((r) => r.hit);
  if (hits.length) jevSetBadge(badge, hits);
  else badge.textContent = "読んだ";
  badge.classList.toggle("quiet", !hits.length);
  jevFillDetails(pop, rows, { extra: extraNote && ((add) => add("note", extraNote)), moreLabel: "詳しく（判定の中身）" });
  badge.onclick = () => (pop.hidden = !pop.hidden);
  return { host, hits };
}

async function render() {
  const saved = await loadPillars();
  $("measured").textContent = `（判定した日: ${JEV_DEMO.measured}、モデル: ${JEV_DEMO.model}）`;
  // 「しくみ」の図の数値は見本1から入れる（手で書くと、問いを変えて測り直したときに食い違った）
  const a0 = JEV_DEMO.posts[0].answers;
  const pct = (qs) => `${jevPct(qs, a0).toFixed(0)}%`;
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
  m.host.classList.add("fixed"); // 詳細を印の上に開く
  art.append(m.host);
}

$("showAll").onchange = render;
$("goOptions").onclick = () => chrome.runtime.openOptionsPage();
render();
