---
title: md-common-config
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - md-public
---

## 1. 模块定位

平台各服务的 **Spring 装配层**：Web MVC、上下文拦截、全局异常、消息(sms4j)、文件存储(x-file-storage)、MyBatis-Flex、WebSocket、Undertow、Actuator 安全、方法日志切面都在这里落地。

## 2. 源码解读

包根 `top.mddata.common`，按 `configuration/`（@Configuration 类）、`configurer/`（WebMvcConfigurer）、`interceptor/`（拦截器/过滤器）、`aspect/`（切面）、`file/`、`undertow/` 组织。

### 2.1 mode=cloud/boot 双拦截器互斥机制（核心）

`WebConfiguration.java` 用两个互斥的 `@ConditionalOnProperty` 装配上下文拦截器，条件都是 `mdp.system.mode`：

| mode | 装配 | 用户信息来源 |
| --- | --- | --- |
| `cloud`（**matchIfMissing=true，缺省即此**） | `HeaderThreadLocalInterceptor` | 网关已解析 token，把 userId/companyId/deptId 等写入**请求头**；拦截器只做 header → `ContextUtil` + MDC 的搬运 |
| `boot` | `TokenContextFilter extends SaInterceptor` | 服务端直接读 **sa-token 会话** `StpUtil.getSession()`，取 loginId 及 session 中缓存的组织字段 |

两者都实现 `AsyncHandlerInterceptor`，`preHandle` 填充 `ContextUtil`/MDC，`afterCompletion` 中 `ContextUtil.remove() + MDC.clear()` 防止线程池串号；都只处理 `HandlerMethod`（静态资源直接放行），order 均为 -20，路径 `/**` 并排除 `BasicConfigurer.getExcludeCommonPathPatterns()` 的公共资源。

`TokenContextFilter` 还额外做了两件事（`TokenContextFilter.java`）：

- `parseApplication`：从 header/参数取 appId 写入上下文；
- `parseToken`：先用 `IgnoreProperties.isIgnoreUser(method, uri)` 判定免登录白名单，命中则跳过会话解析。其 `auth` 鉴权处理器目前为 **TODO 空实现**（uri 级鉴权在单体版尚未启用）。

### 2.2 其他关键类

| 类 | 说明 |
| --- | --- |
| `SystemAutoConfiguration` | `@EnableConfigurationProperties({MsgProperties, SystemProperties})`；无条件注册 `MethodLogAspect`（注释说明：不按 recordLog 条件注册，因 SystemProperties 是 @RefreshScope 代理，运行期开关可被 Nacos 热刷新） |
| `WebConfiguration` | 继承 md-boot 的抽象类 `BaseConfig`（获得 4 个日期 Converter 注册）；`addViewControllers` 把 `/` 转发到 `/index` |
| `MybatisFlexConfiguration` | 继承 md-db-mybatis-flex 的抽象类 `MyMybatisFlexConfiguration`，补上 `@MapperScan`；数据库 id 策略、审计、逻辑删除等能力全部来自父类 |
| `ExceptionConfiguration` | 继承 md-boot 的抽象类 `AbstractGlobalExceptionHandler`。 |
| `MsgAutoConfiguration` | `@ConditionalOnBean(SmsReadConfig)`：应用提供了 sms4j 的动态配置读取 Bean 才装配；`@EventListener(ContextRefreshedEvent)` 时 `SmsFactory.createSmsBlend` 批量创建短信实例 |
| `FileStorageConfiguration` | 取 x-file-storage 的 `localPlus` 第一个配置，复制后把 platform 改为 `localPlusExt`，注册 `LocalPlusExtFileStorage`（重写 `generatePresignedUrl`，返回 domain+fileKey 的完整访问地址） |
| `ActuatorSecurityConfig` | 解决 /actuator 端点能直接访问导致敏感数据泄露的问题 |
| `WebSocketConfig` | `@EnableWebSocket` + `ServerEndpointExporter`（使 `@ServerEndpoint` 生效） |
| `UndertowServerFactoryCustomizer` | 为 WebSocket 预置 XnioWorker/ByteBufferPool，消除 Undertow 启动告警；`@ConditionalOnClass(Undertow.class)` 才注册 |
| `NotAllowWriteInterceptor` | 演示环境保护：`mdp.system.not-allow-write=true` 时，按 `not-allow-write-list` 中的 `Map<HTTP方法, URI列表>` Ant 匹配，命中抛 `BizException(-1, "演示环境禁止新增、修改、删除…")`；由 `AlwaysConfigurer` 以 `order=Integer.MIN_VALUE` 注册（最先执行） |
| `MethodLogAspect` | 开发期全量方法日志，见 2.4 |
| `DataPermissionFilterImpl` | `@Component implements DataPermissionFilter`（md-db-mybatis-flex）：数据权限的"当前用户"来源——从 `ContextUtil` 取 userId/deptId |
| `ServerApplication` | 启动辅助工具：`start(primarySource, args)` 启动后打印 doc.html / druid 访问地址，各服务 main 方法调用它 |

### 2.4 MethodLogAspect 方法日志切面

与 md-log-starter 的 `SysLogAspect`（@RequestLog 注解驱动、异步审计入库）定位不同，本切面用于**开发/测试期全量观察 Service 调用链**（`MethodLogAspect.java`）：

