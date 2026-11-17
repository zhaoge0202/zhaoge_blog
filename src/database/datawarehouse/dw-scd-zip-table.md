---
title: "缓慢变化维怎么处理？拉链表怎么设计和使用？"
description: "讲清 SCD1/2/3 的取舍，并用可跑的 SQL 走完拉链表的初始化和每日合并。"
breadcrumb: true
article: true
editLink: false
category:
  - "数据仓库"
tag:
  - "必会"
  - "高频"
  - "细节题"
prev:
  text: "维度建模怎么落到数仓里？事实表和维度表怎么设计？"
  link: "/database/datawarehouse/dw-dimensional-modeling.html"
next:
  text: "指标体系怎么建？原子指标、派生指标和口径一致性怎么落？"
  link: "/database/datawarehouse/dw-metric-system.html"
---

# 缓慢变化维怎么处理？拉链表怎么设计和使用？

> 维度属性一定会变（用户搬家、商品换类目、客户升级），但已经落库的历史事实不能跟着变。SCD 回答"变的那一刻怎么记"：SCD1 直接覆盖、SCD2 追加版本、SCD3 多存一列上一版。拉链表是 SCD2 在 Hive / Spark 里最落地的形态——一个实体 N 行，`start_date` / `end_date` 圈出每段有效期，`end_date = '9999-12-31'` 表示"现在还有效"。

## 为什么会有这道题

维度字段分两类：天生不变的（注册手机号、首次上架时间），和会变的（地址、类目、会员等级、负责销售）。会变的这类叫**缓慢变化维**，"缓慢"只是相对事实表每天在长而言，它可能一个月才动一次。

麻烦在于**事实表早在属性变化之前就写进去了**。订单事实表里有一条 2024-03-01 的订单，下单时用户 1 住在广州；半年后他搬到深圳。如果维度表直接覆盖地址，今天跑"3 月各城市销售额"，这条订单会被算到深圳头上——"广州 3 月卖了多少钱"永远查不出来了，而且没人会立刻发现，因为总量是对的，只有拆分错了。反过来也常需要"用户现在的地址"：发券、算当前城市渗透率，这时要的又是最新值。

所以本质是两个问题：**① 变化要不要留痕；② 查数时按"事实发生当时的维度"还是"维度现在的样子"**。留痕 → SCD2 / SCD3；只要最新 → SCD1。

## SCD1 / SCD2 / SCD3

- **SCD1 直接覆盖**：Hive 没有 `UPDATE`，一般每天 `INSERT OVERWRITE` 全量重刷一张维度表，只留最新值。省空间、查询不用动脑，但历史被抹掉——过去任何一天的城市分布都无法复原。
- **SCD2 追加版本**：同一 `user_id` 出现多行，每行是一段时间内有效的一个版本，用 `start_date` / `end_date` 标记。唯一能"还原任意历史时点"的方案，也就是拉链表。
- **SCD3 加一列存上一版**：行数不变，表上多一个 `prev_city`（用户 1 现在是深圳市、`prev_city` 是上海市），能答"现在和上一次分别是什么"，再往前就没地方放了。

| 维度       | SCD1 直接覆盖      | SCD2 拉链表                     | SCD3 加列记上一版    |
| ---------- | ------------------ | ------------------------------- | -------------------- |
| 存储成本   | 最低（一实体一行） | 高（一实体 N 行，N = 变更次数） | 低（一行，列变宽）   |
| 历史可追溯 | 完全不可追溯       | 任意时点可还原                  | 只能看最近一次       |
| 查询复杂度 | 最低               | 中（必须带区间条件）            | 低                   |
| 典型场景   | 属性纠错、字典表   | 用户 / 商品 / 客户等核心维度    | 变化极少、只看上一版 |

SCD3 用得少，因为边界太窄：只保留"上一版"一个版本，第二次变更就把第一次冲掉了；而且每关心一个字段就多一个 `prev_` 列，字段一多表横向膨胀。它只在很窄的场景成立，比如只看"等级上一档"算流失风险。

## 拉链表：SCD2 的落地形态

