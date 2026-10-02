const $ = (id) => document.getElementById(id);
const DEFAULT_RULE = { condition: "", high: 80 };
const PROVIDER_HINT = {
  typesafe: "キーは console.typesafe.ai/settings/keys で発行（2026-09 時点で順番待ちあり）。",
  vercel: "キーは Vercel ダッシュボードの AI Gateway → API Keys で発行。順番待ちなし。",
};
let apiKeys = {}; // 接続先ごとのキー。切り替えても入力を失わない

function showProvider() {
  const pv = $("provider").value;
  $("providerHint").textContent = PROVIDER_HINT[pv];
  $("apiKey").value = apiKeys[pv] || "";
  $("testResult").textContent = "";
}

// 基本の項目はオン・オフだけを見せ、閾値は高度な設定の「感度」にまとめる。
// advanced の項目（集団へのレッテル貼り・性的な内容）は、オン・オフ・動作・閾値ごと高度な設定に置く
function renderPillars(saved) {
  for (const [id, p] of Object.entries(JEV_PILLARS)) {
    const c = { ...p.defaults, ...(saved[id] || {}) };
    const box = document.createElement("div");
    box.className = "item";
    box.innerHTML = `<label><input type="checkbox" data-on="${id}"> <b></b></label><div class="why"></div><div class="opts"></div>`;
    box.querySelector("b").textContent = p.label;
    box.querySelector(".why").textContent =
      p.why + (p.modes ? `（${p.modes.map((m) => JEV_MODES[m]).join("・")}モードのみ）` : "") + (p.code ? "（Jev を使わずコードで判定。キーなしでも動く）" : "");
    box.querySelector("[data-on]").checked = c.on;
    if (p.code) { // コードの項目には確率が無いので、感度の欄は出さない
      box.querySelector(".opts").remove();
      $(p.advanced ? "advPillars" : "pillars").append(box);
      continue;
    }
    const high = document.createElement("label");
    high.innerHTML = `${p.advanced ? "閾値" : ""} <input type="number" min="0" max="100" data-high="${id}"> %`;
    if (!p.advanced) high.prepend(p.label + " ");
    high.querySelector("input").value = c.high;
    if (p.actions) {
      const sel = document.createElement("select");
      sel.dataset.act = id;
      for (const a of p.actions) sel.append(new Option(JEV_ACTION_LABEL[a], a));
      sel.value = c.action;
      const l = document.createElement("label");
      l.append("当たったとき ", sel);
      box.querySelector(".opts").append(l);
    }
    if (p.advanced) {
      box.querySelector(".opts").append(high);
      $("advPillars").append(box);
    } else {
      box.querySelector(".opts").remove();
      $("pillars").append(box);
      $("thresholds").append(high);
    }
  }
}

function addRule(rule) {
  const node = $("tpl").content.firstElementChild.cloneNode(true);
  node.dataset.id = rule.id || crypto.randomUUID();
  for (const f of node.querySelectorAll("[data-k]")) f.value = rule[f.dataset.k] ?? DEFAULT_RULE[f.dataset.k];
  node.querySelector(".del").onclick = () => { node.remove(); refreshPresets(); };
  node.querySelector("[data-k=condition]").addEventListener("input", refreshPresets);
  $("rules").append(node);
  refreshPresets();
}

// 同じ条件の項目が既にあるおすすめは押せなくする
function refreshPresets() {
  const used = new Set([...document.querySelectorAll("#rules [data-k=condition]")].map((f) => f.value.trim()));
  for (const b of $("presets").children) b.disabled = used.has(b.dataset.condition);
}

function renderPresets() {
  for (const p of JEV_PRESETS) {
    const b = document.createElement("button");
    b.textContent = "＋ " + p.label;
    b.dataset.condition = p.condition;
    b.onclick = () => addRule({ condition: p.condition, high: p.high });
    $("presets").append(b);
  }
}

// ---- サイト別の設定（userSites）。sites.js の組み込みと同じ形 ----
const SITE_FIELDS = ["item", "text", "page"];

function addSite(site) {
  const node = $("siteTpl").content.firstElementChild.cloneNode(true);
  node.querySelector("[data-s=hosts]").value = (site.hosts || []).join(", ");
  for (const f of SITE_FIELDS) node.querySelector(`[data-s=${f}]`).value = site[f] || "";
  node.querySelector(".del").onclick = () => node.remove();
  $("sites").append(node);
}

function readSites(errors) {
  const out = [];
  for (const [i, node] of [...$("sites").children].entries()) {
    const hosts = node.querySelector("[data-s=hosts]").value.split(/[,\s、]+/).map((h) => h.trim()).filter(Boolean);
    const site = { hosts };
    for (const f of SITE_FIELDS) {
      const v = node.querySelector(`[data-s=${f}]`).value.trim();
      if (!v) continue;
      try { document.createDocumentFragment().querySelector(v); }
      catch { errors?.push(`サイト別の設定${i + 1}: ${f === "item" ? "1件分" : f === "text" ? "本文" : "判定範囲"}の書き方が正しくありません`); }
      site[f] = v;
    }
    if (!hosts.length && SITE_FIELDS.some((f) => site[f])) errors?.push(`サイト別の設定${i + 1}: サイトを書いてください`);
    if (hosts.length && SITE_FIELDS.some((f) => site[f])) out.push(site);
  }
  return out;
}

