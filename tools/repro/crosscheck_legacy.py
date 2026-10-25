#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""agreement.py 与旧脚本的迁移对拍。

不只比「都输出 16/16 和 κ=1」，还要比分母、机会一致率、混淆矩阵合计、
共同阳性/阴性，以及 C6 的中位数两口径，避免两个脚本算的不是同一件事。

用法：
    cd tools/repro
    python crosscheck_legacy.py

任一项不符退出码 1。
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def run(cmd):
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", shell=False)
    return r.returncode, r.stdout or "", r.stderr or ""


def main() -> int:
    tmp = tempfile.mkdtemp()
    new_out = os.path.join(tmp, "agreement.json")

    code, out, err = run([sys.executable, "agreement.py", "--out", new_out, "--expect"])
    if code != 0:
        print("agreement.py 运行失败：", err)
        return 1
    new = json.load(open(new_out, encoding="utf-8"))

    # 旧脚本
    legacy_kappa_out = os.path.join(tmp, "verify-kappa.json")
    code_k, out_k, err_k = run(["node", "verify-kappa.mjs", "--out", legacy_kappa_out])
    legacy_onset_out = os.path.join(tmp, "verify-onset.json")
    code_o, out_o, err_o = run(["node", "verify-onset.mjs", "--out", legacy_onset_out])
    if code_k != 0 or code_o != 0:
        print("旧脚本运行失败：", err_k, err_o)
        return 1
    leg_k = json.load(open(legacy_kappa_out, encoding="utf-8"))
    leg_o = json.load(open(legacy_onset_out, encoding="utf-8"))

    bad = []

    def cmp(name, a, b, tol=5e-5):
        """旧脚本的 JSON 把 po/pe/κ 截到 4 位小数，比较口径要按它对齐。
        新脚本保留 6 位，精度更高，差异只应出现在第 5 位之后。"""
        if a is None and b is None:
            return
        if a is None or b is None or abs(a - b) > tol:
            bad.append(f"{name}: 新 {a} vs 旧 {b}")

    # ---- C4 / C5：数值 ----
    for key, set_name in (("C4_batchA_loop", "A"), ("C5_batchB_loop", "B")):
        n = new["conditions"][key]
        old = next(r for r in leg_k["results"] if r["set"] == set_name and r["dim"] == "loop")
        cmp(f"{key} n", n["n"], old["n"])
        cmp(f"{key} 观察一致", n["observed_agreement"]["value"], old["po"])
        cmp(f"{key} 机会一致", n["expected_agreement"]["value"], old["pe"])
        cmp(f"{key} κ", n["kappa"], old["kappa"])
        # 语义：一致率分母必须等于 n
        if n["observed_agreement"]["den"] != n["n"]:
            bad.append(f"{key} 一致率分母 {n['observed_agreement']['den']} != n={n['n']}")
        # 语义：混淆矩阵（按标签顺序展开）合计 = n
        total = sum(n["confusion"].values())
        if total != n["n"]:
            bad.append(f"{key} 混淆矩阵合计 {total} != n={n['n']}")
        # 语义：一致数 = 对角元之和
        diag = sum(v for k, v in n["confusion"].items() if k.split("__")[0] == k.split("__")[1])
        if diag != n["observed_agreement"]["num"]:
            bad.append(f"{key} 对角元 {diag} != 观察一致数 {n['observed_agreement']['num']}")

    # ---- C5：共同阳性/阴性，且与混淆矩阵自洽 ----
    c5 = new["conditions"]["C5_batchB_loop"]
    if c5["common_positive"] != leg_k["batch_b_common"]["positive"]:
        bad.append(f"C5 共同阳性：新 {c5['common_positive']} vs 旧 {leg_k['batch_b_common']['positive']}")
    if c5["common_negative"] != leg_k["batch_b_common"]["negative"]:
        bad.append(f"C5 共同阴性：新 {c5['common_negative']} vs 旧 {leg_k['batch_b_common']['negative']}")
    if c5["common_positive"] != c5["confusion"].get("yes__yes", 0):
        bad.append("C5 共同阳性与混淆矩阵 yes__yes 不一致")
    if c5["common_negative"] != c5["confusion"].get("no__no", 0):
        bad.append("C5 共同阴性与混淆矩阵 no__no 不一致")

    # ---- C5：标签来源必须标成重建件 ----
    src = c5["label_source"]
    if any(v != "reconstructed_from_conversation" for v in src.values()):
        bad.append(f"C5 标签来源标注不对：{src}")

    # ---- C6：n / ≤100 / 两个中位数口径 ----
    c6 = new["conditions"]["C6_onset_position"]["cases"]
    for new_key, old_key in (("all", "all"), ("drop_zero", "dropZero"), ("strict", "strict")):
        g = c6[new_key]
        o = leg_o["results"][old_key]
        cmp(f"C6 {new_key} n", g["n"], o["n"])
        cmp(f"C6 {new_key} ≤100", g["le100"], o["le100"])
        # 旧脚本用的是上中位；新脚本主字段是常规中位
        cmp(f"C6 {new_key} 上中位（新）vs 旧 median", g["median_upper"], o["median"])
        if g["n"] > 0 and abs(g["median_standard"] - g["median_upper"]) < 1e-9:
            pass  # 奇数样本或恰好相等都合法
        if g["n"] % 2 == 0 and g["n"] > 1:
            if g["median_standard"] == g["median_upper"] and g["values_sorted"][g["n"] // 2 - 1] != g["values_sorted"][g["n"] // 2]:
                bad.append(f"C6 {new_key} 偶数样本两个口径相同但中间两值不同，口径可能算错")

    # ---- 输出 ----
    print("=== 对拍结果 ===")
    print(f"C4: n={new['conditions']['C4_batchA_loop']['n']} "
          f"po={new['conditions']['C4_batchA_loop']['observed_agreement']['value']} "
          f"pe={new['conditions']['C4_batchA_loop']['expected_agreement']['value']} "
          f"κ={new['conditions']['C4_batchA_loop']['kappa']}")
    print(f"C5: n={c5['n']} po={c5['observed_agreement']['value']} "
          f"pe={c5['expected_agreement']['value']} κ={c5['kappa']} "
          f"共同阳性/阴性 {c5['common_positive']}/{c5['common_negative']}")
    for k in ("all", "drop_zero", "strict"):
        g = c6[k]
        print(f"C6 {k}: n={g['n']} 常规中位={g['median_standard']} 上中位={g['median_upper']} "
              f"≤100={g['le100']}/{g['n']}")
    print(f"\n旧脚本 C6 的 median（上中位口径）："
          f"{leg_o['results']['all']['median']} / {leg_o['results']['dropZero']['median']} / "
          f"{leg_o['results']['strict']['median']}")

    if bad:
        print("\n不符项：", file=sys.stderr)
        for b in bad:
            print(f"  {b}", file=sys.stderr)
        return 1
    print("\n数值与字段语义全部一致（C4/C5/C6）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
