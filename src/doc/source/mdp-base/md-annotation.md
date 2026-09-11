---
title: md-annotation（公共注解）
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

`md-annotation` 是**纯注解定义模块**，不含任何 Spring 依赖与运行逻辑，把平台全部自定义注解集中在一处，供实体、DTO、Controller 引用而不必依赖实现模块（避免循环依赖）。

- Maven 坐标：`top.mddata.base:md-annotation`
- 依赖：`knife4j-core`、`swagger-annotations-jakarta`、`swagger-models-jakarta`、`jakarta.validation-api`、`mybatis-flex-annotation`（全部是注解/API 级依赖）
- 被依赖：`md-core` → 几乎所有模块
- 注解的**消费方**分散在其他模块：`@Echo` 由 md-echo-starter 处理、`@RequestLog` 由 md-log-starter 处理、`@LoginUser`/`@ParamName` 由 md-boot 处理

## 2. 源码解读

包结构（`top.mddata.base.annotation`）：

```
annotation/
├── constraints/NotEmptyPattern.java   # 空值放行的正则校验
├── echo/Echo.java                     # 字段级数据回显
├── echo/EchoResult.java               # 方法级回显触发
├── log/RequestLog.java                # 操作日志
├── user/LoginUser.java                # Controller 注入当前登录人
└── web/ParamName.java                 # 表单参数别名绑定
```

### 2.1 @Echo / @EchoResult（数据回显）

`Echo.java` 标记在**字段**上（也可标记方法/类型），声明该字段的值需要被「翻译/填充」：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `api` | 必填 | 提供数据的 Spring Bean 名称（`LoadService` 实现类），或常量 `Echo.ENUM_API`（`"_DEF_ENUM_API"`，枚举回显） |
| `ref` | `""` | 回显结果写入的目标字段（不填则写回本字段的 `echoMap`） |
| `beanClass` | `Object.class` | 远程调用（Feign）反序列化后丢类型时，强制转换的目标类型 |
| `dictType` | `""` | 字典回显时的字典 key（对应字典表的 parent_key） |

`EchoResult.java` 标记在 **Service 方法**上（不能标记 Mapper 方法），方法返回后由 AOP 自动执行回显，属性仅 `ignoreFields()`（跳过的字段）。

### 2.2 @RequestLog（操作日志）

`RequestLog.java` 可标记方法或类，由 md-log-starter 的切面消费：

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 是否记录 |
| `value` | `""` | 日志描述，**支持 SpEL 表达式** |
| `logType` | `LogType.OTHER` | 内置枚举：QUERY(1)/ADD(2)/UPDATE(3)/DELETE(4)/OTHER(9) |
| `modular` | `""` | 所属模块名 |
| `controllerApiValue` | `true` | 是否拼接 Controller 类上 `@Tag` 的 name |
| `request` | `true` | 是否记录入参 |
| `requestByError` | `true` | `request=false` 时，方法报错仍记录入参 |
| `response` | `true` | 是否记录返回值 |

### 2.3 @LoginUser（注入当前登录人）

`LoginUser.java` 标记在 **Controller 方法参数**上，由 md-boot 的 `ParamAttrProcessor`/`ParamArgumentProcessor` 解析（见 [md-boot](md-boot.md)）：

```java
public R<User> info(@LoginUser(isOrg = true) SysUser user) { ... }
```

| 属性 | 说明 |
| --- | --- |
| `isFull` | 查询用户所有信息（走 RPC） |
| `isEmployee` / `isUser` | 只查员工 / 用户信息 |
| `isRoles` / `isResource` | 附带角色 / 资源信息 |
| `isOrg` / `isMainOrg` | 附带组织 / 主组织信息 |
| `isPosition` | 附带岗位信息 |

全部默认 `false`，即默认只从线程上下文取基础字段，不发远程调用。

### 2.4 @ParamName（参数别名）

`ParamName.java` 标记在 DTO **字段**上，让表单绑定时支持自定义参数名（一个字段可绑定多个请求参数名），由 md-boot 的 `ParamDataBinder` 消费。

### 2.5 @NotEmptyPattern（宽松正则校验）

`constraints/NotEmptyPattern.java` 与 `jakarta.validation.constraints.Pattern` 的唯一区别：**入参为 `null` 或 `""` 时跳过正则校验**。属性与 Pattern 完全对齐（`regexp`、`flags`、`message`、`groups`、`payload`），支持 `@Repeatable`。

注意其 `@Constraint(validatedBy = {})` 为空 —— 校验器实现不在本模块，由平台校验体系注册（配合 md-validator-starter / hibernate-validator 使用）。

## 3. 可配置参数

无。纯注解模块不含配置属性类；各注解的行为开关在消费方模块（如 `mdp.echo.enabled`、`mdp.log.enabled`）。

## 4. 扩展点

- **注解本身即扩展点**：新增平台级注解时放入本模块对应子包（按 echo/log/user/web/constraints 分类），消费逻辑写到对应 starter，保持「定义与实现分离」
- `@Echo(api=...)` 的 beanName 路由机制：任何实现 `LoadService`（定义在 md-core）的 Spring Bean 都能成为回显数据源，无需改框架
- `@RequestLog.value` 支持 SpEL，可动态取方法入参拼日志描述

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
| --- | --- |
| 给新业务字段做字典翻译 | 字段加 `@Echo(api = Echo.ENUM_API, dictType = "xxx")` 或指向自定义 `LoadService` Bean |
| 新日志类型 | 不修改 `RequestLog.LogType` 枚举（平台升级会冲突），用 `modular` + `value` 表达业务语义 |
| 新增校验注解 | 参照 `NotEmptyPattern` 的写法：注解放本模块，`ConstraintValidator` 实现放业务工程或 starter |

## 6. 二次开发注意事项

::: warning 高频坑点
1. **@LoginUser 不能用于 BaseController 的方法**（注解 Javadoc 明确说明），因为基类方法签名固定，参数解析器无法介入。
2. **@EchoResult 不能标记在 Mapper 方法上**，只能标记 Service 方法；回显对象之间**禁止循环引用**（User ↔ File 互相回显会导致递归异常）。
3. **@Echo(api="xxxServiceImpl") 要求当前服务存在该 Bean**：微服务拆分后，若数据在别的服务，api 需指向 FeignClient 并配置 `beanClass` 强转类型。
4. 本模块刻意**零 Spring 依赖**，不要在此引入 spring-context 等实现级依赖，否则会破坏「实体层可被任意模块引用」的设计。
:::
