# Attention Vaccine（煽り注意報）

[日本語](#日本語) | [English](#english)

---

## 日本語

英語名は Attention Vaccine です（日本語の Chrome では「煽り注意報」と表示されます）。

怒りや不安をあおって稼ぐ、炎上を狙う、根拠を示さずに言い切る。
読んでいる投稿や記事にこうした**手口**が使われていたら、‼️ で知らせる Chrome 拡張です。

- **知らせるのは手口だけ:** 投稿を隠したり、良し悪しを決めたりはしません。‼️ を押すと、どの手口に当たったか、なぜか、数値が出ます。
- **立場は見ない:** どの主張かではなく、書き方だけを見ます。
- **真偽は確かめていない:** 「根拠のない断定」は、根拠が示されていないという意味です。内容が誤りだという判定ではありません。
- **すべて自分で決められる:** 使うサイト、見つける手口、感度は設定で変えられます。

### 願い

私がこの拡張機能を作ったのは、政治的な立場を超えて、人々がアテンションエコノミー（人の注目を奪い合って稼ぐ仕組み）などが引き起こす瞬間的な感情に突き動かされることへの、免疫として働いてほしいと願ったからです。

開発者の私はエンジニアではありません。この拡張機能は、ほぼすべてを AI（Claude Opus 5.5）と相談しながら作りました。エンジニアの方による修正や改善を心から歓迎します。

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
| 集団へのレッテル貼り | 国籍・性別・世代・立場などの集団の全員に、性質を決めつける（好意的な決めつけも含む。Jev、高度な設定） | オフ |

API キーが無くても、コードで判定する 2 項目だけで動きます。
キーを入れずに、体験ページ（`demo.html`）で見本を試すこともできます。

### 入れ方

Chrome ウェブストアには、まだ出していません。次の手順で、手元のファイルから入れます（Windows・Mac とも同じです）。

**1. ファイルを取得する**
1. このページの上にある緑の「Code」ボタンを押し、「Download ZIP」を選びます。
2. ダウンロードした ZIP ファイルを展開（解凍）します。
3. 展開してできたフォルダ（`attention-vaccine-main`）を、消さない場所に移します（例: ドキュメント）。**このフォルダを消したり動かしたりすると、拡張機能が動かなくなります。**

`git` を使える人は、`git clone https://github.com/nevrs/attention-vaccine.git` でも構いません。

**2. Chrome に読み込む**
1. Chrome のアドレス欄に `chrome://extensions` と入れて開きます。
2. 右上の「デベロッパー モード」をオンにします。
3. 左上に出る「パッケージ化されていない拡張機能を読み込む」を押します。
4. 手順 1 のフォルダ（中に `manifest.json` があるフォルダ）を選びます。
5. 一覧に「煽り注意報」が出れば完了です（Chrome の表示言語が日本語以外なら「Attention Vaccine」と出ます）。体験ページが自動で開きます。キーなしで、どんな表示になるかを試せます。
6. アドレス欄の右にあるパズルのピースのアイコンを押し、「煽り注意報」のピンを押すと、アイコンが常に表示されて使いやすくなります。

**3. API キーを入れる**（キーなしでも、コードで判定する 2 項目だけは動きます）
1. 次のどちらかで API キーを発行します。どちらも料金はあなたのアカウントに請求されます（下の「費用」を参照）。
   - **TypeSafe（公式）:** [console.typesafe.ai](https://console.typesafe.ai/settings/keys) でアカウントを作り、キーを発行します（順番待ちがあることがあります）。
   - **Vercel AI Gateway:** Vercel のダッシュボードで「AI Gateway」→「API Keys」からキーを発行します。
2. 拡張のアイコンを押し、「設定を開く」を押します。
3. 「接続先」でキーを発行した先を選び、「API キー」の欄にキーを貼り付けます。
4. 「接続テスト」を押し、「つながりました」と出るのを確かめます。
5. 画面下の「保存」を押します。

**4. 使うサイトを選ぶ**

初期状態では、どのサイトでも何もしません。使いたいサイトごとにオンにします。
1. 判定したいサイト（X、ニュースサイトなど）を開きます。
2. 拡張のアイコンを押し、次のどちらかを選びます。
   - **ページ全体:** ニュース記事やブログなど、1 ページに 1 本の文章があるページ向け。画面の右下に結果が 1 つ出ます。
   - **ブロックごと:** X のタイムラインや検索結果など、投稿が並ぶページ向け。手口が見つかった投稿の右上に ‼️ が付きます。
3. ‼️ を押すと、見つかった手口の名前・理由・数値が出ます。
4. やめるときは、同じ画面で「オフ」を選びます。

**更新するとき**

新しい ZIP をダウンロードし、前のフォルダの中身を置き換えます。そのあと `chrome://extensions` で「煽り注意報」の更新ボタン（丸い矢印）を押します。設定と API キーは残ります。

**外すとき**

`chrome://extensions` で「煽り注意報」の「削除」を押します。保存した設定と API キーも一緒に消えます。

### 送るもの・送らないもの（プライバシー）

- **どのサイトも、あなたがオンにするまで何も判定しません。**
- オンにしたサイトで、**画面に表示されて読んだ投稿の本文**（1 件最大 2000 字）を、あなたが選んだ接続先（TypeSafe または Vercel）に送ります。送るのは本文だけです。
- **DM・メール・チャットの画面は判定しないようにしています。** アドレスに `/messages`・`/inbox`・`/chat`・`/dm`・`/direct`・`/mail` を含む画面、X の Grok の画面、主なチャット・メール・AI チャットのサービス（Discord・Slack・Messenger・Teams・WhatsApp・Telegram・LINE・Gmail・Outlook・ChatGPT・Claude・Gemini など）が対象です。見分けは完全ではないので、**この一覧にないチャット・メール・AI チャットのサイトはオンにしないでください。**
- 「一次ソースと比較」（初期値オフ）をオンにすると、記事中の論文番号（DOI）を [OpenAlex](https://openalex.org) に送ります。
- 開発者のサーバーはありません。利用状況の収集もしていません。
- API キーはこのブラウザの中だけに保存されます（同期しません）。拡張のうちページの中で動く部分はキーを読みません。さらに、Chrome の公式資料にある方法（`storage.local.setAccessLevel`）で、ページの中からは読めない設定にしています（実際の Chrome での動作確認はまだです）。
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
- 同じ書き方なら、どの政治的立場の文章でも同じように判定されるかは、まだ十分に測っていません。「集団へのレッテル貼り」では、向きを逆にした文の組（男女・左右・世代など）でほぼ同じ数値でした。ただし、よく知られた決めつけほど拾いやすく、見慣れない決めつけは拾いにくい傾向がありました（自作の例文 50 本）。

### 詳しく

- 設計の考え方と実測値: [DESIGN.md](DESIGN.md)
- 開発の現在地: [SESSION.md](SESSION.md)

### ライセンス

[MIT ライセンス](LICENSE)です。ネット環境全体に貢献したいと願っています。改変・再配布・他の製品への組み込みも自由です。

---

## English

In Japanese, this extension is called 煽り注意報 (roughly "rage-bait advisory", as in a weather advisory). The name you see in Chrome depends on your browser's language.

A Chrome extension that shows ‼️ when a post or article you are reading uses a **manipulation technique**, such as stirring up anger or anxiety for profit, provoking a flame war, or making claims without evidence.

- **It points out the technique, nothing more:** it never hides posts or judges them good or bad. Click ‼️ to see which technique was detected, why, and the score.
- **It ignores viewpoints:** it looks only at how something is written, not at which side it supports.
- **It does not fact-check:** "Unsupported assertion" means no evidence was given. It does not mean the claim is false.
- **You are in control:** you choose the sites, the techniques to detect, and the sensitivity.

### My hope

I built this extension hoping it would work as an immune system, across political lines, against being driven by the momentary emotions stirred up by the attention economy (business models that profit by competing for people's attention) and similar forces.

I am not an engineer. Almost all of this extension was built in consultation with an AI (Claude Opus 5.5). Fixes and improvements from engineers are very welcome.

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
| Group labeling | Attributing a trait to everyone in a group by nationality, gender, generation, political position, etc., including "positive" stereotypes (Jev, advanced settings) | Off |

Without an API key, only the two rule-based checks run.
You can also try the demo page (`demo.html`) without a key.

### Install

The extension is not on the Chrome Web Store yet. Install it from the files as follows (the steps are the same on Windows and Mac). The extension screens are in Japanese only, so the steps below give English translations in parentheses.

**1. Get the files**
1. Click the green "Code" button at the top of this page and choose "Download ZIP".
2. Extract the downloaded ZIP file.
3. Move the extracted folder (`attention-vaccine-main`) to a place where it will stay (for example, Documents). **If you delete or move this folder later, the extension stops working.**

If you use `git`, you can run `git clone https://github.com/nevrs/attention-vaccine.git` instead.

**2. Load it into Chrome**
1. Type `chrome://extensions` in the address bar and open it.
2. Turn on "Developer mode" in the top right.
3. Click "Load unpacked" in the top left.
4. Select the folder from step 1 (the one that contains `manifest.json`).
5. When "Attention Vaccine" appears in the list (or "煽り注意報" if Chrome is set to Japanese), you are done. A demo page opens automatically so you can see how it works without a key.
6. Click the puzzle-piece icon to the right of the address bar and pin "Attention Vaccine" so its icon is always visible.

**3. Enter an API key** (without a key, only the two rule-based checks run)
1. Get an API key from one of these. Charges go to your own account (see "Cost" below).
   - **TypeSafe (official):** create an account at [console.typesafe.ai](https://console.typesafe.ai/settings/keys) and issue a key (there may be a waitlist).
   - **Vercel AI Gateway:** in the Vercel dashboard, go to "AI Gateway" → "API Keys" and create a key.
2. Click the extension icon, then "設定を開く" (Open settings).
3. Under "接続先" (Provider), choose where you got the key, and paste it into "API キー" (API key).
4. Click "接続テスト" (Test connection) and check that it says "つながりました" (Connected).
5. Click "保存" (Save) at the bottom.

**4. Choose the sites**

By default, nothing happens on any site. Turn it on for each site you want.
1. Open a site you want to check (X, a news site, etc.).
2. Click the extension icon and choose one of these:
   - **ページ全体 (Whole page):** for pages with a single piece of writing, such as news articles or blog posts. One result appears in the bottom-right corner.
   - **ブロックごと (Per block):** for pages that list posts, such as the X timeline or search results. ‼️ appears at the top right of each post where a technique is found.
3. Click ‼️ to see the technique, the reason, and the score.
4. To stop, choose "オフ" (Off) in the same place.

**Updating**

Download the new ZIP and replace the contents of the old folder. Then click the reload button (circular arrow) for "Attention Vaccine" in `chrome://extensions`. Your settings and API key are kept.

**Removing**

Click "Remove" for "Attention Vaccine" in `chrome://extensions`. Your saved settings and API key are deleted with it.

### What is sent, and what is not (privacy)

- **Nothing is analyzed on any site until you turn that site on.**
- On sites you turn on, **the text of posts you actually view** (up to 2,000 characters each) is sent to the provider you chose (TypeSafe or Vercel). Only the text is sent.
- **DM, mail, and chat pages are skipped.** This covers URL paths containing `/messages`, `/inbox`, `/chat`, `/dm`, `/direct`, or `/mail`, X's Grok pages, and major chat, mail, and AI chat services (Discord, Slack, Messenger, Teams, WhatsApp, Telegram, LINE, Gmail, Outlook, ChatGPT, Claude, Gemini, and others). Detection is not perfect, so **do not turn the extension on for any other chat, mail, or AI chat site.**
- If you turn on "Compare with the primary source" (off by default), the paper identifier (DOI) found in an article is sent to [OpenAlex](https://openalex.org).
- There is no developer server and no usage tracking.
- Your API key is stored only in this browser (not synced). The part of the extension that runs inside web pages never reads it. Storage is also restricted from web-page contexts using the documented Chrome method (`storage.local.setAccessLevel`); this has not yet been verified in a real browser.
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
- Whether texts from different political positions, written in the same style, are judged equally has not been fully measured. For "Group labeling", mirrored pairs (men/women, left/right, young/old, etc.) scored almost the same, but well-known stereotypes were caught more readily than unfamiliar ones (50 hand-written examples).

### More

- Design notes and measurements (Japanese): [DESIGN.md](DESIGN.md)
- Development status (Japanese): [SESSION.md](SESSION.md)

### License

[MIT License](LICENSE). I hope this contributes to the internet as a whole. You are free to modify it, redistribute it, and build it into other products.
