---
title: md-cache-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

# md-cache-starter

## 1. 模块定位

Redis 缓存统一封装模块，提供三块能力：

- `RedisTemplate` / `StringRedisTemplate` 的序列化定制（ProtoStuff 或 JDK）
- 编程式缓存操作门面 `RedisOps`（string/hash/set/zset 全量 API）与抽象接口 `CacheOps` / `CachePlusOps`
- Spring Cache（`@Cacheable` 等注解）的 `CacheManager` 定制，支持**按缓存名分别设置过期时间与前缀**

Maven 坐标：`top.mddata.base:md-cache-starter`。自动配置入口：`CacheAutoConfigure`（`META-INF/spring/...AutoConfiguration.imports` 注册）。

## 2. 源码解读

```
top.mddata.base.cache
├── CacheAutoConfigure        # 自动配置入口：@EnableCaching + keyGenerator Bean + @Import(RedisAutoConfigure)
├── RedisAutoConfigure        # 注册 redisTemplate/stringRedisTemplate/redisSerializer/cacheOps/cachePlusOps/cacheManager/redisOps
├── properties
│   ├── CustomCacheProperties # mdp.cache.* 配置（prefix = Constants.PROJECT_PREFIX + ".cache"）
│   └── SerializerType        # 枚举：ProtoStuff / JDK
├── repository
│   ├── CacheOps              # 缓存抽象接口（get/set/del/expire/exists/incr...）
│   ├── CachePlusOps          # 增强接口，extends CacheOps（hash 等扩展操作）
│   └── impl/RedisOpsImpl     # 默认实现，委托 RedisOps
├── redis
│   ├── RedisOps              # 编程式操作门面（组合两个 RedisTemplate）
│   ├── BaseRedis             # string/hash/set/zset 底层 API 封装
│   ├── CacheResult           # 带 null 标记的取值包装
│   └── NullVal               # 空值占位对象（缓存穿透防护）
└── utils
    ├── ProtoStuffSerializer  # ProtoStuff 序列化（默认，体积小速度快）
    ├── RedisObjectSerializer # 兜底对象序列化
    └── BytesWrapper          # ProtoStuff 包装类
```

关键机制：

- `RedisAutoConfigure` 构造时若配置了 `mdp.cache.cache-prefix`，会调用 `CacheKeyBuilder.Key.setPrefix(...)` 设置**全局缓存 key 前缀**（`mdp.cache.RedisAutoConfigure` 构造器），用于多项目/多环境共用一个 Redis 时隔离数据。
- `cacheManager` Bean 用 `RedisCacheConfiguration` 组装默认策略（`mdp.cache.def.*`），再遍历 `mdp.cache.configs.<缓存名>.*` 生成按缓存名的差异化配置（`withInitialCacheConfigurations`），`<缓存名>` 即 `@Cacheable(value = "xxx")` 的 value。
- `cacheOps` / `cachePlusOps` / `getRedisOps` / `redisSerializer` 四个 Bean 均标注 `@ConditionalOnMissingBean`，应用层可整体替换。

## 3. 可配置参数

配置类：`CustomCacheProperties`（prefix `mdp.cache`）。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `mdp.cache.serializer-type` | `ProtoStuff` | 值序列化类型，可选 `ProtoStuff` / `JDK` |
| `mdp.cache.cache-null-val` | `true` | `RedisOps` 编程式操作是否缓存 null 值（防穿透） |
| `mdp.cache.cache-prefix` | 无 | 全局缓存 key 前缀，写入 `CacheKeyBuilder.Key`，多环境共用 Redis 时隔离 |
| `mdp.cache.def.time-to-live` | `1d` | `@Cacheable` 默认过期时间（Duration 格式，如 `1d`、`2h`） |
| `mdp.cache.def.cache-null-values` | `true` | `@Cacheable` 默认是否缓存 null |
| `mdp.cache.def.key-prefix` | 无 | 默认 key 前缀，最终 key 格式：`keyPrefix:缓存名:key` |
| `mdp.cache.def.use-key-prefix` | `true` | 是否使用 key 前缀 |
| `mdp.cache.def.max-size` | `1000` | Caffeine 本地缓存最大条数（当前默认走 Redis，此项备用） |
| `mdp.cache.configs.<缓存名>.time-to-live` 等 | 同 def | 按 `@Cacheable` 的 value 逐个覆盖上述 5 项，**仅对 Redis 有效** |

示例：

```yaml
mdp:
  cache:
    serializer-type: ProtoStuff
    cache-prefix: mdp-prod
    def:
      time-to-live: 1d
    configs:
      mdp_user:            # @Cacheable(value = "mdp_user") 专属策略
        time-to-live: 12h
```

## 4. 扩展点

| 扩展点 | 机制 | 说明 |
| --- | --- | --- |
| `CacheOps` / `CachePlusOps` | `@ConditionalOnMissingBean` | 应用注册同类型 Bean 即可整体替换默认 Redis 实现（如换成内存/多级缓存） |
| `RedisSerializer<Object>` | `@ConditionalOnMissingBean` | 自定义值序列化器 |
| `RedisOps` Bean | `@ConditionalOnMissingBean` | 替换编程式门面 |
| `KeyGenerator` | `CacheAutoConfigure#keyGenerator` | `@Cacheable` 未指定 key 时的生成规则（类名:方法名:参数），应用可注册自己的 `keyGenerator` 覆盖 |
| `CacheManager` | `@Primary` Bean | 应用可再定义 `@Primary` CacheManager 接管 |

## 5. 功能扩展建议

- **换缓存介质**：实现 `CacheOps`（必要时加 `CachePlusOps`）并注册为 Bean，框架内所有依赖 `CacheOps` 的代码（如滑块验证码 `cache-type=redis` 分支）自动切换。
- **多级缓存**：装饰 `RedisOpsImpl`，先查 Caffeine 再查 Redis；注意失效广播需自行实现。
- **key 规范**：新缓存 key 不要手拼字符串，参考 `md-cache-key` 模块用 `CacheKeyBuilder` 生成（命名规范 `[前缀:]业务类型[:业务字段][:唯一键值]`）。

## 6. 二次开发注意事项

::: warning 序列化方式切换会导致旧缓存反序列化失败
`serializer-type` 从 ProtoStuff 切到 JDK（或反向）后，Redis 中的存量数据无法反序列化，上线前需清空相关缓存 key。
:::

::: warning configs 的 key 必须与 @Cacheable 的 value 完全一致
`mdp.cache.configs` 下的键名是 Spring Cache 的缓存名（`@Cacheable(value = "...")`），拼写不一致时静默走默认策略，不会报错。
:::

- `cache-prefix` 在 `RedisAutoConfigure` **构造期**写入 `CacheKeyBuilder.Key` 静态字段，仅影响 `CacheKeyBuilder` 体系生成的 key，不影响 `@Cacheable` 的 key（后者由 `def.key-prefix` / `configs.*.key-prefix` 控制），两套前缀机制不要混淆。
- 该模块 `@ConditionalOnClass(RedisConnectionFactory.class)`，不引入 `spring-boot-starter-data-redis` 时整个 Redis 装配不生效。
