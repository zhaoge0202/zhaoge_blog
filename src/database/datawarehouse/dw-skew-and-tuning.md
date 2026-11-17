---
title: "数仓任务又慢又贵怎么优化？数据倾斜和小文件怎么治？"
description: "从定位慢在哪到倾斜、小文件、参数与成本治理，给一套可复述的调优答法。"
breadcrumb: true
article: true
editLink: false
category:
  - "数据仓库"
tag:
  - "必会"
  - "排障"
  - "项目实战"
prev:
  text: "实时链路怎么保证不丢不重？Flink 的 checkpoint 和维表 join 怎么用？"
  link: "/database/datawarehouse/dw-realtime-pipeline.html"
next:
  text: "数据质量怎么监控与治理？校验规则和异常排查怎么做？"
  link: "/database/datawarehouse/dw-data-quality.html"
---

# 数仓任务又慢又贵怎么优化？数据倾斜和小文件怎么治？

> 调优不是先加资源，而是先证明瓶颈在哪：是扫描量、是 shuffle、是倾斜的长尾 task，还是小文件把 task 数堆爆了。

同样 1 TB 数据，一个 job 200 个 task 三分钟跑完；另一个 job 里 198 个 task 三分钟、2 个跑 40 分钟。后者加一倍机器只能把 40 分钟变成 35 分钟，钱翻倍、问题还在——因为慢的根源是活干得不均匀，不是算力不够。

## 先用证据定位，再谈优化

打开 Spark UI 的 SQL/Stages 页或 YARN 上的 MR/Tez 任务详情，只看五类指标：

| 观察点                 | 说明                            | 典型信号                                 |
| ---------------------- | ------------------------------- | ---------------------------------------- |
| task 时长 max / 中位数 | 同一 stage 内 task 快慢是否悬殊 | max 是中位数 10 倍以上 = 倾斜            |
| Shuffle Read / Write   | 跨节点搬了多少数据              | 写入量远超输入量 = 分区键选错            |
| Spill（memory / disk） | 内存放不下、溢写磁盘            | disk spill 几百 GB = 内存或分区数不对    |
| GC 时间占比            | task 里 GC 花了多久             | 超过 10% 多半是对象太多或 broadcast 太大 |
| 输入量 vs 分片数       | 每个 task 分到多少数据          | 分片多但每片只几 MB = 小文件             |

某 stage 显示 `Shuffle Write 1.2 TB`、上游扫描只有 `180 GB`，说明中间结果被放大近 7 倍：此时调内存没用，得回头查 join / group by 的键。**加 executor 只提高吞吐，不改变数据分布和扫描量**——倾斜是分布问题，小文件是文件数问题，全扫是裁剪问题，三者加机器都治不好。所以先看执行计划：走 `BroadcastHashJoin` 还是 `SortMergeJoin`、有没有裁剪到目标分区、聚合是不是两阶段、两侧估算行数差多少（Hive 用 `EXPLAIN FORMATTED` / `EXPLAIN DEPENDENCY`，Spark 看 SQL 页的 physical plan）。

## 四段式答法：现象 → 原因 → 手段 → 效果

面试讲调优按这个顺序说，比罗列参数有说服力：

```text
现象：订单宽表任务日常 6 小时。Stage 7 的 200 个 task 中 196 个 2~3 分钟结束，
      4 个跑 3 小时以上、卡在 99%；shuffle write 1.4 TB，磁盘 spill 620 GB。
原因：按 merchant_id 关联维表时，头部 3 个商户（大促主会场）订单占 45%，
      这几个 key 全落到同一个 reducer，分区数据量差两个数量级。
手段：① 商户维表 40 MB 改广播 join，消掉这次 shuffle；② 大表 join 对热点商户加 0~9 随机前缀；
      ③ shuffle 分区数 200 → 2000，开 AQE 自动合并小分区。
效果：6 小时 → 50 分钟；shuffle write 1.4 TB → 260 GB，spill 归零；
      与上游订单表按 dt + 商户双向对账，单量/金额/去重订单数差异均为 0。
```

关键是最后那句**对账**——只说"变快了"必被追问怎么证明没算错。

## 数据倾斜：现象与根因

现象好认：绝大多数 task 秒完，少数长时间停在 99%，或 reducer 卡在 `reduce > shuffle`。这类 job 的耗时约等于最慢那个 task，其余算力全在空转。根因只有两类：

- **join 键分布不均**：某个 merchant_id、主播 id、设备 id 的记录数远大于其它（热点商户、头部主播）。
- **group by 键不均或大量 null**：`user_id is null` 占 30%，若写成 `coalesce(uid,'未知')` 参与关联或分组，所有 null 会挤进同一个分区。

