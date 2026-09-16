---
title: md-boot
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

Spring Boot（单体形态）的公共配置模块，坐标 `top.mddata.base:md-boot`。提供三块能力：全局日期参数转换（`BaseConfig`）、`@LoginUser` 参数解析、异步线程池与全局异常处理的基类。依赖 md-core、md-util。

## 2. 源码解读

```
top.mddata.base.boot
├── config
│   ├── BaseConfig.java              # 抽象配置基类：注册 4 个日期 Converter Bean
│   ├── DefaultAsyncTaskConfig.java  # @EnableAsync 异步线程池（读 AsyncProperties）
│   ├── ParamNameConfig.java         # @LoginUser 参数解析装配入口
│   └── properties/AsyncProperties.java  # mdp.async.* 配置类
└── handler
    ├── AbstractGlobalExceptionHandler.java  # 抽象全局异常处理器（20+ @ExceptionHandler）
    ├── ParamAttrProcessor.java       # 参数属性解析
    ├── ParamArgumentProcessor.java   # HandlerMethodArgumentResolver 实现
    └── ParamDataBinder.java          # 数据绑定
```

### 2.1 BaseConfig（抽象，需继承）

注册 4 个字符串→日期时间 Converter Bean，解决 GET 参数多格式日期解析。在 MDP 中由 md-public 的 `WebConfiguration extends BaseConfig` 落地。

### 2.2 @LoginUser 参数解析链

`ParamNameConfig` → `ParamArgumentProcessor`（实现 `HandlerMethodArgumentResolver`）→ 识别 Controller 方法参数上的 `@LoginUser`（注解定义在 md-annotation）→ 从 `ContextUtil`/sa-token 会话取当前用户信息注入参数，支持 `isRoles/isOrg/isStation/isFull/isResource` 控制注入内容。

### 2.3 AbstractGlobalExceptionHandler（抽象，需继承）

内置 20+ 个 `@ExceptionHandler`，覆盖 `BizException`、`ArgumentException`、Sa-Token `NotLoginException`、`BindException`、NPE 等，统一转 `R` 响应。`errorMsg` 字段仅在 dev/test profile 回填（生产靠服务端日志排查）。MDP 中由 md-public 的 `ExceptionConfiguration` 继承并加 `@RestControllerAdvice`。

### 2.4 DefaultAsyncTaskConfig

`@EnableAsync` + 基于 `AsyncProperties` 的线程池 Bean，供 `@Async` 注解使用（md-log-starter 的 `SysLogListener` 异步消费依赖它）。

## 3. 可配置参数

`AsyncProperties`（`AsyncProperties.java:21`，前缀 `mdp.async`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.async.enabled` | true | 是否启用框架线程池 |
| `mdp.async.core-pool-size` | 2 | 核心线程数 |
| `mdp.async.max-pool-size` | 50 | 最大线程数 |
| `mdp.async.queue-capacity` | 10000 | 队列容量 |
| `mdp.async.keep-alive-seconds` | 300 | 线程存活时间（秒） |
| `mdp.async.thread-name-prefix` | md-async-executor- | 线程名前缀 |

## 4. 扩展点

| 扩展点 | 类型 | 说明 |
|---|---|---|
| `BaseConfig` | 抽象类 | 应用层继承并加 `@Configuration`，可追加自己的 Converter |
| `AbstractGlobalExceptionHandler` | 抽象类 | 应用层继承并加 `@RestControllerAdvice`，可追加业务异常的 `@ExceptionHandler` |
| `@LoginUser` | 注解 | md-annotation 定义；解析链在 `ParamNameConfig`，应用一般直接用 |
| 线程池 Bean | Bean 覆盖 | 应用定义自己的 `ThreadPoolTaskExecutor` 改变 `@Async` 行为 |

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新增业务异常处理 | 继承 `AbstractGlobalExceptionHandler` 的应用类里加 `@ExceptionHandler(YourException.class)`，**不要直接改 md-boot** |
| 自定义 `@LoginUser` 注入内容 | 扩展 `ParamAttrProcessor` / `ContextUtil` 中的数据，而不是改解析器 |
| 调大异步线程池 | 改 `mdp.async.*` 配置，不要另起线程池（统一走 `@Async` 便于排查） |
| 单体应用引入 | 依赖 `md-all-boot` 已包含本模块，无需单独引入 |

## 6. 二次开发注意事项

::: warning imports 为空是有意设计
本模块**没有** `AutoConfiguration.imports` 注册——`BaseConfig` 和 `AbstractGlobalExceptionHandler` 刻意做成抽象类，要求应用层继承后才生效（避免强制装配覆盖应用自己的配置）。如果你新起的服务发现"日期参数解析不生效/异常响应不是 R"，先检查是否继承了这两个基类。MDP 各业务服务统一在 md-common-config 中继承，**业务服务不要再继承一遍**，否则双份 Bean 冲突。
:::

::: warning 微服务形态别用错
本模块面向单体（boot）形态。微服务（cloud）形态下当前用户由网关解析后经请求头透传，使用 md-public 的 `HeaderThreadLocalInterceptor`，`@LoginUser` 解析的数据源因此不同，详见 [md-common-config](../md-public/md-common-config.md)。
:::
