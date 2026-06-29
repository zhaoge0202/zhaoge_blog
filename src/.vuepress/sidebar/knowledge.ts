export const knowledgeSidebar = {
  "/interview-preparation/": [""],
  "/java/": [
    "",
    {
      text: "基础",
      prefix: "basis/",
      collapsible: true,
      children: [""],
    },
    {
      text: "集合",
      prefix: "collection/",
      collapsible: true,
      children: [
        "",
        {
          text: "List",
          collapsible: true,
          children: ["java-collection-arraylist-linkedlist"],
        },
        {
          text: "Map",
          collapsible: true,
          children: [
            "java-collection-hashmap-structure",
            "java-collection-hashmap-thread-safety",
            "java-collection-concurrenthashmap",
            "java-collection-linkedhashmap-lru",
          ],
        },
        {
          text: "Set",
          collapsible: true,
          children: ["java-collection-hashset"],
        },
        {
          text: "并发集合与队列",
          collapsible: true,
          children: [
            "java-collection-copyonwritearraylist",
            "java-collection-queue-scenarios",
          ],
        },
      ],
    },
    {
      text: "并发",
      prefix: "concurrent/",
      collapsible: true,
      children: [
        "",
        {
          text: "线程基础与内存模型",
          collapsible: true,
          children: [
            "java-concurrency-basics",
            "java-concurrency-jmm",
            "java-concurrency-volatile",
          ],
        },
        {
          text: "锁与同步",
          collapsible: true,
          children: [
            "java-concurrency-synchronized",
            "java-concurrency-cas",
            "java-concurrency-reentrantlock",
          ],
        },
        {
          text: "线程池",
          collapsible: true,
          children: ["java-concurrency-thread-pool"],
        },
        {
          text: "并发工具与集合",
          collapsible: true,
          children: [
            "java-concurrency-threadlocal",
            "java-concurrency-concurrent-collections",
            "java-concurrency-completablefuture",
          ],
        },
        {
          text: "虚拟线程",
          collapsible: true,
          children: ["java-concurrency-virtual-thread"],
        },
      ],
    },
    {
      text: "JVM",
      prefix: "jvm/",
      collapsible: true,
      children: [
        "",
        {
          text: "内存与对象",
          collapsible: true,
          children: ["jvm-memory-areas", "jvm-object-lifecycle"],
        },
        {
          text: "类加载",
          collapsible: true,
          children: ["jvm-class-loading", "jvm-classloader"],
        },
        {
          text: "GC 原理与收集器",
          collapsible: true,
          children: [
            "jvm-object-recycling",
            "jvm-gc-collectors",
            "jvm-g1-vs-cms",
          ],
        },
        {
          text: "线上排障与调优",
          collapsible: true,
          children: [
            "jvm-oom-troubleshooting",
            "jvm-full-gc-troubleshooting",
            "jvm-parameters-tuning",
          ],
        },
      ],
    },
    {
      text: "IO",
      prefix: "io/",
      collapsible: true,
      children: [""],
    },
    {
      text: "新特性",
      prefix: "new-features/",
      collapsible: true,
      children: [""],
    },
  ],
  "/cs-basics/": [
    "",
    {
      text: "操作系统",
      prefix: "operating-system/",
      collapsible: true,
      children: [
        "",
        {
          text: "进程线程",
          collapsible: true,
          children: [
            "os-process-thread",
            "os-context-switch",
            "os-thread-count-limit",
            "os-ipc",
            "os-deadlock",
          ],
        },
        {
          text: "内存与文件系统",
          collapsible: true,
          children: [
            "os-virtual-memory",
            "os-malloc-physical-memory",
            "os-page-cache",
          ],
        },
        {
          text: "网络 IO",
          collapsible: true,
          children: ["os-io-multiplexing", "os-zero-copy", "os-reactor-netty"],
        },
      ],
    },
    {
      text: "计算机网络",
      prefix: "network/",
      collapsible: true,
      children: [
        "",
        {
          text: "网络基础",
          collapsible: true,
          children: ["network-tcp-ip-model", "network-url-process"],
        },
        {
          text: "TCP 连接生命周期",
          collapsible: true,
          children: [
            "network-tcp-three-way-handshake",
            "network-tcp-four-way-wave-time-wait",
          ],
        },
        {
          text: "TCP 可靠传输与控制",
          collapsible: true,
          children: [
            "network-tcp-reliability",
            "network-tcp-flow-congestion-control",
            "network-tcp-queue-overflow",
            "network-server-no-accept",
          ],
        },
        {
          text: "HTTP/HTTPS",
          collapsible: true,
          children: [
            "network-http-versions",
            "network-https-rsa-ecdhe",
            "network-http-keepalive-tcp-keepalive",
          ],
        },
        {
          text: "抓包排障",
          collapsible: true,
          children: ["network-tcpdump-handshake-retransmission"],
        },
      ],
    },
    {
      text: "数据结构",
      prefix: "data-structure/",
      collapsible: true,
      children: [""],
    },
    {
      text: "算法",
      prefix: "algorithms/",
      collapsible: true,
      children: [""],
    },
  ],
  "/database/": [
    "",
    {
      text: "MySQL",
      prefix: "mysql/",
      collapsible: true,
      children: [
        "",
        {
          text: "基础与架构",
          collapsible: true,
          children: [
            "mysql-architecture-sql-execution",
            "mysql-innodb-vs-myisam",
          ],
        },
        {
          text: "数据是怎么存的",
          collapsible: true,
          children: [
            "mysql-row-format",
            "mysql-data-page",
            "mysql-buffer-pool",
          ],
        },
        {
          text: "索引与查询优化",
          collapsible: true,
          children: [
            "mysql-why-bplus-tree",
            "mysql-index-design",
            "mysql-index-invalidation",
            "mysql-explain",
            "mysql-count",
          ],
        },
        {
          text: "事务与并发控制",
          collapsible: true,
          children: [
            "mysql-transaction-isolation",
            "mysql-mvcc-read-view",
            "mysql-locks",
            "mysql-lock-rules",
            "mysql-deadlock",
          ],
        },
        {
          text: "日志与持久化",
          collapsible: true,
          children: [
            "mysql-logs",
            "mysql-replication",
            "mysql-update-execution",
            "mysql-crash-recovery-logs",
            "mysql-flush-policy",
          ],
        },
        {
          text: "工程细节与规范",
          collapsible: true,
          children: [
            "mysql-schema-design",
            "mysql-time-and-primary-key",
            "mysql-auto-increment",
          ],
        },
        {
          text: "工程排障与变更",
          collapsible: true,
          children: [
            "mysql-next-key-lock-range",
            "mysql-slow-query-troubleshooting",
            "mysql-deadlock-log-analysis",
            "mysql-replication-delay-troubleshooting",
            "mysql-online-ddl",
          ],
        },
      ],
    },
    {
      text: "Redis",
      prefix: "redis/",
      collapsible: true,
      children: [
        "",
        {
          text: "数据结构与持久化",
          collapsible: true,
          children: [
            "redis-data-structures",
            "redis-internal-data-structures",
            "redis-zset-skiplist",
            "redis-single-thread-performance",
            "redis-special-data-structures",
            "redis-typical-scenarios",
            "redis-persistence",
            "redis-persistence-latency",
            "redis-expire-eviction",
          ],
        },
        {
          text: "线上问题与工程实践",
          collapsible: true,
          children: [
            "redis-bigkey-hotkey",
            "redis-blocking-troubleshooting",
            "redis-memory-fragmentation",
            "redis-configuration-tuning",
            "redis-monitoring-metrics",
          ],
        },
        {
          text: "缓存问题",
          collapsible: true,
          children: [
            "redis-cache-problems",
            "redis-bloom-filter",
            "redis-cache-consistency",
          ],
        },
        {
          text: "高可用与分布式协调",
          collapsible: true,
          children: [
            "redis-high-availability",
            "redis-replication-internals",
            "redis-sentinel-failover",
            "redis-cluster-details",
            "redis-cluster-operations",
            "redis-replication-troubleshooting",
            "redis-distributed-lock",
          ],
        },
        {
          text: "扩展能力",
          collapsible: true,
          children: [
            "redis-pipeline-lua",
            "redis-rate-limiting",
            "redis-message-queue",
            "redis-delayed-task",
          ],
        },
      ],
    },
    {
      text: "SQL",
      prefix: "sql/",
      collapsible: true,
      children: [
        "",
        {
          text: "查询执行与聚合",
          collapsible: true,
          children: ["sql-execution-order", "sql-groupby-aggregate"],
        },
        {
          text: "多表连接、子查询与集合",
          collapsible: true,
          children: ["sql-join", "sql-subquery", "sql-set-operations"],
        },
        {
          text: "进阶查询",
          collapsible: true,
          children: [
            "sql-window-functions",
            "sql-null-and-case",
            "sql-pagination",
          ],
        },
        {
          text: "写法规范与优化",
          collapsible: true,
          children: ["sql-writing-best-practices"],
        },
      ],
    },
    {
      text: "Elasticsearch",
      prefix: "elasticsearch/",
      collapsible: true,
      children: [
        "",
        {
          text: "核心概念与原理",
          collapsible: true,
          children: ["es-core-concepts", "es-inverted-index"],
        },
        {
          text: "分词与映射",
          collapsible: true,
          children: ["es-analyzer", "es-mapping"],
        },
        {
          text: "查询与打分",
          collapsible: true,
          children: ["es-query-dsl", "es-scoring"],
        },
        {
          text: "聚合",
          collapsible: true,
          children: ["es-aggregation"],
        },
        {
          text: "集群与分布式",
          collapsible: true,
          children: ["es-shard-replica", "es-read-write-flow"],
        },
        {
          text: "工程实践",
          collapsible: true,
          children: ["es-deep-pagination-tuning"],
        },
      ],
    },
    {
      text: "MongoDB",
      prefix: "mongodb/",
      collapsible: true,
      children: [
        "",
        {
          text: "文档模型与选型",
          collapsible: true,
          children: ["mongodb-data-model"],
        },
        {
          text: "索引与查询优化",
          collapsible: true,
          children: ["mongodb-index-query"],
        },
        {
          text: "聚合管道",
          collapsible: true,
          children: ["mongodb-aggregation-pipeline"],
        },
        {
          text: "高可用与扩展",
          collapsible: true,
          children: ["mongodb-replica-sharding"],
        },
      ],
    },
  ],
  "/system-design/": [
    "",
    {
      text: "设计基础",
      prefix: "basis/",
      collapsible: true,
      children: [""],
    },
    {
      text: "框架",
      prefix: "framework/",
      collapsible: true,
      children: [
        "",
        "spring-ioc-container-startup",
        "spring-bean-lifecycle-extension-points",
        "spring-circular-dependency-resolution",
        "spring-aop-proxy-weaving",
        "spring-transaction-failure-cases",
        "spring-mvc-request-processing",
        "spring-boot-auto-configuration-principles",
        "mybatis-cache-pitfalls",
        "mybatis-plugin-pagination-mechanism",
      ],
    },
    {
      text: "安全",
      prefix: "security/",
      collapsible: true,
      children: [""],
    },
  ],
  "/distributed-system/": [
    "",
    "distributed-cap-base",
    "distributed-raft-overview",
    "distributed-zookeeper-zab",
    "distributed-lock-implementations",
    {
      text: "RPC",
      prefix: "rpc/",
      collapsible: true,
      children: [
        "",
        "rpc-call-flow",
        "dubbo-discovery-loadbalance-faulttolerance",
      ],
    },
  ],
  "/high-performance/": [
    "",
    {
      text: "性能定位与 SQL 排查",
      collapsible: true,
      children: [
        "high-performance-bottleneck-analysis",
        "high-performance-sql-optimization-chain",
      ],
    },
    {
      text: "数据库扩展与一致性",
      collapsible: true,
      children: [
        "high-performance-read-write-splitting-consistency",
        "high-performance-sharding-tradeoffs",
      ],
    },
    {
      text: "消息队列与异步链路",
      collapsible: true,
      children: [
        "high-performance-message-queue-role",
        "high-performance-message-reliability",
        "high-performance-message-idempotency",
        "high-performance-message-backlog",
        "high-performance-mq-selection",
      ],
    },
  ],
  "/high-availability/": [
    "",
    {
      text: "可用性目标",
      collapsible: true,
      children: ["high-availability-sla-rto-rpo"],
    },
    {
      text: "稳定性治理",
      collapsible: true,
      children: [
        "high-availability-rate-limiting",
        "high-availability-resilience-composition",
        "high-availability-retry-storm",
      ],
    },
    {
      text: "幂等与重复请求",
      collapsible: true,
      children: [
        "high-availability-idempotency-design",
        "high-availability-idempotency-cases",
      ],
    },
    {
      text: "容灾与验证",
      collapsible: true,
      children: [
        "high-availability-disaster-recovery",
        "high-availability-performance-testing",
      ],
    },
  ],
  "/tools/": [
    "",
    {
      text: "Docker",
      prefix: "docker/",
      collapsible: true,
      children: [""],
    },
    {
      text: "Git",
      prefix: "git/",
      collapsible: true,
      children: [""],
    },
    {
      text: "Maven",
      prefix: "maven/",
      collapsible: true,
      children: [""],
    },
    {
      text: "Gradle",
      prefix: "gradle/",
      collapsible: true,
      children: [""],
    },
  ],
};
