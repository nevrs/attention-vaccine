# AGENTS — 煽り注意報（Chrome 拡張、MV3）

## 構成
| ファイル | 役割 |
|---|---|
| `manifest.json` | 権限・読み込み順（content scripts: checks → sites → content → picker） |
| `checks.js` | 判定の問い（`JEV_QUESTIONS`）・項目（`JEV_PILLARS`）・コードで判定する項目（`JEV_CODE` / `JEV_LURE` / `JEV_DUP`） |
| `sites.js` | 主要サイトの区切り・本文の場所（`JEV_SITES`）と `jevSiteFor` |
| `content.js` | ページ側。モード（page / block）、見えた件の判定、‼️ の表示 |
| `picker.js` | クリックで区切り・本文の場所・判定範囲を直すバー |
| `background.js` | 接続先への問い合わせ（並列制限・再試行・キャッシュ・1日の上限）、OpenAlex |
| `options.*` / `popup.*` | 設定画面・アイコンのポップアップ |
| `demo.*` / `demo-data.js` | キー不要の体験ページ。`demo-data.js` は `tools/demo_measure.py` で作る |

## 動かし方
- 読み込み: `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」→ このフォルダ
- 構文確認: `for f in *.js; do node --check $f; done`
- 体験ページの数値の作り直し（問いを変えたら必須）: `TYPESAFE_API_KEY` を設定して `python tools/demo_measure.py`
- ビルド工程なし・外部ライブラリなし

## 文書
- 外向けの説明: `README.md`（日英）／設計判断と実測: `DESIGN.md`／今どこにいるか: `SESSION.md`
- 問いの文面と閾値は測ってから変える。測った値は `checks.js` のコメントと `SESSION.md` に残す
