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

```shell
top.mddata.base.json
├── autoconfigure/
│   ├── JacksonAutoConfiguration.java      # 自动配置：经 Jackson2ObjectMapperBuilderCustomizer 注入两个 Module
│   └── GeneralPropertySourceFactory.java # @PropertySource 工厂：支持 json 配置文件
├── enums/BigNumberSerializeMode.java     
├── module/
│   ├── DateJacksonModule.java             # LocalDateTime 序列化/反序列化（时间戳/格式）
│   └── NumberJacksonModule.java           # 挂 BigNumberSerializer
├── serializer/
│   ├── BigNumberSerializer.java          # 按 Mode 决定数值是否转字符串
│   ├── LocalDateTimeDeserializer.java
│   └── SimpleDeserializersWrapper.java
└── util/{JSONUtils, JSONBuilder}.java     
```

工作方式：`JacksonAutoConfiguration` 注册一个 `Jackson2ObjectMapperBuilderCustomizer`，把 `DateJacksonModule`（时间处理）和 `NumberJacksonModule`（大数处理）挂到 Spring Boot 自动创建的 `ObjectMapper` 上——**不替换官方 ObjectMapper**，与 Spring Boot 原生 `spring.jackson.*` 配置共存。

## 3. 可配置参数

无

## 4. 扩展点

- **`Jackson2ObjectMapperBuilderCustomizer`**：应用可再注册自己的 Customizer 追加序列化器（推荐做法，不要自己 new ObjectMapper Bean）。
- **`JSONUtils` / `JSONBuilder`**：业务侧静态 JSON 操作统一入口。
- **`GeneralPropertySourceFactory`**：`@PropertySource(value="classpath:xxx.json", factory=GeneralPropertySourceFactory.class)` 读取 JSON 配置。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 全局日期格式 | 配 `spring.jackson.date-format`，特殊字段用 `@JsonFormat` 局部覆盖 |
| 新的全局序列化规则 | 注册 Customizer，别改本模块 |
| 前后端约定时间戳交互 | `DateJacksonModule` 默认行为可覆盖（自定义 Module 注册靠前者优先） |

## 6. 二次开发注意事项

::: warning 与手工 ObjectMapper 隔离
自己在工具类里 `new ObjectMapper()` 的实例**不经过本模块**，行为与 Web 层不一致。统一用 `JSONUtils` 或注入容器的 ObjectMapper。
:::
