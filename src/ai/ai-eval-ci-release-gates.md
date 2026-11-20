---
title: "模型或 Prompt 变更后，CI 怎样用评测决定能不能发布？"
description: "通过同题对照、关键分组和发布报告控制模型回归。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "项目实战"
  - "进阶"
prev: { text: "AI 功能怎么灰度、怎么评测、怎么兜底？", link: "/ai/ai-feature-rollout-guard.html" }
next: { text: "Java 工单 Agent 的接口与模块应怎样划分？", link: "/ai/ai-agent-java-project.html" }
---

# 模型或 Prompt 变更后，CI 怎样用评测决定能不能发布？

> 让当前线上版本和候选版本回答同一批问题，再按业务后果分别判断能否放行。

## 答对的工单更多了，为什么还要挡住发布？

工单助手换了一个更短的 Prompt。客服问“这单处理到哪一步了”，新版本更常找到正确的状态。在同样的模拟故障里，旧版本遇到“升级已提交、回复超时”时会查到那条升级记录，新版本却回复“提交失败，请重新发起”。审计中只有一条升级记录，错误在于把已完成的操作报成失败，客服照着回复操作就会重新发起升级。

| 场景       | 同题数 | 当前版本通过 | 候选版本通过 | 新通过 | 新失败 |
| ---------- | ------ | ------------ | ------------ | ------ | ------ |
| 普通查询   | 9      | 5            | 8            | 3      | 0      |
| 审批与恢复 | 3      | 3            | 2            | 0      | 1      |
| 汇总       | 12     | 8            | 10           | 3      | 1      |

“新通过”指旧版失败、新版通过。“新失败”指旧版通过、新版失败。两版都失败的题也要留在报告里，它们对应已知问题。总体通过率增加了约 16.7 个百分点。审批与恢复组少过了一题，对应一条明确的业务回归。

上线门槛先定好。跨租户泄露、未授权写入和重复升级一旦由可信记录确认，直接阻断。对已承诺支持的关键流程，还可设置逐题门槛，例如“已提交的任务必须能取得可核对的终态”。总体成功率用于观察，有证据的关键失败单独处理。合并后的灰度规则另见[灰度与评测准入](./ai-feature-rollout-guard.html)。

## 怎样保证两版真的在做同一道题？

每题固定 `caseId`，再固定输入、初始权限、数据快照、故障脚本和预期结果。比如 `E03` 的初始工单、审批记录、调用超时点和预期终态都写进用例。两版各恢复一份干净的环境，免得旧版刚创建的升级记录被新版拿来当成功证据。

| 要锁定的内容 | 在工单案例里怎么做                                                                   |
| ------------ | ------------------------------------------------------------------------------------ |
| 评测集与评分 | 记录用例集版本或摘要、预期结果、评分器版本、Judge 与其评分细则                       |
| 被测版本     | 用当前已发布的配置作基线，记录两边的模型标识、Prompt、工具定义、采样参数和应用提交   |
| 环境         | 固定知识与权限快照、模型可见工具、业务替身和故障位置，每次尝试前恢复状态             |
| 运行条件     | 固定单题预算、重试与超时口径。真实模型对比保留每次尝试的运行标识和实际返回的模型版本 |

一次只改 Prompt 时，其余条件应一致。若同时换模型与工具配置，结论只适用于整套候选版本。更换评分器或修正用例时，需要用同一版判据重跑两边。历史基线只有在数据、环境、评分口径与运行条件匹配时才可复用。供应商只公开滚动别名时，记录返回的版本和运行时段，并把无法锁定底层版本视为比较的限制。

CI 按预期题号匹配两边，两次运行可以按不同的顺序返回。重复记录当作输入错误，缺题或证据未落盘记为结果未知。如果下游超时原本就是测试输入，稳定复现后导致应用未达到预期，则是业务失败。假如超时来自评测机断网，导致两边记录不齐，则是评测运行问题。两种情况需要不同的重试和修复方式。

## 规则、人工和 Judge 各自要留下什么证据？

审批后的业务检查可以写成确定性断言。比如比较审批票据和工单租户，从数据表与审计事件统计升级次数，再核对终态接口返回。工具读到了正确记录但最后宣告失败时，环境断言通过，终态报告仍失败。候选版本返回的“操作成功”只是一条输出，副作用以测试环境为准。[业务终态与轨迹](./ai-agent-evaluation.html)

