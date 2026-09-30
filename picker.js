// サイト別の設定を、ページ上でクリックして作る。ポップアップのボタンから起動する。
//   preview  … ブロックごと: 1件分の区切りを確認・保存・クリックで修正 → 続けて本文の場所も指定できる
//   pickPage … ページ全体: 判定する範囲を確認・クリックで修正
// 保存先は userSites（sites.js と同じ形）。設定画面で一覧・書き出し・読み込みができ、他の人と共有できる。
// content.js と同じ実行環境なので、settings / SITE / currentItems / selectAll / isShown / pageRoot をそのまま使う。
let ui = null; // { host, shadow, marked: Element[], cleanup: Function[] }

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg.type !== "preview" && msg.type !== "pickPage") return;
  if (msg.type === "preview") startPreview();
  else startPageRoot();
  send({ ok: true }); // 返事をしないと、ポップアップ側の送信がエラーになって閉じない
});

function userEntry() {
  return settings.userSites.find((s) => hostMatches(location.hostname, s.hosts || []));
}

// ---- ブロックごと: 1件分の区切り ----

function startPreview() {
  const mine = userEntry()?.item;
  const mineHits = mine ? selectAll(mine) : [];
  if (mineHits.length) return showPreview(mineHits, null, "自分で保存した区切り", true);
  const builtin = jevSiteFor(location.hostname)?.item;
  const builtinHits = builtin ? selectAll(builtin) : [];
  if (builtinHits.length) return showPreview(builtinHits, null, "このサイトのおすすめ設定", !!mine);
  const auto = currentItems();
  const sel = auto.length ? buildSelector(auto) : null;
  // 保存されるのはセレクタなので、見せるのもセレクタで拾える分にする（自動検出の結果と少し違いうる）
  showPreview(sel ? selectAll(sel) : [], sel, "自動検出", !!mine);
}

function showPreview(items, sel, source, hasMine) {
  openUi();
  mark(items, "jev-preview");
  const msg = items.length
    ? `${source}: ${items.length} 件を「1件分」として青枠で囲みました。1件ずつ囲めていますか？`
    : `${source}: 区切りを見つけられませんでした。`;
  setBar(msg, [
    sel && items.length && ["これで保存", () => saveField("item", sel)],
    items.length && ["本文の場所を指定", startPickText],
    ["クリックで直す", () => pickElement("「1件分」にしたい部分をクリックしてください", itemFrom, finishPickItem)],
    hasMine && ["自分の設定を消す", () => saveField("item", null)],
    ["閉じる", closeUi],
  ]);
}

function finishPickItem(el) {
  const sibs = [...el.parentElement.children].filter((c) => c.tagName === el.tagName && isShown(c));
  const sel = buildSelector(sibs.length >= 2 ? sibs : [el]);
  if (!sel) return retry("この部分からは区切りを作れませんでした。↑キーで一段外側を選んでからクリックしてください。", finishPickItem, itemFrom);
  showPreview(selectAll(sel), sel, "クリックから作った区切り", !!userEntry()?.item);
}

// ---- ブロックごと: 1件の中の本文の場所（ユーザー名・時刻・いいね数を Jev に渡さないため） ----

function startPickText() {
  pickElement("1件の中で、本文にあたる部分をクリックしてください", (el) => el, finishPickText);
}

function finishPickText(el) {
  const items = currentItems();
  // 1件の枠そのもの（やその外側）を選ぶと、本文の場所にならない
  if (items.some((it) => el === it || el.contains(it))) {
    return retry("1件の枠ではなく、1件の中の一部（本文の段落など）をクリックしてください。", finishPickText, (e) => e);
  }
  const sel = shapeOf([el], 2);
  const hits = sel ? items.filter((it) => it.querySelector(sel)) : [];
  // 半分以上の件で見つかる形でないと、他の件では本文が空になる
  if (hits.length < Math.max(1, items.length / 2)) {
    return retry("この形は他の件に見当たりませんでした。↑キーで一段外側を選んでからクリックしてください。", finishPickText, (e) => e);
  }
  openUi();
  mark(hits.flatMap((it) => [...it.querySelectorAll(sel)]), "jev-pick");
  setBar(`${items.length} 件中 ${hits.length} 件で、点線の部分を本文として Jev に渡します。`, [
    ["これで保存", () => saveField("text", sel)],
    ["選び直す", startPickText],
    userEntry()?.text && ["自分の設定を消す", () => saveField("text", null)],
    ["閉じる", closeUi],
  ]);
}

