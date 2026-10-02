# 回帰評価: tools/eval/cases.json の文を今の checks.js の問いで Jev にかけ、閾値での誤検知・取りこぼしを出す。
# 使い方（問いや閾値を変える前後に）: TYPESAFE_API_KEY を設定して  python tools/eval_run.py [--only bait] [--repeat 3] [--limit 15] [--out r.json]
# 失敗（誤検知・取りこぼし）があれば終了コード 1。
import sys, re, json, os, time, argparse, urllib.request, urllib.error, concurrent.futures as cf, statistics

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "jev-1.13.0"


def parse_checks(path):
    """checks.js から {検査名: {qs: [問いの原文], high: 閾値}} を作る。検査名は JEV_PILLARS の id と JEV_PRESETS の label。"""
    src = open(path, encoding="utf-8").read()
    qblock = src.split("const JEV_QUESTIONS", 1)[1].split("\n};", 1)[0]
    Q = {k: json.loads('"' + v + '"') for k, v in re.findall(r'^\s+(\w+): "(.*)",$', qblock, re.M)}
    pblock = src.split("const JEV_PILLARS", 1)[1].split("\n};", 1)[0]
    checks = {}
    for m in re.finditer(r'^  (\w+): \{\n(.*?)^  \},', pblock, re.M | re.S):
        body = m.group(2)
        qs = re.search(r'^\s+qs: \[(.*?)\]', body, re.M)
        hi = re.search(r'defaults: \{[^}]*high: (\d+)', body)
        keys = re.findall(r'"(\w+)"', qs.group(1)) if qs else []
        if keys and hi:
            checks[m.group(1)] = {"qs": [Q[k] for k in keys], "high": int(hi.group(1))}
    prblock = src.split("const JEV_PRESETS", 1)[1].split("\n];", 1)[0]
    # 先頭が label: のオブジェクトごとに、label / high / condition を読む（old: の中の condition は拾わない）
    for chunk in re.split(r'(?=\blabel: ")', prblock)[1:]:
        lab = re.match(r'label: "([^"]+)"', chunk)
        hi = re.search(r'\bhigh: (\d+)', chunk)
        con = re.search(r'\bcondition: "((?:[^"\\]|\\.)*)"', chunk)
        if lab and hi and con:
            checks[lab.group(1)] = {"qs": [json.loads('"' + con.group(1) + '"')], "high": int(hi.group(1))}
    return checks


def ask(state, questions):
    body = json.dumps({"state": state, "model": MODEL, "questions": questions}).encode()
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=body, headers={
        "Authorization": "Bearer " + os.environ["TYPESAFE_API_KEY"], "Content-Type": "application/json"})
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500:
                raise  # 4xx（キー・形の誤り）は再試行しても同じ
            last = e
        except Exception as e:
            last = e
        time.sleep(2 ** i)
    raise last


def score_case(case, checks):
    need = list(case["expect"])
    qtexts = sorted({q for c in need for q in checks[c]["qs"]})
    qid = {q: f"q{i}" for i, q in enumerate(qtexts)}
    r = ask(case["text"], {qid[q]: {"type": "noul", "instructions": q} for q in qtexts})
    ans = {q: r["answers"][qid[q]]["noul"] for q in qtexts}
    out = {}
    for c in need:
        p = 1.0
        for q in checks[c]["qs"]:
            p *= ans[q]
        out[c] = round(p * 100, 1)
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="この検査だけ（bait / flame / dema / stereo / source / 誇張 / 釣りタイトル / 宣伝・勧誘）")
    ap.add_argument("--repeat", type=int, default=0, help="各文を追加で N 回再実行し、スコアのばらつきを出す")
    ap.add_argument("--ids", help="カンマ区切りの case id だけ使う")
    ap.add_argument("--limit", type=int, help="N 件に均等に間引く")
    ap.add_argument("--out")
    a = ap.parse_args()
    checks = parse_checks(os.path.join(HERE, "..", "checks.js"))
    cases = json.load(open(os.path.join(HERE, "eval", "cases.json"), encoding="utf-8"))
    for c in cases:
        c["expect"] = {k: v for k, v in c.get("expect", {}).items()
                       if v in ("hit", "no") and k in checks and (not a.only or k == a.only)}
    cases = [c for c in cases if c["expect"]]
    if a.ids:
        want = set(a.ids.split(","))
        cases = [c for c in cases if c["id"] in want]
    if a.limit and len(cases) > a.limit:
        step = len(cases) / a.limit
        cases = [cases[int(i * step)] for i in range(a.limit)]
    n = 1 + a.repeat
    jobs = [(c, i) for c in cases for i in range(n)]
    def safe(j):  # 1件の失敗で全体の結果を捨てない
        try:
            return score_case(j[0], checks)
        except Exception as e:
            print(f"失敗 {j[0]['id']}: {e}", file=sys.stderr)
            return None

    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(safe, jobs))
    runs = {c["id"]: [] for c in cases}
    for (c, _), r in zip(jobs, res):
        if r is not None:
            runs[c["id"]].append(r)
    runs = {cid: rs for cid, rs in runs.items() if rs}
    cases = [c for c in cases if c["id"] in runs]
    scores = {cid: {k: statistics.mean(r[k] for r in rs) for k in rs[0]} for cid, rs in runs.items()}

    fails = []
    print(f"{'check':<12}{'thr':>4}{'hit n':>6}{'hit min':>8}{'no n':>5}{'no max':>8}{'FP':>4}{'miss':>5}")
    for ck in checks:
        hs = [(c, scores[c["id"]][ck]) for c in cases if c["expect"].get(ck) == "hit"]
        ns = [(c, scores[c["id"]][ck]) for c in cases if c["expect"].get(ck) == "no"]
        if not hs and not ns:
            continue
        thr = checks[ck]["high"]
        miss = [(c, s) for c, s in hs if s < thr]
        fp = [(c, s) for c, s in ns if s >= thr]
        hmin = min((s for _, s in hs), default=float("nan"))
        nmax = max((s for _, s in ns), default=float("nan"))
        print(f"{ck:<12}{thr:>4}{len(hs):>6}{hmin:>8.1f}{len(ns):>5}{nmax:>8.1f}{len(fp):>4}{len(miss):>5}")
        fails += [(ck, "FP", c, s, thr) for c, s in fp] + [(ck, "MISS", c, s, thr) for c, s in miss]
    if fails:
        print("\n失敗:")
        for ck, kind, c, s, thr in fails:
            print(f"[{ck}] {kind} {s:.1f} (閾値 {thr}) {c['id']}: {c['text']!r}")
    if a.repeat:
        print(f"\nばらつき（同じ文を {n} 回、検査ごと）:")
        for ck in checks:
            devs, rngs = [], []
            for c in cases:
                if ck in c["expect"]:
                    v = [r[ck] for r in runs[c["id"]]]
                    m = statistics.mean(v)
                    devs += [abs(x - m) for x in v]
                    rngs.append(max(v) - min(v))
            if rngs:
                print(f"{ck:<12}mean|dev| {statistics.mean(devs):.2f}  max|dev| {max(devs):.2f}  max range {max(rngs):.1f}  range>0: {sum(r > 0 for r in rngs)}/{len(rngs)}")
    if a.out:
        json.dump({"scores": scores, "runs": runs, "thresholds": {k: v["high"] for k, v in checks.items()}},
                  open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
