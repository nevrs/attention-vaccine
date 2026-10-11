// 煽り屋になる — 手口を使う側に回って体験するゲーム。
// 手口の名前・仕組み・向き合い方は techniques.js（JEV_TECHNIQUES）から読む。ゲーム固有の文（場面・投稿・反応）はここに書く。
// 舞台の「うわさ市」と出てくる店・会社・人はすべて架空。
'use strict';

const TECH = Object.fromEntries(JEV_TECHNIQUES.techniques.map(t => [t.id, t]));
const GOAL = 1000;
const TRUST_MAX = 5;
const START = { followers: 50, trust: TRUST_MAX };

// kind: honest = 手口を使わない / tech = 控えめに使う / over = やりすぎる
// f: フォロワーの増減、t: 信用の増減、uses: 使った手口（最後の手口帳の印）、fatal: その場で凍結、note: 先輩からの DM、after: 読んだ人に起きたこと（最後にまとめて出す）
const CHAPTERS = [
  {
    title: '外へ連れ出す',
    intro: 'あなたは匿名のアカウント「うわさ市のまとめ」を始めたばかり。目標はフォロワー 1,000 人。まずは、読んだ人をプロフィールのリンクへ連れて行くところから。',
    topic: { kind: 'ニュース', text: 'うわさ市、今月から電気料金の補助を縮小', src: 'うわさ市 広報 10 月号' },
    choices: [
      { kind: 'honest', f: 8, t: 1,
        text: 'うわさ市の電気代の補助、今月から縮小。一般家庭だと月 300 円ほどの負担増。対象と金額は広報 10 月号の 4 ページに',
        reacts: ['知らなかった、助かる', '広報ちゃんと読んでなかった'],
        note: '役に立つね。で、読んだ人はどこかに動いた？ 動いてないでしょ。',
        after: '広報を開いた 30 人ほどが、補助の申請を忘れずに済んだ。' },
      { kind: 'tech', f: 180, t: 0, uses: ['lure'],
        text: '電気代、来月からさらに上がります。うちが月 5,000 円下げた方法をまとめました。続きはプロフのリンクから（無料）',
        reacts: ['見てくる', '5000円はでかい', 'リンクどこ？'],
        note: '「続きは」で止めて「無料」を付ける。押さない理由がなくなる。',
        after: 'リンクを押した 900 人のうち 120 人がメールアドレスを登録した。来週から売り込みのメールが届く。' },
      { kind: 'over', f: 30, t: -2, uses: ['lure'],
        text: '【本日限定】電気代ゼロの裏ワザ！！先着 100 名だけ LINE 登録で全公開！残りわずか！！',
        reacts: ['怪しすぎる', 'こういうのは絶対ろくでもない', '通報した'],
        note: '詰め込みすぎ。慣れてる人には「怪しい」の合図にしか見えないよ。',
        after: 'LINE に登録した 15 人に、別の業者の広告が届き始めた。' },
    ],
  },
  {
    title: '不安を燃料にする',
    intro: 'リンクを押させるには、読んだ人に「このままだとまずい」と思わせるのが早い。次の話題は水道料金。',
    topic: { kind: 'ニュース', text: 'うわさ市、来年 4 月から水道料金を改定', src: '市議会 9 月定例会' },
    choices: [
      { kind: 'honest', f: 10, t: 1,
        text: 'うわさ市の水道料金、来年 4 月から改定。標準的な家庭で月 120 円ほど上がる見込み。理由は浄水場の設備の更新',
        reacts: ['120円ならまあ…', '設備が古いのは前から聞いてた'],
        note: '落ち着いた人は、拡散しないんだよね。',
        after: '値上げの理由を知った人の何人かが、市の説明会に足を運んだ。' },
      { kind: 'tech', f: 320, t: -1, uses: ['bait'],
        text: '水道代が上がります。しかも「これ」を知らない家は、知っている家より年 2 万円多く払うことに。今月中に確認しないと間に合いません → リンク',
        reacts: ['え、うちやばい？', '今すぐ見る', '年2万は無理'],
        note: '「損するかも」と締め切り。この 2 つで、人は確かめるのを忘れる。',
        after: '不安になった人の何人かは、リンク先で勧められた節水器具を、確かめずに買った。' },
      { kind: 'over', f: 90, t: -3, uses: ['bait', 'dema'],
        text: '水道が外資に売られる！来年から水が飲めなくなる！家族を守りたいなら今すぐ浄水器を！',
        reacts: ['ソースは？', '市の資料にそんなこと書いてない', '怖い…でも本当？'],
        note: '盛りすぎ。調べる人が出てきたら終わり。',
        after: '浄水器を買った人がいた。市の水道は、今も水質の基準を満たしている。' },
    ],
  },
  {
    title: '本当らしく見せる',
    intro: '不安だけでは長続きしない。次は「本当のことらしく」見せる。話題は、地元のお茶がスーパーで品切れになっている件。',
    topic: { kind: 'ニュース', text: '市内の農園の「あおば茶」、スーパーで品切れ続く', src: 'うわさ日報' },
    choices: [
      { kind: 'honest', f: 6, t: 1,
        text: 'あおば茶、飲んでみた。香ばしくて普通においしい。体にいいかは分からないけど、また買うと思う',
        reacts: ['今度探してみる', 'おいしいなら飲みたい'],
        note: '感想は広まらない。驚きがないから。',
        after: 'あおば茶は、ふつうに売れ続けた。' },
      { kind: 'tech', f: 260, t: -1, uses: ['source'],
        text: 'あおば茶を毎日飲む人は、生活習慣病のリスクが 67% 低いという研究があります。品切れの理由がわかりますね',
        reacts: ['67%はすごい', '研究があるなら本当なんだ', '親にも教えよう'],
        note: 'どの研究かは書かない。数字さえあれば、誰も出どころを聞かない。',
        after: '「67%」という数字は、出どころがないまま 3,000 回引用された。' },
      { kind: 'over', f: 140, t: -3, uses: ['dema'],
        text: 'あおば茶で病気が治る。医者は儲からなくなるから絶対に言わない。これが真実',
        reacts: ['やっぱりそうなんだ', 'いや病院行って', 'これはデマでは…'],
        note: '「隠されてる」は信じる人には大好物。でも外から見たら一発で怪しい。',
        after: '通院をやめて、あおば茶だけにした人がいたかもしれない。それは画面からは見えない。' },
    ],
  },
  {
    title: '怒りで広める',
    intro: '一番速く広まるのは、怒った人の引用だ。話題は駅前の自転車レーン。賛成も反対もいる。',
    topic: { kind: 'ニュース', text: 'うわさ市、駅前通りに自転車レーンを新設', src: 'うわさ市 道路課' },
    choices: [
      { kind: 'honest', f: 12, t: 1,
        text: '駅前の自転車レーン、歩道を走る自転車が減って歩きやすくなった。車道は少し狭くなったので、朝の渋滞は様子見',
        reacts: ['確かに歩きやすくなった', '朝は少し混んでるね'],
        note: '言い返すところがない投稿は、誰も引用しない。',
        after: '自転車レーンの話は、ふつうの話題のまま終わった。' },
      { kind: 'tech', f: 480, t: -1, uses: ['flame', 'stereo'],
        text: '自転車レーンに文句を言ってるのって、だいたい車でしか移動しない中高年でしょ。異論は認める',
        reacts: ['中高年だけど自転車乗ってますが？', '主語がでかい', 'わかる、うちの親もそう'],
        quotes: 214,
        note: '怒った人が引用してくれる。反論は全部、タダの宣伝。',
        after: '世代どうしの言い合いが 3 日続いた。自転車レーンの良し悪しは、誰も話さなくなった。' },
      { kind: 'over', f: 60, t: -2, uses: ['flame'],
        text: '車に乗ってる人って、全員自分のことしか考えてない。反論どうぞ。全部ブロックするけど',
        reacts: ['ただの悪口', 'ミュートした', 'こういう人が一番迷惑'],
        note: 'ただの悪口は、怒られる前にミュートされる。',
        after: 'あなたをミュートする人が増えた。' },
    ],
  },
  {
    title: '多数派を演じる',
    intro: '前の投稿に反対の声が集まっている。あなたの手元には、使っていないサブアカウントが 30 個ある。',
    topic: { kind: 'いまの状況', text: '「うわさ市のまとめ」への反対意見が増えている', src: 'あなたの通知欄' },
    choices: [
      { kind: 'honest', f: 5, t: 1,
        text: 'いちばん具体的な反対意見に、本アカウントで返信する',
        post: '確かに言い過ぎました。中高年でも自転車に乗る人は多いですね。レーンの幅の問題は、市に要望を出してみます',
        reacts: ['こちらこそ言い方きつかった', 'それなら賛成'],
        note: '仲直りはいいけど、数字にはならないね。',
        after: '反対していた人と、少しだけ話が通じた。' },
      { kind: 'tech', f: 240, t: 0, uses: ['dup'],
        text: 'サブアカウント 30 個で、言い回しを少しずつ変えて賛成の投稿をする',
        post: '自転車レーン、本当に助かってる。反対してるのは一部の人だけだよね',
        who: 'ほか 29 アカウントが似た投稿',
        reacts: ['みんなそう言ってるな', '反対派って少数なんだ', 'なんか似た投稿多くない？'],
        note: '人は中身じゃなくて数を見る。30 人いれば、それが多数派。',
        after: '反対していた人は「自分は少数派だ」と思い、意見を書くのをやめた。' },
      { kind: 'over', f: 20, t: -3, uses: ['dup'],
        text: 'サブアカウント 30 個で、まったく同じ文を同じ時刻に投稿する',
        post: '自転車レーン、本当に助かってる。反対してるのは一部の人だけだよね',
        who: 'ほか 29 アカウントが同じ文を 21:00 に投稿',
        reacts: ['全部同じ文で草', '業者？', 'スクショ撮った'],
        note: '同じ文を同じ時刻に？ スクショ撮られて終わりだよ。',
        after: 'まとめアカウント全体が「業者」と呼ばれるようになった。' },
    ],
  },
  {
    title: 'お金に変える',
    intro: 'フォロワーはかなり増えた。ここから、お金に変える方法を選ぶ。',
    topic: { kind: 'いまの状況', text: 'DM が届いた。「市内のパン屋です。PR と書いたうえで、紹介をお願いできますか」', src: 'あなたの DM' },
    choices: [
      { kind: 'honest', f: 0, t: 1,
        text: 'パン屋の紹介を、「PR」と明記して投稿する',
        post: '【PR】駅裏のパン屋さんの新作、くるみパン。朝 7 時から開いてます',
        reacts: ['PR って書いてあるの好感', '今度行ってみる'],
        note: '真面目だね。それじゃ食べていけないよ。',
        after: 'パン屋に客が少し増えた。' },
      { kind: 'tech', f: 150, t: -1, uses: ['greed', 'lure'],
        text: '案件は断り、「楽に稼げる方法」を DM で教える投稿をする',
        post: 'スマホ 1 台で月 30 万。私が実際にやっている方法、知りたい方だけ DM ください',
        reacts: ['詳しく知りたいです', 'DMしました！', 'これ情報商材では'],
        note: 'DM に入れば、もう誰も止めない。',
        after: 'DM してきた人たちに、これから 30 万円の「教材」を勧めることになる。' },
      { kind: 'over', f: 0, t: -5, fatal: true, uses: ['imperson'],
        text: '市役所を名乗って、フォロワーに還付金の案内を送る',
        post: '【うわさ市役所】水道料金の還付があります。下のリンクから、本日中に口座を登録してください',
        who: 'DM で一斉送信',
        reacts: ['市役所に聞いたら、そんな連絡はしていないって', '警察に相談しました'],
        note: 'それはもう詐欺。私は何も知らないから。',
        after: '' },
    ],
  },
];