```sql
SELECT merchant_id, count(*) AS cnt FROM dwd_order WHERE dt = '2024-06-01'
GROUP BY merchant_id ORDER BY cnt DESC LIMIT 20;
SELECT sum(if(user_id IS NULL, 1, 0)) / count(*) AS null_ratio FROM dwd_order WHERE dt = '2024-06-01';
```

top 1 占 45% 必然拖慢整个 stage；top 20 加起来才 2%，问题不在倾斜，别往这改。

## join 倾斜：四种解法

**① 小表广播（map join）**：小表几十 MB 到一两百 MB 就广播到每个 executor，join 退化成 map 端哈希查找，这次 shuffle 直接消失。

```sql
SET hive.auto.convert.join = true;                              -- 小表自动转 map join
SET hive.auto.convert.join.noconditionaltask = true;            -- 多表级联也按大小判断
SET hive.auto.convert.join.noconditionaltask.size = 300000000;  -- 阈值（字节），默认 10MB
SET hive.mapjoin.smalltable.filesize = 300000000;               -- 显式 MAPJOIN hint 的判断阈值
-- Spark 侧只有一个：spark.sql.autoBroadcastJoinThreshold = 10485760（默认 10MB）
```

触发条件不是"看着小"，而是优化器拿到的统计信息说它小：表刚写完没 `ANALYZE`、或小表其实"过滤后才小"（过滤发生在 join 之后），判断都会失真，此时用 `/*+ MAPJOIN(b) */` 或 `broadcast(b)` 强制。代价是广播表进每个 executor 内存，阈值调到 500 MB 等于把 OOM 从 reducer 挪到 executor。

**② 大表 join 大表：热点 key 随机前缀两阶段**，膨胀小的一侧、打散大的一侧：

```sql
-- 订单（大表）join 商户维表（40 万行），热点 merchant_id 占 45%
SELECT f.order_id, f.merchant_id, d.merchant_name, f.amount
FROM (
  SELECT order_id, merchant_id, amount,
         CASE WHEN merchant_id IN ('M0001','M0002','M0003')
              THEN concat(merchant_id, '_', cast(floor(rand() * 10) AS int))
              ELSE merchant_id END AS join_key
  FROM dwd_order WHERE dt = '2024-06-01'
) f
JOIN (
  SELECT merchant_id, merchant_name, merchant_id AS join_key
  FROM dim_merchant WHERE merchant_id NOT IN ('M0001','M0002','M0003')
  UNION ALL
  SELECT m.merchant_id, m.merchant_name, concat(m.merchant_id, '_', cast(t.idx AS int)) AS join_key
  FROM dim_merchant m LATERAL VIEW explode(array(0,1,2,3,4,5,6,7,8,9)) t AS idx
  WHERE m.merchant_id IN ('M0001','M0002','M0003')
) d ON f.join_key = d.join_key;
```

实测：3 个热点 key 各压一个 reducer，单分区 210 GB；打散成 30 个分区后每个约 7 GB，最慢 task 从 3 小时降到 12 分钟。打散倍数让"打散后单分区 ≈ 平均分区大小"即可，10~20 倍够用。这里只 join 不聚合，后缀不进最终口径；若 join 后按商户汇总，聚合键仍是原始 `merchant_id`。

**③ 空值 / 无效值加随机后缀**，只治 null 聚集，最便宜：

```sql
ON coalesce(a.user_id, '未知') = b.user_id     -- join 条件片段·优化前：null 全变 '未知'，30% 数据压一个 reducer
ON CASE WHEN a.user_id IS NULL THEN concat('NULL_', cast(floor(rand() * 100) AS int))
        ELSE a.user_id END = b.user_id         -- 优化后：null 反正关联不上，加随机后缀散开
```

前提是这些 key 确实关联不上；若 null 有业务含义（游客订单要挂默认用户），得单独 `UNION ALL` 一条分支算，不能随手打散。

**④ 交给引擎的 skew join**：Hive 用 `SET hive.optimize.skewjoin = true`，配合 `hive.skewjoin.key`（默认 100000，单 key 超过该行数视为倾斜），把倾斜 key 的行单独拆出来做一次 map join。Spark 3.x 的 AQE 更实用：`spark.sql.adaptive.skewJoin.enabled = true`（3.2 起默认开启，3.0/3.1 需显式打开），按运行时分区大小判断（`skewedPartitionFactor` 默认 5、`skewedPartitionThresholdInBytes` 默认 256MB），自动拆分大分区再合并结果。适合倾斜中等、不想改 SQL 的场景；单 key 就几十 GB 的极端热点，手写两阶段更稳。

