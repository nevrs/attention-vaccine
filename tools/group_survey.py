# 候補の手口「排除を求める言葉」の問いの案を比べる（未採用。techniques.js は変えない）。
# shizume（おすすめ検温）の D15「ひとまとめ → 見下し → 排除」のうち、煽り注意報に無いのは排除。ひとまとめは stereo、見下しは dehuman（意図して狭い）が近い。
# 例文は tools/eval/groups.json（shizume の写し。amb は除く）。ほかに critique.json の legit、power.json の acc_power / acc_weak、
# dehuman.json の no（虐殺・ナチスの宣伝を報じる文など。dehuman の v1 が 68〜78 で付いた種類）を、排除の当てはまらない側として測る。
# 使い方: TYPESAFE_API_KEY を設定して  python tools/group_survey.py [--repeat 2] [--out r.json]
import sys, os, json, argparse, statistics, collections, concurrent.futures as cf
from eval_run import ask

HERE = os.path.dirname(os.path.abspath(__file__))

VARIANTS = {
    # shizume の group1 の exclusion を、書き手の行為として聞く形にしたもの（greed・imperson・dehuman の教訓）
    "ex1": "この文章の書き手自身が、人や集団を、追い出す・権利を奪う・黙らせる・社会から消す・暴力を加えることを求めている、または当然だとしている。特定の人の違法行為を法に沿って罰することを論じる文、投票しないなど本人の選択を述べる文、こうした主張を報じる・批判する文は含まない",
    # ex1 に、公職者・組織への責任追及（辞任・説明・処分の要求）の除外を足す
    "ex2": "この文章の書き手自身が、人や集団を、追い出す・権利を奪う・黙らせる・社会から消す・暴力を加えることを求めている、または当然だとしている。公職者や組織の責任を問う（辞任・説明・処分・法に沿った罰を求める）文、投票しないなど本人の選択を述べる文、こうした主張を報じる・批判する文は含まない",
    # ex2 に、人以外（動物・害虫）の駆除の除外を足す（ex2 は「イノシシ…猟友会に駆除を頼んだ」に 75）
    "ex4": "この文章の書き手自身が、人や集団を、追い出す・権利を奪う・黙らせる・社会から消す・暴力を加えることを求めている、または当然だとしている。動物や害虫の駆除の話、公職者や組織の責任を問う（辞任・説明・処分・法に沿った罰を求める）文、投票しないなど本人の選択を述べる文、こうした主張を報じる・批判する文は含まない",
    # 矛先を集団・属性・立場に絞る（dehuman と同じ絞り方。個人への「書き込めないようにしてやる」は落ちる）
    "ex3": "この文章の書き手自身が、国籍・民族・性別・世代・宗教・政治的な立場・暮らし向きなどの集団や属性の人々を、追い出す・権利を奪う・発言の場を奪う・社会から消す・暴力を加えることを求めている、または当然だとしている。公職者や組織の責任を問う文、投票しないなど本人の選択を述べる文、こうした主張を報じる・批判する文は含まない",
}
# critique.json の legit のうち、集団から権利・給付を外せと求める文。2026-10-24 ユーザー判断で排除に数える
EXCLUSION_LEGIT = {"L40"}
CURRENT = ["stereo", "dehuman", "flame"]  # 今の問い（techniques.js のキー）


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=int, default=2)
    ap.add_argument("--out")
    a = ap.parse_args()
    import techniques
    tq = techniques.questions()
    g = json.load(open(os.path.join(HERE, "eval", "groups.json"), encoding="utf-8"))["posts"]
    pw = json.load(open(os.path.join(HERE, "eval", "power.json"), encoding="utf-8"))
    cr = json.load(open(os.path.join(HERE, "eval", "critique.json"), encoding="utf-8"))
    items = [dict(x, src="groups") for x in g if not x.get("amb") and not x.get("border")]
    border = [dict(x, src="groups") for x in g if x.get("border")]
    items += [dict(x, group=k, lump=False, contempt=False, exclusion=False, src=k) for k in ("acc_power", "acc_weak") for x in pw[k]]
    items += [dict(x, group="legit", lump=False, contempt=False, exclusion=False, src="critique") for x in cr["legit"]]
    dh = json.load(open(os.path.join(HERE, "eval", "dehuman.json"), encoding="utf-8"))["cases"]
    items += [dict(x, group="dh_no", lump=False, contempt=False, exclusion=False, src="dehuman") for x in dh if x["expect"] == "no"]
    for x in items:
        if x["src"] == "critique" and x["id"] in EXCLUSION_LEGIT:
            x["group"], x["exclusion"] = "policy", True  # critique.json は変えず、ここでだけ正解を替える
    items += border
    keys = list(VARIANTS) + CURRENT
    qtexts = list(VARIANTS.values()) + [tq[k] for k in CURRENT]
    qs = {f"q{i}": {"type": "noul", "instructions": q} for i, q in enumerate(qtexts)}
    jobs = [x for x in items for _ in range(1 + a.repeat)]
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda x: ask(x["text"], qs)["answers"], jobs))
    runs = collections.defaultdict(list)
    for x, r in zip(jobs, res):
        runs[x["src"] + x["id"]].append([r[f"q{i}"]["noul"] for i in range(len(qtexts))])
    for x in items:
        rs = runs[x["src"] + x["id"]]
        x["scores"] = {k: round(statistics.mean(r[i] for r in rs) * 100, 1) for i, k in enumerate(keys)}
        x["spread"] = {k: round((max(r[i] for r in rs) - min(r[i] for r in rs)) * 100, 1) for i, k in enumerate(keys)}

    # 正解: 排除の案は exclusion、stereo は lump、dehuman・flame は参考（正解なし、当たった数だけ）
    truth = {k: "exclusion" for k in VARIANTS} | {"stereo": "lump"}
    print(f"■ 問いごと（{1 + a.repeat} 回平均。groups {sum(x['src'] == 'groups' and not x.get('border') for x in items)} 本・境目 {len(border)} 本・ほかの例文 {sum(x['src'] != 'groups' for x in items)} 本）")
    for k in keys:
        if k not in truth:
            continue
        scored = [x for x in items if not x.get("border")]
        hit = [x for x in scored if x[truth[k]]]
        no = sorted((x for x in scored if not x[truth[k]]), key=lambda x: -x["scores"][k])
        h = sorted(x["scores"][k] for x in hit)
        print(f"  {k}（正解 {truth[k]}: 当てはまる {len(hit)} / 当てはまらない {len(no)}）")
        print(f"    当てはまる 最小 {h[0]:.0f} 中央値 {statistics.median(h):.0f} / 当てはまらない 最大 {no[0]['scores'][k]:.0f}"
              " 上位: " + ", ".join(f"{x['src']}:{x['id']} {x['scores'][k]:.0f}" for x in no[:6]))
        for thr in (50, 60, 70, 80, 85):
            print(f"     閾値 {thr}: 取りこぼし {sum(v < thr for v in h)}  誤検知 {sum(x['scores'][k] >= thr for x in no)}")
        print(f"     ぶれの最大 {max(x['spread'][k] for x in items):.0f}")
    print("\n■ groups の段ごとに、今の問いが閾値を越えた本数（stereo 閾値は techniques.js の値）")
    ch = techniques.checks()
    for grp in ("lump", "contempt", "exclusion", "policy", "mobilize", "critique", "neutral", "hard", "legit", "acc_power", "acc_weak", "dh_no"):
        xs = [x for x in items if x["group"] == grp]
        if xs:
            print(f"  {grp:<10} {len(xs):>2} 本: " + "  ".join(f"{k}≧{ch[k]['high']} {sum(x['scores'][k] >= ch[k]['high'] for x in xs)}" for k in CURRENT))
    print("\n■ 文ごと（排除の正解あり、またはどれかの案が 50 以上）")
    for x in items:
        if x["exclusion"] or x["group"] == "policy" or max(x["scores"][k] for k in VARIANTS) >= 50:
            mark = "?" if x.get("border") else "X" if x["exclusion"] else "-"
            print(f"  {x['src'][:3]}:{x['id']:<5}{x['group']:<10}{x.get('lean', ''):<6}{mark} " + " ".join(f"{k} {x['scores'][k]:.0f}" for k in keys) + f" :: {x['text'][:34]}")
    if a.out:
        json.dump(items, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
