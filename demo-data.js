// 体験ページの見本と、その判定結果。本物の Jev（jev-1.13.0）に techniques.js の問いで判定させた値をそのまま載せている。
// 問いの文面を変えたら作り直すこと: python tools/demo_measure.py
const JEV_DEMO = {
  "measured": "2026-10-09",
  "model": "jev-1.13.0",
  "posts": [
    {
      "text": "このままだと老後資金が5000万円足りない！知らないと破産する人が続出…今すぐ無料診断を",
      "answers": {
        "arouse": 0.97,
        "profit": 0.98,
        "flame": 0.24,
        "dema": 0.76,
        "greed": 0.21,
        "imperson": 0.23
      }
    },
    {
      "text": "駅前の桜がもう咲いてた。今年は少し早いみたい",
      "answers": {
        "arouse": 0.01,
        "profit": 0.01,
        "flame": 0.07,
        "dema": 0.05,
        "greed": 0.0,
        "imperson": 0.01
      }
    },
    {
      "text": "正直、〇〇世代って本当に使えない。指示待ちばっかり。異論は認める",
      "answers": {
        "arouse": 0.66,
        "profit": 0.04,
        "flame": 0.82,
        "dema": 0.66,
        "greed": 0.01,
        "imperson": 0.03
      }
    },
    {
      "text": "大雨の影響で、○○線は終日運転を見合わせています。振替輸送を実施中です",
      "answers": {
        "arouse": 0.05,
        "profit": 0.02,
        "flame": 0.05,
        "dema": 0.06,
        "greed": 0.01,
        "imperson": 0.02
      }
    },
    {
      "text": "【緊急】明日から全国の銀行で引き出し制限が始まる。今日中に全額おろして！まだどこも報道していない",
      "answers": {
        "arouse": 0.96,
        "profit": 0.83,
        "flame": 0.19,
        "dema": 0.93,
        "greed": 0.1,
        "imperson": 0.28
      }
    },
    {
      "text": "この計画には反対です。住民への説明が足りないまま決めるのは、順序が逆だと思う",
      "answers": {
        "arouse": 0.14,
        "profit": 0.02,
        "flame": 0.09,
        "dema": 0.07,
        "greed": 0.01,
        "imperson": 0.01
      }
    },
    {
      "text": "年収300万の同級生と年収3000万の僕、たった1つの違い。答えはプロフのリンクから",
      "answers": {
        "arouse": 0.84,
        "profit": 0.97,
        "flame": 0.4,
        "dema": 0.2,
        "greed": 0.41,
        "imperson": 0.16
      }
    }
  ],
  "article": {
    "text": "【衝撃】〇〇大学の研究で判明！毎朝この成分をとるだけで、認知症のリスクが40%も下がることが分かった。専門家も「今日から始めるべき」と太鼓判。高齢の親がいる人は、今すぐ見直してほしい。記事の最後で、研究チームも愛用しているおすすめのサプリを紹介しています。",
    "answers": {
      "arouse": 0.91,
      "profit": 0.95,
      "flame": 0.13,
      "dema": 0.78,
      "greed": 0.04,
      "imperson": 0.05,
      "source": 0.89
    }
  }
};
