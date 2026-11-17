---
title: "数据质量怎么监控与治理？校验规则和异常排查怎么做？"
description: "从六个质量维度、规则配置到异常排查四步法与数据标准，讲清质量体系怎么落地。"
breadcrumb: true
article: true
editLink: false
category:
  - "数据仓库"
tag:
  - "高频"
  - "排障"
  - "体系化"
prev:
  text: "数仓任务又慢又贵怎么优化？数据倾斜和小文件怎么治？"
  link: "/database/datawarehouse/dw-skew-and-tuning.html"
next:
  text: "数仓场景的手撕 SQL 怎么准备？窗口函数和高频题型有哪些套路？"
  link: "/database/datawarehouse/dw-sql-patterns.html"
---

# 数据质量怎么监控与治理？校验规则和异常排查怎么做？

> 数仓做到最后，比拼的不是模型多漂亮，而是出事那天能不能半小时内说清：哪张表、哪个字段、影响谁、怎么补。

## 为什么说「错的数比没有数更糟」

没有数的时候，业务知道来找你对一下；数错了但看起来很正常的时候，业务会拿它去做决策。`dws_trade_gmv_1d` 因为关联维表没去重，GMV 被放大一倍，报表显示大促效果爆炸，运营追加投放、供应链按虚高销量备货——三天后有人发现转化率低得离谱，钱已经花完、货压在仓里。**空值会被发现，错值会被相信**，所以质量得靠机制盯。再叠一层难度：`ods → dwd → dws → ads` 是分层的，上游一条脏数据逐层放大，每多一层就多一次「我以为是上游的问题」。校验要尽量往上游压，最好在 dwd 拦住——等 ads 出报表才发现时，下游已跑完、报表已被截图发群。

## 六个维度，各查什么

| 维度   | 回答什么问题                               | 一条典型规则                             |
| ------ | ------------------------------------------ | ---------------------------------------- |
| 完整性 | 该有的数据有没有、该填的字段填没填         | 分区行数不低于近 7 日均值的 70%          |
| 唯一性 | 同一业务实体有没有重复记录                 | 订单号在 dwd 最细粒度上不重复            |
| 有效性 | 值本身合不合法（取值域、格式、正负、区间） | `order_status` 落在枚举字典内            |
| 准确性 | 值对不对，与上游或另一条链路能否对上       | dwd 与 dws 的 GMV 差异小于 1 元          |
| 一致性 | 同指标跨表跨层是否一致、关联能否对上       | 明细行的 `user_id` 都能在维表命中        |
| 及时性 | 数据到得够不够早                           | 分区 07:00 前产出，`etl_time` 不晚于 SLA |

### 完整性：先看有没有，再看填没填

```sql
SELECT count(*) AS total,
       sum(if(nullif(trim(user_id), '') IS NULL, 1, 0))                      AS null_cnt,
       round(sum(if(nullif(trim(user_id), '') IS NULL, 1, 0)) / count(*), 4) AS null_rate
FROM dwd_order_detail
WHERE dt = '2024-06-11';
```

`''` 和 `NULL` 在 Hive/Spark SQL 里是两回事，脏数据两种都有，`nullif(trim(col), '')` 一次判掉空白串和 `NULL`。行数波动则是性价比最高的一条规则，一条 SQL 就能揪出「上游没推」「任务空跑」「分区被覆盖写丢」：

```sql
WITH today AS (SELECT count(*) AS c FROM dwd_order_detail WHERE dt = '2024-06-11'),
hist AS (SELECT avg(c) AS avg_7d FROM (
    SELECT dt, count(*) AS c FROM dwd_order_detail
    WHERE dt BETWEEN '2024-06-04' AND '2024-06-10' GROUP BY dt) t)
SELECT today.c AS today_rows, round(hist.avg_7d) AS avg_7d, round(today.c / hist.avg_7d, 3) AS ratio
FROM today CROSS JOIN hist
WHERE today.c < hist.avg_7d * 0.7 OR today.c > hist.avg_7d * 1.5;
```

