// 判定項目。定義（問いの原文・手口の名前と説明・閾値・測った結果）はデータとして techniques.js にあり、ここはそれを
// 拡張の各所が使う形（JEV_QUESTIONS / JEV_PILLARS / JEV_PRESETS）に組み直すのと、コードで判定する部分を持つ。
// content.js・options.js・popup.js・background.js・demo.js・tune.js から読む（どこでも techniques.js → checks.js の順に読み込む）

const JEV_QUESTIONS = Object.fromEntries(Object.entries(JEV_TECHNIQUES.questions).map(([k, q]) => [k, q.text]));

// 1日の問い合わせ上限の初期値（設定画面で変えられる）。暴走で料金が膨らむのを止める
const JEV_DAILY_CAP = 2000;

// 手口の伝え方（2026-10-04、ユーザーと UI レビュー）: 名前は手口そのものを言う（作り手の用語や「×」を出さない）。
// 詳細は「手口の名前 → 仕組み（why）→ 向き合い方（tip）」の順。手口を知らせて、向き合い方を1つ添えると見抜く力が育つ（事前に手口を教える型の対策）。
// 確率・問いの原文は「詳しく」の中だけ（% をバッジに出すと「95% うそ」と読まれる）
const JEV_MARK = "手口"; // 印の頭に付ける語。‼️ は警報に見え、直感をあおる側の記号になるのでやめた

// 手口。qs が2つ以上なら確率を掛け合わせる。code があればコードで判定（Jev を呼ばない）
const JEV_PILLARS = Object.fromEntries(JEV_TECHNIQUES.techniques.map(({ id, notes, ...p }) => [id, p]));

// 利用者が手口ごとに保存する設定（on / high / action）は、初期値と違う項目だけを残す。
// 全部を保存すると、問いを測り直して初期値（閾値やオン・オフ）を変えても、一度保存した人には届かない（問いと閾値は組で測っている）
function jevPillarOverrides(id, cur) {
  const d = { action: "warn", ...JEV_PILLARS[id].defaults };
  return Object.fromEntries(Object.entries(cur).filter(([k, v]) => k in d && v !== d[k]));
}

// 設定画面の「自分で足す項目」のおすすめ。押すと condition と high が利用者の rules に写される。
// content.js は condition が一致すれば label を名前に使う。問いを変えたら、旧い文を old に残す（background.js が入れ替える）
const JEV_PRESETS = JEV_TECHNIQUES.presets.map(({ notes, ...p }) => p);

