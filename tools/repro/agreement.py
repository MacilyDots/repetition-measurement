#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""C4 / C5 / C6 的正式实现：人类间一致率、Cohen's κ、起点位置差。

这是这三项主张的 canonical 脚本。旧的 verify-kappa.mjs 与 verify-onset.mjs
保留为 legacy，仅用于迁移对拍，不再作为引用来源。

用法：
    python agreement.py [--labels DIR] [--expect] [--out FILE]

    --labels   标注目录，默认 <本脚本目录>/inputs/labels
    --expect   按内置期望值断言；任何不符退出码 1
    --out      输出 JSON，默认 <本脚本目录>/outputs/agreement.json

输出是确定性 JSON：无时间戳、键排序稳定、浮点保留 6 位。
同样输入重复运行，文件 sha256 不变。

中位数口径（C6 的关键决定）
    论文 v0.9 及更早用的是「上中位」（排序后取第 floor(n/2) 个，0-indexed），
    这是原脚本的实现细节，不是预注册规则，论文与实验记录都没有写过这个定义。
    因此 v0.10 起主字段改用**常规中位数**（偶数样本取中间两值平均，n=8 时 230），
    同时在 JSON 里保留 `median_upper` 供审计，避免把两个概念混成一个 median。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from typing import Any

SCRIPT_NAME = "agreement.py"
SCRIPT_VERSION = "1.0.0"

# 批次 A 与批次 B 的绕圈判断各自应有多少受试条目
EXPECTED_N = {
    "run1v3-A-human1-answers.json": 8,
    "run1v3-A-human2-answers.json": 8,
    "run1v3-B-human1-answers.json": 16,
    "run1v3-B-human2-answers.json": 16,
    "run1-A-human-answers.json": 8,
    "run1-A-answers.json": 8,
}

# 批次 B 的标签是按对话记录重建的，不能与原始提交混同
LABEL_SOURCE = {
    "run1v3-A-human1-answers.json": "raw_submission",
    "run1v3-A-human2-answers.json": "raw_submission",
    "run1v3-B-human1-answers.json": "reconstructed_from_conversation",
    "run1v3-B-human2-answers.json": "reconstructed_from_conversation",
    "run1-A-human-answers.json": "raw_submission",
    "run1-A-answers.json": "raw_submission",
}


