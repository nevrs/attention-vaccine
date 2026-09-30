// 主要サイトのおすすめ設定。content.js と popup.js から読む。
// 区切りの優先順位: 利用者が足した設定（userSites、同じ形）> ここの item > 自動検出。
//   item  … ブロックごとモードの「1件分」
//   text  … 1件の中で Jev に渡す部分（ユーザー名・時刻・いいね数などの部品を混ぜないため）。無ければ1件の全文
//   page  … ページ全体モードで判定する範囲。無ければ h1 を含む article → main → body
//   textFallback … text が見つからない件を全文で判定するか（既定は判定しない）
//   author … 1件の中の投稿者へのリンク。「同じ文言の大量投稿」で投稿者を数えるのに使う。無いサイトではその項目は動かない
//   markAt … ‼️ の位置（CSS）。既定は右上の角。サイト自身のボタンと重なるときに書く
//   cornerAt … 画面の隅の表示（読んだ件数・ページ全体の結果）の位置。既定は右下
//   mode  … ポップアップで「おすすめ」と表示するモード
//   checked … 実際のページで区切りを確かめた日。null はログインが必要などで未確認（広く知られた作りから書いた）
// 自動検出で足りるサイトはここに書かない（2026-09-28 確認: Yahoo!ニュースの一覧とコメント・知恵袋・note・Amazon・
// 東洋経済 76 件・はてなブックマーク 48 件・PRESIDENT 31 件）。
// 記事ページのページ全体モードは、文春・東洋経済・NHK・PRESIDENT で見出しから本文を取れた。
// 本文が 2000 字に満たない記事は、末尾に関連記事や記事下の広告（PR）が入る。
// 利用者が自分で足したサイト（userSites、ポップアップの区切り修正や設定画面から）は、ここより優先する。

const JEV_SITES = [
  {
    hosts: ["x.com", "twitter.com"],
    mode: "block",
    item: 'article[data-testid="tweet"]',
    text: '[data-testid="tweetText"]',
    author: '[data-testid="User-Name"] a[href^="/"]', // リンク先 /アカウント名 から取る
    // 右上の角には X の「Grok」「もっと見る」ボタン（上 12px・右端から 16〜62px）があるので、その左隣に置く
    markAt: "top:9px;right:72px",
    // 右下には X の「Grok」「メッセージ」の丸いボタンがあるので、右下の表示は左下に置く
    cornerAt: "right:auto;left:12px",
    checked: "2026-09-28", // ログイン済みのホームで確認（本文の中央値 51 字、画像だけの投稿は本文なし）
  },
  {
    hosts: ["bsky.app"],
    mode: "block",
    item: '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]',
    text: '[data-testid="postText"]',
    author: 'a[href^="/profile/"]', // リンク先 /profile/アカウント名 から取る
    checked: "2026-09-28", // 公開プロフィールで 48 件
  },
  {
    hosts: ["youtube.com"],
    mode: "block",
    // 検索結果・ホーム・関連動画・コメント。動画ページでは自動検出が関連動画の欄だけを拾うので、明示する
    item: "ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-comment-thread-renderer",
    text: "#video-title, #description-text, .metadata-snippet-text, #content-text, h3",
    page: "ytd-watch-metadata", // 動画のタイトルと説明文
    checked: "2026-09-28", // 検索結果と動画のコメント欄
  },
  {
    hosts: ["reddit.com"],
    mode: "block",
    item: "shreddit-post, shreddit-comment",
    text: '[slot="title"], [slot="text-body"], [slot="comment"]',
    checked: null, // 確認用のブラウザ操作ツールで開けなかった
  },
  // ---- 情報サイト。自動検出が「欄」（複数の記事を含む塊）を拾ってしまったもの ----
  // 自動検出を直す案（リンクの行き先の種類で減点・下限を下げる・同じ形の並びを合算）は、
  // 直すたびに Amazon・はてブ・livedoor のどれかが壊れたので採らず、サイトごとに書く（2026-09-28）
  {
    hosts: ["news.web.nhk", "www3.nhk.or.jp"],
    mode: "block", // 記事ページはページ全体
    // クラス名は自動生成（znan2av 等）で改版に弱い。記事ページへのリンクの形で拾う
    item: 'li:has(a[href*="/newsweb/na/"])',
    checked: "2026-09-28", // トップで 29 件
  },
  {
    hosts: ["bunshun.jp"],
    mode: "block",
    item: 'main li:has(a[href*="/articles/-/"]), main div.item:has(a[href*="/articles/-/"])',
    checked: "2026-09-28", // トップで 67 件（ヘッダーのメニューは除外）
  },
  {
    hosts: ["www.itmedia.co.jp"],
    mode: "block",
    item: "ul.c-article-row-list > li, ul.c-article-column-list > li",
    checked: "2026-09-28", // ITmedia NEWS トップで 23 件
  },
  {
    hosts: ["news.livedoor.com"],
    mode: "block",
    item: "ul.topicsList > li",
    checked: "2026-09-28", // トップで 108 件（見出しが平均 15 字と短く、自動検出の下限 20 字に届かない）
  },
  {
    hosts: ["news.yahoo.co.jp"],
    mode: "block", // 一覧とコメント欄。記事ページで使うならページ全体
    // 区切りは自動検出で足りる（コメント欄で 10 件）。コメント本文は段落だけ（「共感した」等のボタン文字を除く）。
    // クラス名は自動生成で改版に弱いので使わない。段落が無い一覧ページでは全文から部品を落とす
    text: "article p",
    page: "main article", // 記事ページ（ページ全体）。main のままだと下の関連動画・関連記事の見出しまで判定に入った（4937字 → 1185字）
    textFallback: true, // 本文の場所が無い件は全文で判定する（他のサイトは判定しない: 画像だけの投稿でユーザー名等を送らないため）
    checked: "2026-09-28",
  },
];

function hostMatches(hostname, hosts) {
  const h = hostname.replace(/^www\./, "");
  return hosts.some((d) => {
    d = d.replace(/^www\./, "");
    return h === d || h.endsWith("." + d);
  });
}

// 組み込みの設定に、利用者が足した設定（userSites）を項目ごとに上書きして返す。どちらも無ければ null
function jevSiteFor(hostname, userSites = []) {
  const builtin = JEV_SITES.find((s) => hostMatches(hostname, s.hosts));
  const user = userSites.find((s) => hostMatches(hostname, s.hosts || []));
  if (!builtin && !user) return null;
  const merged = { ...(builtin || {}) };
  for (const [k, v] of Object.entries(user || {})) if (v) merged[k] = v; // 空欄は組み込みを残す
  return merged;
}