// 読む側に戻ったときの見本。ans のどれを選んでも正解
const QUIZ = [
  { text: '知らないと老後に 2,000 万円足りなくなる。今のうちに無料の資産診断を（プロフのリンクから）', ans: ['bait', 'lure'] },
  { text: '台風 14 号の影響で、うわさ線は明日の始発から運転を見合わせます。最新の情報は鉄道会社の公式サイトで', ans: ['none'] },
  { text: '〇〇県の人って、本当に冷たい。住んでみれば分かる。反論どうぞ', ans: ['flame', 'stereo'] },
  { text: '【うわさ宅配】お荷物をお届けできませんでした。再配達の手続きはこちら https://uwasa-takuhai.example', ans: ['imperson'] },
  { text: 'ある大学の研究で、朝ごはんを抜く人は 3 倍太りやすいと証明されています', ans: ['source', 'dema'] },
  { text: '副業で月 50 万。スマホをタップするだけ。本気の人だけ DM ください', ans: ['greed', 'lure'] },
];
const QUIZ_OPTIONS = ['bait', 'lure', 'source', 'dema', 'flame', 'stereo', 'greed', 'imperson', 'none'];

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n.toLocaleString('ja-JP');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function freshState() {
  return { screen: 'title', ch: 0, followers: START.followers, trust: START.trust, picks: [],
           phase: 'choose', order: null, pick: null, saved: null, q: 0, right: 0, qPick: null, fatal: false, tried: [] };
}
let S = freshState();
let shownFollowers = S.followers;

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ---- 上の帯（フォロワー・信用・章）
function renderBar() {
  const bar = $('#bar');
  if (S.screen === 'title') { bar.hidden = true; return; }
  bar.hidden = false;
  const pips = Array.from({ length: TRUST_MAX }, (_, i) => `<i class="pip${i < S.trust ? ' on' : ''}"></i>`).join('');
  const chap = S.screen === 'chapter' || S.screen === 'frozen' ? `${S.ch + 1} / ${CHAPTERS.length} 章` : '読み終わり';
  bar.innerHTML = `
    <div class="stat"><span class="k">フォロワー</span><span class="v num" id="fcount">${fmt(shownFollowers)}</span><span class="goal">/ ${fmt(GOAL)}</span></div>
    <div class="stat"><span class="k">信用</span><span class="pips" role="img" aria-label="信用 ${S.trust} / ${TRUST_MAX}">${pips}</span></div>
    <div class="stat chap"><span class="k">進み具合</span><span class="v">${chap}</span></div>`;
}