| 解法              | 适用场景                 | 代价                       | 效果                       |
| ----------------- | ------------------------ | -------------------------- | -------------------------- |
| 小表广播          | 一侧几十 MB ~ 一两百 MB  | executor 内存、driver 收集 | 消掉整次 shuffle，通常最快 |
| 热点 key 随机前缀 | 大表 join 大表、热点明确 | SQL 变复杂、维表侧要膨胀   | 单 task 时长降一个数量级   |
| 空值随机后缀      | 大量 null 聚集           | 基本无                     | 便宜有效，但只治 null      |
| 引擎 skew join    | 不想改 SQL、倾斜中等     | 额外落盘 / 拆分            | 兜底，极端热点不彻底       |

## group by 倾斜：两阶段聚合

Hive 开关的语义是：开启后生成两个 MR 作业，第一个把 map 输出随机分发给 reducer 做部分聚合，第二个做最终聚合。

```sql
SET hive.groupby.skewindata = true;   -- 默认 false
SET hive.map.aggr = true;             -- map 端预聚合，默认已开
```

局限：靠随机分发打散，只对 `count/sum` 这类可结合聚合有效，对 `count(distinct)`、`collect_set` 不友好；多一个作业多一次落盘，非倾斜任务开了纯属浪费。手写更可控：

```sql
-- 优化前：'未知' 城市占 30%，全落一个 reducer
SELECT coalesce(city,'未知') AS city, count(*) AS cnt, sum(amount) AS amt
FROM dwd_order WHERE dt = '2024-06-01' GROUP BY coalesce(city,'未知');

-- 优化后：先加随机数局部聚合，再去掉随机数全局聚合
WITH stage1 AS (
  SELECT concat(coalesce(city,'未知'), '_', cast(floor(rand() * 20) AS int)) AS salt_key,
         coalesce(city,'未知') AS city, count(*) AS cnt, sum(amount) AS amt
  FROM dwd_order WHERE dt = '2024-06-01'
  GROUP BY concat(coalesce(city,'未知'), '_', cast(floor(rand() * 20) AS int)), coalesce(city,'未知')
)
SELECT city, sum(cnt) AS cnt, sum(amt) AS amt FROM stage1 GROUP BY city;
```

`count(*)`、`sum` 两层可直接相加；`count(distinct uid)` 不行——要先在 salt 内去重再计数（`group by salt_key, uid` 后外层 `count(*)`，或 `size(collect_set)`），做错指标会悄悄偏小。

## 小文件：不是删掉就好，要在写入侧控住

一个小文件就是一个 block 元数据对象（NameNode 内存约 150 字节/对象），但真正的痛点在计算侧：每个小文件对应一个 task，10 万个 1 MB 文件就是 10 万次 task 启动，调度开销远超计算；ORC/Parquet 的 stripe、row group 被切得很小，压缩率和 min-max 索引退化，谓词下推几乎无效。压缩在这里是**放大器**：不可切分的压缩块（整文件 gzip、单帧 zstd）让大文件也无法被多 task 并行切，小文件 + 压缩 = 既切不动、又要开一堆 task 去读。

| 产生原因     | 典型场景                                              |
| ------------ | ----------------------------------------------------- |
| 动态分区     | 一次写几千个分区，每分区再按 reducer 数拆成几十个文件 |
| 并行度过大   | reducer 给到 1000+，每个只写几 MB                     |
| 频繁小批写入 | 每 5 分钟跑一次，每次只写几十 MB                      |
| 没有合并     | 上游本来就碎，下游 `INSERT ... SELECT` 原样搬         |

治理分三层。**写入前控数量**、**写入时打散**、**事后合并**：

```sql
SET hive.exec.dynamic.partition = true;  SET hive.exec.dynamic.partition.mode = nonstrict;
SET hive.exec.max.dynamic.partitions = 2000;          -- 限制分区爆炸
SET hive.exec.reducers.bytes.per.reducer = 512000000; -- 每个 reducer 约 512MB
SET mapreduce.job.reduces = 200;                      -- 或直接指定 reducer 数
SET hive.merge.mapfiles = true;                       -- 纯 map 任务结束合并，默认 true
SET hive.merge.mapredfiles = true;                    -- MR 任务结束合并，默认 false
SET hive.merge.size.per.task = 256000000;             -- 合并后目标 256MB
SET hive.merge.smallfiles.avgsize = 16000000;         -- 平均小于 16MB 才触发
SET hive.merge.orcfile.stripe.level = true;           -- ORC 按 stripe 级合并更彻底
```