```sql
CREATE TABLE IF NOT EXISTS dim_user_zip (
    user_id    BIGINT COMMENT '用户 ID',
    province   STRING COMMENT '省份',
    city       STRING COMMENT '城市',
    start_date STRING COMMENT '本条版本生效日（含当天）',
    end_date   STRING COMMENT '本条版本失效日（含当天），9999-12-31 表示当前有效'
)
COMMENT '用户维度拉链表'
PARTITIONED BY (dt STRING COMMENT '跑批日期：该分区里存的是当天那一版完整链')
STORED AS PARQUET;
```

两个设计决定要说清：

- **闭区间**：`start_date` / `end_date` 都含当天，查某天快照就是 `start_date <= dt AND end_date >= dt`，两个比较符、不留缝。
- **当前有效用 `'9999-12-31'` 而不是 `NULL`**：区间条件能写成一条，不必 `end_date >= dt OR end_date IS NULL`，少一个分支就少一类漏行 bug；`NULL` 参与比较永远是 `UNKNOWN`，在 `NOT IN`、`<>`、join、排序里到处是坑；`WHERE end_date = '9999-12-31'` 这种筛法直观可用，同步给不认 `NULL` 的下游也不出错。

以 user_id = 1 为例，地址变过两次（日期统一用 `'YYYY-MM-DD'` 定长字符串，字符串比较等价于日期比较）：

```mermaid
flowchart LR
    A["v1 2024-01-01 ~ 2024-05-09<br/>广东省 / 广州市"] --> B["v2 2024-05-10 ~ 2024-09-14<br/>上海市 / 上海市"]
    B --> C["v3 2024-09-15 ~ 9999-12-31<br/>广东省 / 深圳市"]
```

三段首尾相接、不重叠不留空：上一段 `end_date + 1 天` 就是下一段 `start_date`，任何一天能且只能命中一条。生效日约定是：变更流水落在 `dt = 2024-05-10`，就认为新版本 **2024-05-10** 生效，旧版本 `end_date = date_sub(变更日, 1)`；约定要全链路统一，否则关链开链会差一天。

## 初始化：第一次全量写成开链

第一版没有任何历史，所有行都从今天开始、无限远结束：

```sql
INSERT OVERWRITE TABLE dim_user_zip PARTITION (dt = '2024-01-01')
SELECT user_id, province, city, '2024-01-01' AS start_date, '9999-12-31' AS end_date
FROM   ods_user_full WHERE dt = '2024-01-01';
```

此时分区里只有 user 1（广东省 / 广州市）和 user 2（浙江省 / 杭州市）两条开链，`start_date = 2024-01-01`、`end_date = 9999-12-31`。

## 每日增量合并

跑 `2024-09-15` 这天，输入两份：上一版链（`dt = '2024-09-14'` 分区）和当日变更流水 `ods_user_change`。流水里同一用户同一天可能多条，比如 user 1 有 `09:12:31` 改成「广东省 / 深圳市」、`08:00:02` 改成「江苏省 / 南京市」两条，得取 `update_time` 最新的那条；user 3（四川省 / 成都市，`10:30:00`）是首次出现的新用户。user 2 没出现即没变更——"没出现 = 没变"是变更流水表的前提，通常由 CDC 或每日全量比对生成。合并就四句话：**未变的不动、变了的闭旧链开新链、新增的开链、历史闭链原样搬走**。

