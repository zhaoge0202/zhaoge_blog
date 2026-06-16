insert into topics (slug, title, summary, target_audience, why_important, prerequisites, knowledge_map, interview_focus, sort_order, status)
values
('java-concurrency', '并发', '围绕锁、线程池、AQS、ThreadLocal 的进阶面试专题。', '3-5 年 Java 后端工程师', '并发是区分 CRUD 熟练工和能处理复杂服务端问题的核心模块。', 'Java 基础、集合、线程基础', '线程模型 -> 内存模型 -> 锁 -> AQS -> 线程池 -> 工具类', '能解释原理，能联系项目线程池和并发风险。', 10, 'PUBLISHED'),
('jvm', 'JVM', '围绕运行时内存、GC、类加载和线上排查的专题。', '3-5 年 Java 后端工程师', 'JVM 体现线上排障和性能分析能力。', 'Java 基础、操作系统内存基础', '内存区域 -> 对象生命周期 -> GC -> 收集器 -> 故障排查 -> 类加载', '能讲清 GC 和排查路径，不停留在术语。', 20, 'PUBLISHED'),
('mysql', 'MySQL', '围绕索引、事务、MVCC、锁和日志的专题。', '3-5 年 Java 后端工程师', 'MySQL 是后端工程师项目深挖里最常见的主战场。', 'SQL 基础、B+ 树基础', '索引 -> 执行计划 -> 事务 -> MVCC -> 锁 -> 日志 -> 调优', '能解释设计原因，能映射慢查询和数据一致性问题。', 30, 'PUBLISHED'),
('redis', 'Redis', '围绕数据结构、持久化、缓存问题和分布式锁的专题。', '3-5 年 Java 后端工程师', 'Redis 高频出现在性能优化、缓存一致性和分布式协调场景。', '缓存基础、网络 IO 基础', '数据结构 -> 持久化 -> 过期淘汰 -> 缓存问题 -> 高可用 -> 分布式锁', '能讲清缓存问题治理和真实项目取舍。', 40, 'PUBLISHED');

insert into questions (topic_id, slug, title, summary, difficulty, frequency, mastery_level, short_answer, long_answer, deep_dive, answer_strategy, sort_order, status, published_at)
select id, 'java-concurrency-thread-pool', '线程池 7 个参数怎么理解？', '线程池参数是并发面试里最容易联系项目配置的入口题。', 'ADVANCED', 'MUST_KNOW', 'PROJECT_READY',
'线程池 7 个参数分别控制核心线程、最大线程、空闲回收、任务队列、线程创建、拒绝策略和时间单位。面试回答要重点讲任务进入后的执行路径。',
'回答时先讲参数，再讲执行流程：任务提交后优先使用核心线程；核心线程满了进入队列；队列满了才扩到最大线程；最大线程和队列都满了触发拒绝策略。',
'进阶点在于不要只背参数名，要能结合业务解释队列选择、核心线程数估算、拒绝策略和监控指标。3-5 年面试通常会继续追问线上线程池打满、任务积压和隔离策略。',
'先用流程串参数，再结合项目说明 CPU 密集型和 IO 密集型配置差异，最后补充监控与降级。',
10, 'PUBLISHED', current_timestamp
from topics where slug = 'java-concurrency';

insert into questions (topic_id, slug, title, summary, difficulty, frequency, mastery_level, short_answer, long_answer, deep_dive, answer_strategy, sort_order, status, published_at)
select id, 'jvm-g1-vs-cms', 'G1 相比 CMS 改进了什么？', '垃圾收集器对比是 JVM 面试从概念走向排障的关键题。', 'ADVANCED', 'HIGH', 'DEEP_EXPLAIN',
'CMS 以低停顿为目标但存在内存碎片和并发失败问题；G1 用 Region 管理堆，并以可预测停顿和整体收益优先作为核心目标。',
'回答时先讲 CMS 的标记清除和问题，再讲 G1 的 Region、Remembered Set、Mixed GC 和停顿预测模型。不要把 G1 简化成“更快的 CMS”。',
'G1 的核心变化不是单点算法替换，而是堆布局和回收决策方式变化。它把堆拆成 Region，通过选择收益高的 Region 回收来控制停顿。',
'先讲 CMS 痛点，再讲 G1 设计，再回到线上排查：GC 日志、停顿时间、对象晋升和老年代占用。',
10, 'PUBLISHED', current_timestamp
from topics where slug = 'jvm';

