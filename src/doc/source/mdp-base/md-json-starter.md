---
title: md-json-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

Jackson 增强模块，坐标 `top.mddata.base:md-json-starter`。解决两个序列化问题：JS 大数精度丢失（Long 型 ID 超过 `2^53`）、LocalDateTime 格式统一。同时提供 JSON 工具类和支持 `.json` 格式配置文件读取。

## 2. 源码解读

```
top.mddata.base.json
├── autoconfigure/
│   ├── JacksonAutoConfiguration.java      # 自动配置：经 Jackson2ObjectMapperBuilderCustomizer 注入两个 Module
│   ├── JacksonExtensionProperties.java    # spring.jackson 扩展配置（bigNumberSerializeMode）
│   └── GeneralPropertySourceFactory.java # @PropertySource 工厂：支持 json 配置文件
├── enums/BigNumberSerializeMode.java     # ALWAYS / NEVER / FLEXIBLE
├── module/
│   ├── DateJacksonModule.java             # LocalDateTime 序列化/反序列化（时间戳/格式）
│   └── NumberJacksonModule.java           # 挂 BigNumberSerializer
├── serializer/
│   ├── BigNumberSerializer.java          # 按 Mode 决定数值是否转字符串
│   ├── LocalDateTimeDeserializer.java
│   └── SimpleDeserializersWrapper.java
└── util/{JSONUtils, JSONBuilder}.java     # fastjson2 静态工具
```

工作方式：`JacksonAutoConfiguration` 注册一个 `Jackson2ObjectMapperBuilderCustomizer`，把 `DateJacksonModule`（时间处理）和 `NumberJacksonModule`（大数处理）挂到 Spring Boot 自动创建的 `ObjectMapper` 上——**不替换官方 ObjectMapper**，与 Spring Boot 原生 `spring.jackson.*` 配置共存。

## 3. 可配置参数

`JacksonExtensionProperties`（前缀 `spring.jackson`，与官方属性同一前缀）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `spring.jackson.big-number-serialize-mode` | FLEXIBLE | 大数序列化模式：ALWAYS（全部转字符串）/ NEVER（不转）/ FLEXIBLE（仅超 JS 安全范围 `2^53-1` 才转） |

日期格式经 Spring Boot 官方 `spring.jackson.date-format` 等配置，模块内 `DateJacksonModule` 优先。

## 4. 扩展点

- **`Jackson2ObjectMapperBuilderCustomizer`**：应用可再注册自己的 Customizer 追加序列化器（推荐做法，不要自己 new ObjectMapper Bean）。
- **`JSONUtils` / `JSONBuilder`**：业务侧静态 JSON 操作统一入口（fastjson2 内核）。
- **`GeneralPropertySourceFactory`**：`@PropertySource(value="classpath:xxx.json", factory=GeneralPropertySourceFactory.class)` 读取 JSON 配置。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 前端拿到的 Long ID 精度丢失 | 保持默认 FLEXIBLE 即可（雪花 ID 自动转字符串） |
| 全局日期格式 | 配 `spring.jackson.date-format`，特殊字段用 `@JsonFormat` 局部覆盖 |
| 新的全局序列化规则 | 注册 Customizer，别改本模块 |
| 前后端约定时间戳交互 | `DateJacksonModule` 默认行为可覆盖（自定义 Module 注册靠前者优先） |

## 6. 二次开发注意事项

::: warning 前端别用 Number 接 ID
FLEXIBLE 模式下只有超 `2^53-1` 的数才转字符串，小 ID 仍是数值——前端 TypeScript 接口字段类型要写成 `string`（对雪花 ID 场景）或统一按字符串处理，不能假定类型恒定。
:::

::: warning 与手工 ObjectMapper 隔离
自己在工具类里 `new ObjectMapper()` 的实例**不经过本模块**，行为与 Web 层不一致。统一用 `JSONUtils` 或注入容器的 ObjectMapper。
:::
