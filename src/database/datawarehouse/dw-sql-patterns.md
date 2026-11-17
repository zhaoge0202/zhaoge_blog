---
title: "数仓场景的手撕 SQL 怎么准备？窗口函数和高频题型有哪些套路？"
description: "十二类高频手撕题型，每题给出示例数据、可跑 SQL、结果形态与一句套路总结。"
breadcrumb: true
article: true
editLink: false
category:
  - "数据仓库"
tag:
  - "必会"
  - "高频"
  - "项目实战"
prev:
  text: "数据质量怎么监控与治理？校验规则和异常排查怎么做？"
  link: "/database/datawarehouse/dw-data-quality.html"
next:
  text: "Java 业务系统怎么对接数仓？埋点、CDC 和指标回流怎么设计？"
  link: "/database/datawarehouse/dw-bigdata-java-integration.html"
---

# 数仓场景的手撕 SQL 怎么准备？窗口函数和高频题型有哪些套路？

> 手撕 SQL 考的从来不是"会不会窗口函数"，而是**你能不能把业务问题翻译成"按什么分组、按什么排序、要第几行"**。题型是有限的，套路是可以默写的。

## 先说清楚怎么练

- **限时手写**：每题 8 分钟，不看笔记、不查文档、不用编辑器补全。面试是白板或在线文档，没有语法提示。
- **按题型归类背**：下面十二类覆盖了绝大多数数仓面试题，同类型只记一个骨架，换字段换表名即可。
- **写不出先写思路**：说清"我要按 user_id 分组、按 dt 排序、用 row_number 取第一条"，很多时候面试官会认可思路。
- **注意方言**：下面以 Hive 语法为主，Spark SQL 的差异会在需要的地方点出来。二者的窗口函数、`explode` 基本一致，差别主要在日期函数与 `QUALIFY` 之类的方言扩展。

## 一、分组 Top-N：每个类目卖得最好的 3 个商品

```sql
-- sku_sales(dt, category, sku_id, amt)
select category, sku_id, amt
from (
  select category, sku_id, amt,
         row_number() over (partition by category order by amt desc) as rn
  from sku_sales
  where dt = '2024-06-01'
) t
where rn <= 3;
```

套路：**排名函数做在子查询里，过滤放在外层**。`ROW_NUMBER` 严格不并列；允许并列都进榜用 `RANK`，要并列且不跳号用 `DENSE_RANK`。这个"并列怎么算"是面试官最常追问的一句，答不上来会显得只是背过语法。

## 二、连续 N 天登录

```sql
-- login_log(user_id, dt)，dt 为日期
select user_id, count(1) as continuous_days
from (
  select user_id, dt,
         date_sub(dt, rn) as grp
  from (
    select user_id, dt,
           row_number() over (partition by user_id order by dt) as rn
    from (select distinct user_id, dt from login_log) a
  ) b
) c
group by user_id, grp
having count(1) >= 3;
```

套路是那个 `date_sub(dt, rn)`：**连续日期的 dt 与行号同步 +1，相减得到同一个常量**，于是"连续"变成了"同一个 grp 分组"。中间那次 `distinct` 不能省，否则一天登录两次就把序号顶掉了。

如果题目要的是"连续 N 天里的最大长度"，把外层改成 `select user_id, max(cnt)`。如果要求"连续 3 天内每天都有登录且跨月也成立"，这个写法天然支持，因为用的是日期差不是自然日序号。

## 三、次日留存 / 7 日留存

```sql
with first_login as (
  select user_id, min(dt) as first_dt
  from login_log
  group by user_id
)
select f.first_dt,
       count(distinct f.user_id) as new_users,
       count(distinct case when l.dt = date_add(f.first_dt, 1) then f.user_id end) as d1_users,
       count(distinct case when l.dt = date_add(f.first_dt, 7) then f.user_id end) as d7_users,
       round(count(distinct case when l.dt = date_add(f.first_dt, 1) then f.user_id end)
             / count(distinct f.user_id), 4) as d1_rate
from first_login f
left join login_log l on f.user_id = l.user_id
where f.first_dt = '2024-06-01'
group by f.first_dt;
```

套路：**先算出每个用户的首次登录日，再用它和后续行为做自关联**。必须 `left join` 且分母取首日新增用户数，否则"今天没登录的人"被过滤掉，留存率会被系统性抬高——这是留存算错最常见的原因。

## 四、同比 / 环比