insert into questions (topic_id, slug, title, summary, difficulty, frequency, mastery_level, short_answer, long_answer, deep_dive, answer_strategy, sort_order, status, published_at)
select id, 'mysql-mvcc-read-view', 'MVCC 和 ReadView 是怎么工作的？', 'MVCC 是 MySQL 事务面试最核心的原理题。', 'ADVANCED', 'MUST_KNOW', 'DEEP_EXPLAIN',
'MVCC 通过 undo log 版本链和 ReadView 判断版本可见性，让普通快照读在不加锁的情况下看到一致性视图。',
'回答时先说明版本链，再说明 ReadView 中活跃事务集合、最小事务 ID、下一个事务 ID 如何判断某个版本是否可见。RC 和 RR 的差异主要在 ReadView 创建时机。',
'不要把 MVCC 说成单纯“不加锁”。它解决的是快照读一致性，当前读仍然需要锁。幻读问题还要结合间隙锁和临键锁讨论。',
'先讲解决的问题，再讲数据结构，最后讲 RC/RR 差异和幻读边界。',
10, 'PUBLISHED', current_timestamp
from topics where slug = 'mysql';

insert into questions (topic_id, slug, title, summary, difficulty, frequency, mastery_level, short_answer, long_answer, deep_dive, answer_strategy, sort_order, status, published_at)
select id, 'redis-cache-consistency', '如何保证缓存和数据库一致性？', '缓存一致性是 Redis 面试最容易接项目场景的题。', 'ADVANCED', 'MUST_KNOW', 'PROJECT_READY',
'常见方案是 Cache Aside：更新数据库后删除缓存，并通过重试、消息队列或 binlog 订阅提高删除成功率。',
'回答时不要承诺强一致。要先说明缓存和数据库通常追求最终一致，再讲先更新数据库后删缓存的原因、删除失败补偿、并发读写下的短暂不一致窗口。',
'进阶点在于能讲清业务容忍度。对一致性要求极高的场景，应减少缓存或改用更强约束；对读多写少场景，可以接受短暂不一致并用补偿机制兜底。',
'先定义一致性目标，再讲 Cache Aside，再讲失败补偿和项目取舍。',
10, 'PUBLISHED', current_timestamp
from topics where slug = 'redis';

insert into follow_up_questions (question_id, question_text, answer_hint, sort_order)
select id, '线程池队列满了以后一定会创建新线程吗？', '只有当前线程数小于 maximumPoolSize 时才会继续创建。', 10 from questions where slug = 'java-concurrency-thread-pool';

insert into follow_up_questions (question_id, question_text, answer_hint, sort_order)
select id, 'G1 为什么可以做可预测停顿？', '它按 Region 估算回收收益和成本，优先选择收益更高的集合。', 10 from questions where slug = 'jvm-g1-vs-cms';

insert into follow_up_questions (question_id, question_text, answer_hint, sort_order)
select id, 'RC 和 RR 的 ReadView 创建时机有什么不同？', 'RC 每次快照读创建，RR 通常事务内第一次快照读创建后复用。', 10 from questions where slug = 'mysql-mvcc-read-view';

insert into follow_up_questions (question_id, question_text, answer_hint, sort_order)
select id, '为什么一般删除缓存而不是更新缓存？', '删除让下一次读取回源重建，避免复杂写入路径下更新缓存带来更多不一致。', 10 from questions where slug = 'redis-cache-consistency';

insert into misconceptions (question_id, wrong_statement, why_wrong, correct_statement, sort_order)
select id, '线程池参数只要背出 7 个名字就够。', '3-5 年面试更关注参数之间如何协作以及线上配置取舍。', '应该用任务执行流程解释 7 个参数，再结合项目说明配置依据。', 10 from questions where slug = 'java-concurrency-thread-pool';

insert into misconceptions (question_id, wrong_statement, why_wrong, correct_statement, sort_order)
select id, 'G1 就是 CMS 的升级版，永远更快。', 'G1 的收益取决于堆大小、对象分布和停顿目标，不能简单说永远更快。', '应该比较二者设计目标、堆管理方式和典型问题。', 10 from questions where slug = 'jvm-g1-vs-cms';

insert into misconceptions (question_id, wrong_statement, why_wrong, correct_statement, sort_order)
select id, 'MVCC 可以解决所有幻读问题。', 'MVCC 主要服务快照读，当前读下仍需要锁机制。', '需要区分快照读和当前读，再讨论 RR 下 MVCC 与临键锁的配合。', 10 from questions where slug = 'mysql-mvcc-read-view';

insert into misconceptions (question_id, wrong_statement, why_wrong, correct_statement, sort_order)
select id, '先删缓存再更新数据库一定没问题。', '并发读可能在数据库更新前回源旧值并写回缓存。', '常用策略是先更新数据库再删除缓存，并准备删除失败补偿。', 10 from questions where slug = 'redis-cache-consistency';

insert into correction_notes (question_id, title, problem, correction, evidence, source_type)
select id, '回答重点从背参数转为讲流程', '资料常把线程池参数列成清单，但面试追问通常发生在执行流程和项目配置。', '以执行流程组织答案，再补参数含义。', 'ThreadPoolExecutor 执行模型和项目线程池配置经验。', 'PERSONAL_REVIEW' from questions where slug = 'java-concurrency-thread-pool';

