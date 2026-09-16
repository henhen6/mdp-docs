---
title: mdp-sdk-core
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-sdk
---

# mdp-sdk-core（SDK 内核）

## 1. 模块定位

SDK 的运行时内核：HTTP 客户端、RSA 签名/验签、AES 消息加解密、统一返回体与分页模型、请求基类。所有第三方 API 封装（mdp-simple-sdk）都构建在本模块之上。

- Maven 坐标：`top.mddata.sdk:mdp-sdk-core`
- 依赖：okhttp 4.12（网络）、fastjson2（JSON）、commons-logging（日志）、commons-io，版本在自身 pom 中独立管理，**不继承平台 parent**
- 包根：`top.mddata.sdk.core`

## 2. 源码解读

### 2.1 包结构

```
top.mddata.sdk.core
├── client/      # OpenClient / OpenRequest / OpenHttp —— HTTP 请求发送
├── param/       # BaseParam / DownloadRequest / DownloadAware / IdRequest —— 请求对象基类
├── common/      # Result / OpenConfig / RequestForm / FileResult / UploadFile / DataNameBuilder
├── request/     # PageParams / Kv —— 分页入参与键值对
├── response/    # Page —— 分页返回
├── sign/        # SignUtil / RsaTool / StringUtils / StreamUtil —— RSA 签名
├── aes/         # MdpBizMsgCrypt 及配套 —— 回调消息加解密
├── exception/   # SdkException / SopSignException
└── util/        # Base64Util / HexUtil / MD5Util / FileUtil / ClassUtil
```

### 2.2 OpenClient —— 唯一入口

`client/OpenClient.java`，构造时传入网关 url、appKey、开发者 RSA 私钥，**全局声明一个即可**（内部持有连接资源）。

核心方法：

| 方法 | 说明 |
|---|---|
| `execute(BaseParam)` | 组装表单 → 按需签名 → 发送请求 → `parseResponse` 反序列化，返回 `Result<Resp>` |
| `download(DownloadRequest)` | 文件下载，内部走 `execute`，返回 `FileResult`（字节 + 响应头） |
| `setDefaultAccessToken(token)` | 设置默认令牌，之后所有请求自动携带；单个请求也可用 `param.setAccessToken()` 覆盖 |

关键逻辑（`OpenClient.java:121-171`）：

1. `param.createRequestForm(openConfig)` 生成公共参数表单
2. accessToken 优先级：请求级 > 客户端默认级
3. 签名开关优先级：`param.getSignEnabled()`> `openConfig.isSignEnabled()`
4. `param instanceof DownloadAware` 时走下载分支，否则 `parseResponse` 解析 JSON
5. 响应解析：先整体转 `Result`（下划线智能转驼峰），再从 `dataNameBuilder.build(method)` 指定的数据节点取业务数据，JSONArray 自动转 List

### 2.3 BaseParam —— 请求对象基类

`param/BaseParam.java`，泛型 `BaseParam<Req, Resp>`：Req 为业务入参类型、Resp 为返回类型（通过 `ClassUtil.getSuperClassGenricType` 反射获取，用于反序列化）。

| 成员 | 说明 |
|---|---|
| `method()` | **抽象方法**，对应服务端 `@Open` 注解的 value，如 `user.page` |
| `version()` | 接口版本，默认取 `OpenConfig.defaultVersion`（1.0） |
| `bizModel` / `bizContent` | 业务参数：对象（自动 JSON 序列化）或原始 JSON 字符串，二选一 |
| `requestMethod` | HTTP 方法，默认 POST |
| `signEnabled` | 请求级签名开关，`null` 时回落到全局配置 |
| `accessToken` | 请求级令牌，为空时用客户端默认令牌 |
| `notifyUrl` | 异步回调地址（如批量导入完成后回调） |
| `files` | `addFile(UploadFile)` 添加上传文件 |

`createRequestForm(OpenConfig)` 组装公共参数：`method`、`format`、`charset`、`signType`、`timestamp`（yyyy-MM-dd HH:mm:ss）、`version`、`notifyUrl`、`bizContent`，内部用 `SkipNullHashMap` 自动跳过 null 值。

### 2.4 OpenConfig —— 编程式配置

`common/OpenConfig.java`。**无 Spring 配置项**，全部通过 POJO 链式 setter 编程式设置，作为第 4 个构造参数传入 `OpenClient`：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| successCode | `0` | 成功返回码 |
| defaultVersion | `1.0` | 默认接口版本 |
| charset | `UTF-8` | 字符编码 |
| signType | `RSA2` | 签名算法（RSA2/RSA） |
| formatType | `json` | 格式类型 |
| timestampPattern | `yyyy-MM-dd HH:mm:ss` | 时间戳格式 |
| dataName | `bizContent` | 业务参数表单字段名 |
| methodName / versionName / charsetName / appKeyName / signName / signTypeName / formatName / accessTokenName / timestampName / notifyUrl | 同名字符串 | 各公共参数的表单字段名，均可改 |
| locale | `zh-CN` | 国际化语言 |
| responseCodeName | `code` | 响应码字段名 |
| errorResponseName | `errorResponse` | 错误响应节点名 |
| **signEnabled** | **false** | 全局签名开关；`accessToken.get` 等高安全接口在 API 类中单独强制开启 |
| connectTimeoutSeconds / readTimeoutSeconds / writeTimeoutSeconds | 60 / 60 / 60 | okhttp 三项超时 |
| dataNameBuilder | `CustomDataNameBuilder`（节点名 `data`） | 响应数据节点解析策略 |