```sql
-- 占位符 ${bizdate} 由调度传入（这里 = 2024-09-15）
WITH old_zip AS (                       -- ① 上一版完整链
    SELECT user_id, province, city, start_date, end_date
    FROM   dim_user_zip WHERE dt = date_sub('${bizdate}', 1)
),
incr AS (                               -- ② 当日变更按人去重
    SELECT user_id, province, city,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY update_time DESC) AS rn
    FROM   ods_user_change WHERE dt = '${bizdate}'
),
cur AS (                                -- ③ 存量里开链那一行
    SELECT user_id, province, city, start_date FROM old_zip WHERE end_date = '9999-12-31'
),
joined AS (                             -- ④ 开链 全外连接 当日变更
    SELECT COALESCE(c.user_id, i.user_id) AS user_id,
           c.province AS old_province, c.city AS old_city, c.start_date AS old_start,
           i.province AS new_province, i.city AS new_city
    FROM   cur c
    FULL OUTER JOIN (SELECT user_id, province, city FROM incr WHERE rn = 1) i
           ON c.user_id = i.user_id
)
SELECT user_id, province, city, start_date, end_date
FROM (
    SELECT user_id, province, city, start_date, end_date            -- ⑤ 历史闭链不动
    FROM   old_zip WHERE end_date <> '9999-12-31'
    UNION ALL
    SELECT user_id, old_province, old_city, old_start,              -- ⑥ 变更者闭旧链
           date_sub('${bizdate}', 1) AS end_date
    FROM   joined
    WHERE  old_start IS NOT NULL AND new_city IS NOT NULL
      AND  NOT (old_province <=> new_province AND old_city <=> new_city)
    UNION ALL
    SELECT user_id,                                                 -- ⑦ 变更者/新用户开新链
           COALESCE(new_province, old_province) AS province,
           COALESCE(new_city, old_city)         AS city,
           '${bizdate}' AS start_date, '9999-12-31' AS end_date
    FROM   joined
    WHERE  new_city IS NOT NULL
      AND  (old_start IS NULL OR NOT (old_province <=> new_province AND old_city <=> new_city))
    UNION ALL
    SELECT user_id, old_province, old_city, old_start,              -- ⑧ 未变不动
           '9999-12-31' AS end_date
    FROM   joined WHERE new_city IS NULL AND old_start IS NOT NULL
) t;
```

这段的产物就是 `dt = '2024-09-15'` 分区的完整链内容，落表时在外面套一层 `INSERT OVERWRITE TABLE dim_user_zip PARTITION (dt = '2024-09-15')` 即可（个别引擎对 `INSERT ... WITH` 支持不好，把 `WITH` 改成子查询嵌套，或先落临时表再覆盖分区）。

逐段说：

- **①②**：① 只读上一版分区，不读目标分区；② 用 `ROW_NUMBER` 按 `update_time` 倒序取 `rn = 1`。少了去重这步，同人当天两条变更会同时进来，链就分叉了。
- **③④**：只要开链行（闭链行已定稿不会再变）；`FULL OUTER JOIN` 两边都保留，才能同时覆盖"变更 / 未变"和"新增"；`<=>` 是 null-safe 比较，防止属性为 `NULL` 时比较变 `UNKNOWN` 而漏判。
- **⑤**：历史闭链原样搬走，保证旧版本一段不少。**⑥**：变更者闭旧链，`end_date = date_sub(bizdate, 1)`。**⑦**：变更者和首次出现的新用户（`old_start IS NULL`）共用这个分支开新链。**⑧**：没变更的老用户维持 `'9999-12-31'`，**这段最容易漏**，漏了就会出现"没变化的人链凭空断掉"。

另一种写法是 `union all + row_number`：把"存量开链"和"当日变更"叠起来，每人按生效日倒序编号取 `rn = 1` 得到最终状态；闭旧链仍要回存量表另写一次。生产上更推荐全外连接那版——四个分支和四句口诀一一对应，好 review、出错好定位。

结果对账（`dt = '2024-09-15'` 分区续接初始化的两条）：

| user_id | province | city   | start_date | end_date   | 来源 |
| ------- | -------- | ------ | ---------- | ---------- | ---- |
| 1       | 广东省   | 广州市 | 2024-01-01 | 2024-05-09 | ⑤    |
| 1       | 上海市   | 上海市 | 2024-05-10 | 2024-09-14 | ⑥    |
| 1       | 广东省   | 深圳市 | 2024-09-15 | 9999-12-31 | ⑦    |
| 2       | 浙江省   | 杭州市 | 2024-01-01 | 9999-12-31 | ⑧    |
| 3       | 四川省   | 成都市 | 2024-09-15 | 9999-12-31 | ⑦    |

user 1 当天那条"江苏省 / 南京市"被 ② 的 `ROW_NUMBER` 筛掉了，所以链上没有——这就是去重那步的作用。行数也对得上：上一版 3 行（user 1 两段 + user 2 一段），今天 user 1 的旧链由开变闭、行数不变，新增一段 +1，新用户 +1，本版 5 行。

## 三种典型查询