“是否清楚解释为什么要补材料”可以交给 Judge。固定评分细则，提供政策证据、参考答案和通过边界，让它返回判定、依据以及“无法判断”。做两版比较时隐藏版本名，对换答案位置后复判。把长短不同但事实一致的回答和已知漏项放入人工标注集，针对关键分组看假通过和假失败。如果两次位置互换结论不一致，送人工复核或当作未定。Judge 更新后用同一批标注重新校准，权限与写入约束仍由代码直接判定。

## 什么时候可以说“证据不足”？

先区分固定用例的业务约束和抽样估计。已经确认有一条越权写入，足以阻断。要声称“新版在生产流量中更稳”，则要看独立题数、每个关键组的样本量和运行波动。将一道题的十次尝试当成十道独立题，会把置信区间画得过窄。重复尝试可按题先聚合，再以题为单位做配对估计。如果一个工单派生了多道高度相关的题，则按工单或会话聚类抽样，保留配对和原有分层。

例如把“候选版本扣除波动后，审批组成功率最多允许降低 2 个百分点”定成一个非劣效门槛。先选好统计方法与置信水平，再计算候选减基线的配对区间。区间下界不低于 −2 个百分点才算达到要求，区间上界低于 −2 个百分点则判退步，区间跨过边界则补样本或复核。对小组用极少样本拟合出的区间要格外谨慎。百分比门槛用未四舍五入的计数或比值判断，页面展示时再舍入。

同样，“0 次观察到越权”只说明评测集中没有捕捉到越权。即使做了 50 次独立、同分布的试验且一次也没撞到越权，单侧 95% 的精确上界仍约为 5.8%（解 `(1 - p)^50 = 0.05`）。有意挑选的对抗用例通常达不到这个抽样假设，直接报告覆盖和计数更诚实。

## 怎样在本地复现三种发布决定？

下面的 Node 脚本用合成判定记录演示发布报告。每一行的左右两列是同一题的已评分结果。示例策略要求所有题有记录、关键流程逐题通过、零已知安全违规，汇总分数只作诊断。保存为 `eval-gate.mjs` 后可直接运行。

```javascript
import { argv } from "node:process";

const mode = argv[2];
const modes = ["regression", "pass", "incomplete", "violation"];
if (!modes.includes(mode)) throw new Error("mode: " + modes.join(", "));

const cases = [
  // 题号、场景、基线是否通过、候选是否通过
  ["Q01", "query", true, true],
  ["Q02", "query", true, true],
  ["Q03", "query", true, true],
  ["Q04", "query", true, true],
  ["Q05", "query", true, true],
  ["Q06", "query", false, true],
  ["Q07", "query", false, true],
  ["Q08", "query", false, true],
  ["Q09", "query", false, false],
  ["E01", "critical", true, true],
  ["E02", "critical", true, true],
  ["E03", "critical", true, false],
];

const baseline = new Map(cases.map(([id, , passed]) => [id, { passed }]));
const candidate = new Map(
  cases
    .filter(([id]) => !(mode === "incomplete" && id === "E03"))
    .map(([id, , , passed]) => [
      id,
      {
        passed: id === "E03" && (mode === "pass" || mode === "violation") ? true : passed,
        violation: mode === "violation" && id === "E01",
      },
    ]),
);

const paired = cases.map(([id, group]) => ({
  id,
  group,
  baseline: baseline.get(id),
  candidate: candidate.get(id),
}));
const complete = paired.filter((row) => row.baseline && row.candidate);
const missing = paired.filter((row) => !row.baseline || !row.candidate).map(({ id }) => id);
const violations = paired.filter((row) => row.candidate?.violation).map(({ id }) => id);

function summarize(rows) {
  const improved = rows.filter((row) => !row.baseline.passed && row.candidate.passed);
  const regressed = rows.filter((row) => row.baseline.passed && !row.candidate.passed);
  const stillFailing = rows.filter((row) => !row.baseline.passed && !row.candidate.passed);
  return {
    n: rows.length,
    baselinePassed: rows.filter((row) => row.baseline.passed).length,
    candidatePassed: rows.filter((row) => row.candidate.passed).length,
    wins: improved.map(({ id }) => id),
    losses: regressed.map(({ id }) => id),
    bothFailed: stillFailing.map(({ id }) => id),
  };
}

const critical = complete.filter((row) => row.group === "critical");
const criticalFailures = critical.filter((row) => !row.candidate.passed).map(({ id }) => id);
let decision = "PASS";
if (violations.length > 0 || criticalFailures.length > 0) decision = "BLOCK";
else if (missing.length > 0) decision = "INSUFFICIENT";

console.log(
  JSON.stringify(
    {
      decision,
      expected: cases.length,
      overall: summarize(complete),
      query: summarize(complete.filter((row) => row.group === "query")),
      critical: summarize(critical),
      missing,
      violations,
      criticalFailures,
    },
    null,
    2,
  ),
);
process.exitCode = { PASS: 0, BLOCK: 1, INSUFFICIENT: 2 }[decision];
```

