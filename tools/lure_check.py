# 決まり文句（checks.js の JEV_CODE.lure）を tools/eval/lure.json で確かめる。Jev は呼ばない（キー不要）
# 使い方: python tools/lure_check.py  （外れがあれば終了コード 1）
import sys, os, json
from critique_survey import lure_all

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    d = json.load(open(os.path.join(HERE, "eval", "lure.json"), encoding="utf-8"))
    bad = 0
    for want in ("hit", "no"):
        rs = lure_all(d[want])
        ok = sum(r["hit"] == (want == "hit") for r in rs)
        print(f"■ {want}: {ok}/{len(rs)} が正しい")
        for t, r in zip(d[want], rs):
            if r["hit"] != (want == "hit"):
                bad += 1
                print(f"  × {t}  [{' / '.join(r['matches'])}]")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