class InputError(Exception):
    """输入文件缺失、结构不对或条目数不符。"""


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_labels(path: str, *, required_ids: list[str] | None = None) -> list[dict[str, Any]]:
    """读一份标注文件并校验结构、条目数与 blindId 唯一性。"""
    name = os.path.basename(path)
    if not os.path.exists(path):
        raise InputError(f"缺少输入文件：{path}")
    try:
        body = json.load(open(path, encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise InputError(f"{name} 不是合法 JSON：{e}") from e
    if not isinstance(body, list):
        raise InputError(f"{name} 顶层应为数组，实际是 {type(body).__name__}")
    if len(body) == 0:
        raise InputError(f"{name} 是空数组")

    ids: list[str] = []
    for i, row in enumerate(body):
        if not isinstance(row, dict):
            raise InputError(f"{name} 第 {i} 条不是对象")
        bid = row.get("blindId") or row.get("id")
        if not bid:
            raise InputError(f"{name} 第 {i} 条缺 blindId/id")
        ids.append(str(bid))

    dup = sorted({x for x in ids if ids.count(x) > 1})
    if dup:
        raise InputError(f"{name} 有重复 blindId：{dup}")

    want = EXPECTED_N.get(name)
    if want is not None and len(body) != want:
        raise InputError(f"{name} 受试条目数应为 {want}，实际 {len(body)}")

    if required_ids is not None and set(ids) != set(required_ids):
        only_a = sorted(set(ids) - set(required_ids))
        only_b = sorted(set(required_ids) - set(ids))
        raise InputError(f"{name} 的 blindId 集合与另一份不一致：多 {only_a}，少 {only_b}")
    return body


def as_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(r.get("blindId") or r.get("id")): r for r in rows}


def cohen_kappa(pairs: list[tuple[str, str]]) -> dict[str, Any]:
    """Cohen's κ，并给出一致率与机会一致率的分子/分母。"""
    n = len(pairs)
    if n == 0:
        return {
            "n": 0,
            "confusion": {},
            "observed_agreement": {"num": 0, "den": 0, "value": None},
            "expected_agreement": {"value": None},
            "kappa": None,
        }
    agree = sum(1 for a, b in pairs if a == b)
    labels = sorted({x for pair in pairs for x in pair})
    row_counts = {v: 0 for v in labels}
    col_counts = {v: 0 for v in labels}
    confusion: dict[str, int] = {}
    for a, b in pairs:
        row_counts[a] += 1
        col_counts[b] += 1
        key = f"{a}__{b}"
        confusion[key] = confusion.get(key, 0) + 1
    po = agree / n
    pe = sum((row_counts[v] / n) * (col_counts[v] / n) for v in labels)
    kappa = None if abs(1 - pe) < 1e-12 else (po - pe) / (1 - pe)
    return {
        "n": n,
        "labels": labels,
        "confusion": dict(sorted(confusion.items())),
        "row_counts": dict(sorted(row_counts.items())),
        "col_counts": dict(sorted(col_counts.items())),
        "observed_agreement": {"num": agree, "den": n, "value": round(po, 6)},
        "expected_agreement": {"value": round(pe, 6)},
        "kappa": None if kappa is None else round(kappa, 6),
    }


def median_dual(values: list[float]) -> dict[str, Any]:
    """同时给常规中位数与上中位数，口径差异显式化。"""
    s = sorted(values)
    n = len(s)
    if n == 0:
        return {"n": 0, "values_sorted": [], "median_standard": None, "median_upper": None}
    upper = s[n // 2]  # 原脚本口径：取第 floor(n/2) 个（0-indexed）
    if n % 2 == 1:
        standard = s[n // 2]
    else:
        standard = (s[n // 2 - 1] + s[n // 2]) / 2
    return {
        "n": n,
        "values_sorted": s,
        "median_standard": standard,
        "median_upper": upper,
    }


def pos_of(row: dict[str, Any]) -> float | None:
    p = row.get("pos")
    if p is None or p == "":
        return None
    return float(p)


def has_tag(row: dict[str, Any], tag: str) -> bool:
    main = str(row.get("main") or "")
    also = row.get("also") or []
    if not isinstance(also, list):
        also = [also]
    return main == tag or tag in [str(x) for x in also]


def build_batch_agreement(label: str, path1: str, path2: str, rows1, rows2) -> dict[str, Any]:
    """批次级一致率。同一个 blindId 两条标注配对。"""
    m1, m2 = as_map(rows1), as_map(rows2)
    ids = sorted(set(m1) & set(m2))
    pairs = []
    for bid in ids:
        a, b = m1[bid].get(label), m2[bid].get(label)
        pairs.append((str(a), str(b)))
    base = cohen_kappa(pairs)
    pos = sum(1 for a, b in pairs if a == b and a == "yes")
    neg = sum(1 for a, b in pairs if a == b and a == "no")
    base.update({
        "label": label,
        "common_positive": pos,
        "common_negative": neg,
        "label_source": {
            os.path.basename(path1): LABEL_SOURCE.get(os.path.basename(path1), "unknown"),
            os.path.basename(path2): LABEL_SOURCE.get(os.path.basename(path2), "unknown"),
        },
    })
    return base


def build_onset(rowsA: list[dict[str, Any]], rowsB: list[dict[str, Any]]) -> dict[str, Any]:
    """批次 A 的起点位置差，三种分母口径。"""
    mA, mB = as_map(rowsA), as_map(rowsB)
    ids = sorted(set(mA) & set(mB))
    both = [bid for bid in ids if pos_of(mA[bid]) is not None and pos_of(mB[bid]) is not None]
    zero = [bid for bid in both if pos_of(mA[bid]) == 0 or pos_of(mB[bid]) == 0]
    with_common = []
    for bid in both:
        loop_both = has_tag(mA[bid], "loop") and has_tag(mB[bid], "loop")
        repeat_both = has_tag(mA[bid], "repeat") and has_tag(mB[bid], "repeat")
        common = [t for t, ok in (("loop", loop_both), ("repeat", repeat_both)) if ok]
        if common:
            with_common.append((bid, common))
    single = [bid for bid, c in with_common if len(c) == 1]

    def diffs(subset: list[str]) -> list[float]:
        return sorted(abs(pos_of(mA[b]) - pos_of(mB[b])) for b in subset)

    cases = {
        "all": diffs(both),
        "drop_zero": diffs([b for b in both if b not in zero]),
        "strict": diffs([b for b in single if b not in zero]),
    }
    out: dict[str, Any] = {
        "counts": {
            "paired_ids": len(ids),
            "both_positions_filled": len(both),
            "zero_start": len(zero),
            "shared_anomaly": len(with_common),
            "single_shared_anomaly": len(single),
        },
        "cases": {},
        "label_source": {
            os.path.basename(p): LABEL_SOURCE[p]
            for p in ("run1-A-human-answers.json", "run1-A-answers.json")
        },
        "median_definition": (
            "主字段 median_standard 为常规中位数（偶数样本取中间两值平均）；"
            "median_upper 为原脚本口径（第 floor(n/2) 个），仅供审计"
        ),
    }
    for key, ds in cases.items():
        m = median_dual(ds)
        out["cases"][key] = {
            "n": m["n"],
            "median_standard": m["median_standard"],
            "median_upper": m["median_upper"],
            "le100": sum(1 for d in ds if d <= 100),
            "diffs_sorted": m["values_sorted"],
        }
    return out


# 期望值：median_standard 为 v0.10 起的主口径，median_upper 保留供审计
EXPECT = {
    "C4": {"label": "loop", "n": 8, "po": 0.75, "pe": 0.75, "kappa": 0.0},
    "C5": {"label": "loop", "n": 16, "po": 1.0, "pe": 0.882812, "kappa": 1.0,
           "common_positive": 15, "common_negative": 1},
    "C6": {
        "all": {"n": 8, "median_standard": 230.0, "median_upper": 264, "le100": 0},
        "drop_zero": {"n": 7, "median_standard": 196.0, "median_upper": 196, "le100": 0},
        "strict": {"n": 3, "median_standard": 290.0, "median_upper": 290, "le100": 0},
    },
}


def check_expect(payload: dict[str, Any]) -> list[str]:
    """不只是百分数：分母、混淆矩阵、κ、0/8 分布都要对。"""
    bad: list[str] = []
    c4 = payload["conditions"]["C4_batchA_loop"]
    c5 = payload["conditions"]["C5_batchB_loop"]
    c6 = payload["conditions"]["C6_onset_position"]

    for name, got, want in (("C4", c4, EXPECT["C4"]), ("C5", c5, EXPECT["C5"])):
        if got["n"] != want["n"]:
            bad.append(f"{name} n：期望 {want['n']}，实际 {got['n']}")
        if abs((got["observed_agreement"]["value"] or 0) - want["po"]) > 5e-6:
            bad.append(f"{name} 观察一致：期望 {want['po']}，实际 {got['observed_agreement']['value']}")
        if got["observed_agreement"]["den"] != want["n"]:
            bad.append(f"{name} 一致率分母：期望 {want['n']}，实际 {got['observed_agreement']['den']}")
        if abs((got["expected_agreement"]["value"] or 0) - want["pe"]) > 5e-6:
            bad.append(f"{name} 机会一致：期望 {want['pe']}，实际 {got['expected_agreement']['value']}")
        if abs((got["kappa"] or 0) - want["kappa"]) > 5e-6:
            bad.append(f"{name} κ：期望 {want['kappa']}，实际 {got['kappa']}")
        if sum(got["confusion"].values()) != want["n"]:
            bad.append(f"{name} 混淆矩阵合计：期望 {want['n']}，实际 {sum(got['confusion'].values())}")

    if c5["common_positive"] != EXPECT["C5"]["common_positive"]:
        bad.append(f"C5 共同阳性：期望 15，实际 {c5['common_positive']}")
    if c5["common_negative"] != EXPECT["C5"]["common_negative"]:
        bad.append(f"C5 共同阴性：期望 1，实际 {c5['common_negative']}")

    for key, want in EXPECT["C6"].items():
        got = c6["cases"][key]
        for field in ("n", "median_standard", "median_upper", "le100"):
            if got[field] != want[field]:
                bad.append(f"C6 {key} {field}：期望 {want[field]}，实际 {got[field]}")
    return bad


def main(argv: list[str] | None = None) -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="C4/C5/C6 的正式实现")
    ap.add_argument("--labels", default=os.path.join(here, "inputs", "labels"))
    ap.add_argument("--out", default=os.path.join(here, "outputs", "agreement.json"))
    ap.add_argument("--expect", action="store_true", help="按内置期望值断言，不符退出码 1")
    args = ap.parse_args(argv)

    names = [
        "run1v3-A-human1-answers.json",
        "run1v3-A-human2-answers.json",
        "run1v3-B-human1-answers.json",
        "run1v3-B-human2-answers.json",
        "run1-A-human-answers.json",
        "run1-A-answers.json",
    ]
    paths = {n: os.path.join(args.labels, n) for n in names}
    try:
        A1 = load_labels(paths["run1v3-A-human1-answers.json"])
        A2 = load_labels(paths["run1v3-A-human2-answers.json"],
                         required_ids=[str(r.get("blindId") or r.get("id")) for r in A1])
        B1 = load_labels(paths["run1v3-B-human1-answers.json"])
        B2 = load_labels(paths["run1v3-B-human2-answers.json"],
                         required_ids=[str(r.get("blindId") or r.get("id")) for r in B1])
        H1 = load_labels(paths["run1-A-human-answers.json"])
        H2 = load_labels(paths["run1-A-answers.json"],
                         required_ids=[str(r.get("blindId") or r.get("id")) for r in H1])
    except InputError as e:
        print(f"输入校验失败：{e}", file=sys.stderr)
        return 2

    payload = {
        "script": {"name": SCRIPT_NAME, "version": SCRIPT_VERSION},
        "inputs": {
            "labels_dir": os.path.basename(os.path.normpath(args.labels)),
            "files": [
                {
                    "name": n,
                    "sha256": sha256_of(paths[n]),
                    "bytes": os.path.getsize(paths[n]),
                    "label_source": LABEL_SOURCE[n],
                }
                for n in names
            ],
        },
        "conditions": {
            "C4_batchA_loop": build_batch_agreement(
                "loop", paths["run1v3-A-human1-answers.json"],
                paths["run1v3-A-human2-answers.json"], A1, A2),
            "C5_batchB_loop": build_batch_agreement(
                "loop", paths["run1v3-B-human1-answers.json"],
                paths["run1v3-B-human2-answers.json"], B1, B2),
            "C6_onset_position": build_onset(H1, H2),
        },
        "expect": EXPECT,
    }

    text = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

    c4 = payload["conditions"]["C4_batchA_loop"]
    c5 = payload["conditions"]["C5_batchB_loop"]
    c6 = payload["conditions"]["C6_onset_position"]
    print(f"# C4 批次 A · loop（{c4['label_source']}）")
    print(f"  n={c4['n']} 观察一致 {c4['observed_agreement']['num']}/{c4['observed_agreement']['den']}"
          f" = {(c4['observed_agreement']['value'] or 0) * 100:.1f}%"
          f"｜机会一致 {(c4['expected_agreement']['value'] or 0) * 100:.1f}%"
          f"｜κ={c4['kappa']}")
    print(f"  混淆矩阵 {c4['confusion']}")
    print(f"# C5 批次 B · loop（{c5['label_source']}）")
    print(f"  n={c5['n']} 观察一致 {c5['observed_agreement']['num']}/{c5['observed_agreement']['den']}"
          f" = {(c5['observed_agreement']['value'] or 0) * 100:.1f}%"
          f"｜机会一致 {(c5['expected_agreement']['value'] or 0) * 100:.1f}%"
          f"｜κ={c5['kappa']}")
    print(f"  混淆矩阵 {c5['confusion']}｜共同阳性 {c5['common_positive']}、共同阴性 {c5['common_negative']}")
    print("# C6 起点位置差")
    for key in ("all", "drop_zero", "strict"):
        g = c6["cases"][key]
        print(f"  {key}: n={g['n']}｜常规中位 {g['median_standard']}｜上中位 {g['median_upper']}"
              f"｜≤100 字 {g['le100']}/{g['n']}")
    print(f"\n写入 {args.out}")

    if args.expect:
        bad = check_expect(payload)
        if bad:
            print("\n断言失败：", file=sys.stderr)
            for b in bad:
                print(f"  {b}", file=sys.stderr)
            return 1
        print("\n全部断言通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
