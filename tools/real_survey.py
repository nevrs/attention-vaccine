# 実際の投稿で問いを測る。おすすめ検温（shizume）の「本文を書き出す」で本人が保存したファイルを読み、Jev で点を付ける。
# 本文は他の人の投稿なので、結果はリポの外（--out-dir）にだけ書く。リポに入れない（.gitignore にも型を入れてある）。
# 使い方: TYPESAFE_API_KEY を設定して  python tools/real_survey.py <osusume-kenon-日付.json> --out-dir <リポの外> [--sample 40]
# 出力: scores.json（全件の点）と label.md（本人が「合っている／違う」を付ける一覧。点の高いもの全部＋無作為の sample 件）
import sys, os, json, argparse, random, concurrent.futures as cf
from eval_run import ask
from group_survey import VARIANTS

QS = {"exclusion": VARIANTS["ex4"]}  # 候補の「排除」の問い（未採用）
CURRENT = ["stereo", "dehuman", "flame"]
HIGH = 50  # この点以上は、ラベル付けの一覧に全部入れる


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("export")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--sample", type=int, default=40)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    out = os.path.abspath(a.out_dir)
    # 大文字・小文字の違いとジャンクション・シンボリックリンクでリポの中に書かないよう、実体の場所を比べる。別のドライブはリポの外
    real = lambda p: os.path.normcase(os.path.realpath(p))
    repo = real(os.path.join(os.path.dirname(__file__), ".."))
    if os.path.splitdrive(real(out))[0] == os.path.splitdrive(repo)[0] and os.path.commonpath([real(out), repo]) == repo:
        sys.exit("--out-dir はリポの外にしてください（他の人の投稿が入るため）")
    import techniques
    tq = techniques.questions()
    keys = list(QS) + CURRENT
    qs = {f"q{i}": {"type": "noul", "instructions": q} for i, q in enumerate(list(QS.values()) + [tq[k] for k in CURRENT])}
    rows = json.load(open(a.export, encoding="utf-8"))["rows"]
    seen, items = set(), []
    for r in rows:  # 同じ本文（おすすめとフォロー中の両方に出たもの等。空白の違いは同じとみなす）は 1 回だけ測る。空の本文は飛ばす
        t = " ".join((r.get("text") or "").split())
        if t and t not in seen:
            seen.add(t)
            items.append(dict(r, text=t))
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda r: ask(r["text"], qs)["answers"], items))
    for i, (r, ans) in enumerate(zip(items, res)):
        r["n"] = i + 1
        r["scores"] = {k: round(ans[f"q{j}"]["noul"] * 100) for j, k in enumerate(keys)}
    os.makedirs(out, exist_ok=True)
    json.dump(items, open(os.path.join(out, "scores.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    high = [r for r in items if max(r["scores"].values()) >= HIGH]
    rest = [r for r in items if r not in high]
    random.Random(a.seed).shuffle(rest)
    pick = sorted(high + rest[: a.sample], key=lambda r: r["n"])  # 点の順に並べない（点に引きずられて付けないように）
    lines = ["# 実際の投稿のラベル付け", "",
             "各投稿に、当てはまるものを書いてください。排除＝人や集団を追い出す・権利を奪う・黙らせることを求める／決めつけ＝集団をみな同じ性質のように語る／人間扱いしない／挑発＝反応を集めるためのわざとの挑発。",
             "書き方の例: `排除: はい / 決めつけ: いいえ`。迷ったら `?`。点は見ないで付け、付け終えてから比べます。", "",
             f"全 {len(items)} 件のうち、どれかの点が {HIGH} 以上の {len(high)} 件と、無作為の {min(a.sample, len(rest))} 件。", ""]
    for r in pick:
        lines += [f"## {r['n']}（{r['feed']}・{r['day']}）", "", "> " + r["text"].replace("\n", " "), "", "排除:  / 決めつけ:  / 人間扱いしない:  / 挑発: ", ""]
    open(os.path.join(out, "label.md"), "w", encoding="utf-8").write("\n".join(lines))
    print(f"{len(items)} 件を測った（重複を除く）。{HIGH} 点以上: " + ", ".join(f"{k} {sum(r['scores'][k] >= HIGH for r in items)}" for k in keys))
    print(f"→ {os.path.join(out, 'scores.json')} と label.md（{len(pick)} 件）")


if __name__ == "__main__":
    main()