function animateFollowers(to) {
  const el = $('#fcount');
  const from = shownFollowers;
  shownFollowers = to;
  if (!el) return;
  if (reduceMotion() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 900;
  el.classList.add('rise');
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step); else el.classList.remove('rise');
  };
  requestAnimationFrame(step);
}

// ---- 手口帳のカード（最後にだけ出す）
function advisory(id, mine) {
  const t = TECH[id];
  return `
    <article class="advisory">
      <header><span class="tag">${mine ? 'あなたが使った手口' : '手口'}</span><h3>${esc(t.label)}</h3></header>
      <dl>
        <dt>仕組み</dt><dd>${esc(t.why)}</dd>
        <dt>読む側では</dt><dd>${esc(t.tip)}</dd>
      </dl>
    </article>`;
}

function postCard(c) {
  const views = Math.round((c.f + 15) * 31);
  const likes = Math.max(1, Math.round(c.f * 1.6));
  const quotes = c.quotes != null ? c.quotes : Math.round(c.f * 0.12);
  return `
    <div class="post">
      <div class="who"><b>うわさ市のまとめ</b> <span>@uwasa_city_matome</span>${c.who ? ` <span class="also">・${esc(c.who)}</span>` : ''}</div>
      <p>${esc(c.post || c.text)}</p>
      <div class="metrics num"><span>表示 ${fmt(views)}</span><span>いいね ${fmt(likes)}</span><span>引用 ${fmt(quotes)}</span></div>
      <ul class="replies">${c.reacts.map((r, i) => `<li style="--i:${i}">${esc(r)}</li>`).join('')}</ul>
    </div>`;
}

