// 规范一致性检查：每个用例先按 v1.1 冻结规范写出预期，再运行实现对比。
//
// 重要：expected 是**照 v1.1 文档逐条推出来的**，不是运行后填入的。
// 若实际结果与预期不符，记录为「不一致」，并决定是改实现还是改规范——不静默改预期。

export const CASES = [
  // ── 阈值边界：exact_run ──
  {
    id: "E4",
    group: "阈值边界 / exact",
    text: "做。做。做。做。",
    expected: { exact: 4, template: 4, alternating: null },
    hit: false,
    reason: "连续 4 次，低于 ≥5 阈值",
  },
  {
    id: "E5",
    group: "阈值边界 / exact",
    text: "做。做。做。做。做。",
    expected: { exact: 5, template: 5, alternating: null },
    hit: true,
    reason: "连续 5 次，达到阈值",
  },
  {
    id: "E6",
    group: "阈值边界 / exact",
    text: "做。做。做。做。做。做。",
    expected: { exact: 6, template: 6, alternating: null },
    hit: true,
    reason: "连续 6 次，超过阈值",
  },

  // ── 阈值边界：alternating_run ──
  {
    id: "A2x4",
    group: "阈值边界 / alternating",
    text: "好。做。好。做。好。做。好。做。",
    expected: { exact: 1, template: 1, alternating: { period: 2, cycles: 4 } },
    hit: false,
    reason: "p=2 共 4 轮，低于 ≥5 轮",
  },
  {
    id: "A2x5",
    group: "阈值边界 / alternating",
    text: "好。做。好。做。好。做。好。做。好。做。",
    expected: { exact: 1, template: 1, alternating: { period: 2, cycles: 5 } },
    hit: true,
    reason: "p=2 共 5 轮，达到阈值",
  },
  {
    id: "A3x4",
    group: "阈值边界 / alternating",
    text: "做。执行。等待。做。执行。等待。做。执行。等待。做。执行。等待。",
    expected: { exact: 1, template: 1, alternating: { period: 3, cycles: 4 } },
    hit: false,
    reason: "p=3 共 4 轮，低于 ≥5 轮",
  },
  {
    id: "A3x5",
    group: "阈值边界 / alternating",
    text: "做。执行。等待。做。执行。等待。做。执行。等待。做。执行。等待。做。执行。等待。",
    expected: { exact: 1, template: 1, alternating: { period: 3, cycles: 5 } },
    hit: true,
    reason: "p=3 共 5 轮，达到阈值",
  },
  {
    id: "A-PARTIAL",
    group: "阈值边界 / alternating",
    text: "好。做。好。做。好。做。好。做。好。做。好。",
    expected: { exact: 1, template: 1, alternating: { period: 2, cycles: 5 } },
    hit: true,
    reason: "5 个完整周期 + 末尾残缺的 1 句；完整周期数仍为 5，应命中",
  },
  {
    id: "A-P4",
    group: "阈值边界 / alternating",
    text: "甲。乙。丙。丁。甲。乙。丙。丁。甲。乙。丙。丁。甲。乙。丙。丁。甲。乙。丙。丁。",
    expected: { exact: 1, template: 1, alternating: null },
    hit: false,
    reason: "周期 4 不在 p∈{2,3} 范围内，规范不检测 → 应为 null",
  },

  // ── 插句中断 ──
  {
    id: "INT3",
    group: "插句中断",
    text: "做。做。做。现在读日志。做。做。做。",
    expected: { exact: 3, template: 3, alternating: null },
    hit: false,
    reason: "被实质内容打断，两段各 3 次，均未达阈值",
  },
  {
    id: "INT5",
    group: "插句中断",
    text: "做。做。做。做。做。现在读日志。做。做。做。做。做。",
    expected: { exact: 5, template: 5, alternating: null },
    hit: true,
    reason: "两段各 5 次，第一段已达阈值",
  },

  // ── 归一化：标点与空白 ──
  {
    id: "NORM-PUNCT",
    group: "归一化",
    text: "做。做。 做。\n做。",
    expected: { exact: 4, template: 4, alternating: null },
    hit: false,
    reason: "句号分隔 + 尾随空格/换行，归一后连续 4 次，低于阈值",
  },
  {
    id: "NORM-PUNCT5",
    group: "归一化",
    text: "做。做。 做。\n做。做。",
    expected: { exact: 5, template: 5, alternating: null },
    hit: true,
    reason: "5 个「做。」，中间只有空格与换行，归一后连续 5 次",
  },
  {
    id: "SPACE-SEP",
    group: "归一化（已知缺口）",
    text: "做 做 做 做 做。",
    expected: { exact: 1, template: 1, alternating: null },
    hit: false,
    reason: "空格分隔、无句号 → 分句规则视为**一句话**，归一后为「做做做做做」，exact=1。**这是规范缺口：空格分隔的重复检测不到**",
  },
  {
    id: "NORM-BLANK",
    group: "归一化",
    text: "做。\n\n做。\n做。\n\n\n做。\n做。",
    expected: { exact: 5, template: 5, alternating: null },
    hit: true,
    reason: "空行不中断也不计数，归一后连续 5 次",
  },
  {
    id: "NORM-MIXED",
    group: "归一化",
    text: "做。做。好。做。做。",
    expected: { exact: 2, template: 2, alternating: null },
    hit: false,
    reason: "「好。」插入中断，最长连续 2 次",
  },

  // ── 数字模板 ──
  {
    id: "T5",
    group: "数字模板",
    text: "第1步。第2步。第3步。第4步。第5步。",
    expected: { exact: 1, template: 5, alternating: null },
    hit: true,
    reason: "归一化后骨架均为「第#步」，连续 5 次",
  },
  {
    id: "T3",
    group: "数字模板",
    text: "第1步。第2步。第3步。",
    expected: { exact: 1, template: 3, alternating: null },
    hit: false,
    reason: "骨架连续 3 次，低于阈值",
  },
  {
    id: "T-CN",
    group: "数字模板",
    text: "第一步。第二步。第三步。第四步。第五步。",
    expected: { exact: 1, template: 5, alternating: null },
    hit: true,
    reason: "中文数字也应归一为 #，连续 5 次",
  },

  // ── 合法重复：规则会命中，但性质未定 ──
  // 注意：这些用例的输入**确实构成同骨架连续**，才能测出规则的误报面。
  {
    id: "LEGIT-LIST",
    group: "合法重复（命中但不等于退化）",
    text: "第1步。第2步。第3步。第4步。第5步。",
    expected: { exact: 1, template: 5, alternating: null },
    hit: true,
    reason: "与 T5 同一输入。规则命中 template=5。**若这是合法步骤编号，则命中不代表退化**——规则无法区分",
  },
  {
    id: "LEGIT-CODE",
    group: "合法重复（命中但不等于退化）",
    text: "x = 1\nx = 2\nx = 3\nx = 4\nx = 5",
    expected: { exact: 1, template: 5, alternating: null },
    hit: true,
    reason: "连续 5 行同结构赋值，无句号 → 每行一句，模板归一为「x=#」，连续 5 次命中。合法代码",
  },
  {
    id: "LEGIT-TABLE",
    group: "合法重复（命中但不等于退化）",
    text: "| a | 1 |\n| a | 2 |\n| a | 3 |\n| a | 4 |\n| a | 5 |",
    expected: { exact: 1, template: 5, alternating: null },
    hit: true,
    reason: "连续 5 行同结构表格行，模板归一为「|a|#|」，连续 5 次命中。合法表格",
  },
  {
    id: "LEGIT-LIST-INTERLEAVED",
    group: "合法重复（不命中）",
    text: "第1步。安装依赖。\n第2步。配置环境。\n第3步。运行测试。\n第4步。检查日志。\n第5步。部署上线。",
    expected: { exact: 1, template: 1, alternating: null },
    hit: false,
    reason: "带内容的步骤列表：分句后「第1步。」与「安装依赖。」交替，骨架**不连续** → 不命中。说明规则对这类合法清单反而安全",
  },

  // ── 多指标同时命中 ──
  {
    id: "MULTI-E-T",
    group: "多指标",
    text: "做。做。做。做。做。第1步。第2步。第3步。第4步。第5步。",
    expected: { exact: 5, template: 5, alternating: null },
    hit: true,
    reason: "前半 exact=5，后半 template=5，两指标同时命中",
  },
  {
    id: "MULTI-A-E",
    group: "多指标",
    text: "做。做。做。做。做。好。做。好。做。好。做。好。做。好。做。",
    expected: { exact: 5, template: 5, alternating: { period: 2, cycles: 5 } },
    hit: true,
    reason: "开头 exact=5；尾部「做/好」交替 5 轮。注意交替单元可能因开头 5 个「做」而被切成「做/好」起于第二个做——预期仍应识别出 p=2×5",
  },

  // ── 不应命中的反例 ──
  {
    id: "NEG-NORMAL",
    group: "不应命中",
    text: "我需要读取台账确认 F6 节。然后检查 F7 是否已经记录了结果。如果没有，就更新 F6。",
    expected: { exact: 1, template: 1, alternating: null },
    hit: false,
    reason: "正常推理，无重复",
  },
  {
    id: "NEG-SHORT",
    group: "不应命中",
    text: "做。做。做。好。读文件。做。",
    expected: { exact: 3, template: 3, alternating: null },
    hit: false,
    reason: "零散重复，最长 3 次，均低于阈值",
  },
  {
    id: "NEG-AA-B",
    group: "不应命中",
    text: "做。做。好。做。做。好。做。做。好。做。做。好。",
    expected: { exact: 2, template: 2, alternating: null },
    hit: false,
    reason: "单元「做/做/好」内部有相邻相同项，按规范应归 exact（而 exact 只有 2），不应判为 alternating",
  },
];
