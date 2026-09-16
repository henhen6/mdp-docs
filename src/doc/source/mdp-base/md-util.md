---
title: md-util
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

mdp-base 的通用工具集，坐标 `top.mddata.base:md-util`。依赖 md-core，提供 Bean 拷贝、参数断言、树构建、字符串/日期/集合工具、SQL 注入过滤、MapStruct 基类、函数式接口等无业务语义的基础设施。被 md-boot、md-db-mybatis-flex、md-codegen、md-cloud-starter 等大量模块依赖。

## 2. 源码解读

包结构（`top.mddata.base`）：

| 包 | 关键类 | 职责 |
|---|---|---|
| `utils` | `BeanPlusUtil` | hutool BeanUtil 的增强版：支持 `clone`、map ↔ bean、集合批量转换单泛型方法 |
| | `ArgumentAssert` | fail-fast 参数断言（`notNull`/`notEmpty`...），失败直接抛 `ArgumentException` |
| | `AntiSqlFilterUtils` | SQL 注入关键字过滤（配合 XssFilter 场景） |
| | `ArithUtil` | 精确算术（金额计算避免浮点误差） |
| | `ClassUtils` | 反射工具：泛型类型提取等 |
| | `CollHelper` | 集合工具：拆分、转换、join |
| | `DateUtils` | 日期格式化与计算 |
| | `DefValueHelper` | 取值带默认值兜底 |
| | `FreeMarkerUtil` | FreeMarker 模板渲染（代码生成、消息模板用） |
| | `IpUtil` | IP 获取（兼容网关转发头） |
| | `MetaPlusUtil` | MyBatis-Flex TableDef 反射元数据工具 |
| | `MyTreeUtil` | hutool Tree 的增强封装，构建树更省事 |
| | `StrHelper` | 字符串工具（驼峰、脱敏等） |
| | `UaSecureUtil` | 用户代理（UA）解析 |
| | `ValidatorUtil` | 手工校验工具（绕过 Controller 层自动校验时使用） |
| | `WebUtils` | Servlet 工具：request/response 获取、参数转 JSON |
| `converter` | `String2DateConverter`、`String2LocalDateConverter`、`String2LocalTimeConverter`、String2LocalDateTimeConverter` | 字符串→日期时间的宽松转换（支持多种格式），由 md-boot 的 `BaseConfig` 注册为 Spring Converter |
| `tree` | `MyTreeBuilder` | 树构建器（流式 API） |
| `mapstruct` | `BaseMapStruct`、`MapStructMethod` | mapstruct-plus 的转换器基类与注解 |
| `function` | `CheckedFunction`、`Either` | 可抛受检异常的函数式接口、二选一结果类型 |

## 3. 可配置参数

无。本模块是纯工具库，不感知 Spring 配置。

## 4. 扩展点

- **`BaseMapStruct`**：业务转换器（DTO↔VO↔DO）继承它即可获得 mapstruct-plus 能力，见 md-common-pojo 各业务实体的用法。
- **`CheckedFunction` / `Either`**：需要把受检异常"接住"再链式处理时使用（如 IO 重试逻辑）。
- 4 个 **Converter**：如需自定义字符串日期格式，不要改这里——在应用工程注册自己的 `Converter<String, LocalDateTime>` Bean 即可（先于/后于 BaseConfig 取决于 Bean 顺序，建议直接排除 `BaseConfig` 对应 Bean 重复定义）。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新增通用工具方法 | 先看 hutool 是否已有；确认没有再往 `utils` 加，命名跟随现有 `XxxUtil/Helper` 风格 |
| 树形接口返回 | `MyTreeUtil` + `MyTreeBuilder`，避免每个业务自己写递归组装 |
| 模板渲染（如消息内容） | `FreeMarkerUtil`，模板字符串与参数 Map 分离，不要 String.format 拼 |
| 金额/比率计算 | 一律 `ArithUtil`，禁止 double 直接加减 |

## 6. 二次开发注意事项

::: warning 高频坑点
1. **`ArgumentAssert` 抛的是 `ArgumentException`**：属于业务异常体系，会被全局异常处理器转为统一错误响应；不要用它做非业务场景的防御（如防御性判空），那类问题应该让它自然抛 NPE 暴露。
2. **`BeanPlusUtil` 泛型转换依赖 Class 参数**：集合拷贝时务必传目标类型，否则得到的是 `List<Map>`。
3. **Converter 的格式约定**：4 个日期 Converter 支持的格式是框架约定的，前端传参格式变化时先确认这里能解析，不要只改 Controller。
4. 本模块处于依赖链上游，**改公共工具方法签名等于影响全平台**，新增方法优先于修改方法。
:::