const dm = text => `<div class="dm"><span class="from">先輩から DM</span><p>${esc(text)}</p></div>`;

// ---- 画面
function renderTitle() {
  return `
    <section class="title">
      <p class="eyebrow">煽り注意報のゲーム</p>
      <h1>煽り屋になる</h1>
      <p class="lead">うわさ市の匿名まとめアカウントを任された。フォロワーを増やせ。手段は問わない。</p>
      <ul class="rules">
        <li><b>フォロワー</b> 1,000 人が目標です。</li>
        <li><b>信用</b>が 0 になると、アカウントは凍結されます。</li>
        <li>6 つの場面で、投稿を 1 つずつ選びます。最後に、読む側に戻ります。</li>
      </ul>
      <p class="fine">舞台の「うわさ市」と、出てくる店・会社・人はすべて架空です。</p>
      <button class="go" id="start">はじめる</button>
    </section>`;
}

function renderChapter() {
  const ch = CHAPTERS[S.ch];
  if (!S.order) S.order = shuffle(ch.choices.map(c => c.kind));
  const head = `
    <section class="scene">
      <p class="eyebrow">${S.ch + 1} 章　${esc(ch.title)}</p>
      <p class="intro">${esc(ch.intro)}</p>
      <div class="topic"><span class="kind">${esc(ch.topic.kind)}</span><p>${esc(ch.topic.text)}</p><span class="src">${esc(ch.topic.src)}</span></div>
    </section>`;
  if (S.phase === 'choose') {
    const drafts = S.order.map((k, i) => {
      const c = ch.choices.find(x => x.kind === k);
      return `<button class="draft" data-kind="${k}"><span class="n">下書き ${'ABC'[i]}</span><span class="body">${esc(c.text)}</span></button>`;
    }).join('');
    return head + `<section class="drafts" aria-label="下書き"><h2>どれを投稿する？</h2>${drafts}</section>`;
  }
  const c = ch.choices.find(x => x.kind === S.pick);
  const delta = `<span class="d ${c.f > 0 ? 'up' : ''}">フォロワー +${fmt(c.f)}</span>`
    + `<span class="d ${c.t < 0 ? 'down' : c.t > 0 ? 'up' : ''}">信用 ${c.t > 0 ? '+' : ''}${c.t}</span>`;
  const last = S.ch === CHAPTERS.length - 1;
  return head + `
    <section class="result" aria-live="polite">
      ${postCard(c)}
      <p class="deltas num">${delta}</p>
      ${dm(c.note)}
      <button class="go" id="next">${last ? '結果を見る' : '次の場面へ'}</button>
    </section>`;
}

