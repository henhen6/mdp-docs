---
title: SDK开发
category:
  - 开发进阶
tag:
  - 开发进阶
  - 开放平台
---

平台方每新增一组 `@Open` 接口，就应同步为第三方提供对应的 SDK 封装。本篇讲**如何基于 mdp-sdk-core 编写新业务域 SDK**、如何复用签名/加解密工具、以及如何指导第三方接收平台推送。

> SDK 内核（OpenClient/BaseParam/OpenConfig）与现有业务封装的源码剖析见 [mdp-sdk-core](../../source/mdp-sdk/mdp-sdk-core.md)、[mdp-simple-sdk](../../source/mdp-sdk/mdp-simple-sdk.md)，本篇聚焦「新增一个业务域」的操作步骤。

## 1. 交付纪律

mdp-sdk 是**直接交付给第三方的 jar**，约束：

::: warning 依赖纪律

- 依赖项尽可能少：当前仅 okhttp（网络）、fastjson2（JSON）、slf4j-api（日志门面），版本在自身 pom 独立管理，**不继承平台 parent**；
- **禁止**依赖平台内部模块（md-core、md-common-pojo 等）与 Spring——会把平台内部类泄露给第三方，并引入版本冲突；
- 出入参 DTO 在 sdk 模块内重新定义（可对照 api-pojo 抄写），不要跨模块引用。

:::

## 2. 新增业务域 SDK

以已有 `demo` 域为模板（`mdp-simple-sdk/src/main/java/top/mddata/sdk/simple/`）：

**第 1 步：** 在 request 包新建入参 DTO

```java
// request/goods/GoodsSaveDto.java —— 普通 POJO，Serializable
// 字段名即 bizContent JSON 的字段名，与服务端 api-pojo 的接收对象一致
```

**第 2 步：** 在response 包新建返回 DTO

```java
// response/goods/GoodsResp.java
```

**第 3 步：** 在api 包新建接口封装类

```java
public class GoodsSaveApi extends BaseParam<GoodsSaveDto, GoodsResp> {
    @Override
    public String method() {
        return "goods.save";   // 与服务端 @Open("goods.save") 完全一致
    }

    // 高安全接口（如换 token）强制签名：
    // @Override
    // public Boolean getSignEnabled() { return true; }
}
```

**第 4 步：写测试**（参照 `src/test/java/top/mddata/sdk/test/` 的 `UserTest`/`OrgTest`）：

```java
public class GoodsTest {
    // OpenClient 全局声明一个即可（javadoc：「申明一个即可」）
    private final OpenClient client = new OpenClient("{gateway-url}/api", "{appKey}", "{私钥}");

    @Test
    public void testSave() {
        GoodsSaveApi api = new GoodsSaveApi();
        api.setBizModel(new GoodsSaveDto().setName("示例"));
        Result<GoodsResp> result = client.execute(api);
        // isSuccess() 依据 subCode 为空判定，失败先看 subCode/subMsg/solution
    }
}
```

## 3. 特殊场景的封装方式

| 场景 | 做法 | 参照 |
| ---- | ---- | ---- |
| 分页查询 | Req 用 `PageParams<XxxQuery>`、Resp 用 `Page<XxxResp>` | `UserPageApi` |
| 按 id 查询 | Req 直接复用内核的 `IdRequest` | `UserGetByIdApi` |
| 强制签名 | 覆写 `getSignEnabled()` 返回 `true` | `AccessTokenGetApi.java:24-26` |
| 异步回调 | `api.setNotifyUrl(...)`，服务端处理完回调该地址 | `UserTest.testSave` |
| 文件上传 | `api.addFile(new UploadFile(...))` | `DemoFileUploadApi` |
| 文件下载 | 继承 `DownloadRequest<Req>`，用 `client.download(...)`，返回 `FileResult` | `DemoFileDownloadApi` |
| 接口多版本 | 覆写 `version()` 或 `setVersion()` | `BaseParam` |

## 4. 密钥与加解密工具

### 4.1 RSA 密钥对（请求签名用）

开发者（或平台代为）生成密钥对的工具在 SDK 内核：

