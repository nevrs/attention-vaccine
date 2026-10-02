// 問いを試す: 「AI に相談」で AI が返した JSON（jevConsultPrompt の形）を、利用者のキーで Jev にかけて並べる。
// 問いの文面は測るまで効くか分からない（2026-10-02 の調整の教訓）。この画面は、その「測る」を利用者が自分でできるようにする段階 2
const $ = (id) => document.getElementById(id);
const MAX_CANDIDATES = 4;
const MAX_TEXTS = 60; // 例文の上限（1日の上限を食いつぶさない）
const MAX_LEN = 2000; // 1本・1問の上限（字）

let result = null; // { cols, rows, current }

// AI の答えは前後に説明や ``` が付きがちなので、最初の { から最後の } までを JSON として読む
function parse(raw) {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error("JSON が見つかりません");
  const j = JSON.parse(raw.slice(s, e + 1));
  const strs = (v, name, max) => {
    if (v == null) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`${name} は文字列の配列にしてください`);
    const out = [...new Set(v.map((x) => x.trim()).filter(Boolean))];
    if (out.some((x) => x.length > MAX_LEN)) throw new Error(`${name} に ${MAX_LEN} 字を超えるものがあります`);
    return out.slice(0, max);
  };
  const candidates = strs(j.candidates, "candidates", MAX_CANDIDATES);
  const current = typeof j.current === "string" ? j.current.trim().slice(0, MAX_LEN) : "";
  const hit = strs(j.should_hit, "should_hit", MAX_TEXTS);
  const not = strs(j.should_not_hit, "should_not_hit", MAX_TEXTS);
  if (!candidates.length && !current) throw new Error("candidates（案）がありません");
  if (!hit.length || !not.length) throw new Error("should_hit と should_not_hit の両方に例文が要ります（片側だけでは良し悪しが分かりません）");
  if (hit.length + not.length > MAX_TEXTS) throw new Error(`例文は合わせて ${MAX_TEXTS} 本までにしてください`);
  return { target: String(j.target || ""), notes: String(j.notes || ""), current, candidates, hit, not };
}

// 今の問いの閾値: 自分で足した項目か本体の項目に同じ文があれば、その閾値
async function currentHigh(q) {
  const { rules = [], pillars = {} } = await chrome.storage.sync.get(["rules", "pillars"]);
  const r = rules.find((r) => r.condition === q);
  if (r) return { high: r.high, kind: "rule" };
  for (const [id, p] of Object.entries(JEV_PILLARS)) {
    if (p.qs.length === 1 && JEV_QUESTIONS[p.qs[0]] === q) return { high: { ...p.defaults, ...(pillars[id] || {}) }.high, kind: "pillar", label: p.label };
  }
  return null;
}

// 当てはまるべき文の最小と、当てはまるべきでない文の最大。間が空いていれば、その真ん中を閾値の候補にする
function summarize(rows, ci) {
  const vals = (g) => rows.filter((r) => r.g === g && r.v[ci] != null).map((r) => r.v[ci]);
  const h = vals("hit");
  const n = vals("not");
  const hitMin = Math.min(...h);
  const notMax = Math.max(...n);
  const t = hitMin > notMax ? Math.round((hitMin + notMax) / 2) : null;
  const count = (arr, th) => arr.filter((x) => x >= th).length;
  return { hitMin, notMax, gap: hitMin - notMax, t, count, h, n };
}

const pct = (x) => (x == null ? "–" : x.toFixed(0));

$("run").onclick = async () => {
  $("msg").className = "";
  let spec;
  try {
    spec = parse($("input").value);
  } catch (e) {
    $("msg").className = "bad";
    $("msg").textContent = "読めませんでした: " + e.message;
    return;
  }
  if (!(await chrome.runtime.sendMessage({ type: "hasKey" }))?.has) {
    $("msg").className = "bad";
    $("msg").textContent = "API キーが未設定です。設定画面で入れてください";
    return;
  }
  const cols = [];
  if (spec.current) cols.push({ name: "今の問い", q: spec.current });
  spec.candidates.forEach((q, i) => q !== spec.current && cols.push({ name: `案${i + 1}`, q }));
  const texts = spec.hit.map((t) => ({ g: "hit", t })).concat(spec.not.map((t) => ({ g: "not", t })));
  $("run").disabled = true;
  let done = 0;
  let failed = 0;
  let lastError = "";
  $("msg").textContent = `測っています 0 / ${texts.length}`;
  const rows = await Promise.all(
    texts.map(async (x) => {
      const res = await chrome.runtime.sendMessage({ type: "judge", text: x.t, questions: cols.map((c) => c.q) }).catch((e) => ({ error: String(e.message || e) }));
      done++;
      if (res?.error) {
        failed++;
        lastError = res.error;
      }
      $("msg").textContent = `測っています ${done} / ${texts.length}`;
      return { ...x, v: cols.map((c) => (typeof res?.answers?.[c.q] === "number" ? res.answers[c.q] * 100 : null)) };
    }),
  );
  $("run").disabled = false;
  $("msg").className = failed ? "bad" : "";
  $("msg").textContent = failed ? `${failed} 本は測れませんでした（${lastError}）` : `${texts.length} 本を測りました`;
  const cur = spec.current ? await currentHigh(spec.current) : null;
  result = { cols, rows, cur, spec };
  render();
};