### 2.5 Result / Page / PageParams —— 数据模型

- `common/Result.java`：统一返回体，字段 `code/msg/subCode/subMsg/solution/data`。**`isSuccess()` 判定依据是 `subCode` 为空**，不是 code==0；静态工厂 `success(data)` / `error(msg)`
- `response/Page.java`：分页返回，字段 `records/pageNumber/pageSize/totalPage/totalRow`，提供 `of(...)` 工厂与 `hasNext()/hasPrevious()/offset()` 翻页辅助
- `request/PageParams.java`：分页入参，字段 `model`（查询条件对象）/`size`(10)/`current`(1)/`sort`/`order`/`extra`
- `param/IdRequest.java`：通用「按 id 查询」入参，只有 `id` 一个字段

### 2.6 签名与加解密

**RSA 签名**（`sign/SignUtil.java`）：

- 请求签名：`getSignContent(params)`（参数按 key 排序拼接，剔除 sign 与空值）→ `rsaSign(content, privateKey, charset, signType)`；RSA2 用 SHA256WithRSA、RSA 用 SHA1WithRSA
- 响应验签：`rsaCheckV1/V2(params, publicKey, charset, signType)`
- `sign/RsaTool.java`：密钥工具——生成密钥对、PKCS1↔PKCS8 格式互转（内部枚举 `KeyFormat`/`KeyLength`/`KeyStore`），可独立复用

**AES 回调消息加解密**（`aes/MdpBizMsgCrypt.java`），用于第三方接收平台的事件回调/接口回调：

- 三种模式常量：`MODE_PLAINTEXT`(0) 明文 / `MODE_COMPATIBLE`(1) 兼容 / `MODE_ENCRYPTED`(2) 加密
- `encryptMsg` / `decryptMsg` / `verifyUrl`（回调地址有效性验证）/ `calcSignature` / `verifySignature` / `generateEncodingAesKey`
- 配套：`SHA1`、`PKCS7Encoder`、`ByteGroup`、`JsonParse`、`AesException` 与 `aes/pojo/` 下的推送参数类（`PushFormParam`/`PushSecureFormParam`/`PushBodyBaseParam`/`PushSecureBodyParam`）
- 服务端对应实现见 [事件回调](../../integration/事件回调.md)、[接口回调](../../integration/接口回调.md)

### 2.7 DataNameBuilder —— 响应数据节点策略

`common/DataNameBuilder.java` 接口只有一个方法 `build(method)`：

| 实现 | 节点名规则 | 示例 |
|---|---|---|
| `CustomDataNameBuilder`（**默认**） | 固定节点，默认 `data`，可构造传参 | `{"data": {...}}` |
| `DefaultDataNameBuilder` | method 点转下划线 + `_response` | `user.page` → `user_page_response` |

### 2.8 异常体系

- `exception/SdkException.java`：SDK 运行时异常（网络、签名构建失败等）
- `exception/SopSignException.java`：签名专用异常
- `common/SopSdkErrors.java`：SDK 侧错误码枚举——`HTTP_ERROR=836875001`（网络错误）、`CHECK_RESPONSE_SIGN_ERROR=836875002`（验签失败），`getErrorResult()` 直接生成失败的 `Result`

## 3. 可配置参数

无 Spring 配置。全部通过 `OpenConfig`（见 2.4 表格）编程式设置；签名密钥、appKey 通过 `OpenClient` 构造器传入。

## 4. 扩展点

| 扩展点 | 方式 |
|---|---|
| 新增接口 | 继承 `BaseParam<Req, Resp>`，重写 `method()`（必须）、`version()`（可选） |
| 文件下载接口 | 继承 `param/DownloadRequest<Req>`（已实现 `DownloadAware` 标记接口，`OpenClient` 据此走下载分支） |
| 响应数据节点 | 实现 `DataNameBuilder` 并 `openConfig.setDataNameBuilder(...)` |
| 请求流程定制 | 继承 `OpenClient`，覆写 `protected doExecute(...)` / `parseResponse(...)` / `buildFileResult(...)` |
| 加解密复用 | `SignUtil`、`RsaTool`、`MdpBizMsgCrypt` 均为静态/独立类，可直接用于第三方自己的验签场景 |

## 5. 功能扩展建议

- **想改 HTTP 底层**（代理、连接池、重试）：改 `client/OpenHttp.java`（okhttp 封装，含 cookie store 与文件上传下载），或在 `OpenRequest` 层拦截
- **想统一记录请求日志**：开启 commons-logging 的 debug 级别，`OpenClient` 会打印请求参数、待签名内容与响应原文（`OpenClient.java:144-155`）
- **对接多环境**：`OpenConfig` 实例可复用，按环境 new 多个 `OpenClient` 即可；不要把 url/appKey 硬编码进 API 类

## 6. 二次开发注意事项

::: warning 依赖纪律
本模块交付给第三方，新增依赖前必须评估体积与泄露风险，禁止引入 mdp 平台内部模块和 Spring。
:::

::: warning isSuccess 的判定
`Result.isSuccess()` 只看 `subCode` 是否为空。排查调用失败时优先打印 `subCode/subMsg/solution` 三个字段，`code/msg` 是网关层信息。
:::