```sql
-- 1. 某天全量快照：2024-06-01 每个用户在哪条链上（user 1 返回上海市，user 3 查不到）
SELECT user_id, province, city FROM dim_user_zip
WHERE  dt = '2024-09-15'
  AND  start_date <= '2024-06-01' AND end_date >= '2024-06-01';

-- 2. 最新状态
SELECT user_id, province, city FROM dim_user_zip
WHERE  dt = '2024-09-15' AND end_date = '9999-12-31';

-- 3. 某用户的历史轨迹
SELECT user_id, province, city, start_date, end_date,
       datediff(end_date, start_date) + 1 AS stay_days
FROM   dim_user_zip
WHERE  dt = '2024-09-15' AND user_id = 1
ORDER  BY start_date;
```

三段都带 `dt` 条件，它是分区裁剪的入口，不写就扫全部分区。查询 3 里 `datediff` 两个 `'YYYY-MM-DD'` 字符串也能直接算，闭区间所以 `+1`；开链算出来的天数没业务意义，展示时判断一下是不是哨兵值。另外事实表要用"当时的维度"，就是拿订单日期去卡这个区间——可区间 join 在 Hive 里走不了等值 join，大事实表代价很高，所以正规做法是写事实表时就确定**维度代理键**（`user_id + start_date` 拼成 `sk`，或自增 sk）落进事实表，查询时直接等值 join，不再现算区间。

## 拉链表 vs 每日全量快照

另一种方案是每天存一份完整快照分区，查哪天就 `WHERE dt = 哪天`。

| 维度     | 拉链表                                     | 每日全量快照分区                |
| -------- | ------------------------------------------ | ------------------------------- |
| 存储     | 只存变化，一年 ≈ 全量 × (1 + 变更率 × 365) | 每天一份全量，一年 = 全量 × 365 |
| 查询写法 | 要写区间条件，容易漏 `end_date`            | `WHERE dt = '某天'`，零负担     |
| 历史长度 | 全历史，可以一直往前追                     | 通常只留 30~90 天               |
| 跑批     | 逻辑复杂，怕链断裂                         | 一次覆盖，几乎不会错            |

算笔账：1000 万用户、每天 1% 变更。每日快照一年 `1000 万 × 365 ≈ 36.5 亿` 行；拉链表约 `1000 万 × (1 + 0.01 × 365) ≈ 1.04 亿` 行，差 35 倍。所以历史要留长（用户画像、类目回溯、"当时的等级"这类监管口径），拉链表划算；只查最近一个月，快照表更省心。不少团队两个都建：快照表给 BI 直接查，拉链表供长周期回溯。

湖仓之后手写拉链的场景在变少：Hudi / Iceberg / Delta 的 `MERGE INTO`（Hudi 0.10+、Iceberg、Flink 1.14+ 都支持）能按主键 upsert 出最新值，时间旅行（Iceberg 的 `VERSION AS OF`、Hudi 的 `_hoodie_commit_time`）等于免费的每日快照，增量读（Iceberg 按 `start-snapshot-id`、Hudi 按 instant time）替代"自己跟昨天比"。剩下的手写需求基本是：下游只要普通 Hive 表、BI 不认时间旅行、还要跨好几年回溯。

## 手撕题变体

**变体一：给每日变更表，输出拉链表。** 只有变更记录（没变就没行），核心是"当天变更生效、下一条变更前一天失效"：

```sql
WITH chg AS (
    SELECT user_id, province, city, dt,
           ROW_NUMBER() OVER (PARTITION BY user_id, dt ORDER BY update_time DESC) AS rn
    FROM   ods_user_change WHERE dt <= '2024-09-15'
),
ver AS (
    SELECT user_id, province, city, dt AS start_date,
           LEAD(dt) OVER (PARTITION BY user_id ORDER BY dt) AS next_dt
    FROM   chg WHERE rn = 1
)
SELECT user_id, province, city, start_date,
       COALESCE(date_sub(next_dt, 1), '9999-12-31') AS end_date
FROM   ver ORDER BY user_id, start_date;
```

`LEAD` 拿同用户下一条变更日，最后一条是 `NULL`，用 `COALESCE` 兜成哨兵值。三个前提：变更表必须真的只有变更（若它其实是每日全量，得先跟昨天比出变化）；必须含首次建档那条记录，否则链头缺一截——上面这段只会算出 2024-05-10 起的两段，`2024-01-01 ~ 2024-05-09` 的广州版本就丢了；`LEAD` / `LAG` 在 Hive 里是 **2.0.0** 才有的，更早版本用自关联或 `ROW_NUMBER` 位移替代。