### 唯一性：重复是安静的错误

重复不报错，只让下游所有 `sum` 悄悄变大。要在事实表**最细粒度**、且**关联维表之前**校验。

```sql
SELECT order_id, count(*) AS cnt
FROM dwd_order_detail
WHERE dt = '2024-06-11'
GROUP BY order_id
HAVING count(*) > 1
ORDER BY cnt DESC
LIMIT 20;
```

别用 `count(distinct order_id) = count(*)` 一句搞定：它只说有重复，给不出重复的是谁，排查还得再写一遍。SCD2 维表天然一 key 多行，判重要用「业务主键 + 生效版本」，否则天天误报。

### 有效性：取值域、日期逻辑、金额边界

```sql
SELECT order_status, count(*) AS cnt FROM dwd_order_detail
WHERE dt = '2024-06-11' AND order_status NOT IN ('CREATED','PAID','SHIPPED','FINISHED','CLOSED')
GROUP BY order_status;
SELECT sum(if(pay_time < create_time, 1, 0)) AS time_reverse, sum(if(pay_amt < 0, 1, 0)) AS negative_amt,
       sum(if(pay_amt > 100000000, 1, 0)) AS unit_suspicious FROM dwd_order_detail WHERE dt = '2024-06-11';
```

最后一行不是抓土豪，是抓**单位错了**——分当元、元当分，都会先在这个上限上炸出来。

### 准确性：对账是唯一靠得住的办法

准确性没法自证，只能跟另一个来源比：上游对账文件，或另一条链路（明细层）。工程上最常用跨层对账，成本低、定位快。

```sql
SELECT coalesce(d.gmv_dwd, 0) AS gmv_dwd, coalesce(s.gmv_dws, 0) AS gmv_dws,
       coalesce(d.gmv_dwd, 0) - coalesce(s.gmv_dws, 0) AS diff
FROM (SELECT dt, sum(pay_amt) / 100 AS gmv_dwd FROM dwd_order_detail
      WHERE dt = '2024-06-11' AND order_status IN ('PAID','SHIPPED','FINISHED') GROUP BY dt) d
FULL JOIN (SELECT dt, sum(gmv) AS gmv_dws FROM dws_trade_gmv_1d WHERE dt = '2024-06-11' GROUP BY dt) s
  ON d.dt = s.dt
WHERE abs(coalesce(d.gmv_dwd, 0) - coalesce(s.gmv_dws, 0)) > 1;
```

用 `FULL JOIN` 而不是 `INNER JOIN`：一边为空时 `INNER JOIN` 直接丢掉这行，对账反而「通过」——这是对账 SQL 最经典的假阴性。

### 一致性：维表能否关联、同指标是否同口径

```sql
SELECT count(*) AS orphan_cnt FROM dwd_order_detail o
LEFT JOIN dim_user u ON o.user_id = u.user_id AND u.dt = '2024-06-11'
WHERE o.dt = '2024-06-11' AND u.user_id IS NULL;
```

孤儿行不一定是脏数据，常见是**维表比事实表晚到**——那该去调调度依赖而不是洗数据，所以这条规则的处置是告警看时间戳，不是阻断。另一层是「同指标跨表同口径」：`dws_trade_gmv_1d` 与 `ads_trade_report_1d` 的 GMV 必须相等。做法是把口径收敛到一个唯一出口（GMV 只在 dws 算一次，ads 只聚合拼接），散落在多张表里迟早长出两个版本。

### 及时性：产出时间也是数据的一部分

看两个字段：`etl_time`（实际写入时间）与 `dt`（业务日期）是否对齐，以及分区产出时刻有没有超过 SLA（如 07:00）。做法是 `select dt, max(etl_time), count(*) from dwd_order_detail where dt >= date_sub('${bizdate}', 7) group by dt`，逐天看产出时间趋势。更可靠的是让调度系统写一张 `meta_task_run`（任务名、业务日期、起止时间、状态），质量任务去查它——能区分「任务没跑」和「跑了但没数据」，比查数据表本身准。