// ---- ページ全体: 判定する範囲 ----

function startPageRoot() {
  openUi();
  const root = pageRoot();
  mark([root], "jev-preview");
  const where = root === document.body ? "ページ全体（本文の範囲を見つけられませんでした）" : "青枠の範囲";
  setBar(`${where}の見出しと本文を判定しています。範囲は合っていますか？`, [
    ["クリックで直す", () => pickElement("判定したい範囲（記事の本文を囲む部分）をクリックしてください", (el) => el, finishPickRoot)],
    userEntry()?.page && ["自分の設定を消す", () => saveField("page", null)],
    ["閉じる", closeUi],
  ]);
}

function finishPickRoot(el) {
  const sel = buildSelector([el]);
  if (!sel || document.querySelector(sel) !== el) {
    return retry("この部分を指す書き方を作れませんでした。↑キーで一段外側を選んでからクリックしてください。", finishPickRoot, (e) => e);
  }
  openUi();
  mark([el], "jev-preview");
  setBar(`青枠の範囲（${el.innerText.trim().length} 字）を判定します。`, [
    ["これで保存", () => saveField("page", sel)],
    ["選び直す", startPageRoot],
    ["閉じる", closeUi],
  ]);
}

// ---- 共通: クリックで要素を選ぶ ----

function retry(message, onPick, resolve) {
  openUi();
  setBar(message, [
    onPick && ["選び直す", () => pickElement("もう一度クリックしてください", resolve, onPick)],
    ["閉じる", closeUi],
  ]);
}