- **切点**：`execution(public * com.mybatisflex.core.service.IService+.*(..))` 命中所有业务 Service（`+` 表示子类型，覆盖 IService 的 default 方法与 SuperService/impl 声明的方法）；`within(top.mddata..service..*)` 兜底不走 IService 体系的 service 包 Bean。`controllerLayer()` 切点已定义但未挂 @Around，需要时自行开启；
- **开关**：`mdp.system.record-log`（默认 false）为总开关，`record-args`/`record-result` 控制入参/返回值；每次调用实时读 @RefreshScope 代理，Nacos 改完即生效；
- **安全性**：单条日志截断 2000 字符；`sanitize()` 把 MultipartFile/ResponseEntity/流类型置换为占位描述，绝不读文件内容流；序列化失败降级 toString，不影响业务；
- **防递归**：`LogSuppressUtil.isSuppressed()` 跳过日志落库链路自身调用的 Service，避免"记录日志产生日志"；
- **异常**：只记类名+消息不打堆栈（堆栈由全局异常处理器统一记录），原样抛出。

## 3. 可配置参数

本模块**消费**的配置（定义在 md-common-pojo 与 mdp-base）：

| 配置项 | 默认值 | 影响的类 |
| --- | --- | --- |
| `mdp.system.mode` | 缺省=cloud | WebConfiguration 拦截器装配 |
| `mdp.system.record-log/record-args/record-result` | false/true/true | MethodLogAspect |
| `mdp.system.not-allow-write`、`not-allow-write-list` | false/{} | NotAllowWriteInterceptor |
| `mdp.ignore.*` | 见 [md-common-pojo](md-common-pojo.md) | TokenContextFilter 免登录判定 |
| `mdp.database.*` | 见 [md-db](../mdp-base/md-db.md) | MybatisFlexConfiguration（父类） |
| `mdp.async.*` | 见 [md-boot](../mdp-base/md-boot.md) | 异步线程池（父类 BaseConfig 体系） |
| sms4j / x-file-storage 自身配置 | — | MsgAutoConfiguration / FileStorageConfiguration |

## 4. 扩展点

| 扩展点 | 方式 |
| --- | --- |
| 定制全局异常响应 | 在 `ExceptionConfiguration` 中覆写 `AbstractGlobalExceptionHandler` 的对应 `@ExceptionHandler` 方法 |
| 增删拦截器 | 新建 `XxxConfigurer extends BasicConfigurer implements WebMvcConfigurer`，参照 `HeaderThreadLocalConfigurer` 注册 |
| 数据权限用户来源 | 替换 `DataPermissionFilterImpl`（@Component，可被同名/条件 Bean 覆盖），或扩展 `DataPermissionCurrentUser` 字段 |
| Web 基础配置 | `WebConfiguration extends BaseConfig`，可继续覆写 WebMvcConfigurer 各方法 |
| 文件存储平台 | 仿照 `LocalPlusExtFileStorage` 继承 x-file-storage 对应平台类，重写 URL 生成逻辑后在 FileStorageConfiguration 注册 |
| Actuator 用户体系 | 覆盖 `UserDetailsService` Bean，从内存用户换成数据库/LDAP |

## 5. 功能扩展建议

- **单体版补 uri 鉴权**：`TokenContextFilter` 构造器中 `this.auth = handler -> {}` 是预留的 TODO 空实现，在此接入 sa-token 的注解鉴权或 `IgnoreProperties.isIgnoreUriAuth` 校验即可，不必新建拦截器。
- **生产开启方法日志**：`record-log` 默认关闭，压测/排障时经 Nacos 打开，配合 `record-args=false` 可只看调用链不落参数，注意日志量。
- **新增公共配置类**：放 `configuration/` 包并遵循现有条件装配风格（@ConditionalOnXxx），确保服务按需引入时不产生多余 Bean。

## 6. 二次开发注意事项

::: warning mode 配错 = 拿不到当前用户
`mdp.system.mode` 缺省按 cloud 装配（matchIfMissing=true）。单体部署若不显式配 `boot`，服务会等待网关注入请求头，`ContextUtil.getUserId()` 恒为 null，登录态表现为"时好时坏"。两套拦截器**互斥**，不要同时注册。
:::

::: warning ActuatorSecurityConfig 存在硬编码凭证
源码中内存用户 `actuator-admin` 的密码为硬编码示例值。生产环境务必覆盖 `UserDetailsService` Bean 或改为外部化配置，**不要把真实凭证提交到仓库**；同时评估 `/actuator/**` 是否需要对公网暴露。
:::

::: warning 本模块对所有服务生效
它不是按依赖裁剪的 starter——只要服务依赖了 md-common-config 且启动类扫到 `top.mddata` 包，全部 @Configuration 都会参与装配。不需要的能力（如 sms4j）通过其自身条件（`@ConditionalOnBean(SmsReadConfig)`）或排除依赖来关闭，改动本模块会影响所有服务，需全量回归。
:::

::: tip 抽象类继承点集中在此
mdp-base 故意把 `BaseConfig`、`AbstractGlobalExceptionHandler`、`MyMybatisFlexConfiguration` 留成抽象类（imports 为空），md-common-config 是平台统一继承落地处。业务服务**不要再各自继承一遍**，否则会出现双份 Converter/异常处理器 Bean 冲突。
:::
