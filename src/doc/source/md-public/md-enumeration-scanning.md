---
title: md-enumeration-scanning
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - md-public
---

## 1. 模块定位

枚举自动扫描模块，坐标 `top.mddata.apps:md-enumeration-scanning`，仅一个类 `EnumService`。启动时扫描指定包下所有实现 `BaseEnum` 的枚举，转成"枚举类 → 下拉选项列表"的映射供前端统一读取——前端枚举下拉不用逐个硬编码。

## 2. 源码解读

`top.mddata.common.enumeration.EnumService`（`@Component`）核心逻辑：

1. `@PostConstruct init()`：读 `SystemProperties.enumPackage`（即 `mdp.system.enumPackage`）；未配置仅打 warn 跳过（`EnumService.java:83-87`）；
2. `ClassUtils.scanPackage(enumPackage, CLASS_FILTER)` 扫描，`CLASS_FILTER`（`EnumService.java:38`）三条件：非 null、是枚举、`BaseEnum` 的实现且非接口；
3. 对每个枚举：
   - 类上 `@Schema(description)` 作为分组 label——**没有注解就 warn 并降级用类名**（`EnumService.java:106`）；
   - value = 枚举类 simpleName，remark = `DataTypeEnum` 匹配的数据类型 code；
   - 值集合 = `Option.mapOptions(枚举常量)`（code→value，desc→label）；
4. 结果存静态 `Map<Option, List<Option>> ENUM_MAP`；
5. `findAll(Boolean rescan)`：`rescan=true` 时重新 `init()` 再返回，否则直接读缓存（支持运行期热刷新）。

## 3. 可配置参数

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.system.enumPackage` | —（未配置则 warn 跳过） | 枚举扫描包路径（属性类定义在 md-common-pojo 的 `SystemProperties`） |

## 4. 扩展点

- **任何 `BaseEnum` 枚举**：实现 `BaseEnum`（getCode/getDesc）+ 类上 `@Schema(description="分组名")` + 落在 `enumPackage` 包下 → 自动被收集，无需注册。
- **`findAll(rescan)`**：传 `true` 可在新增枚举类（热部署场景）后强制重扫。
- 扫描范围就是接入面：业务工程把枚举放在 `mdp.system.enumPackage` 指定包下即完成"接入"。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新增字典型枚举 | 写 `implements BaseEnum` 的枚举 + `@Schema(description)`，放对包，重启即生效 |
| 前端枚举下拉 | 调用暴露 `findAll` 结果的查询接口（各业务域有对应封装），按 simpleName 取组 |
| 想隐藏某枚举 | 不加 `@Schema` 会 warn 并用类名展示（仍会收集）；确实不想暴露就移出扫描包 |
| 排查"枚举没出现" | 按顺序查：包路径是否覆盖 → 是否实现 BaseEnum → 类上是否有 @Schema（看启动日志的 warn） |

## 6. 二次开发注意事项

::: warning @Schema 不是装饰
`@Schema.description` 是分组 label 的**数据来源**（不是注释性配置），漏写会导致前端显示类名且启动日志 warn。枚举的 `@Schema` title/description 写法参见 [md-common-pojo](md-common-pojo.md) 的枚举规范。
:::

::: warning 扫描是全 classpath 的
`enumPackage` 设得过大（如 `top.mddata`）时依赖 jar 里的枚举也会被收集——第三方依赖升级可能"冒出"新枚举组。建议业务工程指向自己的枚举包。
:::

::: warning 静态 ENUM_MAP 多服务隔离
ENUM_MAP 是 JVM 静态的、随服务进程隔离——同一服务多实例一致（同样的包），不同服务各自扫各自的，跨服务不要假设枚举组一致。
:::
