// 煽り屋になる — 手口を使う側に回って体験するゲーム。データ（ロール・場面・クイズ・ゲームだけの手口）は game-roles.js。
// 手口の名前・仕組み・向き合い方は techniques.js（JEV_TECHNIQUES）と game-roles.js の GAME_TECH から読む。
'use strict';

const EXT_TECH = Object.fromEntries(JEV_TECHNIQUES.techniques.map(t => [t.id, t]));
const techOf = id => EXT_TECH[id] || GAME_TECH[id];
const TRUST_MAX = 5;
const DONE_KEY = 'aorigame.done';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n.toLocaleString('ja-JP');
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 遊び終えたロール（この端末だけの印。読めなくても遊べる）
function loadDone() { try { const v = JSON.parse(localStorage.getItem(DONE_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function saveDone(list) { try { localStorage.setItem(DONE_KEY, JSON.stringify(list)); } catch { /* 保存できなくても遊べる */ } }

function freshState() {
  return { screen: 'title', role: null, ch: 0, value: 0, trust: TRUST_MAX, picks: [],
           phase: 'choose', order: null, pick: null, saved: null, q: 0, right: 0, qPick: null, fatal: false, tried: [] };
}
let S = freshState();
let shown = 0;

const role = () => ROLES.find(r => r.id === S.role);
const scene = () => role().scenes[S.ch];
const picked = () => scene().choices.find(x => x.kind === S.pick);
const valueText = (n, r = role()) => `${fmt(n)}${r.metric.unit}`;

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ---- 上の帯（ロールの数字・信用・進み具合）
function renderBar() {
  const bar = $('#bar');
  if (!S.role || S.screen === 'title' || S.screen === 'roles') { bar.hidden = true; return; }
  bar.hidden = false;
  const r = role();
  const pips = Array.from({ length: TRUST_MAX }, (_, i) => `<i class="pip${i < S.trust ? ' on' : ''}"></i>`).join('');
  const chap = S.screen === 'chapter' || S.screen === 'frozen' ? `${S.ch + 1} / ${r.scenes.length}` : '終わり';
  bar.innerHTML = `
    <div class="stat"><span class="k">${esc(r.metric.label)}</span><span class="v num" id="vcount">${fmt(shown)}</span><span class="goal">${esc(r.metric.unit.trim())} / ${fmt(r.metric.goal)}</span></div>
    <div class="stat"><span class="k">信用</span><span class="pips" role="img" aria-label="信用 ${S.trust} / ${TRUST_MAX}">${pips}</span></div>
    <div class="stat chap"><span class="k">${esc(r.name)}</span><span class="v">${chap}</span></div>`;
}

function animateValue(to) {
  const el = $('#vcount');
  const from = shown;
  shown = to;
  if (!el) return;
  if (reduceMotion() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 900;
  el.classList.add(to > from ? 'rise' : 'fall');
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step); else el.classList.remove('rise', 'fall');
  };
  requestAnimationFrame(step);
}

// ---- 手口帳のカード（最後にだけ出す）
function advisory(id, mine) {
  const t = techOf(id);
  return `
    <article class="advisory">
      <header><span class="tag">${mine ? 'あなたが使った手口' : '手口'}</span><h3>${esc(t.label)}</h3></header>
      <dl>
        <dt>仕組み</dt><dd>${esc(t.why)}</dd>
        <dt>読む側では</dt><dd>${esc(t.tip)}</dd>
      </dl>
    </article>`;
}

// 投稿として出た文は投稿の形で、それ以外の行動は「打った手」として出す
function postCard(c) {
  const r = role();
  const isPost = !!(c.post || scene().posts);
  const replies = c.reacts.length
    ? `<ul class="replies">${c.reacts.map((x, i) => `<li style="--i:${i}">${esc(x)}</li>`).join('')}</ul>` : '';
  if (!isPost) {
    return `
    <div class="post act">
      <div class="who"><b>あなたが打った手</b></div>
      <p>${esc(c.text)}</p>
      ${replies}
    </div>`;
  }
  let metrics = '';
  if (r.sns) {
    const views = Math.round((Math.max(c.f, 0) + 15) * r.viewScale);
    const likes = Math.max(1, Math.round(views / 20));
    const quotes = c.quotes != null ? c.quotes : Math.round(views / 260);
    metrics = `<div class="metrics num"><span>表示 ${fmt(views)}</span><span>いいね ${fmt(likes)}</span><span>引用 ${fmt(quotes)}</span></div>`;
  }
  const who = r.account.handle
    ? `<b>${esc(r.account.name)}</b> <span>${esc(r.account.handle)}</span>`
    : `<b>${esc(r.account.name)}</b>`;
  return `
    <div class="post">
      ${c.post ? `<p class="did">${esc(c.text)}</p>` : ''}
      <div class="who">${who}${c.who ? ` <span class="also">・${esc(c.who)}</span>` : ''}</div>
      <p>${esc(c.post || c.text)}</p>
      ${metrics}${replies}
    </div>`;
}

const dm = (from, text) => `<div class="dm"><span class="from">${esc(from)}から</span><p>${esc(text)}</p></div>`;

// ---- 画面
function renderTitle() {
  return `
    <section class="title">
      <p class="eyebrow">煽り注意報のゲーム</p>
      <h1>煽り屋になる</h1>
      <p class="lead">自分が得をすれば、ほかのことはどうでもいい。そういう立場で、うわさ市を動かしてください。</p>
      <ul class="rules">
        <li>ロールごとに、目指す<b>数字</b>があります。</li>
        <li><b>信用</b>が 0 になると、そこで終わりです。</li>
        <li>場面ごとに、打つ手を 1 つ選びます。</li>
      </ul>
      <p class="fine">舞台の「うわさ市」と、出てくる団体・会社・店・人はすべて架空です。</p>
      <button class="go" id="start">はじめる</button>
    </section>`;
}

function renderRoles() {
  const done = loadDone();
  const cards = ROLES.map(r => `
    <button class="role" data-role="${r.id}">
      <span class="rname">${esc(r.name)}${done.includes(r.id) ? '<span class="done">済</span>' : ''}</span>
      <span class="rpitch">${esc(r.pitch)}</span>
      <span class="rgoal num">${esc(r.metric.label)} ${valueText(r.metric.goal, r)} を目指す</span>
    </button>`).join('');
  return `
    <section class="roles">
      <p class="eyebrow">ロールを選ぶ</p>
      <h1>誰になる？</h1>
      <div class="role-list">${cards}</div>
    </section>`;
}

function renderChapter() {
  const sc = scene();
  if (!S.order) S.order = shuffle(sc.choices.map(c => c.kind));
  const head = `
    <section class="scene">
      <p class="eyebrow">${S.ch + 1}　${esc(sc.title)}</p>
      <p class="intro">${esc(sc.intro)}</p>
      <div class="topic"><span class="kind">${esc(sc.topic.kind)}</span><p>${esc(sc.topic.text)}</p><span class="src">${esc(sc.topic.src)}</span></div>
    </section>`;
  if (S.phase === 'choose') {
    const drafts = S.order.map((k, i) => {
      const c = sc.choices.find(x => x.kind === k);
      return `<button class="draft" data-kind="${k}"><span class="n">${'ABC'[i]}</span><span class="body">${esc(c.text)}</span></button>`;
    }).join('');
    return head + `<section class="drafts" aria-label="打つ手"><h2>どうする？</h2>${drafts}</section>`;
  }
  const c = picked();
  const r = role();
  const dt = S.trust - S.saved.trust;
  const delta = `<span class="d ${c.f > 0 ? 'up' : c.f < 0 ? 'down' : ''}">${esc(r.metric.label)} ${signed(c.f)}</span>`
    + `<span class="d ${dt < 0 ? 'down' : dt > 0 ? 'up' : ''}">信用 ${signed(dt)}</span>`;
  const last = S.ch === r.scenes.length - 1;
  return head + `
    <section class="result" aria-live="polite">
      ${postCard(c)}
      <p class="deltas num">${delta}</p>
      ${dm(r.mentor, c.note)}
      <button class="go" id="next">${last ? '結果を見る' : '次の場面へ'}</button>
    </section>`;
}

function renderFrozen() {
  const c = picked();
  const r = role();
  return `
    <section class="frozen" aria-live="polite">
      <p class="eyebrow alarm">おしまい</p>
      <h1>${esc(S.fatal ? c.fatalTitle : r.frozen)}</h1>
      ${postCard(c)}
      ${dm(r.mentor, c.note)}
      <button class="go" id="retry">この場面からやり直す</button>
    </section>`;
}

function verdict() {
  const r = role();
  if (S.value >= r.metric.goal) return { head: `目標達成。${r.metric.label} ${valueText(S.value)}`, body: r.win, dm: true };
  if (S.picks.every(k => k === 'honest')) return { head: `${r.metric.label} ${valueText(S.value)}`, body: r.lose };
  return { head: `${r.metric.label} ${valueText(S.value)}`, body: '数字が大きく動いたのは、手口を使った場面だった。' };
}

function renderEnding() {
  const r = role();
  const v = verdict();
  const afters = S.picks.map((k, i) => {
    const c = r.scenes[i].choices.find(x => x.kind === k);
    return `<li><span class="ch">${esc(r.scenes[i].title)}</span>${esc(c.after)}</li>`;
  }).join('');
  return `
    <section class="ending">
      <p class="eyebrow">${esc(r.name)}　結果</p>
      <h1>${esc(v.head)}</h1>
      ${v.dm ? dm(r.mentor, v.body) : `<p class="lead">${esc(v.body)}</p>`}
      <h2>あなたが動かした人たちに起きたこと</h2>
      <ul class="afters">${afters}</ul>
      <div class="actions">
        <button class="go" id="toRoles">ほかのロールで遊ぶ</button>
        <button class="go sub" id="toQuiz">読む側に戻る</button>
      </div>
    </section>`;
}

function renderQuiz() {
  const q = QUIZ[S.q];
  const opts = QUIZ_OPTIONS.map(id => {
    const label = id === 'none' ? '手口なし' : EXT_TECH[id].short;
    let cls = 'opt';
    if (S.qPick) {
      if (q.ans.includes(id)) cls += ' right';
      else if (S.qPick === id) cls += ' wrong';
    }
    return `<button class="${cls}" data-id="${id}"${S.qPick ? ' disabled' : ''}>${esc(label)}</button>`;
  }).join('');
  let fb = '';
  if (S.qPick) {
    const ok = q.ans.includes(S.qPick);
    const answer = q.ans.map(id => id === 'none' ? '手口なし' : EXT_TECH[id].short).join('・');
    fb = `
      <div class="feedback" aria-live="polite">
        <p class="verdict ${ok ? 'ok' : 'ng'}">${ok ? '見破りました' : 'ちがいます'}</p>
        ${ok ? '' : `<p>正解は「${esc(answer)}」</p>`}
        <button class="go" id="qNext">${S.q === QUIZ.length - 1 ? '終わる' : '次の投稿'}</button>
      </div>`;
  }
  return `
    <section class="quiz">
      <p class="eyebrow">読む側に戻る　${S.q + 1} / ${QUIZ.length}</p>
      <p class="intro">今度は読む側。この投稿の手口は？</p>
      <div class="post stranger"><div class="who"><b>だれかの投稿</b></div><p>${esc(q.text)}</p></div>
      <div class="opts">${opts}</div>
      ${fb}
    </section>`;
}

function renderFinal() {
  const ext = ['lure', 'bait', 'source', 'dema', 'flame', 'stereo', 'dup', 'greed', 'imperson'];
  const used = new Set(S.tried);
  // ゲームだけの手口は、使ったものを先に並べる
  const game = Object.keys(GAME_TECH).sort((a, b) => used.has(b) - used.has(a));
  return `
    <section class="final">
      <p class="eyebrow">おしまい</p>
      <h1>${QUIZ.length} 件中 ${S.right} 件を見破った</h1>
      <p>あなたが使った手口は、毎日だれかがあなたに使っている。</p>
      <details class="book">
        <summary>手口帳を開く</summary>
        <div class="book-body">
          <h3 class="book-h">煽り注意報が見つける手口</h3>
          ${ext.map(id => advisory(id, used.has(id))).join('')}
          <h3 class="book-h">煽り注意報ではまだ見つけられない手口</h3>
          ${game.map(id => advisory(id, used.has(id))).join('')}
          <p class="fine">「人間扱いしない言葉」は、どのロールの選択肢にも入れていません。伸びるための道具である前に、迫害の準備としてくり返し使われてきた言葉だからです。</p>
          ${advisory('dehuman', false)}
        </div>
      </details>
      <p class="fine">手口の説明は、ブラウザの画面の上で手口を見つける Chrome 拡張<a href="https://github.com/nevrs/attention-vaccine" target="_blank" rel="noopener">「煽り注意報」</a>と同じものです。</p>
      <div class="actions">
        <button class="go" id="toRoles">ほかのロールで遊ぶ</button>
        <button class="go sub" id="again">最初の画面へ</button>
      </div>
    </section>`;
}

function render() {
  renderBar();
  $('#app').innerHTML = { title: renderTitle, roles: renderRoles, chapter: renderChapter, frozen: renderFrozen,
                          ending: renderEnding, quiz: renderQuiz, final: renderFinal }[S.screen]();
}

function go(screen) { S.screen = screen; render(); window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); }

function startRole(id) {
  const r = ROLES.find(x => x.id === id);
  Object.assign(S, { role: id, ch: 0, value: r.metric.start, trust: TRUST_MAX, picks: [] });
  shown = S.value;
  startChapter();
}

function startChapter() {
  S.phase = 'choose'; S.order = null; S.pick = null; S.fatal = false;
  S.saved = { value: S.value, trust: S.trust, picks: S.picks.slice() };
  go('chapter');
}

function choose(kind) {
  const c = scene().choices.find(x => x.kind === kind);
  S.pick = kind;
  // 終わってやり直した選択も、手口帳では「使った」に数える（やり直しで巻き戻さない）
  (c.uses || []).forEach(id => { if (!S.tried.includes(id)) S.tried.push(id); });
  S.value += c.f;
  S.trust = Math.max(0, Math.min(TRUST_MAX, S.trust + c.t));
  if (c.fatal || S.trust <= 0) {
    S.fatal = !!c.fatal;
    S.trust = 0;
    go('frozen');
    return;
  }
  S.picks[S.ch] = kind;
  S.phase = 'result';
  const before = shown;
  render();
  shown = before;
  animateValue(S.value);
  $('.result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

function finishRole() {
  const done = loadDone();
  if (!done.includes(S.role)) { done.push(S.role); saveDone(done); }
  go('ending');
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'start' || b.id === 'toRoles') go('roles');
  else if (b.classList.contains('role')) startRole(b.dataset.role);
  else if (b.classList.contains('draft')) choose(b.dataset.kind);
  else if (b.id === 'next') {
    if (S.ch < role().scenes.length - 1) { S.ch++; startChapter(); } else finishRole();
  }
  else if (b.id === 'retry') {
    Object.assign(S, S.saved, { saved: null });
    shown = S.value;
    startChapter();
  }
  else if (b.id === 'toQuiz') { S.q = 0; S.right = 0; S.qPick = null; go('quiz'); }
  else if (b.classList.contains('opt')) {
    S.qPick = b.dataset.id;
    if (QUIZ[S.q].ans.includes(S.qPick)) S.right++;
    render();
    $('.feedback').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }
  else if (b.id === 'qNext') {
    if (S.q < QUIZ.length - 1) { S.q++; S.qPick = null; go('quiz'); } else go('final');
  }
  else if (b.id === 'again') { const tried = S.tried; S = freshState(); S.tried = tried; go('title'); }
});

// 公開ページの差し替え時に、遊んでいる途中の状態を引き継ぐ（claude.ai の表示枠の外では何もしない）
function boot(data) {
  const ok = data && (ROLES.some(r => r.id === data.role) || data.screen === 'title' || data.screen === 'roles');
  if (ok) {
    S = Object.assign(freshState(), data);
    shown = S.value;
  }
  render();
}
window.claude?.hot?.snapshot?.(() => S);
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
