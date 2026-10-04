const $ = (id) => document.getElementById(id);

// 全体の一時停止。保存の形（enabled）は変えない: 一時停止 = enabled が false
chrome.storage.sync.get({ enabled: true }).then(({ enabled }) => ($("paused").checked = !enabled));
$("paused").onchange = (e) => chrome.storage.sync.set({ enabled: !e.target.checked });
$("open").onclick = () => chrome.runtime.openOptionsPage();

function line(t, cls) {
  const d = document.createElement("div");
  d.textContent = t;
  if (cls) d.className = cls;
  $("stats").append(d);
}

// キーが無い人には、まず体験ページ（見本と判定済みの結果。通信なし）を勧める
function trialButton() {
  const b = document.createElement("button");
  b.textContent = "まず体験してみる（キー不要）";
  b.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
  $("stats").append(b);
}

// サイトの許可（v0.17.0）: ページ側のスクリプトは、モードを選んだときに Chrome の確認で許可したサイトにだけ入る
let injectTried = false; // 入れられないページ（PDF・ストア・管理者が止めたサイト）で入れ直しを繰り返さない
async function render() {
  $("stats").textContent = "";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // キーが要るかは判定部分（background.js の BACKENDS）ごとに違うので、background に聞く
  const noKey = !(await chrome.runtime.sendMessage({ type: "hasKey" }).catch(() => null))?.has;
  if (!noKey) {
    const { usage } = await chrome.storage.local.get("usage");
    const { dailyCap = JEV_DAILY_CAP } = await chrome.storage.sync.get("dailyCap");
    const today = usage?.day === new Date().toLocaleDateString("sv") ? usage.n : 0;
    // 普段は見せない。上限が近いときだけ知らせる
    if (dailyCap > 0 && today >= dailyCap * 0.8) line(`今日の問い合わせ ${today} / ${dailyCap} 回（上限が近いです。設定で変えられます）`, "err");
  }
  // アドレスは activeTab（ポップアップを開いたタブだけ）で読める
  if (!/^https?:/.test(tab?.url || "")) {
    line("このページでは動きません（Chrome の内部ページなど）");
    if (noKey) trialButton();
    return;
  }
  const host = new URL(tab.url).hostname;
  const pattern = jevSitePattern(host);
  const granted = await chrome.permissions.contains({ origins: [pattern] });
  let s;
  try { s = await chrome.tabs.sendMessage(tab.id, { type: "stats" }); } catch {}
  const { siteModes = {} } = await chrome.storage.sync.get({ siteModes: {} });
  const mode = siteModes[host] || "";
  // 許可はあるのに、許可より前から開いていたタブにはまだ入っていない → 今入れる
  if (granted && mode && !s && !injectTried) {
    injectTried = true;
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: JEV_CONTENT.css }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: JEV_CONTENT.js }).catch(() => {});
    return setTimeout(render, 500);
  }

  $("site").hidden = false;
  $("host").textContent = host;
  const site = jevSiteFor(host);
  // オンにしたときのモードは自動: 主要サイトはおすすめ、それ以外はページ全体
  const auto = site?.mode || "page";
  $("use").checked = !!mode;
  $("use").onchange = (e) => setMode(host, pattern, e.target.checked ? auto : "", granted);
  for (const r of document.querySelectorAll("[name=mode]")) {
    // 主要サイトは、おすすめのモードに印を付ける（sites.js）
    if (site && r.value === site.mode && !r.parentElement.querySelector(".rec")) {
      const tag = document.createElement("b");
      tag.className = "rec";
      tag.textContent = site.checked ? "おすすめ" : "おすすめ（未確認）";
      tag.style.cssText = "color:#2a7;font-size:11px";
      r.parentElement.append(tag);
    }
    r.checked = r.value === (mode || auto);
    r.disabled = !mode; // オフのあいだは選べない（先に「このサイトで使う」をオンにする）
    r.onchange = () => setMode(host, pattern, r.value, granted);
  }
  if (mode && !granted) {
    line("このサイトを読む許可がありません（v0.17 から、サイトごとに許可が要ります）", "err");
    const b = document.createElement("button");
    b.textContent = "このサイトを許可する";
    b.onclick = () => setMode(host, pattern, mode, false);
    $("stats").append(b);
    return;
  }
  // 表示がずれるとき: ブロックごと → 区切りと本文の場所、ページ全体 → 判定する範囲。操作はページ上のバーで行う
  $("fix").hidden = !s?.mode;
  $("pick").textContent = s?.mode === "page" ? "判定範囲を確認・直す" : "区切りを確認・直す";
  $("pick").onclick = async () => {
    try { await chrome.tabs.sendMessage(tab.id, { type: s.mode === "page" ? "pickPage" : "preview" }); } catch {}
    window.close();
  };

  // キーが無くても、コードで判定する項目だけで動く
  if (noKey) line("キーなしモード: コードで判定できる項目（誘導の決まり文句・同じ文言の大量投稿）だけを見ています。キーを入れると Jev の判定も加わります");
  if (!mode) {
    line("このサイトでは判定していません。「このサイトで使う」をオンにすると、このサイトを読む許可を求めます");
    if (noKey) trialButton();
    return;
  }
  if (!s) return line("このページには入れませんでした。読み込み直すか、PDF・ストアなど拡張が入れないページでないか確かめてください");
  if (s.mode === "block") line(`読んだ投稿 ${s.judged} 件のうち、手口あり ${s.warned} 件`);
  if (s.mode === "page") line(s.judged ? `このページの手口 ${s.pageHits} 件` : "判定中…");
  if (s.errors) line(`失敗 ${s.errors}（${s.lastError}）`, "err");
}

// モードを選ぶ。許可の確認は、クリックの直後に呼ばないと Chrome に断られるので、保存より先に始める。
// オフにしたら許可も返す（読む必要のないサイトの許可を持たない）
async function setMode(host, pattern, value, granted) {
  const asking = value && !granted ? chrome.permissions.request({ origins: [pattern] }) : Promise.resolve(true);
  const { siteModes = {} } = await chrome.storage.sync.get({ siteModes: {} });
  if (value) siteModes[host] = value;
  else delete siteModes[host];
  await chrome.storage.sync.set({ siteModes });
  if (!value) await chrome.permissions.remove({ origins: [pattern] }).catch(() => {});
  else if (!(await asking.catch(() => false))) {
    delete siteModes[host]; // 許可されなかったらオフに戻す
    await chrome.storage.sync.set({ siteModes });
  }
  setTimeout(render, 300); // ページ側が読み直してから数を出す
}

render();
