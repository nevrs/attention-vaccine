# プライバシーポリシー / Privacy Policy

煽り注意報（Attention Vaccine）／ Attention Vaccine

施行日 / Effective date: 2026-10-03

## 日本語

### 要点

- 開発者のサーバーはありません。開発者があなたのデータを受け取ることはありません。
- 利用状況の収集（アナリティクス）、広告、データの販売はありません。
- 文章を送るのは、あなたが選んだ接続先と、あなたが自分で用意した API キーを使うときだけです。

### 送るもの

拡張は、あなたがポップアップでオンにしたサイトでだけ動きます。オンにするときに、Chrome がそのサイトへのアクセス許可を求めます。

- 判定のための文章: オンにしたサイトで、ブロックごとモードでは「画面に表示されて読んだ投稿の本文」、ページ全体モードでは「記事の見出しと本文の冒頭」を、1 件最大 2000 字まで、あなたが選んだ接続先に送ります。接続先は TypeSafe（api.typesafe.ai）または Vercel AI Gateway（ai-gateway.vercel.sh）です。あなたの API キーで送ります。API キーが無いときは何も送りません。
- DM・メール・チャット・AI チャットの画面は判定しないようにしています。ただし見分けは完全ではありません。
- 「一次ソースと比較」（初期値オフ）をオンにしたときだけ、記事中の論文番号（DOI）を OpenAlex（api.openalex.org）に送ります。
- 「問いを試す」ページでは、あなたが入力した試験用の文章を、あなたが選んだ接続先に、あなたの API キーで送ります。
- 「AI に相談」は、相談用の文を画面に出してクリップボードにコピーするだけです。拡張からは何も送りません。

### 保存するもの（すべてあなたのブラウザの中）

- API キー: Chrome の `storage.local` に保存します。同期されません。
- 設定（オンにしたサイト、しきい値、自作の問い、除外するアカウントなど）: Chrome の `storage.sync` に保存します。Chrome の同期をオンにしている場合は、Chrome があなたの Google アカウントを通じて他の端末と同期します。これは Chrome の機能で、開発者には届きません。
- 判定結果のキャッシュ: `storage.session` に置きます。ブラウザを閉じると消えます。
- 1 日の利用回数: `storage.local` に保存します。

### 第三者について

接続先に送った文章の扱いは、それぞれの運営者の方針に従います。[TypeSafe](https://typesafe.ai)、[Vercel](https://vercel.com)、[OpenAlex](https://openalex.org) の公開情報を確認してください。

### 問い合わせ・変更の依頼について

開発者は、個別のサポートや変更の依頼を受け付けていません。設定は、拡張の設定画面からご自身で変えられます。ソースコードは MIT ライセンスで公開しているので、ご自身で改変（フォーク）して使うこともできます。

### 変更

このポリシーを変えるときは、このファイルを更新し、施行日を書き換えます。

## English

### In short

- There is no developer server. The developer never receives your data.
- No analytics or usage tracking, no ads, and no sale of data.
- Text is sent only to the provider you chose, using an API key you supply yourself.

### What is sent

The extension runs only on sites you turn on in the popup. When you turn a site on, Chrome asks you to grant access to that site.

- Text for checking: on sites you turned on, per-block mode sends the text of posts you actually view, and whole-page mode sends the article's headline and the beginning of its body, up to 2,000 characters each, to the provider you chose: TypeSafe (api.typesafe.ai) or Vercel AI Gateway (ai-gateway.vercel.sh). It is sent with your own API key. Without an API key, nothing is sent.
- DM, mail, chat, and AI chat pages are skipped. Detection is not perfect.
- Only if you turn on "Compare with the primary source" (off by default), the paper identifier (DOI) found in an article is sent to OpenAlex (api.openalex.org).
- The "Try the questions" page sends the test sentences you type to the provider you chose, using your API key.
- "Consult an AI" only shows a prompt and copies it to your clipboard. The extension sends nothing.

### What is stored (all in your browser)

- API key: in Chrome's `storage.local`. Not synced.
- Settings (enabled sites, thresholds, custom questions, excluded accounts, etc.): in Chrome's `storage.sync`. If Chrome sync is on, Chrome syncs it to your other devices through your Google account. This is a Chrome feature; the developer does not receive it.
- Cached results: in `storage.session`, cleared when you close the browser.
- Daily usage count: in `storage.local`.

### Third parties

Text sent to a provider is handled under that provider's own policies. See the public information of [TypeSafe](https://typesafe.ai), [Vercel](https://vercel.com), and [OpenAlex](https://openalex.org).

### Contact and change requests

The developer does not accept individual support or change requests. You can change settings yourself in the options page. The source code is open under the MIT license, so you can modify (fork) it yourself.

### Changes

If this policy changes, this file will be updated along with the effective date.