**变体二：给拉链表，输出某天全量快照。** 就是上面查询 1，落表时加一层覆盖：

```sql
INSERT OVERWRITE TABLE dim_user_snapshot PARTITION (dt = '2024-06-01')
SELECT user_id, province, city FROM dim_user_zip
WHERE  dt = '2024-09-15'
  AND  start_date <= '2024-06-01' AND end_date >= '2024-06-01';
```

## 容易踩的坑

- **`dt` 不是 `start_date`**：一个 `dt` 分区存的是"那天那一版完整链"，`dt` 只是版本快照时间；更忌讳把拉链表和每日快照塞进同一张表两种语义，下游必然混。
- **重跑不幂等就断链**：合并只能读"上一版分区"，绝不能读目标分区自己（`dt = '${bizdate}'`），否则重跑就是在已合并结果上再合并一次；回刷补数按天往前推，得保证第 D 天重跑时 D-1 那版链还是当时的版本。另外链分区要每天产出，没变更也把上一版原样写一份，否则 `date_sub(bizdate, 1)` 那一版根本不存在，整段链会被当成"全新初始化"。
- **闭区间写成开区间、或哨兵值筛选漏写**：约定 `end_date` 含当天，快照条件就必须 `end_date >= dt`，写成 `>` 只在变更用户身上丢数据；查最新状态忘写 `end_date = '9999-12-31'`，一个用户会返回 3 行，用户数翻几倍而明细看着都合法。
- **"先全表关链再插变更"是错的**：`UPDATE ... SET end_date = date_sub(bizdate, 1) WHERE end_date = '9999-12-31'` 会把没变更的人一起关掉，第二天他们的链就空了；必须显式分出"变更 / 未变"两支。
- **关链 join 倾斜**：小变更表 join 大存量表时，热门 `user_id`（机器人号、企业主账号、默认成员 `-1`）会全压到一个 reduce 上；给 key 加盐打散，或先 `SELECT DISTINCT user_id FROM incr` 当驱动表，细节见 [数据倾斜怎么排查和治理](/database/datawarehouse/dw-skew-and-tuning.html)。
- **`NULL` 属性判等**：`old_city <> new_city` 任一侧为 `NULL` 时返回 `UNKNOWN`，被当成"未变更"，变更就丢了；用 `<=>` 或先 `COALESCE(city, '')`。同一天多次变更不去重，还会给一个用户开两条 `start_date` 相同的链——拉链表唯一键是 `(user_id, start_date)`，不是 `user_id`。

## 小结

- 核心矛盾是"事实发生在属性变化之前"，要不要留痕决定选 SCD1 还是 SCD2；SCD3 只能记上一版，能力太窄。
- 拉链表 = SCD2 的落地形态：一个实体 N 行，闭区间 `start_date` / `end_date`，`'9999-12-31'` 做开链哨兵值，避开 `NULL` 比较的一串坑。
- 每日合并四句话：未变不动、变更闭旧链（`end_date = 变更日 - 1`）、变更和新用户开新链（`start_date = 变更日`）、历史闭链原样搬走；`FULL OUTER JOIN` 或 `union all + row_number` 都能实现。
- 三种查询：快照 `start_date <= dt AND end_date >= dt`（先卡 `dt` 分区）、最新状态加 `end_date = '9999-12-31'`、历史轨迹按 `start_date` 排序并 `datediff + 1` 算停留天数。
- 存储上比每日全量快照省一个数量级，代价是跑批和查询都复杂；湖仓的 `MERGE INTO` + 时间旅行 + 增量读接管了大部分场景，手写拉链主要留给"下游只要 Hive 表、还要长周期回溯"。

## 参考

综合 Hive Language Manual（DDL、`INSERT OVERWRITE ... PARTITION`、`date_sub` / `datediff`、窗口函数 `ROW_NUMBER` / `LEAD`、null-safe 比较 `<=>`、`FULL OUTER JOIN`）与 Spark SQL Reference（同名函数及 `MERGE INTO`）整理，结合电商用户维度与交易事实表的落地经验改写。示例数据为构造用例，链式区间、生效日约定和四分支合并 SQL 逐段按 Hive 语法核对过；Hudi 的 `MERGE INTO`、Iceberg 的 `VERSION AS OF` 与增量读属于表格式能力，版本间参数名有差异，落库前按所用版本再核一次。
