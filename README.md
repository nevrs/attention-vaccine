# 煽り注意報 (Aori Alert)

[日本語](#日本語) | [English](#english)

---

## 日本語

怒りや不安をあおって稼ぐ、炎上を狙う、根拠を示さずに言い切る。
読んでいる投稿や記事にこうした**手口**が使われていたら、‼️ で知らせる Chrome 拡張です。

- **知らせるのは手口だけ:** 投稿を隠したり、良し悪しを決めたりはしません。‼️ を押すと、どの手口に当たったか、なぜか、数値が出ます。
- **立場は見ない:** どの主張かではなく、書き方だけを見ます。
- **真偽は確かめていない:** 「根拠のない断定」は、根拠が示されていないという意味です。内容が誤りだという判定ではありません。
- **すべて自分で決められる:** 使うサイト、見つける手口、感度は設定で変えられます。

> **状態: 試作品（プロトタイプ）です。** 精度は、主に自作の例文と一部の実サイトでしか測っていません。
> 誤った ‼️ も、見逃しも起きます。

### しくみ

判定には [TypeSafe](https://typesafe.ai) の **Jev**（`jev-1.13.0`）を使います。
Jev は文章を書かない AI で、「この文は○○か」という問いに確率だけを返します。
確率が設定した感度を超えたときだけ ‼️ を付けます。
大きな言語モデル（LLM）は使いません。

| 手口 | 見かた | 初期値 |
|---|---|---|
| 煽って稼ぐ型 | 感情をあおる × 閲覧や購入に誘導する（Jev） | オン |
| 炎上狙い・挑発 | 反応を集めるための挑発や、集団をひとまとめにけなす書き方（Jev） | オン |
| 根拠のない断定 | 根拠を示さない断定、広く否定されている主張（Jev） | オン |
| 要一次ソース確認 | 数字や研究が元の情報源から切り離されている（Jev、記事ページのみ） | オン |
| 誘導の決まり文句 | 「プロフのリンクから」「先着○名」など（コードで判定、日本語のみ） | オン |
| 同じ文言の大量投稿 | ほぼ同じ文を別々のアカウントが投稿（コードで判定） | オン |

API キーが無くても、コードで判定する 2 項目だけで動きます。
キーを入れずに、体験ページ（`demo.html`）で見本を試すこともできます。

### 入れ方

1. このリポジトリを取得します（`git clone` するか、ZIP をダウンロードして展開）。
2. Chrome で `chrome://extensions` を開き、右上の「デベロッパーモード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を押し、このフォルダを選びます。
4. 設定画面で接続先を選び、自分の API キーを入れて保存します（TypeSafe 公式、または Vercel AI Gateway）。
5. 使いたいサイトを開き、拡張のアイコンから「ページ全体」（記事向け）か「ブロックごと」（タイムライン向け）を選びます。

### 送るもの・送らないもの（プライバシー）

- **どのサイトも、あなたがオンにするまで何も判定しません。**
- オンにしたサイトで、**画面に表示されて読んだ投稿の本文**（1 件最大 2000 字）を、あなたが選んだ接続先（TypeSafe または Vercel）に送ります。送るのは本文だけです。
- **DM・メール・チャットの画面は判定しないようにしています。** アドレスに `/messages`・`/inbox`・`/chat`・`/dm`・`/direct`・`/mail` を含む画面と、主なチャット・メールのサービス（Discord・Slack・Messenger・Teams・WhatsApp・Telegram・LINE・Gmail・Outlook など）が対象です。見分けは完全ではないので、**この一覧にないチャットやメールのサイトはオンにしないでください。**
- 「一次ソースと比較」（初期値オフ）をオンにすると、記事中の論文番号（DOI）を [OpenAlex](https://openalex.org) に送ります。
- 開発者のサーバーはありません。利用状況の収集もしていません。
- API キーはこのブラウザの中だけに保存されます（同期しません）。拡張のうちページの中で動く部分はキーを読まず、ページ側から読めないようにする設定もしています（この設定が実際の Chrome で効いているかは、まだ確かめていません）。
- 判定結果は、ブラウザを閉じると消えます。

### 費用

判定は、あなたの API キーで課金されます。TypeSafe の料金は入力 100 万トークンあたり $0.042 で、1 件あたり数百トークンです（2026-09 時点）。
使いすぎを防ぐため、1 日の問い合わせ回数に上限があります（初期値 2000 回。設定で変更できます）。

### 言語について

判定の問いは日本語で書いています。英語・中国語・韓国語・スペイン語の文章にも、日本語の問いのままで判定できることを確かめました。
自作の例文各 20 本で、狙った手口の検出は 12 本中 11〜12 本、当てはまらない文への誤った ‼️ は 0 件でした。

ただし、これで十分だとは考えていません。

- 試したのは、手口がはっきりした自作の例文だけです。実際の投稿での精度はまだ測っていません。
- 問いを各言語に訳した試験では、結果がかえってずれました。ただし訳したのは開発者で、その言語を母語とする人ではありません。
- **その言語を母語とする人が、それぞれの言語や文化に合わせて書いた問いのほうが、より正確に判定できる可能性があります。** あおり方・皮肉・挑発の型は、文化によって違うからです。
- 「誘導の決まり文句」は日本語の言い回しだけに対応しています。

各言語の問いや言い回しの提案、実際の投稿での検証結果を歓迎します。

### 使うときの注意

- ‼️ は機械による推定です。**相手を「デマ認定された」と責める根拠には使わないでください。**
- ‼️ が付かなくても、内容が正しい・安全だという意味ではありません。
- 同じ書き方なら、どの政治的立場の文章でも同じように判定されるかは、まだ測っていません。

### 詳しく

- 設計の考え方と実測値: [DESIGN.md](DESIGN.md)
- 開発の現在地: [SESSION.md](SESSION.md)

---

## English

A Chrome extension that shows ‼️ when a post or article you are reading uses a **manipulation technique**, such as stirring up anger or anxiety for profit, provoking a flame war, or making claims without evidence.

- **It points out the technique, nothing more:** it never hides posts or judges them good or bad. Click ‼️ to see which technique was detected, why, and the score.
- **It ignores viewpoints:** it looks only at how something is written, not at which side it supports.
- **It does not fact-check:** "Unsupported assertion" means no evidence was given. It does not mean the claim is false.
- **You are in control:** you choose the sites, the techniques to detect, and the sensitivity.

> **Status: prototype.** Accuracy has mainly been measured on hand-written examples and a few real sites.
> Expect both false ‼️ and misses.

### How it works

It uses **Jev** (`jev-1.13.0`) by [TypeSafe](https://typesafe.ai).
Jev is an AI model that does not generate text; it returns only a probability for questions like "Does this text do X?".
‼️ appears only when the probability exceeds your sensitivity setting.
No large language model (LLM) is used.

| Technique | How it is detected | Default |
|---|---|---|
| Emotional bait for profit | Stirs up emotions × drives views or purchases (Jev) | On |
| Flame bait / provocation | Provocation to farm reactions, sweeping put-downs of groups (Jev) | On |
| Unsupported assertion | Claims without evidence, widely debunked claims (Jev) | On |
| Check the primary source | Numbers or studies cut off from their original source (Jev, article pages only) | On |
| Lure phrases | "Link in bio", "first N people only", etc. (rule-based, **Japanese only**) | On |
| Copy-paste posting | Near-identical text posted by different accounts (rule-based) | On |

Without an API key, only the two rule-based checks run.
You can also try the demo page (`demo.html`) without a key.

### Install

1. Get this repository (`git clone`, or download the ZIP and extract it).
2. Open `chrome://extensions` in Chrome and turn on "Developer mode" (top right).
3. Click "Load unpacked" and select this folder.
4. In the options page, choose a provider and enter your own API key (TypeSafe or Vercel AI Gateway), then save.
5. Open a site and choose "Whole page" (for articles) or "Per block" (for timelines) from the extension icon.

The user interface is currently in Japanese only.

### What is sent, and what is not (privacy)

- **Nothing is analyzed on any site until you turn that site on.**
- On sites you turn on, **the text of posts you actually view** (up to 2,000 characters each) is sent to the provider you chose (TypeSafe or Vercel). Only the text is sent.
- **DM, mail, and chat pages are skipped.** This covers URL paths containing `/messages`, `/inbox`, `/chat`, `/dm`, `/direct`, or `/mail`, and major chat and mail services (Discord, Slack, Messenger, Teams, WhatsApp, Telegram, LINE, Gmail, Outlook, and others). Detection is not perfect, so **do not turn the extension on for any other chat or mail site.**
- If you turn on "Compare with the primary source" (off by default), the paper identifier (DOI) found in an article is sent to [OpenAlex](https://openalex.org).
- There is no developer server and no usage tracking.
- Your API key is stored only in this browser (not synced). The part of the extension that runs inside web pages never reads it, and storage is also configured to block access from web pages (whether this setting takes effect in real Chrome has not been verified yet).
- Results are cleared when you close the browser.

### Cost

Requests are billed to your own API key. TypeSafe charges $0.042 per million input tokens, and one check uses a few hundred tokens (as of 2026-09).
A daily request limit guards against runaway usage (2,000 by default, adjustable in the options page).

### Languages

The detection questions are written in Japanese. We confirmed that they still work, unchanged, on English, Chinese, Korean, and Spanish text.
On 20 hand-written examples per language, 11–12 of the 12 targeted techniques were detected, with 0 false ‼️ on the 8 neutral texts.

We do not consider this sufficient:

- Only clear-cut, hand-written examples were tested. Accuracy on real posts has not been measured.
- When the questions were translated into each language, the results drifted further. However, the translations were made by the developer, not by native speakers.
- **Questions written by native speakers and adapted to each language and culture may well be more accurate.** Styles of baiting, sarcasm, and provocation differ between cultures.
- "Lure phrases" covers Japanese expressions only.

Contributions of questions or phrase lists for other languages, and test results on real posts, are welcome.

### Please note

- ‼️ is a machine estimate. **Please do not use it as proof to accuse others of spreading misinformation.**
- No ‼️ does not mean the content is true or safe.
- Whether texts from different political positions, written in the same style, are judged equally has not been measured yet.

### More

- Design notes and measurements (Japanese): [DESIGN.md](DESIGN.md)
- Development status (Japanese): [SESSION.md](SESSION.md)