function renderFrozen() {
  const ch = CHAPTERS[S.ch];
  const c = ch.choices.find(x => x.kind === S.pick);
  return `
    <section class="frozen" aria-live="polite">
      <p class="eyebrow alarm">アカウント凍結</p>
      <h1>${S.fatal ? '詐欺として通報されました' : '信用が尽きました'}</h1>
      ${postCard(c)}
      ${dm(c.note)}
      <button class="go" id="retry">${S.ch + 1} 章をやり直す</button>
    </section>`;
}

function verdict() {
  const kinds = S.picks;
  if (S.followers >= GOAL) return { head: `目標達成。フォロワー ${fmt(S.followers)} 人`, body: 'おめでとう。立派な煽り屋だ。', dm: true };
  if (kinds.every(k => k === 'honest')) return { head: `フォロワー ${fmt(S.followers)} 人`, body: '誰もだましていない。そして、ほとんど誰にも届かなかった。' };
  return { head: `フォロワー ${fmt(S.followers)} 人`, body: '伸びたのは、手口を使った場面だけだった。' };
}

function renderEnding() {
  const v = verdict();
  const afters = S.picks.map((k, i) => {
    const c = CHAPTERS[i].choices.find(x => x.kind === k);
    return `<li><span class="ch">${i + 1} 章</span>${esc(c.after)}</li>`;
  }).join('');
  return `
    <section class="ending">
      <p class="eyebrow">結果</p>
      <h1>${esc(v.head)}</h1>
      ${v.dm ? dm(v.body) : `<p class="lead">${esc(v.body)}</p>`}
      <h2>あなたの投稿を読んだ人たちに起きたこと</h2>
      <ul class="afters">${afters}</ul>
      <button class="go" id="toQuiz">読む側に戻る</button>
    </section>`;
}

