# 手口の定義（techniques.js）を読む。techniques.js の { … } は JSON そのものなので、前後を外して json で読む。
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "techniques.js")


def load(path=PATH):
    src = open(path, encoding="utf-8").read()
    m = re.search(r"^const JEV_TECHNIQUES = ", src, re.M)  # 行頭のものだけ（先頭のコメントにも同じ文字列がある）
    return json.loads(src[m.end():].rstrip().rstrip(";"))


def questions(t=None):
    """{問いのキー: 問いの原文}（checks.js の JEV_QUESTIONS と同じ）"""
    t = t or load()
    return {k: q["text"] for k, q in t["questions"].items()}


def checks(t=None):
    """{検査名: {"qs": [問いの原文], "high": 閾値}}。検査名は手口の id と、おすすめの label。コードで判定する手口は含まない"""
    t = t or load()
    q = questions(t)
    out = {}
    for p in t["techniques"]:
        if p.get("qs"):
            out[p["id"]] = {"qs": [q[k] for k in p["qs"]], "high": p["defaults"]["high"]}
    for p in t["presets"]:
        out[p["label"]] = {"qs": [p["condition"]], "high": p["high"]}
    return out