## 规则怎么配置化：一张元数据表 + 一个通用任务

每条规则写一个脚本是最差的做法：三个月后没人知道一共有多少条校验在跑，改个阈值要发版。正确做法是把规则变成**数据**。

```sql
CREATE TABLE meta_dq_rule (
  rule_id     varchar(64)  NOT NULL COMMENT '规则ID，如 dwd_order_detail_uniq_order_id',
  db_table    varchar(128) NOT NULL COMMENT '库.表',
  column_name varchar(128)          COMMENT '字段级规则填字段，表级留空',
  rule_type   varchar(32)  NOT NULL COMMENT 'completeness/uniqueness/validity/accuracy/consistency/timeliness',
  check_sql   text         NOT NULL COMMENT '返回一行指标的校验SQL，${bizdate} 占位',
  expect_expr varchar(255) NOT NULL COMMENT '通过条件，如 ratio >= 0.7 and ratio <= 1.5',
  warn_level  tinyint      NOT NULL COMMENT '1 通知 / 2 告警 / 3 阻断',
  owner       varchar(64)  NOT NULL COMMENT '表负责人'
) COMMENT '数据质量规则元数据';
```

```text
for rule in select * from meta_dq_rule where enabled = 1:
    rows = spark.sql(rule.check_sql.replace("${bizdate}", bizdate)).collect()
    ok   = eval(rule.expect_expr, rows[0].asDict())    # 表达式求值，不写 if-else 分支
    落库 meta_dq_result(rule_id, bizdate, 指标, 是否通过, 耗时)
    if not ok and rule.warn_level == 3: raise BlockDownstream(rule.rule_id)
    if not ok and rule.warn_level == 2: notify(rule.owner, rule.rule_id)
```

三条设计约定：**每条规则 SQL 只返回一行指标**（多行没法统一判断）；**阈值写成表达式而非写死参数**（能表达双条件）；**复杂逻辑封装成视图或中间表**，让规则 SQL 保持一行。这样新增规则 = 插一行数据，不用发版。

## 告警设计与降噪

| 判定方式  | 条件                                      | 适用与代价                                   |
| --------- | ----------------------------------------- | -------------------------------------------- |
| 单阈值    | `rows < 10000`                            | 最省事，业务量一涨就误报，只适合有硬下限的表 |
| 同比/环比 | 今日 / 近 7 日均值 落在 `[0.7, 1.5]` 之外 | 能抓突变，小表抖动剧烈                       |
| 双条件    | 比值越界 **且** 绝对差超阈值              | 推荐做默认，量小波动不吵人                   |
| 兜底      | `rows = 0`                                | 0 行永远必报，不受比值保护                   |

级别决定动作，别只有「发个消息」一种：阻断式（主键重复、对账差异、行数为 0）不启动下游，宁可不产出也不产出错数；告警式（空值率、孤儿行、时效延迟）链路继续跑、当天处理；记录式（偶发枚举越界）只落表进看板。

治告警疲劳三个手段：① 指纹去重，同规则同业务日期只发一次、恢复时补一条；② 变更窗口静默，发布/大促/上游切流期间静默并落日志；③ 误报复盘，连续误报三次的规则必须调阈值或下线——一个没人看的告警等于没有告警。

## 异常排查四步法

从便宜到贵、从外部到内部。大部分问题在前两步就能定位，别一上来翻代码。