// resolve: カーソル下の要素 → 候補の要素。onPick: クリックで確定した要素を受け取る
function pickElement(message, resolve, onPick) {
  openUi();
  let target = null;
  const stack = []; // ↑で外に出た分。↓で戻る
  const setTarget = (el) => {
    mark(el ? [el] : [], "jev-pick");
    target = el;
  };
  const outside = (e) => !e.composedPath().includes(ui.host);
  const onMove = (e) => {
    if (!outside(e)) return;
    const next = resolve(e.target);
    if (next === target || stack.includes(next)) return; // ↑で選び直した状態を、同じ所での揺れで崩さない
    stack.length = 0;
    setTarget(next);
  };
  const block = (e) => {
    if (!outside(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onClick = (e) => {
    if (!outside(e)) return;
    block(e);
    if (!target) return;
    ui.cleanup.splice(0).forEach((f) => f()); // クリック横取りを外す
    onPick(target);
  };
  const onKey = (e) => {
    if (e.key === "Escape") return closeUi();
    if (!target) return;
    if (e.key === "ArrowUp" && target.parentElement && target.parentElement !== document.body) {
      stack.push(target);
      setTarget(target.parentElement);
    } else if (e.key === "ArrowDown" && stack.length) {
      setTarget(stack.pop());
    } else return;
    e.preventDefault();
  };
  const downs = ["mousedown", "mouseup", "pointerdown", "pointerup"];
  addEventListener("mousemove", onMove, true);
  for (const t of downs) addEventListener(t, block, true);
  addEventListener("click", onClick, true);
  addEventListener("keydown", onKey, true);
  ui.cleanup.push(() => {
    removeEventListener("mousemove", onMove, true);
    for (const t of downs) removeEventListener(t, block, true);
    removeEventListener("click", onClick, true);
    removeEventListener("keydown", onKey, true);
  });
  setBar(message + "（↑キーで一段外側、↓で内側、Esc でやめる）", [["やめる", closeUi]]);
}

// 利用者の設定（userSites）の1項目を書き換える。value が null なら消し、何も残らなければそのサイトの設定ごと消す
async function saveField(field, value) {
  const { userSites = [] } = await chrome.storage.sync.get({ userSites: [] });
  let entry = userSites.find((s) => hostMatches(location.hostname, s.hosts || []));
  if (!entry) userSites.push((entry = { hosts: [location.hostname] }));
  if (value) entry[field] = value;
  else delete entry[field];
  const rest = userSites.filter((s) => Object.keys(s).some((k) => k !== "hosts" && s[k]));
  closeUi();
  await chrome.storage.sync.set({ userSites: rest }); // content.js が読み直して、この設定で判定し直す
}

// カーソル下の要素から外に向かって、「中身のある同じタグの兄弟が3つ以上ある」最初の要素を1件分とみなす。
// 中身を問うのは、1件の内側の「タイトル・時刻・配信元」のような短い並びを拾わないため（Yahoo で起きた）
function itemFrom(el) {
  const filled = (e) => e.textContent.trim().length >= 20;
  for (let a = el; a && a !== document.body; a = a.parentElement) {
    const p = a.parentElement;
    if (!p) break;
    if (!filled(a)) continue;
    const same = [...p.children].filter((c) => c.tagName === a.tagName && filled(c)).length;
    if (same >= 3) return a;
  }
  return el;
}

// 並んでいる要素を全部拾い、余計なものは2割以内に収まるセレクタを作る。
// 親を1段ずつ足して絞る（親が複数あれば、その共通の形で書く）。全部を拾えなくなったら止める。
// 余計なものが3倍を超えるセレクタしか作れないときは null（`div` 1語のような全部に当たるものを保存させない）。
function buildSelector(items) {
  // 入れ子を外側に寄せる前の生の一致で数える。寄せてから数えると、`div > div` のような途中段階で
  // 外側の祖先が一致して目的の要素が消え、そこで打ち切られる（Google で実際に起きた）
  const covers = (sel) => {
    const got = new Set(document.querySelectorAll(sel));
    return items.every((e) => got.has(e)) ? got.size : 0;
  };
  const tight = (n) => n <= items.length * 1.2;
  const loose = (n) => n <= items.length * 3;
  let chain = shapeOf(items, 2);
  if (!chain) return null;
  let n = covers(chain);
  let best = n && loose(n) ? chain : null;
  if (n && tight(n)) return chain;
  let level = items;
  for (let depth = 0; depth < 5; depth++) {
    level = [...new Set(level.map((e) => e.parentElement))];
    if (level.some((p) => !p || p === document.body || p === document.documentElement)) break;
    const id = level.length === 1 && level[0].id;
    const d = id && /^[A-Za-z][\w-]*$/.test(id) && !/\d{4,}/.test(id) ? "#" + CSS.escape(id) : shapeOf(level, 3);
    if (!d) break;
    chain = d + " > " + chain;
    n = covers(chain);
    if (!n) break;
    if (loose(n)) best = chain;
    if (tight(n) || d.startsWith("#")) break;
  }
  return best;
}

// 要素群に共通する「タグ＋共通クラス」。タグが揃わなければ null
function shapeOf(els, maxClasses) {
  const tag = els[0].tagName;
  if (els.some((e) => e.tagName !== tag)) return null;
  const common = els
    .map((e) => new Set(cleanClasses(e)))
    .reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  return tag.toLowerCase() + [...common].slice(0, maxClasses).map((c) => "." + CSS.escape(c)).join("");
}

function cleanClasses(e) {
  return [...e.classList].filter((c) => !c.startsWith("jev-"));
}

// ---- 画面上部のバー。サイトの CSS に影響されないよう shadow DOM に閉じる ----

function openUi() {
  if (ui) {
    ui.cleanup.splice(0).forEach((f) => f());
    mark([], "");
    return;
  }
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    .bar { font: 14px system-ui, sans-serif; background: #1f2a44; color: #fff; padding: 10px 14px;
           display: flex; gap: 8px; align-items: center; flex-wrap: wrap; box-shadow: 0 2px 8px #0005; }
    .msg { flex: 1 1 300px; }
    button { font: inherit; padding: 5px 12px; border-radius: 4px; border: 0; cursor: pointer; background: #e8ecf5; color: #111; }
    button:first-of-type { background: #2b7cff; color: #fff; }
  </style><div class="bar"><span class="msg"></span></div>`;
  document.documentElement.append(host);
  ui = { host, shadow, marked: [], cleanup: [] };
}

function setBar(text, buttons) {
  const bar = ui.shadow.querySelector(".bar");
  bar.querySelector(".msg").textContent = text;
  bar.querySelectorAll("button").forEach((b) => b.remove());
  for (const [label, fn] of buttons.filter(Boolean)) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    bar.append(b);
  }
}

function mark(els, cls) {
  for (const e of ui.marked) e.classList.remove("jev-preview", "jev-pick");
  ui.marked = els;
  if (cls) for (const e of els) e.classList.add(cls);
}

function closeUi() {
  if (!ui) return;
  ui.cleanup.splice(0).forEach((f) => f());
  mark([], "");
  ui.host.remove();
  ui = null;
}
