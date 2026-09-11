---
title: md-cache-key
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - md-public
---

## 1. 模块定位

全平台缓存 key 定义模块，坐标 `top.mddata.apps:md-cache-key`（业务公共层）。集中声明各服务的 Redis 缓存"表名"常量与 key 构建器，统一命名规范。仅依赖 md-core（`CacheKeyBuilder`/`CacheKey` 契约所在）。

## 2. 源码解读

```
top.mddata.common.cache
├── CacheKeyTable.java                # 表名常量接口（CAPTCHA/FORGET_PWD + Console/Workbench/Open 嵌套）
├── console/
│   ├── organization/                 # User/Org/UserOrg/RoleResource CacheKeyBuilder
│   └── system/                        # Config/ConfigUniqKey/DictItemHash CacheKeyBuilder
├── system/                           # Role/UserRoleRel/UserRoleCodeRel CacheKeyBuilder
├── workbench/                        # Captcha/ForgetPassword/SsoUser{Phone,Email,UserName} CacheKeyBuilder
└── open/                             # App/Api/AppKeys/AccessToken 等 8 个 CkBuilder
```

### 2.1 两个组成部分

**① CacheKeyTable（表名常量）**：`interface CacheKeyTable` 用嵌套接口按服务域分组（`Console.DICT_ITEM`、`Workbench.USER`、`Open.ACCESS_TOKEN`...），值即 key 中的"表名"段。

**② Builder（每个缓存一个类）**：统一实现 md-core 的 `CacheKeyBuilder`（函数式接口），结构固定：

```java
public class AccessTokenCkBuilder implements CacheKeyBuilder {
    public static CacheKey builder(String appKey, String token) { ... }  // 静态入口
    @Override public String getTable() { return CacheKeyTable.Open.ACCESS_TOKEN; }
    @Override public Duration getExpire() { ... }                        // 过期时间（可空）
}
```

`AccessTokenCkBuilder`（`AccessTokenCkBuilder.java:35-45`）的复合 key 是 `{appKey}:{token}`——**同一 token 不同应用不互通**，防止跨应用冒用；过期约 2 小时（与开放平台 accessToken 有效期一致）。

### 2.2 命名规范（CacheKeyBuilder javadoc 约定）

```
[前缀:][租户ID:]表名[:字段名][:唯一键值]
```

冒号分隔；`CacheKeyBuilder` 提供 `key(uniques...)` → `CacheKey`、`hashKey()`/`hashFieldKey(field, ...)` → `CacheHashKey`、`getPattern()`（`*:{table}:*` 通配，用于批量删除）。全局前缀由 `CacheKeyBuilder.Key.setPrefix(...)` 静态设置（区分项目/环境）。

## 3. 可配置参数

无配置类。缓存策略相关配置在 [md-cache-starter](../mdp-base/md-cache-starter.md)（`mdp.cache.*`）。

## 4. 扩展点

**新增缓存 key 的标准步骤**：

1. `CacheKeyTable` 对应嵌套接口加表名常量；
2. 写一个 `implements CacheKeyBuilder` 的类：`getTable()` 返回常量、`getExpire()` 给过期时间、静态 `builder(...)` 返回 `CacheKey`；
3. 业务代码用 `XxxCacheKeyBuilder.builder(id)` 拿 key 配合 `CacheOps` 使用。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新业务缓存 | 严格走 Builder 模式，**禁止在业务代码手拼字符串 key**——否则 getPattern 批量清理、前缀隔离全部失效 |
| hash 结构缓存 | 用 `hashKey()/hashFieldKey()`（参考 `DictItemHashCacheKeyBuilder`） |
| 换环境/多项目共用 Redis | 启动时设置 `CacheKeyBuilder.Key.setPrefix("项目标识")`，避免 key 撞车 |
| 调过期时间 | 改对应 Builder 的 `getExpire()`；跨实例注意缓存穿透窗口 |

## 6. 二次开发注意事项

::: warning 表名常量一旦发布不可改值
key 中的表名段是线上 Redis 数据的寻址依据，改值等于旧缓存全部失联（表现为缓存永远 miss）。新增可以，改值需要配套清理脚本。
:::

::: warning getExpire 与 mdp.cache.def 的关系
Builder 的 `getExpire()` 是该缓存的"自身过期"；`@Cacheable` 注解走的缓存名策略由 `mdp.cache.def.*` 控制——两条路径都存在时以实际调用代码为准，改缓存时长先确认走的是哪条。
:::
