# 体験ページの見本を、今の checks.js の問いで本物の Jev に判定させ、demo-data.js を作る。
# 判定の問い（checks.js の JEV_QUESTIONS）を変えたら、これを動かして作り直す。
#   TYPESAFE_API_KEY を設定して:  python tools/demo_measure.py
import sys, re, json, datetime, concurrent.futures as cf
import os, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))


def ask(state, questions, model="jev-1.13.0"):
    body = json.dumps({"state": state, "model": model, "questions": questions}).encode()
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=body, headers={
        "Authorization": "Bearer " + os.environ["TYPESAFE_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

checks = open(os.path.join(HERE, "..", "checks.js"), encoding="utf-8").read()
Q = dict(re.findall(r'^\s+(\w+): "(.*)",$', checks.split("const JEV_PILLARS")[0], re.M))

POSTS = [
  "このままだと老後資金が5000万円足りない！知らないと破産する人が続出…今すぐ無料診断を",
  "駅前の桜がもう咲いてた。今年は少し早いみたい",
  "正直、〇〇世代って本当に使えない。指示待ちばっかり。異論は認める",
  "大雨の影響で、○○線は終日運転を見合わせています。振替輸送を実施中です",
  "【緊急】明日から全国の銀行で引き出し制限が始まる。今日中に全額おろして！まだどこも報道していない",
  "この計画には反対です。住民への説明が足りないまま決めるのは、順序が逆だと思う",
  "年収300万の同級生と年収3000万の僕、たった1つの違い。答えはプロフのリンクから",
]
ARTICLE = ("【衝撃】〇〇大学の研究で判明！毎朝この成分をとるだけで、認知症のリスクが40%も下がることが分かった。"
           "専門家も「今日から始めるべき」と太鼓判。高齢の親がいる人は、今すぐ見直してほしい。"
           "記事の最後で、研究チームも愛用しているおすすめのサプリを紹介しています。")

def judge(text, keys):
    r = ask(text, {k: {"type": "noul", "instructions": Q[k]} for k in keys})
    return {k: round(v["noul"], 3) for k, v in r["answers"].items()}

def main():
    BLOCK = ["arouse", "profit", "flame", "dema"]
    PAGE = BLOCK + ["source"]
    with cf.ThreadPoolExecutor(8) as ex:
        posts = list(ex.map(lambda t: {"text": t, "answers": judge(t, BLOCK)}, POSTS))
    article = {"text": ARTICLE, "answers": judge(ARTICLE, PAGE)}

    data = {"measured": datetime.date.today().isoformat(), "model": "jev-1.13.0", "posts": posts, "article": article}
    out = os.path.join(HERE, "..", "demo-data.js")
    open(out, "w", encoding="utf-8").write(
        "// 体験ページの見本と、その判定結果。本物の Jev（jev-1.13.0）に checks.js の問いで判定させた値をそのまま載せている。\n"
        "// 問いの文面を変えたら作り直すこと: python tools/demo_measure.py\n"
        "const JEV_DEMO = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

    for p in posts + [article]:
        a = p["answers"]
        bait = a["arouse"] * a["profit"]
        print(f"煽×利 {bait:.2f} 炎上 {a['flame']:.2f} 断定 {a['dema']:.2f}" + (f" 要源 {a['source']:.2f}" if "source" in a else ""), p["text"][:24])


if __name__ == "__main__":
    main()