```java
// mdp-sdk-core：sign/RsaTool.java
RsaTool.KeyStore keys = new RsaTool(KeyFormat.PKCS8, KeyLength.LENGTH_2048).createKeys();
String publicKey = keys.getPublicKey();   // 配到平台 mdo_app_keys.public_key_app
String privateKey = keys.getPrivateKey(); // 开发者自持，用于请求签名
```

支持 PKCS1/PKCS8 × 1024/2048（测试用例 `RsaToolTest.java:18-27`），`convertPkcs8ToPkcs1` 可互转格式。签名算法 RSA2 = SHA256WithRSA，待签内容为公共参数字典序拼接（`SignUtil`，与网关验签同一套约定）。

### 4.2 AES 推送加解密（接收回调/事件用）

第三方接收平台推送时用 `MdpBizMsgCrypt`（SDK 内核 `aes/` 包）：

```java
MdpBizMsgCrypt crypt = new MdpBizMsgCrypt(token, encodingAesKey, appKey);
// 安全模式：验签 + 解密
String plaintext = crypt.decryptMsg(encrypt, timestamp, nonce, msgSignature);
// 明文/兼容模式：单独验签 signature = SHA1(sort(token, timestamp, nonce, ""))
```

三种模式（`MODE_PLAINTEXT` 明文 / `MODE_COMPATIBLE` 兼容 / `MODE_ENCRYPTED` 安全）与平台 `NotifySender` 一一对应。**SDK 侧与服务端（sop-service-support）各有一份同算法实现，改动时必须两侧同步**。

## 5. 回调接收端参考实现

平台在 md-api 内置了一个完整的接收端参考：`NotifyCallbackController`（`api-web/.../NotifyCallbackController.java:51`，路由 `POST /anyUser/notify/callback`）。指导第三方实现时，流程为：

1. 取 URL 参数 `signature`/`msgSignature`/`timestamp`/`nonce`/`encryptType`（:57-65）；
2. 从请求体取 `appKey`（三种模式都有），查对应加密配置（:74-78）——**建议第三方把 token/encodingAesKey 存自己配置文件，不要每次查库**（代码注释 :80）；
3. 构造 `MdpBizMsgCrypt`，验签、解密（:92-183）；
4. 按明文 JSON 的 `type` 分发：`EVENT_PUSH`（事件）/`CALLBACK`（接口回调），读 `bizContent` 处理业务（:195-234）；
5. **应答**：成功返回 `{"code":0}`，平台以此判定投递成功；失败则进入重试梯度。

第三方接入方视角的完整说明见[事件回调](../../integration/事件回调.md)、[接口回调](../../integration/接口回调.md)。

## 6. OpenClient 使用规范

- **单例复用**：`OpenClient` 字段均 final，唯一可变状态是 `defaultAccessToken`（`OpenClient.java:74`）。全局声明一个实例即可；多线程复用时注意 token setter 的并发赋值（建议初始化后由定时任务统一刷新）；
- **accessToken 管理**：SDK **不内置** token 过期自动刷新——平台方可再封装一层 Facade（缓存 token、到期前调 `accessToken.get` 换新、`forceRefresh` 强制刷新）；
- **多环境**：`OpenConfig` 可复用，按环境 new 多个 `OpenClient`；url/appKey 不硬编码进 API 类；
- **日志**：SDK 用 slf4j 门面，应用方接入 logback 后把 `OpenClient` 的 logger 调到 debug 可打印请求参数与待签名内容（`OpenClient.java:144-155`）及响应原文（:166-168）。

## 7. 版本与发布

- SDK 是 mdp 根工程的 module（`mdp-sdk`），版本跟随根 pom 的 `${revision}`（当前 1.7.0），经 flatten 插件产出最终坐标 `top.mddata.sdk:mdp-sdk-core` / `top.mddata.sdk:mdp-simple-sdk`；
- `mdp-sdk-core` 配了 maven-source-plugin，打包时附带 sources jar，方便第三方阅读源码；
- 仓库内**没有** `distributionManagement` 配置——要发布到企业私服需自行在 pom 增加分发配置后 `mvn deploy`，或把 jar 直接随文档交付。

::: warning method 值是协议的一部分

`method()` 返回值与服务端 `@Open` 的 value 强耦合。已交付第三方的 API 类**不要改 method 值**；接口升级走 `version()` 多版本。详见[接口开发与发布 · 二开注意事项](接口开发与发布.md)。

:::
