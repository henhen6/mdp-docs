---
title: md-powerjob-worker-spring-boot-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

PowerJob worker 定制 starter，坐标 `top.mddata.base:md-powerjob-worker-spring-boot-starter`，包名保留官方 `tech.powerjob.worker.autoconfigure`（源码副本式定制，仅两个类）。职责：装配 `PowerJobWorker`，让服务接入 PowerJob 调度平台（定时任务、工作流、MapReduce 任务）。

## 2. 源码解读

```
tech.powerjob.worker.autoconfigure
├── PowerJobAutoConfiguration.java   # 构建 PowerJobWorker Bean
└── PowerJobProperties.java          # powerjob.worker.* 配置绑定
```

注册机制是 **spring.factories + AutoConfiguration.imports 双注册**（同时兼容 Spring Boot 2 与 3 的自动配置加载机制）——这是它区别于其他 md-*-starter（仅 imports）的地方。

## 3. 可配置参数

`PowerJobProperties`（前缀 `powerjob.worker`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `powerjob.worker.enabled` | true | worker 开关 |
| `powerjob.worker.app-name` | — | 应用名（调度平台注册标识，**必填**） |
| `powerjob.worker.server-address` | — | PowerJob server 地址 |
| `powerjob.worker.port` / `akka-port` | — | worker 通信端口 |
| `powerjob.worker.protocol` | AKKA | AKKA / HTTP |
| `powerjob.worker.store-strategy` | DISK | DISK / MEMORY |
| `powerjob.worker.max-result-length` | 8192 | 任务结果长度上限 |
| `powerjob.worker.max-appended-wf-context-length` | — | 工作流上下文长度 |
| `powerjob.worker.tag` | — | 标签（分组） |
| `powerjob.worker.max-lightweight-task-num` | 1024 | 轻量任务并发 |
| `powerjob.worker.max-heavyweight-task-num` | 64 | 重量任务并发 |
| `powerjob.worker.health-report-interval` | 10 | 健康上报间隔（秒） |
| `powerjob.worker.allow-lazy-connect-server` | — | 允许 server 不可用时启动 |

## 4. 扩展点

- 关闭 worker：`powerjob.worker.enabled=false`（纯 Web 服务不需要跑任务时）。
- 任务处理逻辑：业务工程实现 PowerJob 官方 `BasicProcessor` 等处理器，与平台调度配置配合，本模块不涉及。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新增定时任务 | 业务侧写 Processor + PowerJob 控制台配置，不动本模块 |
| 不跑任务的服务 | `enabled=false`，省掉 akka 端口占用 |
| 任务上下文/日志过大 | 调 `max-result-length` / `max-appended-wf-context-length` |

## 6. 二次开发注意事项

::: warning 双注册机制
升级 Spring Boot 大版本或 PowerJob 版本时，spring.factories（Boot2 机制）会被 Boot3 忽略、imports（Boot3 机制）才是生效入口——两个文件都要保留同步，漏一个会导致不同 Boot 版本下行为不一致。
:::

::: warning 端口冲突
worker 的 akka/http 端口与 Web 端口独立，容器化部署时记得都暴露（同 Pod 多实例注意端口错开）。
:::
