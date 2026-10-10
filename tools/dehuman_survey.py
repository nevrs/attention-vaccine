# 候補の手口「人間扱いしない言葉」の問いの案を比べる（未採用。techniques.js は変えない）。
# 例文は tools/eval/dehuman.json（hit / no / border）。ほかに power.json の harm の dehuman を当てはまる側、
# critique.json の legit と power.json の acc_power / tactic_ok / harm_ok を当てはまらない側として測る。
# 使い方: TYPESAFE_API_KEY を設定して  python tools/dehuman_survey.py [--repeat 2] [--out r.json]
import sys, os, json, argparse, statistics, collections, concurrent.futures as cf
from eval_run import ask

HERE = os.path.dirname(os.path.abspath(__file__))

VARIANTS = {
    # 2026-10-10 の power_survey の c_dehuman そのまま
    "v1": "人や集団を、虫・病気・ゴミ・獣など人間以外のものにたとえて、排除や駆除を当然のように語っている。比喩でない文字どおりの話、こうした言い方を報じる・批判する文は含まない",
    # 排除の呼びかけを条件から外し、「人間以下」と除外の例を足す
    "v2": "人や集団を、虫・害獣・病気・ゴミ・汚物など人間以外のもの、または「人間以下」の存在として描いている。文字どおりの動物や病気の話、親しみや比喩としての動物のたとえ（「小猿みたい」「たぬき親父」）、こうした言い方を報じる・批判する文は含まない",
    # 書き手の行為として聞く（過去の教訓: 書き手の行為・文章の形で聞くと注意喚起・報道に当たりにくい）
    "v3": "この文章の書き手自身が、実在の人や集団を、害虫・病気・ゴミ・獣のような人間以外のもの、または人間以下の存在として扱っている。動物や病気そのものの話、親しみを込めた動物のたとえ、こうした言い方を報じる・批判する文は含まない",
    # v3 に、力や様子を表すだけのたとえの除外を足す（例の語は例文と重ならないものにした）
    "v4": "この文章の書き手自身が、実在の人や集団を、害虫・病気・ゴミ・獣のような人間以外のもの、または人間以下の存在として扱っている。動物や病気そのものの話、親しみを込めた動物のたとえ、力強さや様子を表すだけのたとえ（「熊のような大男」「ミツバチのような働き者」）、こうした言い方を報じる・批判する文は含まない",
}
FLAME = "flame"  # 今の問いで拾えているかの比較用（techniques.js の問いのキー）
STEREO = "stereo"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=int, default=2)
    ap.add_argument("--out")
    a = ap.parse_args()
    import techniques
    tq = techniques.questions()
    d = json.load(open(os.path.join(HERE, "eval", "dehuman.json"), encoding="utf-8"))["cases"]
    pw = json.load(open(os.path.join(HERE, "eval", "power.json"), encoding="utf-8"))
    cr = json.load(open(os.path.join(HERE, "eval", "critique.json"), encoding="utf-8"))
    items = [dict(x, src="dehuman") for x in d]
    items += [dict(x, expect="hit" if x["tags"]["kind"] == "dehuman" else "no", src="harm") for x in pw["harm"]]
    items += [dict(x, expect="no", src=g) for g in ["acc_power", "tactic_ok", "harm_ok"] for x in pw[g]]
    items += [dict(x, expect="no", src="critique") for x in cr["legit"]]
    qtexts = list(VARIANTS.values()) + [tq[FLAME], tq[STEREO]]
    keys = list(VARIANTS) + [FLAME, STEREO]
    qs = {f"q{i}": {"type": "noul", "instructions": q} for i, q in enumerate(qtexts)}
    jobs = [x for x in items for _ in range(1 + a.repeat)]
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda x: ask(x["text"], qs)["answers"], jobs))
    runs = collections.defaultdict(list)
    for x, r in zip(jobs, res):
        runs[x["id"]].append([r[f"q{i}"]["noul"] for i in range(len(qtexts))])
    for x in items:
        rs = runs[x["id"]]
        x["scores"] = {k: round(statistics.mean(r[i] for r in rs) * 100, 1) for i, k in enumerate(keys)}
        x["spread"] = {k: round((max(r[i] for r in rs) - min(r[i] for r in rs)) * 100, 1) for i, k in enumerate(keys)}

    hit = [x for x in items if x["expect"] == "hit"]
    no = [x for x in items if x["expect"] == "no"]
    print(f"■ 案ごと（{1 + a.repeat} 回平均）: 当てはまる {len(hit)} 本 / 当てはまらない {len(no)} 本")
    for k in VARIANTS:
        h = sorted(x["scores"][k] for x in hit)
        n = sorted((x for x in no), key=lambda x: -x["scores"][k])
        gap = h[0] - n[0]["scores"][k]
        print(f"  {k}: 当てはまる 最小 {h[0]:.0f} 中央値 {statistics.median(h):.0f} / 当てはまらない 最大 {n[0]['scores'][k]:.0f}（差 {gap:+.0f}）"
              f" 上位: {', '.join(f'{x['id']} {x['scores'][k]:.0f}' for x in n[:5])}")
        for thr in (50, 60, 70, 80):
            print(f"     閾値 {thr}: 取りこぼし {sum(v < thr for v in h)}  誤検知 {sum(x['scores'][k] >= thr for x in no)}")
        print(f"     同じ文のぶれ（最大−最小）の最大 {max(x['spread'][k] for x in items):.0f}")
    print("\n■ 文ごと")
    for x in items:
        if x["src"] in ("dehuman",) or x["expect"] == "hit" or max(x["scores"][k] for k in VARIANTS) >= 50:
            t = x.get("tags", {})
            label = t.get("target") or t.get("kind") or ""
            print(f"  {x['id']} {x['expect']:<6} [{label}{'/呼びかけ' if t.get('call') else ''}] "
                  + " ".join(f"{k} {x['scores'][k]:.0f}" for k in keys) + f" :: {x['text'][:30]}")
    if a.out:
        json.dump(items, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