function render() {
  const { cols, rows, cur, spec } = result;
  $("out").hidden = false;
  $("notes").textContent = [spec.target && `直したい項目: ${spec.target}`, spec.notes && `AI の見立て: ${spec.notes}`].filter(Boolean).join(" ／ ");
  const sums = cols.map((_, i) => summarize(rows, i));
  const table = document.createElement("table");
  const tr = (cells, cls) => {
    const r = table.insertRow();
    if (cls) r.className = cls;
    for (const c of cells) {
      const td = r.insertCell();
      if (c && typeof c === "object") {
        if (c.cls) td.className = c.cls;
        if (c.node) td.append(c.node);
        else td.textContent = c.text;
      } else td.textContent = c ?? "";
    }
    return r;
  };
  // 見出し: 列ごとに問いの原文と、採用ボタン（閾値は候補を初期値に、変えられる）
  const head = table.createTHead().insertRow();
  head.append(Object.assign(document.createElement("th"), { textContent: "例文" }));
  cols.forEach((c, i) => {
    const th = document.createElement("th");
    th.append(c.name, Object.assign(document.createElement("div"), { className: "q", textContent: c.q }));
    if (c.name !== "今の問い") { // 今の問いは比べる基準。採用するのは案だけ
      const box = document.createElement("div");
      const high = Object.assign(document.createElement("input"), { type: "number", min: 0, max: 100, value: sums[i].t ?? cur?.high ?? 70, style: "width:4em" });
      const btn = Object.assign(document.createElement("button"), { className: "adopt", textContent: "この問いを採用" });
      btn.onclick = () => adopt(c.q, Number(high.value), btn);
      box.append("閾値 ", high, " % ", btn);
      th.append(box);
    }
    head.append(th);
  });
  const th = (g, label) => {
    tr([label, ...cols.map(() => "")], "grp");
    for (const r of rows.filter((r) => r.g === g)) {
      tr([r.t, ...r.v.map((v, i) => {
        const line = sums[i].t ?? cur?.high;
        return { text: pct(v), cls: "n" + (v != null && line != null && (g === "hit" ? v < line : v >= line) ? " over" : "") };
      })]);
    }
  };
  th("hit", "当てはまるべき文（高いほど良い）");
  th("not", "当てはまるべきでない文（低いほど良い）");
  tr(["当てはまるべき文の最小", ...sums.map((s) => ({ text: pct(s.hitMin), cls: "n" }))], "sum");
  tr(["当てはまるべきでない文の最大", ...sums.map((s) => ({ text: pct(s.notMax), cls: "n" }))], "sum");
  tr(["間の空き（大きいほど良い）", ...sums.map((s) => ({ text: pct(s.gap), cls: "n" }))], "sum");
  tr(["閾値の候補", ...sums.map((s) => ({ text: s.t == null ? "分かれない" : String(s.t), cls: "n" }))], "sum");
  if (cur) tr([`今の閾値 ${cur.high} での取りこぼし／誤検知`, ...sums.map((s) => ({ text: `${s.h.length - s.count(s.h, cur.high)} ／ ${s.count(s.n, cur.high)}`, cls: "n" }))], "sum");
  $("table").textContent = "";
  $("table").append(table);
  $("table").append(Object.assign(document.createElement("p"), {
    className: "hint",
    textContent: "色の付いたマスは、閾値の候補（無ければ今の閾値）で見て、取りこぼし（当てはまるべき文が下回る）か誤検知（当てはまるべきでない文が上回る）になるものです。例文が少ないうちは、閾値に余裕を持たせてください。",
  }));
}

// 採用: 今の問い（この画面で採用し直すときは、さっき採用した問い）と同じ文の「自分で足す項目」があれば置き換え、無ければ足す
async function adopt(q, high, btn) {
  if (!(high >= 0 && high <= 100)) return (btn.textContent = "閾値は 0〜100 に");
  const target = result.adopted ?? result.spec.current;
  const { rules = [] } = await chrome.storage.sync.get("rules");
  const same = target && rules.find((r) => r.condition === target);
  if (same) Object.assign(same, { condition: q, high });
  else rules.push({ id: crypto.randomUUID(), condition: q, high });
  await chrome.storage.sync.set({ rules });
  result.adopted = q;
  for (const b of document.querySelectorAll(".adopt")) Object.assign(b, { textContent: "この問いを採用", disabled: false });
  btn.textContent = same ? "置き換えました" : "足しました";
  btn.disabled = true;
}

// 測った結果を AI に返す（jevConsultPrompt のお願い 4「測った値が貼られたら、次の案を出す」）
$("copy").onclick = async () => {
  const { cols, rows } = result;
  const sums = cols.map((_, i) => summarize(rows, i));
  const lines = ["Jev で測った結果です（数値は当てはまる確率 %）。これを読んで、次の案を出してください。", ""];
  cols.forEach((c, i) => lines.push(`${c.name}: 「${c.q}」 → 当てはまるべき文の最小 ${pct(sums[i].hitMin)} / 当てはまるべきでない文の最大 ${pct(sums[i].notMax)}`));
  for (const [g, label] of [["hit", "当てはまるべき文"], ["not", "当てはまるべきでない文"]]) {
    lines.push("", `## ${label}（${cols.map((c) => c.name).join(" / ")}）`);
    for (const r of rows.filter((r) => r.g === g)) lines.push(`- ${r.v.map(pct).join(" / ")}  ${r.t.replace(/\s+/g, " ")}`);
  }
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    $("copyMsg").textContent = "コピーしました";
  } catch {
    $("copyMsg").textContent = "コピーできませんでした";
  }
};