写入时用 `DISTRIBUTE BY cast(rand() * 20 AS int)` 打散（动态分区按分区键分发容易出现单分区一个巨型文件），让落到每个文件的量均匀。

Spark 侧靠 AQE 合并小的 shuffle 分区（`spark.sql.adaptive.coalescePartitions.enabled` 默认开，目标大小 `spark.sql.adaptive.advisoryPartitionSizeInBytes` 默认 64MB、常设 128m）。读取侧还能用 `spark.sql.files.maxPartitionBytes`（默认 128MB）控制单次读取的分片大小，避免小文件把分片数撑爆。已落表的碎文件用定时 `INSERT OVERWRITE` 重写，或 ORC 表执行 `ALTER TABLE t PARTITION(...) CONCATENATE;`；湖仓有专门的 compaction——Iceberg 的 `rewrite_data_files`、Hudi 的 compaction/clean，本质都是读一堆小文件、写回少量大文件。**小文件是写入策略的病，清理只是止疼药**，只删不控，下周还是同样的量。

## 存储与读取：让扫描量真的降下来

- **列存 + 压缩 + 只读需要的列**：ORC/Parquet 只读用到的列，配 snappy/zstd 常省 5~10 倍 I/O；宽表 200 列只取 8 列，`SELECT *` 等于把 200 列的解压和反序列化都做一遍。压缩块不可切分会妨碍并行，压缩要和"文件 ≥ 一个分片"一起考虑。
- **分区裁剪**：`WHERE dt = '2024-06-01'` 只扫一个分区，但写成 `WHERE substr(dt, 1, 7) = '2024-06'` 或 `cast(dt AS date) >= ...` 时分区列被函数包住，裁剪失效、退化成扫全部分区，得改写成 `dt BETWEEN '2024-06-01' AND '2024-06-30'`。
- **谓词下推**：stripe / row group 级 min-max 统计能跳过数据块；表达式不可下推时（自定义 UDF、隐式类型转换）统计就用不上。
- **分桶表 + SMB join**：两边同列同桶数且有序时，可桶对桶 map 端 join，彻底免 shuffle：

```sql
-- 建表：CLUSTERED BY (order_id) SORTED BY (order_id) INTO 64 BUCKETS STORED AS ORC
SET hive.optimize.bucketmapjoin = true;  SET hive.optimize.bucketmapjoin.sortedmerge = true;
SET hive.auto.convert.sortmerge.join = true;
```

代价：桶数建表时定死、后期不好改，写入还要保证分桶正确（Hive 2.x 起 `hive.enforce.bucketing` 默认 true）。

## 引擎与参数取舍

| 引擎        | 优点                               | 代价 / 局限                        | 适合                        |
| ----------- | ---------------------------------- | ---------------------------------- | --------------------------- |
| Hive on MR  | 稳定、生态老、调度成熟             | 每阶段落 HDFS，多阶段反复读写      | 老任务、超大批处理          |
| Hive on Tez | DAG 执行、中间结果不落盘、容器复用 | 调参项多（container 大小、并行度） | 多阶段 Hive SQL，通常快数倍 |
| Spark SQL   | 内存计算、AQE 自适应、算子丰富     | 内存压力大、spill 风险、要调分区数 | 大部分离线加工、迭代计算    |

最该会算的数——Spark shuffle 分区数，目标每分区 100~200 MB：`分区数 ≈ shuffle 数据量 / 每分区目标大小`。1 TB shuffle 按 128 MB 一个分区约 8000 个；1 万个小任务不如 2000 个中等任务，工程上常取 2000~4000，对应的就是这个参数（`spark.sql.shuffle.partitions`，默认 200）。

AQE（`spark.sql.adaptive.enabled`）能兜住：合并过小的 shuffle 分区、拆分倾斜分区、运行时把 `SortMergeJoin` 降级为 `BroadcastHashJoin`（`spark.sql.adaptive.autoBroadcastJoinThreshold`）、动态分区裁剪（`spark.sql.optimizer.dynamicPartitionPruning.enabled` 默认开）。它兜不住扫描量和上游数据本身的脏分布。广播阈值风险是双向的：调太小，本该广播的表走了 shuffle，多一次 TB 级落盘；调太大，executor 内存被 broadcast 挤爆，报 OOM。经验区间 10~100 MB，超过 200 MB 先想"能不能先聚合成小表再 join"。内存上 `spark.memory.fraction` 默认 0.6、`spark.memory.storageFraction` 默认 0.5；大量 disk spill 时优先降分区数、减 broadcast、别 `collect` 大结果，最后才加内存——盲目加内存而 cores 也大，每 task 分到的反而更少。