| 命令                            | 决定与退出码      | 报告里应看到什么                             |
| ------------------------------- | ----------------- | -------------------------------------------- |
| `node eval-gate.mjs regression` | `BLOCK`，1        | 总体从 8/12 到 10/12，`E03` 退步并被阻断     |
| `node eval-gate.mjs pass`       | `PASS`，0         | 11/12 通过，关键用例全过                     |
| `node eval-gate.mjs incomplete` | `INSUFFICIENT`，2 | `E03` 缺失，汇总只有 11 对有效记录           |
| `node eval-gate.mjs violation`  | `BLOCK`，1        | 业务判据通过 11/12，`E01` 的安全违规单独阻断 |

生产报告还应带上用例与判据版本、两边的运行号、关键失败的脱敏轨迹或记录引用。上例中 `Q09` 两版都失败，离线报告也要保留这条已知问题。分组与汇总通过数只覆盖配对齐全的记录，缺少配对的题号在 `missing` 里复核。

## 延迟、成本和合并检查怎样合到发布流程里？

用同一套负载与并发上限测首字和总时延。冷启动与预热分开标记。若 P95 只统计成功请求，就同时报告成功样本数、超时数和超时率门槛，以免大量超时掩盖尾延迟。成本包含同一业务任务产生的所有尝试与补偿请求，保留实际用量和价格版本，断流拿不到用量时单列未知项。每任务成本及每成功任务成本一起看，更容易发现“单次调用便宜了，重试变多反而更贵”。[首字等待与生成耗时](./ai-llm-inference-latency.html)

PR 上可以先跑使用测试替身的业务检查与少量稳定用例，运行条件可控、失败容易定位。从真实模型获得的对照证据可在受信任的预发布流程里生成和留存，发布时校验报告对应的候选提交、模型配置和评测版本。报告缺失或版本不符时重新评测。一个通过的单元测试运行与一份通过的模型回归报告对应不同的检查。

以 GitHub Actions 为例，把必跑的评测步骤放入名称稳定的检查，在分支规则里配置为 required status check。上传报告的步骤可以用 `if: always()` 在评测失败后保留证据，门槛步骤的非零退出码仍需让检查失败。工作流受路径过滤而未触发时，必要检查可能一直等待。工作流运行了但评测任务被条件跳过时，GitHub 又可能将其视为通过。让必需检查实际运行，并在报告里明确记下通过、失败、证据不足或无需评测的判定。启用合并队列时，同一检查还需要响应 `merge_group`。实际发布时再对照将部署的制品与报告，核对候选版本一致。

## 小结

1. 按用例对齐基线和候选，报告分组、配对胜负和缺证据数，避免总体分数吞掉关键场景。
2. 评测配置和门槛先锁定，有可信证据的越权、重复写入及关键业务回归可以单独阻断。
3. 固定用例检查与抽样推断有不同判据。无法排除不可接受的退步时，报告证据不足。
4. 业务终态由环境验证，Judge 用在语义质量上，评分细则和人工校准一起版本化。
5. 让非零退出码阻断流程，保留可复核报告，并在发布前核对候选制品与报告版本。

## 参考

综合仓库 `docs/` 下的大模型评测与持续回归资料，交叉核对 Agent 终态判定、评分器校准、二项比例上界及 GitHub 合并检查。评测规模需由关键分组、预期精度和风险约束决定，固定样本量只适合说明预算与覆盖的取舍。

- [Anthropic《Demystifying evals for AI agents》](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [GitHub Docs《Require status checks to pass before merging》](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-status-checks-to-pass-before-merging)
- [GitHub Docs《Troubleshooting required status checks》](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [NIST 二项比例与小样本精确区间](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)

本地用 Node.js 运行四种合成记录，核对退出码、同题胜负、关键失败题号和缺记录题号。示例验证报告和准入逻辑，模型表现、成本与延迟仍需通过实际评测测量。
