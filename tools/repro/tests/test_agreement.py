#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""agreement.py 的回归测试。

覆盖用户指定的六个场景：
  1. 空输入
  2. 重复 blindId
  3. 单标签类别（只有一种取值）
  4. 全一致
  5. 完全不一致
  6. n=8 时两种中位数口径

运行：
    cd tools/repro && python -m unittest discover -s tests -v
"""
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPRO = os.path.dirname(HERE)
sys.path.insert(0, REPRO)

import agreement  # noqa: E402


def write(tmp, name, rows):
    path = os.path.join(tmp, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    return path


def loop_rows(flags):
    """按 yes/no 序列造一份最小标注。"""
    return [{"blindId": f"R{i+1:02d}", "loop": "yes" if f else "no"} for i, f in enumerate(flags)]


class TestCohensKappa(unittest.TestCase):
    def test_perfect_agreement(self):
        pairs = [("yes", "yes")] * 5 + [("no", "no")] * 3
        r = agreement.cohen_kappa(pairs)
        self.assertEqual(r["n"], 8)
        self.assertEqual(r["observed_agreement"]["num"], 8)
        self.assertEqual(r["observed_agreement"]["value"], 1.0)
        self.assertEqual(r["kappa"], 1.0)

    def test_complete_disagreement(self):
        # 两边完全反着判：观察一致率为 0
        pairs = [("yes", "no")] * 4 + [("no", "yes")] * 4
        r = agreement.cohen_kappa(pairs)
        self.assertEqual(r["observed_agreement"]["num"], 0)
        self.assertEqual(r["observed_agreement"]["value"], 0.0)
        self.assertLess(r["kappa"], 0)

    def test_single_label_category(self):
        # 两人对所有条目都判 yes：机会一致率为 1，κ 无定义
        pairs = [("yes", "yes")] * 8
        r = agreement.cohen_kappa(pairs)
        self.assertEqual(r["expected_agreement"]["value"], 1.0)
        self.assertIsNone(r["kappa"])
        self.assertEqual(r["labels"], ["yes"])

    def test_confusion_sums_to_n(self):
        pairs = [("yes", "yes")] * 6 + [("no", "yes")] * 2
        r = agreement.cohen_kappa(pairs)
        self.assertEqual(sum(r["confusion"].values()), r["n"])
        self.assertEqual(r["observed_agreement"]["den"], r["n"])
        self.assertEqual(r["confusion"]["yes__yes"], 6)
        self.assertEqual(r["confusion"]["no__yes"], 2)


class TestMedianDual(unittest.TestCase):
    def test_n8_two_definitions(self):
        # 与批次 A 的八对起点差同构：常规中位取第 4、5 个的平均，上中位取第 5 个
        values = [0, 100, 150, 200, 260, 300, 400, 500]
        r = agreement.median_dual(values)
        self.assertEqual(r["median_standard"], 230.0)   # (200+260)/2
        self.assertEqual(r["median_upper"], 260)
        self.assertEqual(r["n"], 8)

    def test_odd_n_same(self):
        r = agreement.median_dual([1, 2, 3])
        self.assertEqual(r["median_standard"], 2)
        self.assertEqual(r["median_upper"], 2)

    def test_empty(self):
        r = agreement.median_dual([])
        self.assertIsNone(r["median_standard"])
        self.assertIsNone(r["median_upper"])


class TestInputValidation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        for name in os.listdir(self.tmp):
            os.remove(os.path.join(self.tmp, name))
        os.rmdir(self.tmp)

    def test_empty_input(self):
        p = write(self.tmp, "run1v3-A-human1-answers.json", [])
        with self.assertRaises(agreement.InputError) as ctx:
            agreement.load_labels(p)
        self.assertIn("空数组", str(ctx.exception))

    def test_duplicate_blind_id(self):
        rows = loop_rows([True, True])
        rows[1]["blindId"] = rows[0]["blindId"]
        p = write(self.tmp, "run1v3-A-human1-answers.json", rows)
        with self.assertRaises(agreement.InputError) as ctx:
            agreement.load_labels(p)
        self.assertIn("重复 blindId", str(ctx.exception))

    def test_wrong_subject_count(self):
        p = write(self.tmp, "run1v3-A-human1-answers.json", loop_rows([True] * 5))
        with self.assertRaises(agreement.InputError) as ctx:
            agreement.load_labels(p)
        self.assertIn("受试条目数", str(ctx.exception))

    def test_missing_file(self):
        with self.assertRaises(agreement.InputError):
            agreement.load_labels(os.path.join(self.tmp, "nope.json"))

    def test_id_mismatch(self):
        a = write(self.tmp, "a.json", loop_rows([True, False]))
        b = write(self.tmp, "b.json", [{"blindId": "X99", "loop": "yes"}])
        ids_a = [r["blindId"] for r in json.load(open(a, encoding="utf-8"))]
        with self.assertRaises(agreement.InputError) as ctx:
            agreement.load_labels(b, required_ids=ids_a)
        self.assertIn("blindId 集合", str(ctx.exception))


class TestEndToEnd(unittest.TestCase):
    """用仓库内的真实输入跑一遍，确认与冻结口径一致。"""

    def test_real_inputs(self):
        labels = os.path.join(REPRO, "inputs", "labels")
        out = os.path.join(tempfile.mkdtemp(), "agreement.json")
        code = agreement.main(["--labels", labels, "--out", out, "--expect"])
        self.assertEqual(code, 0)
        payload = json.load(open(out, encoding="utf-8"))
        c4 = payload["conditions"]["C4_batchA_loop"]
        c5 = payload["conditions"]["C5_batchB_loop"]
        c6 = payload["conditions"]["C6_onset_position"]
        # C4
        self.assertEqual(c4["n"], 8)
        self.assertEqual(c4["observed_agreement"]["num"], 6)
        self.assertEqual(c4["kappa"], 0.0)
        # C5
        self.assertEqual(c5["n"], 16)
        self.assertEqual(c5["observed_agreement"]["num"], 16)
        self.assertEqual(c5["kappa"], 1.0)
        self.assertEqual(c5["common_positive"], 15)
        self.assertEqual(c5["common_negative"], 1)
        self.assertEqual(c5["label_source"]["run1v3-B-human1-answers.json"],
                         "reconstructed_from_conversation")
        # C6：两个口径都在
        self.assertEqual(c6["cases"]["all"]["median_standard"], 230.0)
        self.assertEqual(c6["cases"]["all"]["median_upper"], 264)
        self.assertEqual(c6["cases"]["all"]["le100"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
