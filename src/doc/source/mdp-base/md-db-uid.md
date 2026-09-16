---
title: md-db-uid
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

分布式唯一 ID 生成模块，坐标 `top.mddata.base:md-db-uid`。内容是**百度 uid-generator 的源码移植**（包名保留 `com.baidu.fsg.uid`），外加平台自加的 `HuToolUidGenerator`（hutool 雪花）。被 md-db 依赖，本身不暴露配置——全部参数经 `mdp.database.*` 下发（见 [md-db](md-db.md)）。

## 2. 源码解读

```
com.baidu.fsg.uid                        # 百度 uid-generator 原样移植
├── UidGenerator.java                    # 接口：getUid() / parseUid(long)
├── impl/
│   ├── DefaultUidGenerator.java         # 原生：秒级时间戳+机器+序列，每次取 uid 走 DB 分配 workerId
│   ├── CachedUidGenerator.java          # RingBuffer 预生成，借用未来时间，吞吐 ~600万/s
│   └── HuToolUidGenerator.java          # 平台新增：hutool 雪花（不依赖 DB）
├── buffer/                              # RingBuffer、填充执行器、拒绝策略（RejectedPut/TakeBufferHandler）
├── worker/
│   ├── WorkerIdAssigner.java            # 工作节点分配接口
│   ├── DisposableWorkerIdAssigner.java  # 默认实现：用后即弃（重启=新增节点）
│   └── entity/WorkerNodeEntity.java
└── utils/                               # DockerUtils/NetUtils 等
top.mddata.base.uid.dao.WorkerNodeDao    # 平台新增：worker_node 表读写（MyBatis 注解 DAO）
```

### 2.1 三种生成器怎么选

| 生成器 | 策略（`mdp.database.id-type`） | 适用 |
|---|---|---|
| `HuToolUidGenerator` | HU_TOOL（默认） | 单机或固定数量集群；免建表，配置 worker-id/data-center-id |
| `DefaultUidGenerator` | DEFAULT | 集群动态扩容；启动时经 `WorkerNodeDao` 在 `worker_node` 表登记节点 |
| `CachedUidGenerator` | CACHE | 高并发；RingBuffer + 填充线程，参数见 `mdp.database.cache-id.*` |

### 2.2 WorkerNodeDao

MyBatis 注解 DAO（不走 mybatis-flex），对 `worker_node` 表 insert/select，MySQL/Oracle 双 `@Insert(databaseId)`。`DisposableWorkerIdAssigner` 启动时插入一条节点记录取自增 id 作为 workerId——"用后即弃"意味着**每次重启都新增记录**，workerBits 决定可重启次数上限（默认 23 位 ≈ 800 万次）。

## 3. 可配置参数

本模块无自有配置类。全部经 md-db 的 `DatabaseProperties` 配置：

| 配置组 | 关键项 | 说明 |
|---|---|---|
| `mdp.database.hutool-id.*` | worker-id、data-center-id | HU_TOOL 策略的机器标识（默认 0） |
| `mdp.database.default-id.*` | timeBits(31)/workerBits(23)/seqBits(9)/epochStr("2020-09-15") | DEFAULT 策略位数与纪元 |
| `mdp.database.cache-id.*` | boostPower(3)/paddingFactor(50)/scheduleInterval(300s)/rejected*-buffer-handler-class | CACHE 策略 RingBuffer 参数 |

## 4. 扩展点

- **`WorkerIdAssigner`**：想复用（而非用后即弃）workerId，实现该接口替换 `DisposableWorkerIdAssigner`。
- **`RejectedPutBufferHandler` / `RejectedTakeBufferHandler`**：CACHE 策略环满/环空时的拒绝策略，配置实现类即可注入（支持 Lambda 风格实现类）。
- 位数参数本身就是容量调优点：长期运行/频繁重启场景参考 `DatabaseProperties.java:91-95` javadoc 的三组推荐组合。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 换成号段/Leaf 模式 | 不改本模块——在应用工程定义自己的 `UidGenerator` Bean（`@ConditionalOnMissingBean` 自动让位） |
| K8s 滚动更新频繁 | workerBits 调大或改用 HU_TOOL 并给每个实例配稳定 worker-id（用 StatefulSet 序号） |
| 观察生成质量 | `UidGenerator#parseUid` 可反解时间戳/机器位，排查重复 ID 时有用 |

## 6. 二次开发注意事项

::: warning 升级与定制
本模块是百度 uid-generator 的**源码副本**，升级百度版本需手动 diff 合并，不要直接覆盖 `HuToolUidGenerator`、`WorkerNodeDao` 等平台新增类。修改位数参数前先算容量：`timeBits + workerBits + seqBits` 之和受 long 位宽约束，且 epochStr 之后才有效。
:::

::: warning worker_node 表膨胀
用后即弃策略下每次重启插一条记录，长期高频重启的库需要定期清理历史节点数据（否则表越来越大、自增 id 涨到 workerBits 上限）。
:::
