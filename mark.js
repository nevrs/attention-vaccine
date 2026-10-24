// 「注意報」の印の見た目と、押すと開く詳細の中身。ページ側（content.js）と体験ページ（demo.js）で共通。
// 印をどこに置くか・開け閉め・ページへの操作の止め方は、それぞれの側が持つ。
// rows は [{ c: 判定の項目（cat, label, short, why, tip, qs[問いの原文], code, high, showSources）, pct, hit, detail? }]

const JEV_MARK_CSS = `
  .b { all: initial; font: 12px/1 system-ui, sans-serif; cursor: pointer; background: #fffaf0; color: #5c4400; border: 1px solid #d9b45a;
       border-radius: 12px; padding: 4px 8px; box-shadow: 0 1px 3px #0002; }
  .b .k { font-weight: 700; margin-right: 4px; padding-right: 5px; border-right: 1px solid #e3c98a; }
  .b.quiet { background: #fff; border-color: #ccc; color: #888; font-size: 11px; }
  .pop { position: absolute; right: 0; top: 28px; width: 320px; max-height: 60vh; overflow: auto; background: #fff; color: #222; z-index: 10;
         border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px #0003; padding: 8px 10px;
         font: 12px/1.5 system-ui, sans-serif; text-align: left; white-space: normal; }
  :host(.fixed) .pop { top: auto; bottom: 30px; }
  :host(.left) .pop { right: auto; left: 0; }
  .hit { color: #5c4400; font-weight: 700; font-size: 13px; margin-top: 6px; }
  .hit:first-child { margin-top: 0; }
  .item { color: #333; font-weight: 700; margin-top: 4px; }
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

// 詳細の1行
function jevDiv(cls, text, parent) {
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = text;
  parent.append(d);
  return d;
}

// 当たった項目を分類ごとにまとめる。並びは、いちばん確率の高い項目の分類から（コードの項目は Jev の項目より後ろに回す）。
// 分類を持たない項目（自分で足した項目・元論文との比較）は、項目の名前を分類の名前の代わりにする（印は短い名前、詳細は正式な名前）
function jevGroups(hits) {
  const groups = new Map();
  for (const r of [...hits].sort((a, b) => !!a.c.code - !!b.c.code || b.pct - a.pct)) {
    const cat = JEV_CATS[r.c.cat];
    const key = cat ? r.c.cat : "item:" + (r.c.label || r.c.short);
    if (!groups.has(key)) groups.set(key, { name: cat?.name || r.c.short || r.c.label, title: cat?.name || r.c.label || r.c.short, why: cat?.why, cat: !!cat, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()];
}

// 印の文字: 「注意報｜いちばん確率の高い項目の分類」。ほかの分類にも当たっていれば「ほかN」。
// % は出さない（「95% うそ」と読まれる。2026-10-04 UI レビュー）
function jevBadgeText(hits) {
  const g = jevGroups(hits);
  return g[0].name + (g.length > 1 ? ` ほか${g.length - 1}` : "");
}
function jevSetBadge(badge, hits, prefix = "") {
  badge.textContent = prefix;
  badge.append(Object.assign(document.createElement("span"), { className: "k", textContent: JEV_MARK }), jevBadgeText(hits));
  badge.setAttribute("aria-label", `注意報: ${jevGroups(hits).map((g) => g.name).join("、")}。押すと説明が出ます`);
}

const jevRowValue = (r) => (r.c.code ? (r.hit ? "あり" : "なし") : `${r.pct.toFixed(0)}%`);

// 詳細の中身: 分類ごとに「分類の名前 → 分類の説明」、その下に項目ごとに「名前 → 仕組み → 向き合い方」（出典のリンクがあれば添える）。
// 判定の中身（確率・閾値・問いの原文・全項目）は「詳しく」の中。
// extra(add, link): 項目の後に足す行。more(details): 「詳しく」の末尾に足す操作（ページ側の AI に相談・違うと思う）
function jevFillDetails(pop, rows, { links = [], extra, more: addMore, keyless = false, moreLabel = "詳しく（判定の中身・直し方）" } = {}) {
  pop.textContent = "";
  const add = (cls, text, parent = pop) => jevDiv(cls, text, parent);
  const link = (href, text, parent = pop) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    add("note", "", parent).append(a);
  };
  const hits = rows.filter((r) => r.hit);
  if (!hits.length) add("note", "注意報は出ていません。出ていないことは、内容が正しいという意味ではありません");
  for (const g of jevGroups(hits)) {
    add("hit", g.title);
    if (g.why) add("note", g.why);
    for (const r of g.rows) jevFillItem(r, g, add, link, links);
  }
  extra?.(add, link);
  const more = document.createElement("details");
  more.className = "more";
  more.append(Object.assign(document.createElement("summary"), { textContent: moreLabel }));
  pop.append(more);
  for (const r of hits) {
    if (r.c.code) continue;
    add("note", `${r.c.label}: 当てはまる確率 ${r.pct.toFixed(0)}%（${r.c.high}% 以上で印を付けます）`, more);
    add("note", jevQuestionNote(r.c.qs), more);
  }
  if (keyless) add("note", "API キーが無いので、コードで判定できる項目だけを見ています。キーを入れると Jev の判定も加わります", more);
  add("all", rows.map((r) => `${r.c.label} ${jevRowValue(r)}`).join(" ・ "), more);
  if (rows.some((r) => !r.c.code)) add("note", JEV_PCT_NOTE, more);
  addMore?.(more);
}

// 詳細の項目1つ。分類を持たない項目は、分類の名前と同じなので項目の名前を繰り返さない
function jevFillItem(r, g, add, link, links) {
  if (g.cat) add("item", r.c.label);
  if (r.c.why) add("why", r.c.why);
  if (r.detail) add("note", r.detail);
  if (r.c.showSources) {
    if (!links.length) add("note", "範囲内に一次ソースへのリンクは見当たりません");
    for (const href of links.slice(0, 3)) link(href, "出典: " + jevShortUrl(href));
  }
  if (r.c.tip) add("tip", "向き合い方: " + r.c.tip);
}

function jevShortUrl(href) {
  const u = new URL(href);
  const s = u.hostname.replace(/^www\./, "") + u.pathname;
  return s.length > 48 ? s.slice(0, 47) + "…" : s;
}