// 共有用の JSON。貼られたものは外から来たデータなので、決まった項目の文字列だけを取り出す
function sanitizeSites(list) {
  if (!Array.isArray(list)) throw new Error("配列ではありません");
  return list
    .map((s) => {
      const hosts = (Array.isArray(s?.hosts) ? s.hosts : []).filter((h) => typeof h === "string" && /^[a-z0-9.-]+$/i.test(h));
      const site = { hosts };
      for (const f of SITE_FIELDS) if (typeof s?.[f] === "string" && s[f].length <= 500) site[f] = s[f];
      return site;
    })
    .filter((s) => s.hosts.length && SITE_FIELDS.some((f) => s[f]));
}

$("addSite").onclick = () => addSite({});
$("exportSites").onclick = () => {
  $("sitesJson").value = JSON.stringify(readSites(), null, 2);
  $("jsonStatus").textContent = "書き出しました";
};
$("importSites").onclick = () => {
  try {
    const incoming = sanitizeSites(JSON.parse($("sitesJson").value));
    const current = readSites();
    for (const s of incoming) {
      const i = current.findIndex((c) => c.hosts.some((h) => s.hosts.includes(h)));
      if (i >= 0) current[i] = s;
      else current.push(s);
    }
    $("sites").textContent = "";
    current.forEach(addSite);
    $("jsonStatus").style.color = "#2a7";
    $("jsonStatus").textContent = `${incoming.length} サイト分を読み込みました。保存を押すと確定します`;
  } catch (e) {
    $("jsonStatus").style.color = "#c22";
    $("jsonStatus").textContent = "読み込めませんでした: " + e.message;
  }
};

function collect() {
  const errors = [];
  const pillars = {};
  for (const id of Object.keys(JEV_PILLARS)) {
    const highInput = document.querySelector(`[data-high="${id}"]`);
    const high = highInput ? Number(highInput.value) : JEV_PILLARS[id].defaults.high; // コードの項目は欄が無い
    if (!(high >= 0 && high <= 100)) errors.push(`${JEV_PILLARS[id].label}: 閾値は 0〜100 にしてください`);
    pillars[id] = {
      on: document.querySelector(`[data-on="${id}"]`).checked,
      high,
      action: document.querySelector(`[data-act="${id}"]`)?.value ?? "warn",
    };
  }
  const rules = [];
  for (const [i, node] of [...$("rules").children].entries()) {
    const condition = node.querySelector("[data-k=condition]").value.trim();
    if (!condition) continue; // 空の項目は捨てる
    const high = Number(node.querySelector("[data-k=high]").value);
    if (!(high >= 0 && high <= 100)) errors.push(`自分で足す項目${i + 1}: 閾値は 0〜100 にしてください`);
    rules.push({ id: node.dataset.id, condition, high });
  }
  const cmpHigh = Number($("cmpHigh").value);
  if (!(cmpHigh >= 0 && cmpHigh <= 100)) errors.push("一次ソースと比較: 閾値は 0〜100 にしてください");
  const compare = { on: $("cmpOn").checked, high: cmpHigh };
  const userSites = readSites(errors);
  const excludeAuthors = [...new Set($("excludeAuthors").value.split(/[\s,、]+/).map((a) => a.trim().replace(/^@/, "")).filter(Boolean))];
  if (excludeAuthors.some((a) => a.length > 100)) errors.push("判定しないアカウント: 1つが長すぎます");
  return { pillars, rules, compare, userSites, excludeAuthors, debug: $("debug").checked, dwell: Number($("dwell").value), errors };
}

// モードを選んであるのに許可がないサイト（v0.17 で <all_urls> をやめたので、それ以前から使っている人は全部これになる）
async function renderPerm() {
  const { siteModes = {} } = await chrome.storage.sync.get({ siteModes: {} });
  const missing = [];
  for (const h of Object.keys(siteModes)) if (!(await chrome.permissions.contains({ origins: [jevSitePattern(h)] }))) missing.push(h);
  $("perm").hidden = !missing.length;
  $("permHosts").textContent = missing.join("、");
  // 許可の確認はクリックの直後に呼ぶ（間に await を挟むと Chrome に断られる）
  $("permAsk").onclick = () => chrome.permissions.request({ origins: missing.map(jevSitePattern) }).catch(() => false).then(renderPerm);
}