1. **上游延迟或为空**：查上游分区 `max(etl_time)`、行数与昨天比、调度里父任务状态。上游没到齐，后面全白查。
2. **口径或逻辑变更**：查需求变更记录、指标定义文档的修改时间、新旧 SQL diff。数字整体平移或按比例变化时，八成是口径动了。
3. **当天有无代码/配置发布**：查发布单、Git 提交、调度参数改动（并行度、过滤条件、依赖）。很多事故不是逻辑写错，是有人顺手加了 `and dt >= '2024-01-01'`。
4. **数据本身异常**：抽样看明细——同一 `order_id` 是否多条、渠道是否多推一遍、补数是否与当天调度重叠写两次。这时候才轮到怀疑脏数据。

每一步都要留证据：分区时间、行数对比、变更记录、抽样明细 SQL。复盘时这些比结论有用。

## 一个案例：GMV 翻倍那晚

背景：`dws_trade_gmv_1d` 平时日均 800 万，某天 1630 万，涨 103%，订单量只涨 8%。**告警**：跨层对账规则先炸——dwd 侧 800 万、dws 侧 1630 万，远超 1 元阈值；规则是 3 级阻断，ads 没产出，报表停在昨天。

**查上游**：`dwd_order_detail` 当天行数环比 +9% 正常，`max(etl_time)` 正常，排除延迟与空分区。**查口径**：指标定义未变，dws 的 SQL 与上周 diff 一致，排除口径调整。

**查发布 + 验证**：当天下午 `dim_shop` 有一次发布，加了 SCD2 历史版本字段。问题对上了——dws 关联时只写 `on a.shop_id = b.shop_id`，漏了 `and b.is_current = 1`，维表一变成一 key 多行，事实表被扇出（fan-out），一个订单关联出 2~3 行，`sum(pay_amt)` 直接翻倍。抽样验证：dwd 92 万行、关联后 186 万行，放大 2.02 倍；按 `shop_id` 分组后只有带历史版本的店铺金额异常，其余正常。

**修复 + 防复发**：补上版本过滤（长期方案是维表只对外暴露一张「当前版本」视图，从源头堵住漏条件）；重跑 dws 与 ads 当天分区；对账复跑通过并同步业务。真正该补的规则是「关联前后行数不得放大」——`关联后 / 关联前 <= 1.01`，它比 GMV 对账更早暴露扇出；再把 `dim_shop` 挂进血缘影响面分析，维表一改自动列出下游任务并触发校验。

## 静态治理：标准、血缘、生命周期

动态校验只能发现「已经错了」，静态治理减少「天天错」。**数据标准**管四件事：命名按 `<层>_<业务域>_<粒度>_<周期>`（如 `dws_trade_shop_1d`），`ods/dwd/dws/ads` 前缀不许混用；类型上金额统一 `decimal(18,2)`（`double` 会有 `0.1+0.2=0.30000000000000004`，对账永远差几分），业务 ID 用 `string` 防大整数跨引擎丢精度；枚举存 `code` 不存中文，字典集中维护；单位与时间统一——**「分/元」混用是经典事故**：上游按分存 `pay_amt`、报表按元展示，某天新渠道直接存了元，GMV 瞬间放大 100 倍；治法是全链路用分、只在展示层除以 100，并在 dwd 加金额上限校验兜底，时间写死 `Asia/Shanghai`、分区统一 `dt` 字符串。

**血缘**（字段级）两条技术路线：解析 SQL 拿 AST（覆盖自研脚本，但处理不了动态拼接和 `select *`）与引擎采集（Hive Hook / Spark Listener 在编译期拿到输入输出表与字段，准但只覆盖真跑过的任务）。用途不是画图好看，而是影响面分析（ods 某字段要改，三分钟列出下游 47 张表和 12 个任务）、排障反查、下线评估。

**表生命周期**：30 天无查询、90 天无下游、无 Owner 的表进待下线清单，通知后归档再 `drop`；分区也要定策略（明细留 400 天、汇总留 3 年）。仓库成本一大半来自没人敢删的死表。

## 质量分与责任机制

只做技术不做机制，体系会退化成一堆没人看的规则。