insert into correction_notes (question_id, title, problem, correction, evidence, source_type)
select id, '避免把 G1 简化成 CMS 替代品', '很多总结只写 G1 比 CMS 好，忽略适用前提。', '比较 Region、Mixed GC、停顿目标和碎片问题。', 'HotSpot G1 设计目标和 GC 日志分析实践。', 'PERSONAL_REVIEW' from questions where slug = 'jvm-g1-vs-cms';

insert into correction_notes (question_id, title, problem, correction, evidence, source_type)
select id, 'MVCC 不能脱离锁讨论幻读', '只讲版本链会让回答缺少边界。', '补充当前读、间隙锁和临键锁。', 'InnoDB 事务隔离实现和锁行为。', 'PERSONAL_REVIEW' from questions where slug = 'mysql-mvcc-read-view';

insert into correction_notes (question_id, title, problem, correction, evidence, source_type)
select id, '缓存一致性不是强一致承诺', '很多答案把延迟双删当成万能方案。', '先定义一致性目标，再选择 Cache Aside、补偿或更强约束。', '缓存架构实践和业务一致性要求。', 'PERSONAL_REVIEW' from questions where slug = 'redis-cache-consistency';

insert into project_mappings (question_id, scenario, project_talking_point, risk_point, interview_answer, sort_order)
select id, '异步任务、批量处理、接口聚合。', '说明不同业务线程池隔离、队列长度、拒绝策略和监控指标。', '共用线程池会导致慢任务拖垮核心链路。', '我会先按业务隔离线程池，再根据任务类型设置核心线程和队列，并对拒绝、积压、耗时做监控。', 10 from questions where slug = 'java-concurrency-thread-pool';

insert into project_mappings (question_id, scenario, project_talking_point, risk_point, interview_answer, sort_order)
select id, '线上接口延迟抖动或 Full GC。', '说明如何查看 GC 日志、停顿时间和老年代增长。', '只调大堆可能掩盖对象泄漏或晋升异常。', '我会先用 GC 日志和监控确认停顿来源，再判断是参数问题、对象分配问题还是泄漏问题。', 10 from questions where slug = 'jvm-g1-vs-cms';

insert into project_mappings (question_id, scenario, project_talking_point, risk_point, interview_answer, sort_order)
select id, '订单、库存、账户等事务读写。', '说明隔离级别选择、快照读和当前读差异。', '误把普通查询和加锁查询混为一谈会导致一致性判断错误。', '我会根据读写语义区分快照读和当前读，对关键写路径使用合适锁策略。', 10 from questions where slug = 'mysql-mvcc-read-view';

insert into project_mappings (question_id, scenario, project_talking_point, risk_point, interview_answer, sort_order)
select id, '商品详情、配置、用户会话等读多写少场景。', '说明 Cache Aside、删除失败重试和过期兜底。', '缓存删除失败会产生长时间脏数据。', '我会先更新数据库，再删除缓存；删除失败进入重试或消息补偿，并设置合理过期时间。', 10 from questions where slug = 'redis-cache-consistency';

insert into reference_sources (question_id, source_name, source_url, source_type, usage_note, sort_order)
select id, 'JavaGuide 线程池详解', 'https://javaguide.cn/java/concurrent/java-thread-pool-summary.html', 'JAVAGUIDE', '用于参数和执行流程主线。', 10 from questions where slug = 'java-concurrency-thread-pool';

insert into reference_sources (question_id, source_name, source_url, source_type, usage_note, sort_order)
select id, 'JavaGuide JVM 垃圾回收', 'https://javaguide.cn/java/jvm/jvm-garbage-collection.html', 'JAVAGUIDE', '用于收集器对比主线。', 10 from questions where slug = 'jvm-g1-vs-cms';

insert into reference_sources (question_id, source_name, source_url, source_type, usage_note, sort_order)
select id, '小林 MySQL MVCC', 'https://xiaolincoding.com/mysql/transaction/mvcc.html', 'XIAOLIN', '用于 ReadView 可见性解释。', 10 from questions where slug = 'mysql-mvcc-read-view';

insert into reference_sources (question_id, source_name, source_url, source_type, usage_note, sort_order)
select id, '小林 Redis 缓存问题', 'https://xiaolincoding.com/redis/cluster/cache_problem.html', 'XIAOLIN', '用于缓存一致性和缓存问题对比。', 10 from questions where slug = 'redis-cache-consistency';

insert into personal_notes (topic_id, note_type, title, content, happened_on, sort_order, status)
select id, 'REVISION', '从资料汇总转向内容纠偏', '准备这个站时意识到，单纯把 JavaGuide 和小林coding 拼在一起没有价值，真正的价值是把冲突、误区和项目表达整理成自己的判断。', current_date, 10, 'PUBLISHED'
from topics where slug = 'java-concurrency';