async function init() {
  renderPerm();
  renderPresets();
  const local = await chrome.storage.local.get(["provider", "apiKeys", "apiKey"]);
  apiKeys = local.apiKeys || (local.apiKey ? { typesafe: local.apiKey } : {}); // 0.1.0 の単一キーを引き継ぐ
  $("provider").value = local.provider || "typesafe";
  showProvider();
  const s = await chrome.storage.sync.get({ enabled: true, pillars: {}, rules: [], compare: {}, userSites: [], debug: false, dwell: 1.5, dailyCap: JEV_DAILY_CAP, excludeAuthors: [] });
  s.userSites.forEach(addSite);
  $("enabled").checked = s.enabled;
  $("debug").checked = !!s.debug;
  $("dwell").value = s.dwell;
  $("dailyCap").value = s.dailyCap;
  $("excludeAuthors").value = s.excludeAuthors.map((a) => "@" + a).join("\n");
  renderPillars(s.pillars);
  const cmp = { ...JEV_COMPARE.defaults, ...s.compare };
  $("cmpOn").checked = cmp.on;
  $("cmpHigh").value = cmp.high;
  s.rules.forEach(addRule);
}

$("add").onclick = () => addRule({});
// 「問いを試す」画面で採用すると rules が変わる。開いたままのこの画面で保存すると上書きして消してしまうので、読み直す
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "sync" || !ch.rules) return;
  const next = ch.rules.newValue || [];
  if (JSON.stringify(next) === JSON.stringify(collect().rules)) return; // この画面の保存
  $("rules").textContent = "";
  next.forEach(addRule);
  $("status").textContent = "ほかの画面で「自分で足す項目」が変わったので、読み直しました";
});
// 「AI に相談」: 画面上の今の値（保存前でも）で、オンの Jev の項目と自分で足した項目を並べる
$("consult").onclick = () => {
  const { pillars, rules, errors } = collect();
  $("consultErr").textContent = errors.join(" / ");
  if (errors.length) return;
  const items = Object.entries(JEV_PILLARS)
    .filter(([id, p]) => !p.code && pillars[id].on)
    .map(([id, p]) => ({ label: p.label, qs: p.qs.map((k) => JEV_QUESTIONS[k]), high: pillars[id].high, pct: null }))
    .concat(rules.map((r) => ({ label: JEV_PRESETS.find((p) => p.condition === r.condition)?.label || "自分で足した項目", qs: [r.condition], high: r.high, pct: null })));
  $("consultText").value = jevConsultPrompt({ items });
  $("consultText").readOnly = true; // 考えは AI に貼ってから書く（content.js と同じ）
  $("consultBox").hidden = false;
  $("consultStatus").textContent = "";
};
$("consultCopy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("consultText").value);
    $("consultStatus").textContent = "コピーしました";
  } catch {
    $("consultStatus").textContent = "コピーできませんでした。欄の中を全選択してコピーしてください";
  }
};
$("provider").onchange = showProvider;
$("apiKey").oninput = (e) => (apiKeys[$("provider").value] = e.target.value.trim());

$("test").onclick = async () => {
  const out = $("testResult");
  out.style.color = "#666";
  out.textContent = "確認中…";
  const res = await chrome.runtime.sendMessage({ type: "test", provider: $("provider").value, apiKey: $("apiKey").value.trim() });
  out.style.color = res.error ? "#c22" : "#2a7";
  out.textContent = res.error ? "失敗: " + res.error : `つながりました（${res.ms}ms）。保存を押すと使えます`;
};

$("save").onclick = async () => {
  const { pillars, rules, compare, userSites, excludeAuthors, debug, dwell, errors } = collect();
  const dailyCap = Number($("dailyCap").value);
  if (!(dwell >= 0.5 && dwell <= 5)) errors.push("判定までの待ち時間: 0.5〜5 秒にしてください");
  if (!(Number.isInteger(dailyCap) && dailyCap >= 1)) errors.push("1日の上限: 1 以上の整数にしてください");
  const st = $("status");
  if (errors.length) {
    st.className = "bad";
    st.textContent = errors.join(" / ");
    return;
  }
  try {
    await chrome.storage.local.set({ provider: $("provider").value, apiKeys });
    await chrome.storage.local.remove("apiKey");
    await chrome.storage.sync.set({ enabled: $("enabled").checked, pillars, rules, compare, userSites, excludeAuthors, debug, dwell, dailyCap, savedAt: Date.now() }); // savedAt: キーだけ変えたときも、ページ側に変更を知らせる
  } catch (e) {
    // sync は1項目 8KB まで。除外リストやサイト別の設定が長すぎると失敗する
    st.className = "bad";
    st.textContent = "保存できませんでした（設定が長すぎる可能性があります）: " + (e.message || e);
    return;
  }
  st.className = "";
  st.textContent = apiKeys[$("provider").value]
    ? "保存しました（開いているページにもすぐ反映）"
    : "保存しました。API キーが空なので、まだ動きません";
};

init();