// 誘導の決まり文句（コードだけで判定）。強い言い回しは1つで、弱い言い回しは2つ以上で当たり。
// 弱いものを1つで当たりにすると普通の投稿にも付きすぎる。ふつうの動画にほぼ必ずある「チャンネル登録」は入れない。
// 言い回しを足すときは、普通の投稿に付かないかを確かめる（誤検知は印の信用を落とす）
const JEV_LURE = {
  // 強いほうは「外のページ・登録・DM へ連れ出す」言い回しそのもの。急かす・無料・限定の語は普通の投稿にも出るので弱いほうに置く。
  // 2026-10-10: 「今日だけは早めに寝ます」「質問があればDMください」「法テラスの無料相談」「友達追加できた」などが1つで当たっていた。
  // 確かめ方: python tools/lure_check.py（tools/eval/lure.json）
  strong: [
    /プロフ(ィール)?(の|に)?(リンク|URL)/,
    /(固定(ツイ|ポスト)|固ツイ)(の|に)?(リンク|URL)/,
    /(気になる|興味(が|の)?ある|知りたい|希望の?|稼ぎたい|欲しい)(方|人)(だけ)?(は|も)?、?(リプ(か|や|と))?(DM|LINE|プロフ|固定|固ツイ|リンク)/,
    /LINE(登録|追加|で受け取)|LINE@/,
    /(詳細|資料|方法|やり方|特典|マニュアル|リスト)(は|を)?DM|DMで(資料|詳細|特典|方法|やり方)/,
    /無料プレゼント/,
    /メルマガ(登録|で)/,
    /続きは(note|ノート|有料|リンク|プロフ)/,
    /(答え|方法|続き|詳細|全文|やり方)は(固定|固ツイ|プロフ|note|ノート)/,
    /(教え|お伝えし|お送りし|送り|配布し)ます[。、!！\s]*(DM|LINE)/,
  ],
  // 重なる言い回し（「詳しくは概要欄」と「概要欄」など）は長いほうを先に書く。JEV_CODE.lure が重なった分を数えない。
  // 拡散の呼びかけは弱いほう（2026-10-09）。迷子・災害・献血・告発の「拡散希望」にも付くため。
  // 「今すぐ」は行動の語が続くときだけ（「今すぐ帰りたい」「今すぐ見かけた方は連絡を」に付けない）。続く語は先読みにして、「無料診断」などと別に数える
  weak: [
    /拡散(希望|お願い|して(ください|下さい))|RT希望|リポスト希望/,
    /今だけ(?!ど)/, /今日だけ(の|限定)/, /本日限り/, /残り(わずか|僅か)/, /期間限定/,
    /今すぐ(?=登録|申し込|申込|購入|クリック|チェック|確認|LINE|DM|フォロー|無料|診断|相談|広め|拡散|シェア)/,
    /(?<=申し込み|申込|登録|購入|相談|予約)は(こちら|リンク|プロフ|DM|LINE)/,
    /詳しくは(こちら|リンク|概要欄)/, /概要欄/, /リンクから/, /続きはこちら/,
    /限定(公開|特典|配布)/, /特典/, /知らないと損/,
    /無料(配布|診断|相談|セミナー|講座|体験会)/, /先着\s*\d+\s*(名|人|様)/,
    /公式LINE/, /友(だち|達)追加/,
    /DM(ください|下さい|くれ|で(お送り|送ります|受付|受け付け))/,
    /固定(ツイ|ポスト)|固ツイ/, /プロフ(ィール)?(から|を?見て|をチェック)/,
  ],
};

// コードで判定する項目の関数。返り値は { hit, matches[] }
const JEV_CODE = {
  lure(text) {
    // 全角の英数字（「ＬＩＮＥ登録」「先着１００名」）も当たるよう、比べる前に表記をそろえる
    const t = text.normalize("NFKC");
    // 1つの言い回しを2回数えない（「詳しくは概要欄」が /詳しくは概要欄/ と /概要欄/ の両方に当たり、弱い2つで当たりになっていた）。
    // 既に数えた箇所と重なる当たりは捨てる。強い → 弱いの順、各リストは長い言い回しを先に書く
    const taken = [];
    const pick = (list) =>
      list.flatMap((re) => {
        for (const m of t.matchAll(new RegExp(re.source, "g"))) {
          const [s, e] = [m.index, m.index + m[0].length];
          if (taken.some(([a, b]) => s < b && a < e)) continue;
          taken.push([s, e]);
          return [m[0]];
        }
        return [];
      });
    const strong = pick(JEV_LURE.strong);
    const weak = pick(JEV_LURE.weak);
    return { hit: strong.length >= 1 || weak.length >= 2, matches: [...strong, ...weak] };
  },
};