```sql
select dt, amt,
       lag(amt) over (order by dt) as prev_day_amt,
       round(amt / lag(amt) over (order by dt) - 1, 4) as dod,
       lag(amt, 7) over (order by dt)   as last_week_same_day
from dws_trade_1d
where dt between '2024-06-01' and '2024-06-30';
```

坑在这里：`lag` 取的是**上一行**，不是"昨天"。如果 6 月 10 日没有数据（缺行），`lag` 会拿到 6 月 9 日的值当成"昨天"，环比就错了。要严格按日期对齐，用日期维表补齐或用显式自关联：

```sql
select a.dt, a.amt, b.amt as prev_day_amt
from dws_trade_1d a
left join dws_trade_1d b on b.dt = date_sub(a.dt, 1);
```

同比同理，把偏移换成 `add_months(dt, -12)`，别用 `lag(amt, 365)`——闰年和平年的天数不同。

## 五、行转列：条件聚合

```sql
-- order_detail(user_id, status)
select user_id,
       sum(case when status = 'paid'   then 1 else 0 end) as paid_cnt,
       sum(case when status = 'refund' then 1 else 0 end) as refund_cnt,
       sum(case when status = 'paid'   then amt else 0 end) as paid_amt
from order_detail
where dt = '2024-06-01'
group by user_id;
```

套路：**`SUM(CASE WHEN ... THEN 1 ELSE 0 END)` 就是一个"只统计满足条件那部分"的计数器**。Hive 里也可以写 `sum(if(status = 'paid', 1, 0))`，等价。注意 `count(case when ... then 1 end)` 也能用（不给 else 就是 null，`count` 忽略 null），但混用容易错，统一成 `sum + else 0` 最稳。

## 六、列转行：explode

```sql
-- order_tag(order_id, sku_list)  sku_list = 'A01,A02,A03'
select order_id, sku_id
from order_tag
lateral view explode(split(sku_list, ',')) t as sku_id;

-- order_ext(order_id, ext_map)  ext_map 是 map<string,string>
select order_id, kv_key, kv_value
from order_ext
lateral view explode(ext_map) t as kv_key, kv_value;
```

套路：字符串用 `split` 切成数组再 `explode`，map 直接 `explode` 会拆成两列。注意 `lateral view` 是 Hive 写法，Spark SQL 两者都支持，也可以直接 `select order_id, explode(split(sku_list, ',')) as sku_id from order_tag`。

一个容易忽略的后果：**explode 会让行数膨胀**，如果外层还有 `count(distinct)` 或聚合，结果会变。先想清楚"膨胀后我要的是明细还是聚合"。

## 七、累计求和与移动平均

```sql
select dt, amt,
       sum(amt) over (order by dt rows between unbounded preceding and current row) as cum_amt,
       avg(amt) over (order by dt rows between 6 preceding and current row)      as ma_7d,
       sum(amt) over (partition by category order by dt)                        as cum_by_category
from dws_trade_1d
where dt between '2024-06-01' and '2024-06-30';
```

套路：默认窗口帧是 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`，按"值"聚合（同一天多行会一起进），`ROWS` 才是按"行"数。算 7 日移动平均要显式写 `ROWS BETWEEN 6 PRECEDING`，否则日期缺失时会多算或少算。

## 八、漏斗转化

```sql
select dt,
       count(distinct user_id) as uv_all,
       count(distinct if(page = 'detail', user_id, null)) as uv_detail,
       count(distinct if(page = 'order',  user_id, null)) as uv_order,
       count(distinct if(page = 'pay',    user_id, null)) as uv_pay
from traffic_log
where dt = '2024-06-01'
group by dt;
```

套路：一步一个 `count(distinct if(...))`。但要说清它在算什么——**"当天是否到达过这一步"**，不是"按顺序依次到达"。严格的漏斗要么限定会话内按时间排序做窗口，要么在埋点侧就有 `step` 字段。面试时主动指出这个差别，比背对 SQL 更值分。

## 九、去重取最新一条

```sql
-- ods_user_change(user_id, phone, update_time, dt)
select user_id, phone, update_time
from (
  select user_id, phone, update_time,
         row_number() over (partition by user_id order by update_time desc) as rn
  from ods_user_change
  where dt = '2024-06-01'
) t
where rn = 1;
```

套路：`row_number` 是最通用的解，能带出整行。对比 `group by user_id` + `max(update_time)`：那个只能拿到聚合列，`phone` 取哪一行取决于引擎实现（Hive 通常取最后读到的任意一行），**结果不确定**。要取最新整行，必须用窗口函数，或者用 `join` 回原表。

## 十、中位数与分位数

```sql
select percentile_approx(amt, 0.5, 10000) as p50,
       percentile_approx(amt, 0.9, 10000) as p90,
       percentile_approx(amt, array(0.5, 0.9, 0.99), 10000) as multi