## 成本也要一起算

- **错峰 + 降频**：6 小时大任务放凌晨低峰，别和实时链路抢资源；确认下游是否真需要小时级，很多任务降频后成本砍半。
- **下线无用中间表**：靠血缘找出"下游 30 天无访问"的表并停掉产出任务，这一步常比调参省得多。
- **冷热分层 + 生命周期 + 弹性**：明细留 3 个月、历史归档，分区级 `DROP PARTITION` 比 `DELETE` 便宜得多；大促临时扩、平时缩，Spark on K8s / YARN 弹性队列做自动化。

## 一个完整的优化案例

订单宽表任务，输入明细 180 GB、输出 40 个分区，原耗时 6 小时，三处改动：

| 改动               | 做法                                               | 单项收益                               |
| ------------------ | -------------------------------------------------- | -------------------------------------- |
| 商户维表改广播     | 40 MB 维表，阈值 10 MB → 64 MB，走 map join        | 6 h → 3.5 h，消掉 900 GB shuffle       |
| 热点商户两阶段打散 | top 3 商户（占 45%）加 0~9 随机后缀                | 3.5 h → 1.1 h，最慢 task 3 h → 12 min  |
| 分区数与合并       | shuffle 分区 200 → 2000，AQE 合并 + `hive.merge.*` | 1.1 h → 50 min，task 数 12 万 → 1.1 万 |

怎么验证没改坏：改动前后各跑同一分区，按 `dt + merchant_id` 双向对账 `count(*)`、`sum(amount)`、`count(distinct order_id)`；再抽 1000 条订单明细逐字段比对。随机前缀只改数据分布、不改业务口径，最终聚合仍落在原始 key 上，结果必须完全一致。

## 容易踩的坑

- **为快把 map join 阈值调到 500 MB**：表是能塞进去，但每个 executor 一份，并发一上来就 OOM，比慢更糟。
- **倾斜处理连口径一起改了**：随机后缀进了最终 `GROUP BY` 却没去掉，结果从按商户汇总变成按"商户_3"汇总；或 `count(distinct)` 被 salt 拆开后简单相加，指标偏小。
- **只调并行度不动倾斜**：分区数 200 → 5000，热点 key 仍在一个分区，只是多了一堆闲置 task，反而更慢。
- **删小文件解决小文件**：不控写入侧并发与分区数，合并完第二天又碎回去。

## 小结

1. 顺序固定：先用 task 时长分布、shuffle 量、spill、GC、输入量/分片数证明瓶颈，再动手；加资源只提吞吐，不解决分布问题。
2. 答法四段式：现象（少数 task 卡 99%）→ 原因（热点 key / null 聚集）→ 手段（广播、随机前缀、skew join）→ 效果（附对账结果）。
3. join 倾斜四板斧：小表广播 > 热点 key 随机前缀（膨胀小侧、打散大侧）> 空值随机后缀 > 引擎 skew join 兜底；group by 倾斜用两阶段聚合，`count(distinct)` 要单独处理。
4. 小文件是写入侧的病：控 reduce/分区数、`DISTRIBUTE BY rand()`、`hive.merge.*`、AQE 合并、湖仓 compaction 一起上；压缩块不可切分时会放大危害。
5. 参数要能说出"为什么是这个值"：shuffle 分区按"每分区 100~200 MB"反推，广播阈值 10~100 MB，AQE 兜合并/倾斜/join 策略，兜不住扫描量。

## 参考

综合 Apache Hive 官方配置文档（`hive.auto.convert.join.noconditionaltask.size`、`hive.mapjoin.smalltable.filesize`、`hive.groupby.skewindata`、`hive.optimize.skewjoin`、`hive.skewjoin.key`、`hive.merge.*`、`hive.exec.reducers.*`、`mapreduce.job.reduces`、`hive.optimize.bucketmapjoin.*`）与 Apache Spark SQL 官方配置文档（`spark.sql.shuffle.partitions`、`spark.sql.adaptive.enabled`、`spark.sql.adaptive.skewJoin.enabled`、`spark.sql.adaptive.coalescePartitions.enabled`、`spark.sql.autoBroadcastJoinThreshold`、`spark.sql.files.maxPartitionBytes`、`spark.memory.fraction`）整理。参数名与默认值逐条对照官方文档；版本差异（`hive.merge.mapredfiles` 默认 false、AQE skew join 自 3.2 起默认 true）已在文中标注边界；耗时与数据量为工程经验值，用来说明量级而非承诺。