// 同じ文言の大量投稿の比べ方（content.js が使う）。語尾や絵文字だけ違う投稿も同じとみなすため、
// 記号・絵文字・URL・空白を除いた本文を3文字ずつの切れ端にし、「短いほうの切れ端のうち、何割が相手にもあるか」で比べる。
// 全体に対する割合（Jaccard）だと、同じ文の後ろに銘柄名などを追記しただけで 0.57 まで下がり取りこぼした（2026-09-29）
const JEV_DUP = {
  minChars: 20, // 挨拶などを除いた残りがこれより短い投稿は比べない。短いと偶然一致する
  similar: 0.7, // これ以上なら同じ文言。実例の変種（語尾違い・途中違い・追記）は 0.74〜1.0、似た型の別文は 0.63
  minAuthors: 3, // 別々のアカウントがこれ以上そろったら当たり
  keep: 500, // 覚えておく投稿の数（古いものから忘れる）
  // ありふれた挨拶・お礼は、本当に同じ文なので比べ方では区別できない（挨拶どうしで 0.82〜1.0）。比べる前に取り除く
  stock: /おはようございます|おはよう|こんにちは|こんばんは|おやすみなさい|ありがとうございました|ありがとうございます|ありがとう|よろしくお願いいたします|よろしくお願いします|よろしく|お疲れ様です|おつかれさまです|おめでとうございます|今日も一日|良い一日を|素敵な一日を|頑張りましょう|フォロー|仲良くしてください|これから/g,
  normalize(text) {
    return text
      .normalize("NFKC")
      .replace(this.stock, "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
  },
  shingles(norm) {
    const s = new Set();
    for (let i = 0; i + 3 <= norm.length; i++) s.add(norm.slice(i, i + 3));
    return s;
  },
  similarity(a, b) {
    let inter = 0;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    for (const x of small) if (big.has(x)) inter++;
    return inter / (small.size || 1);
  },
};

// 一次ソース比較（オプション）。記事と論文の要旨を並べて1回で聞く。background.js が使う。
// 2026-09-28 の試験: ナゾロジー 0.89（やや誇張 55% / 大きく誇張 44%）、忠実な書き方 0.13、煽った書き方 0.97。
// 実在の記事は1本だけ。要旨にない数字は照合できず、数字の細かいずれ（4.0% → 40%）は Jev の苦手分野
const JEV_COMPARE = {
  distort: "【記事】は【元論文の要旨】の結論を誇張・歪曲している（効果の大きさを盛る、要旨にない主張を足す、見出しが要旨と食い違う）",
  level: "【記事】が【元論文の要旨】をどの程度正確に伝えているか",
  levels: ["正確", "やや誇張", "大きく誇張", "別物"],
  label: "元の研究を盛って伝えている",
  defaults: { on: false, high: 60 },
};

// 一次ソースとみなすリンク先。ホスト名の末尾一致（"go.jp" なら mhlw.go.jp も当たる）
const JEV_PRIMARY_HOSTS = [
  // 論文・プレプリント
  "doi.org", "arxiv.org", "biorxiv.org", "medrxiv.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
  "nature.com", "science.org", "sciencedirect.com", "link.springer.com", "onlinelibrary.wiley.com",
  "cell.com", "thelancet.com", "nejm.org", "jamanetwork.com", "bmj.com", "plos.org", "frontiersin.org",
  "mdpi.com", "psycnet.apa.org", "academic.oup.com", "tandfonline.com", "pnas.org", "journals.sagepub.com",
  "jstage.jst.go.jp", "cir.nii.ac.jp", "ssrn.com",
  // 公的機関・国際機関
  "go.jp", "e-stat.go.jp", "gov", "gov.uk", "europa.eu", "who.int", "un.org", "oecd.org", "imf.org", "worldbank.org",
];

const JEV_ACTION_LABEL = {
  warn: "印を付ける",
  blur: "印を付けて本文をぼかす（押すと表示）",
};

// 印の詳細に出す説明（content.js・demo.js で共通）。Jev は理由を返さないので、代わりに聞いた問いの原文を見せる
const JEV_PCT_NOTE = "数値は「この書き方に当てはまる」と Jev が見た確率です。内容が正しいかどうかの確率ではありません。";
const jevQuestionNote = (qs) => "判定に使った問い: " + qs.map((q) => `「${q}」`).join(" × ");

const JEV_MODES = { page: "ページ全体", block: "ブロックごと" };

// ページ側に入れるファイル。manifest には書かず、利用者が許可したサイトにだけ background.js が登録する（v0.17.0 で <all_urls> をやめた）
const JEV_CONTENT = { id: "jev", js: ["techniques.js", "checks.js", "sites.js", "content.js", "picker.js"], css: ["content.css"], runAt: "document_idle" };
// サイトの許可は http と https をまとめて、ホスト単位で求める（siteModes もホスト単位）
const jevSitePattern = (host) => `*://${host}/*`;

// 「AI に相談」: 利用者が好きな AI（ChatGPT など）に貼って、問いと閾値の直し方を相談するための文。
// 拡張の中で AI は使わない（理念）。AI は案と例文を出す係で、効くかどうかは Jev で測るまで分からない（2026-10-02 の調整の教訓）
// items: [{ label, qs: [問いの原文], high, pct（この件の値。無ければ null） }]、text: 相談したい文章（無ければ設定全体の相談）
const JEV_CONSULT_MAX = 2000; // 貼る本文の上限（字）
const JEV_DISAGREE_MAX = 50; // 「違うと思う」で手元に残す件数（古いものから消える）
function jevConsultPrompt({ items, text, mode }) {
  const row = (it) =>
    `- ${it.label}（閾値 ${it.high}${it.pct == null ? "" : `、この文章の値 ${it.pct.toFixed(0)}${it.pct >= it.high ? " → 印が付く" : ""}`}）\n  問い: ${it.qs.map((q) => `「${q}」`).join(" × ")}`;
  const body = text
    ? `## 相談したい文章（${JEV_MODES[mode] || ""}モードで判定）\n"""\n${text.slice(0, JEV_CONSULT_MAX)}${text.length > JEV_CONSULT_MAX ? "\n…（以下略）" : ""}\n"""\n\n` +
      `## この文章への判定\n${items.map(row).join("\n")}\n\n` +
      `## 利用者の考え\n【ここに書いてください: 付くべきでないのに付いた（誤検知）か、付くべきなのに付かなかった（取りこぼし）か。どの項目の、どこがおかしいと思うか】\n`
    : `## 今の判定項目\n${items.map(row).join("\n")}\n\n` +
      `## 利用者の考え\n【ここに書いてください: どの項目を、どう変えたいか。足したい手口があれば、その説明と実例】\n`;
  return `あなたは、Chrome 拡張「煽り注意報（Attention Vaccine）」の判定の問いと閾値を、利用者と一緒に調整する相談相手です。

## この拡張のしくみ
- 投稿や記事の文章を判定サービス Jev（TypeSafe の判定モデル）に送り、「この文章は次の問いに当てはまるか」を確率（0〜100）で答えさせる。Jev は文章を書かない判定専用のモデルで、理由は返さない。結果は問いの文面に強く左右される
- 確率が閾値以上なら「手口」の印を付けて、手口の名前・仕組み・向き合い方を伝える。内容の真偽は判定しない（「この書き方に当てはまるか」だけ）
- 問いが「×」で2つ並ぶ項目は、2つの確率を掛け合わせた値で判定する
- ブロックごとモードは SNS の投稿や見出しを1件ずつ、ページ全体モードは記事の本文を判定する
- 問いは日本語のまま、どの言語の文章にも使う（訳すと基準がずれた）
- 利用者が自分で項目（問いと閾値）を足せる。本体の項目の問いは、今は利用者が書き換えられない

## 理念
- 判断を押し付けず、読み手の直感（システム1）をハッキングする手口を感知して伝える。どの政治的立場・集団にもフラットに
- 誤検知は印の信用を落とす。取りこぼしと同じかそれ以上に重く見る

## これまでの調整で分かったこと
- 「〜を含む」と聞くと、それを否定・批判・報道する文や、冗談・感想まで高く出る。「〜を事実として述べている」「〜しようとしている」のように、書き手が何をしているかで聞くと絞れる
- 除外は「…は含まない」「…は、それだけでは含まない」と問いの中に書くと効く。括弧で具体例を添えると基準が安定する
- 旧の問いの末尾に除外を足すだけでは足りないことがある。問いの主語・動詞から書き直した案も出す
- 言い換えが効くかは測るまで分からない。もっともらしい案が外れることは多い

${body}
## お願い
1. 利用者の考えが書かれていなければ、まずそれを聞く。原因の見立てを短く述べる
2. 問いの言い換え案を 2〜3 個出す。今の問いが拾いたいもの（意図）は保つ
3. 測るための例文を出す。当てはまるべき文と当てはまるべきでない文を、それぞれ 10 本以上。相談の文章そのものと、紛らわしい文（境目の文）を多めに入れる。実際の投稿に近い自然な文にし、案が通りやすい例文に偏らせない。立場を入れ替えた組も入れる
4. 閾値は推測で決めない。利用者は、あなたの JSON を拡張の「問いを試す」画面に貼り、今の問いと案を例文すべてで Jev にかけて比べてから採用する。測った値が貼られたら、それを読んで次の案を出す
5. 最後に、次の形の JSON を1つだけ出す
{"target": "直したい項目の名前", "current": "今の問い", "candidates": ["案1", "案2"], "should_hit": ["…"], "should_not_hit": ["…"], "notes": "見立てと、測るときに見るべき点"}
`;
}