from order_detail
where dt = '2024-06-01';
```

套路：大数据量下用近似算法（`percentile_approx`），第三个参数是精度（桶数），越大越准也越慢。要精确中位数就麻烦得多（排序后取中间行），面试里能用近似答上并说清误差来源就够了。注意这不是 MySQL 的 `PERCENTILE_CONT`，方言差异别混。

## 十一、分组占比与除零

```sql
select category, amt,
       round(amt / sum(amt) over (partition by dt), 4)            as ratio_in_day,
       round(amt / nullif(sum(amt) over (), 0), 4)                as ratio_all
from category_sales
where dt = '2024-06-01';
```

套路：占比 = 自身 / 组内总和，用 `over()` 开窗算分母，不用再 join 一次。**分母一律套 `nullif(..., 0)`**，否则某天数据为空时整条任务会因为除零报错或返回 NULL。

## 十二、补齐连续日期

报表最常见的需求：某天没数据也要显示 0。

```sql
-- 方案一：日期维表（生产推荐）
select d.dt, coalesce(t.amt, 0) as amt
from dim_date d
left join dws_trade_1d t on d.dt = t.dt
where d.dt between '2024-06-01' and '2024-06-30';

-- 方案二：Hive 里现造序列（space + split + posexplode）
select date_add('2024-06-01', pos) as dt
from (
  select posexplode(split(space(29), '')) as (pos, x)
) t;

-- 方案三：Spark SQL 直接用 sequence
select explode(sequence(to_date('2024-06-01'), to_date('2024-06-30'), interval 1 day)) as dt;
```

套路：**永远优先用日期维表**。现造序列的写法（`space` 生成 n 个空格、`split` 切成 n+1 个空串、`posexplode` 取下标）在面试里能写出来是加分项，但生产上可读性和健壮性都不如维表。

## 容易踩的坑

- **窗口函数不能写在 `WHERE` 里**：它在 `SELECT` 阶段才计算，过滤排名必须套子查询（或用 Spark/Hive 之外某些方言的 `QUALIFY`）。
- **先裁剪再开窗**：`where dt = ...` 和只选需要的列都要写在窗口之前。在大表上先开窗再过滤，等于让引擎把全量数据 shuffle 一遍。
- **`COUNT(DISTINCT)` 很贵**：数据量大时先用 `approx_count_distinct`（HyperLogLog，误差约 1~2%）做趋势，需要精确值时再单独跑。
- **分区字段上套函数等于放弃分区裁剪**：`where substr(dt, 1, 6) = '202406'` 会扫全表，写成 `where dt between '2024-06-01' and '2024-06-30'`。
- **`NOT IN` 遇 NULL 全空**：子查询结果里只要有一个 NULL，整个条件就永远不成立，改用 `NOT EXISTS` 或 `left join ... is null`。
- **`COUNT(*)` 与 `COUNT(col)` 不同**：后者忽略 NULL，算"有值的人数"时别写错。
- **日期字符串格式不统一**：`'2024-6-1'` 和 `'2024-06-01'` 不等值，join 不上也不报错，只是结果少一截。落 DWD 时就把格式统一掉。

## 小结

- 手撕题的通用四问：**按什么分组（partition by）、按什么排序（order by）、要第几行（row_number/rank）、要不要保留全行（子查询套一层）**。
- 连续 N 天用 `date_sub(dt, rn)` 构造同组标识；留存用"首日 + 自关联"；同比环比要按日期对齐而不是按行偏移。
- 行转列用条件聚合 `sum(case when ... then 1 else 0 end)`，列转行用 `lateral view explode`，注意膨胀后的聚合口径。
- 去重取最新只能用窗口函数或自关联，`group by + max` 取不到确定的整行。
- 先裁剪分区和列、再开窗；`COUNT(DISTINCT)` 慎用；分母一律 `nullif(..., 0)`。

## 参考

SQL 写法依据 Hive 官方 LanguageManual 中窗口函数与内置函数（`row_number`、`lag`、`percentile_approx`、`lateral view explode`、`date_sub` / `date_add`）的语义说明，以及 Spark SQL 官方文档中 `sequence`、`explode`、`QUALIFY` 等方言差异的记载。示例数据为构造数据，SQL 均按 Hive 语法核对过函数签名与参数个数；`percentile_approx` 的误差范围与实际数据分布有关，未写成固定值。
