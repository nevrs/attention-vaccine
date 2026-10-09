# 調査: 権力側への告発の扱い（tools/eval/power.json）。問いは変えずに測るだけ。
# 1. 権力側への告発（acc_power、critique.json の legit のうち target が権力側）に今の問いで印が付く割合と、
#    同じ形で弱い立場・私人に向けた文（acc_weak）との値の差
# 2. 権力側のかわし方（power_tactic）と、相手を問わない害（harm）を、今の問いと候補の問い（CANDIDATES、未採用）がどれだけ拾うか。
#    候補は、似た形の正当な文（tactic_ok / harm_ok）と正当な告発・批判に当たらないかも見る
# 使い方: TYPESAFE_API_KEY を設定して  python tools/power_survey.py [--repeat 2] [--out r.json]
import sys, os, json, argparse, statistics, collections, concurrent.futures as cf
import techniques  # tools/techniques.py
from eval_run import ask
from critique_survey import lure_all

HERE = os.path.dirname(os.path.abspath(__file__))
POWER = {"gov", "opp", "corp", "org", "person", "intl"}

# 候補の問い（未採用。測るだけ）。書き手の行為・文章の形で聞く（「〜を名乗り」型より誤検知が少なかった過去の教訓）
CANDIDATES = {
    "c_deflect": "批判や疑惑に対して、その中身に答えずに、別の話題に移す・相手も同じことをしたと言い返す・批判する人の動機や人柄を攻撃する、のいずれかでかわしている。根拠を示して反論・訂正している文、こうしたかわし方を報じる・批判する文は含まない",
    "c_dismiss": "批判する人や告発する人を、根拠を示さずに「デマ」「一部の活動家」「陰謀論者」「反日」などとひとくくりにして、主張の中身を退けている。根拠を示した訂正やファクトチェック、こうした言い方を報じる・批判する文は含まない",
    "c_harass": "特定の個人や団体に対して、集団で押しかける・電話や書き込みを殺到させる・住所や顔写真や勤め先などの個人情報をさらす・脅す、のいずれかを呼びかけたり、それを行ったりしている。署名・投票・公式の窓口への意見・平和的な集会の呼びかけ、こうした行為を報じる・批判する文は含まない",
    "c_dehuman": "人や集団を、虫・病気・ゴミ・獣など人間以外のものにたとえて、排除や駆除を当然のように語っている。比喩でない文字どおりの話、こうした言い方を報じる・批判する文は含まない",
    "c_spill": "批判や攻撃の矛先が、問題の当事者ではない家族や、決定権のない末端の職員・店員などの私人に向いている",
}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=int, default=2, help="各文を追加で N 回測って平均する")
    ap.add_argument("--out")
    a = ap.parse_args()
    t = techniques.load()
    checks = techniques.checks(t)
    on = {p["id"] for p in t["techniques"] if p["defaults"]["on"]}
    pw = json.load(open(os.path.join(HERE, "eval", "power.json"), encoding="utf-8"))
    cr = json.load(open(os.path.join(HERE, "eval", "critique.json"), encoding="utf-8"))
    items = [dict(x, group=g) for g in ["acc_power", "acc_weak", "power_tactic", "tactic_ok", "harm", "harm_ok"] for x in pw[g]]
    items += [dict(x, group="critique") for x in cr["legit"]]
    qtexts = sorted({q for c in checks.values() for q in c["qs"]}) + list(CANDIDATES.values())
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
        for ck, q in CANDIDATES.items():
            x["scores"][ck] = round(ans[q] * 100, 1)
        x["hits"] = [ck for ck, c in checks.items() if x["scores"][ck] >= c["high"]] + (["lure"] if lu["hit"] else [])
        x["hits_on"] = [h for h in x["hits"] if h in on and h != "source"]

    G = collections.defaultdict(list)
    for x in items:
        G[x["group"]].append(x)
    byid = {x["id"]: x for x in items}
    cur = ["bait", "flame", "dema", "stereo", "sexual"]

    def flagged(xs):
        return sum(bool(x["hits_on"]) for x in xs)

    print("■ 1. 権力側への告発に、今の問い（初期値のまま、出典の項目を除く）で印が付く割合")
    crp = [x for x in G["critique"] if x["tags"].get("target") in POWER]
    print(f"  critique.json の権力側 {flagged(crp)}/{len(crp)}  acc_power（難しい例）{flagged(G['acc_power'])}/{len(G['acc_power'])}  acc_weak（対象を入れ替え）{flagged(G['acc_weak'])}/{len(G['acc_weak'])}")
    for g in ["acc_power", "acc_weak"]:
        print(f"\n  {g}")
        for x in G[g]:
            v = " ".join(f"{k} {x['scores'][k]:.0f}" for k in cur)
            print(f"  {x['id']} [{x['tags']['target']}/{x['tags']['src']}/{x['tags']['tone']}] 印: {' '.join(x['hits_on']) or '-'} | {v} :: {x['text'][:30]}")
    print("\n  対の差（弱い側 − 権力側）")
    for x in G["acc_power"]:
        if "pair" in x:
            y = byid[x["pair"]]
            print(f"  {x['id']}→{y['id']} " + " ".join(f"{k} {y['scores'][k] - x['scores'][k]:+.0f}" for k in cur))
    for k in cur:
        d = [byid[x["pair"]]["scores"][k] - x["scores"][k] for x in G["acc_power"] if "pair" in x]
        print(f"  平均 {k} {statistics.mean(d):+.1f}")

    print("\n■ 2. 今の問いでの印（初期値のまま）")
    for g in ["power_tactic", "tactic_ok", "harm", "harm_ok"]:
        print(f"  {g} {flagged(G[g])}/{len(G[g])}")

    print("\n■ 3. 候補の問い（値は 0〜100、3 回平均）。正当な文側の最大と、拾うべき側の分布")
    neg_all = G["tactic_ok"] + G["harm_ok"] + G["acc_power"] + G["critique"]
    for ck, pos, neg in [("c_deflect", "power_tactic", "tactic_ok"), ("c_dismiss", "power_tactic", "tactic_ok"),
                         ("c_harass", "harm", "harm_ok"), ("c_dehuman", "harm", "harm_ok"), ("c_spill", "harm", "harm_ok")]:
        p = sorted(x["scores"][ck] for x in G[pos])
        n_top = sorted(neg_all, key=lambda x: -x["scores"][ck])[:4]
        print(f"\n  {ck}: {pos} 中央値 {statistics.median(p):.0f} 最小 {p[0]:.0f} / {neg} 最大 {max(x['scores'][ck] for x in G[neg]):.0f} / 正当な文全体の上位: "
              + ", ".join(f"{x['id']} {x['scores'][ck]:.0f}" for x in n_top))
    print("\n  拾うべき文ごと（今の印 / 候補の値）")
    for g, cks in [("power_tactic", ["c_deflect", "c_dismiss"]), ("tactic_ok", ["c_deflect", "c_dismiss"]),
                   ("harm", ["c_harass", "c_dehuman", "c_spill"]), ("harm_ok", ["c_harass", "c_dehuman", "c_spill"])]:
        print(f"  -- {g}")
        for x in G[g]:
            print(f"  {x['id']} [{x['tags'].get('kind')}{'/' + x['tags']['target'] if 'target' in x['tags'] else ''}] 印: {' '.join(x['hits_on']) or '-'} | "
                  + " ".join(f"{k} {x['scores'][k]:.0f}" for k in cks) + f" | flame {x['scores']['flame']:.0f} stereo {x['scores']['stereo']:.0f} :: {x['text'][:28]}")
    if a.out:
        json.dump(items, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