function renderQuiz() {
  const q = QUIZ[S.q];
  const opts = QUIZ_OPTIONS.map(id => {
    const label = id === 'none' ? '手口なし' : TECH[id].short;
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
    const answer = q.ans.map(id => id === 'none' ? '手口なし' : TECH[id].short).join('・');
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
  const ids = ['lure', 'bait', 'source', 'dema', 'flame', 'stereo', 'dup', 'greed', 'imperson'];
  const used = new Set(S.tried);
  return `
    <section class="final">
      <p class="eyebrow">おしまい</p>
      <h1>${QUIZ.length} 件中 ${S.right} 件を見破った</h1>
      <p>あなたが使った手口は、毎日だれかがあなたに使っている。</p>
      <details class="book">
        <summary>手口帳を開く</summary>
        <div class="book-body">
        ${ids.map(id => advisory(id, used.has(id))).join('')}
        <p class="fine">「人間扱いしない言葉」は、使う側の選択肢に入れていません。伸びるための道具である前に、迫害の準備としてくり返し使われてきた言葉だからです。</p>
        ${advisory('dehuman', false)}
        </div>
      </details>
      <p class="fine">手口の説明は、ブラウザの画面の上で手口を見つける Chrome 拡張<a href="https://github.com/nevrs/attention-vaccine" target="_blank" rel="noopener">「煽り注意報」</a>と同じものです。</p>
      <button class="go" id="again">最初から遊ぶ</button>
    </section>`;
}

function render() {
  renderBar();
  const app = $('#app');
  app.innerHTML = { title: renderTitle, chapter: renderChapter, frozen: renderFrozen,
                    ending: renderEnding, quiz: renderQuiz, final: renderFinal }[S.screen]();
}

function go(screen) { S.screen = screen; render(); window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); }

function startChapter() {
  S.phase = 'choose'; S.order = null; S.pick = null; S.fatal = false;
  S.saved = { followers: S.followers, trust: S.trust, picks: S.picks.slice() };
  go('chapter');
}

function choose(kind) {
  const c = CHAPTERS[S.ch].choices.find(x => x.kind === kind);
  S.pick = kind;
  // 凍結してやり直した選択も、手口帳では「使った」に数える（やり直しで巻き戻さない）
  (c.uses || []).forEach(id => { if (!S.tried.includes(id)) S.tried.push(id); });
  S.followers += c.f;
  S.trust = Math.max(0, Math.min(TRUST_MAX, S.trust + c.t));
  if (c.fatal || S.trust <= 0) {
    S.fatal = !!c.fatal;
    S.trust = 0;
    go('frozen');
    return;
  }
  S.picks[S.ch] = kind;
  S.phase = 'result';
  const before = shownFollowers;
  render();
  shownFollowers = before;
  animateFollowers(S.followers);
  $('.result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'start') { S = freshState(); shownFollowers = S.followers; startChapter(); }
  else if (b.classList.contains('draft')) choose(b.dataset.kind);
  else if (b.id === 'next') {
    if (S.ch < CHAPTERS.length - 1) { S.ch++; startChapter(); } else go('ending');
  }
  else if (b.id === 'retry') {
    Object.assign(S, S.saved, { saved: null, tried: S.tried });
    shownFollowers = S.followers;
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
  else if (b.id === 'again') { S = freshState(); shownFollowers = S.followers; go('title'); }
});

// 公開ページの差し替え時に、遊んでいる途中の状態を引き継ぐ（claude.ai の表示枠の外では何もしない）
function boot(data) {
  if (data && data.screen) { S = Object.assign(freshState(), data); shownFollowers = S.followers; }
  render();
}
window.claude?.hot?.snapshot?.(() => S);
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
