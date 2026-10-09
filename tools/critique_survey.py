# 実態調査: 正当な告発・批判（tools/eval/critique.json の legit）に、どの手口の印がどれだけ付くか。
# 比べる相手として、告発の体裁をとったデマ（disinfo）も測る。
# 使い方: TYPESAFE_API_KEY を設定して  python tools/critique_survey.py [--repeat 2] [--out r.json]
# Jev の項目は techniques.js の問いと閾値、決まり文句は checks.js の JEV_CODE.lure をそのまま node で動かす
import sys, os, json, argparse, statistics, subprocess, collections, concurrent.futures as cf
import techniques  # tools/techniques.py
from eval_run import ask

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

LURE_JS = r"""
const fs = require("fs"), path = require("path");
const root = process.argv[1];
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
eval(src("techniques.js").replace("const JEV_TECHNIQUES", "globalThis.JEV_TECHNIQUES") + src("checks.js").replace(/^const (\w+)/gm, "globalThis.$1"));
const texts = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify(texts.map((t) => JEV_CODE.lure(t))));
"""


def lure_all(texts):
    r = subprocess.run(["node", "-e", LURE_JS, ROOT], input=json.dumps(texts), capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(r.stdout)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=int, default=2, help="各文を追加で N 回測って平均する")
    ap.add_argument("--out")
    a = ap.parse_args()
    t = techniques.load()
    checks = techniques.checks(t)  # Jev の項目（手口 ＋ おすすめ）
    on = {p["id"] for p in t["techniques"] if p["defaults"]["on"]}  # 初期値でオンの手口
    data = json.load(open(os.path.join(HERE, "eval", "critique.json"), encoding="utf-8"))
    items = [dict(x, group="legit") for x in data["legit"]] + [dict(x, group="disinfo", tags={}) for x in data["disinfo"]]
    qtexts = sorted({q for c in checks.values() for q in c["qs"]})
    qs = {f"q{i}": {"type": "noul", "instructions": q} for i, q in enumerate(qtexts)}
    jobs = [x for x in items for _ in range(1 + a.repeat)]
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda x: ask(x["text"], qs)["answers"], jobs))
    runs = collections.defaultdict(list)
    for x, r in zip(jobs, res):
        runs[x["id"]].append({q: r[f"q{i}"]["noul"] for i, q in enumerate(qtexts)})
    lures = lure_all([x["text"] for x in items])
    for x, lu in zip(items, lures):
        ans = {q: statistics.mean(r[q] for r in runs[x["id"]]) for q in qtexts}
        x["scores"] = {}
        for ck, c in checks.items():
            p = 1.0
            for q in c["qs"]:
                p *= ans[q]
            x["scores"][ck] = round(p * 100, 1)
        x["hits"] = [ck for ck, c in checks.items() if x["scores"][ck] >= c["high"]]
        if lu["hit"]:
            x["hits"].append("lure")
        x["lure"] = lu["matches"]
        x["hits_on"] = [h for h in x["hits"] if h in on and h != "source"]  # ブロックごとモードで初期値のまま付く印

    legit = [x for x in items if x["group"] == "legit"]
    dis = [x for x in items if x["group"] == "disinfo"]
    names = list(checks) + ["lure"]
    print("■ 項目ごと: 正当な告発・批判に付いた数 / 告発の体裁のデマに付いた数（閾値は techniques.js）")
    print(f"{'項目':<14}{'初期値':>6}{'閾値':>5}{'告発 n=' + str(len(legit)):>12}{'デマ n=' + str(len(dis)):>10}")
    for ck in names:
        thr = checks[ck]["high"] if ck in checks else "-"
        st = "オン" if ck in on else "オフ"
        print(f"{ck:<14}{st:>6}{thr:>5}{sum(ck in x['hits'] for x in legit):>12}{sum(ck in x['hits'] for x in dis):>10}")
    n_on = sum(bool(x["hits_on"]) for x in legit)
    print(f"\n初期値のまま（ブロックごと、出典の項目を除く）で何かの印が付く告発・批判: {n_on} / {len(legit)}")
    print(f"同じ条件で、デマに付く: {sum(bool(x['hits_on']) for x in dis)} / {len(dis)}")

    print("\n■ 観点ごと（初期値のままで印が付く割合）")
    for tag in ["tone", "src", "lean", "target", "share"]:
        groups = collections.defaultdict(list)
        for x in legit:
            groups[str(x["tags"].get(tag, False))].append(x)
        row = "  ".join(f"{k} {sum(bool(x['hits_on']) for x in g)}/{len(g)}" for k, g in sorted(groups.items()))
        print(f"{tag:<7}{row}")

    print("\n■ 印が付いた告発・批判（初期値オフの項目も含む。値は %）")
    for x in legit:
        if x["hits"]:
            vals = " ".join(f"{h}{'' if h == 'lure' else ' ' + str(round(x['scores'][h]))}" for h in x["hits"])
            print(f"{x['id']} [{x['tags'].get('tone')}/{x['tags'].get('src')}{'/share' if x['tags'].get('share') else ''}] {vals} :: {x['text'][:40]}")
    print("\n■ デマで dema（根拠を示さない断定）の値")
    for x in dis:
        print(f"{x['id']} dema {x['scores']['dema']:.0f}  付いた印: {' '.join(x['hits']) or 'なし'} :: {x['text'][:30]}")
    print("\n■ 告発・批判の dema の値（高い順に 10 件）")
    for x in sorted(legit, key=lambda x: -x["scores"]["dema"])[:10]:
        print(f"{x['id']} {x['scores']['dema']:.0f} [{x['tags'].get('src')}] {x['text'][:40]}")
    if a.out:
        json.dump(items, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