- **按表打分**：`质量分 = 1 - 失败规则权重和 / 总权重`，阻断级失败一次该表当天 0 分，按天落表出趋势，谁的表在掉一眼看得出。
- **Owner 制**：每张表必须有负责人，无主表不许上线；告警直接打给 Owner，群里的告警等于没有告警。
- **SLA 违约复盘**：记录违约次数、时长、原因分类（上游延迟 / 代码缺陷 / 数据脏 / 资源不足），按月看分布——只看单次事故会当成偶然，看分布才知道该修哪一环。

## 面试里怎么答这两问

**「你怎么保证数据准确」**，按拦截点 + 机制两层说：

> 四层拦截：dwd 做强校验（主键唯一、空值率、枚举、金额边界），dws 做跨层对账（同口径聚合后相减），ads 只聚合不重算口径，保证指标只有一个出口。规则不写死在脚本里，用规则元数据表 + 通用校验任务，新增规则只插一行数据。规则分三级：对账差异、主键重复阻断下游；空值率、孤儿行只告警；偶发越界只记录。最后落到机制：每张表有 Owner、有质量分，新表上线必须配五条基础规则（行数波动、主键唯一、空值率、枚举、对账），SLA 违约按月复盘。

**「发现数据不对你怎么查」**，四步法直接背：

> 先看上游有没有延迟或空分区（`etl_time`、行数环比、父任务状态），再看口径逻辑有没有变更（需求记录、定义文档），再看当天有没有代码或配置发布（发布单、Git diff、调度参数），最后才怀疑数据本身（抽样明细看重复、多推、补数重叠）。大部分问题在前两步就能定位，关键是把每一步的证据留下来。

## 容易踩的坑

- **只告警不阻断**：错数照样流到报表，告警只让人「知道错了」，不解决问题。
- **`count(distinct)` 当唯一性规则**：只说有重复、不说谁重复，排查还得重写 SQL。
- **对账用 `INNER JOIN`**：一边为空整行消失，对账「通过」，假阴性最致命。
- **阈值写死**：大促当天全量规则一起爆，然后所有人开始习惯性忽略告警。
- **补数后不重跑校验**：数据修好了 `meta_dq_result` 还是失败，看板一直红，最后没人信分数。
- **`avg` 忽略 `NULL` / `!=` 判空**：算空值率写成 `avg(col)` 会被非空行拉偏；`col != ''` 遇到 `NULL` 结果是 `NULL` 不是 `true`，脏数据被静默放过。

## 小结

- 错的数比没有数更糟：空值会被发现、错值会被相信，所以校验要往上游压，在 dwd 就拦住。
- 六维各有落点：完整性看行数波动与空值率，唯一性看最细粒度主键，有效性看枚举/日期/金额边界，准确性靠跨层对账，一致性看孤儿行与同指标同口径，及时性看产出时间与 SLA。
- 规则要配置化：元数据表（表名、字段、类型、`check_sql`、期望表达式、级别、Owner）+ 一个通用任务，SQL 只返回一行指标，阈值写成表达式。
- 阈值优先「同比/环比 + 绝对量」双条件，`rows = 0` 永远必报；告警分阻断/告警/记录三级，靠指纹去重、变更静默、误报下线治疲劳。
- 排查永远四步：上游延迟 → 口径变更 → 当天发布 → 数据本身；再配上线卡点与 Owner 机制，别只做技术不做治理。

## 参考

综合自数据质量六维度（完整性、准确性、一致性、及时性、唯一性、有效性）的公开方法论、数仓分层治理与维度建模的通行实践，以及 Hive/Spark SQL 方言下的实测验证：`nullif(trim(col),'')` 判空、`FULL JOIN` 对账、`CROSS JOIN` 行数对比、`max(etl_time)` 查时效均在本机引擎跑通；规则元数据表与通用校验任务按「规则即数据」的思路改写为可直接落地的骨架，未绑定任何具体商业产品功能。
