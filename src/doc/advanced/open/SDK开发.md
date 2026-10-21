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

请求签名的规则是：**开发者持私钥签名，平台持公钥验签**。密钥对用 SDK 内核的 `RsaTool`（`mdp-sdk-core: sign/RsaTool.java`）生成：

```java
RsaTool.KeyStore keys = new RsaTool(KeyFormat.PKCS8, KeyLength.LENGTH_2048).createKeys();
String publicKey = keys.getPublicKey();    // 配置到平台（mdo_app_keys.public_key_app）
String privateKey = keys.getPrivateKey();  // 开发者自行保存，用于请求签名
```

支持 PKCS1/PKCS8 × 1024/2048（测试用例 `RsaToolTest.java:18-27`），`convertPkcs8ToPkcs1` 可互转格式；推荐 **PKCS8 + 2048**（与平台管理端「替我生成公私钥」的默认参数一致）。签名算法 RSA2 = SHA256WithRSA，待签内容为公共参数字典序拼接（`SignUtil`，与网关验签同一套约定）。

**公钥如何配置进平台**（两种视角）：

![](/img/doc/开发者平台/开发者中心-应用秘钥.png)

| 视角 | 操作路径 | 接口 |
| ---- | ---- | ---- |
| 开发者自行配置 | web-open「应用管理」→ 应用详情 → **应用秘钥** Tab：粘贴公钥到「开发者公钥」后保存；或点「替我生成公私钥」由平台生成（弹窗确认后旧密钥对立即失效，新公私钥只读展示一次） | 保存：`POST /client/app/updateKeys`；平台代生成：`POST /client/app/resetAppKeys` |
| 运营代为配置 | console「开放平台 → 应用管理」→ 行操作「密钥」：查看/修改开发者公钥等密钥配置；也可在此代为重置密钥对 | 查看：`GET /admin/app/getKeys`；保存：`POST /admin/app/updateKeys` |

无论哪条路径，平台侧最终只落库**公钥**（`AppKeysServiceImpl.resetAppKeys` :175-184 私钥不下库，仅返回一次）。

**私钥如何保存**（给第三方的指导建议，平台方写接入文档时可直接引用）：

- 私钥**绝不上传平台、不进 git 仓库、不出现在日志**——遗失无法找回，只能重新生成（旧密钥对随之作废）；
- 推荐放配置中心或密钥管理服务（如 Nacos 加密配置、KMS），应用启动时注入 `OpenClient` 构造器；
- 多人协作时按环境（开发/测试/生产）分别生成密钥对，避免共用一把私钥。

### 4.2 AES 推送加解密（接收回调/事件用）

第三方接收平台的事件推送/接口回调时，用 SDK 内核的 `MdpBizMsgCrypt`（`aes/` 包）验签解密：

```java
MdpBizMsgCrypt crypt = new MdpBizMsgCrypt(token, encodingAesKey, appKey);
// 安全/兼容模式：decryptMsg 内部完成 msgSignature 验签 + AES 解密
String plaintext = crypt.decryptMsg(encrypt, timestamp, nonce, msgSignature);
// 明文模式：无密文可解，单独验签 signature = SHA1(sort(token, timestamp, nonce, ""))
boolean ok = crypt.verifySignature(timestamp, nonce, "", signature);
```

三个构造参数的来源与生成方式：

| 参数 | 含义 | 如何生成 |
| ---- | ---- | ---- |
| `token` | 签名校验令牌 | 平台工具 `MdpBizMsgCrypt.generateToken()`（32 字符，:305-307）；web-open「事件订阅」Tab 有「随机生成」按钮 |
| `encodingAesKey` | AES 消息加解密密钥 | `MdpBizMsgCrypt.generateEncodingAesKey()`（43 字符，:298-302）；「事件订阅」Tab 同样可一键生成 |
| `appKey` | 应用标识 | **不可自选**——应用创建时由平台分配（`yyyyMMdd` + 随机 10 位），在「应用秘钥」Tab 查看 |

三个参数如何配置进平台（两种视角）：

![](/img/doc/开发者平台/开发者中心-事件订阅.png)

| 视角 | 操作路径 | 接口 |
| ---- | ---- | ---- |
| 开发者自行配置 | web-open「应用管理」→ 应用详情 → **事件订阅** Tab：填通知地址、选加密模式、生成/粘贴 token 与 encodingAesKey、勾选订阅的事件类型，一并保存 | `POST /client/app/updateEventSubscription` |
| 运营代为配置 | console「应用管理」→ 行操作「密钥」：修改通知地址、加密模式、Token、EncodingAESKey | `POST /admin/app/updateKeys` |

配置落库在 `mdo_app_keys`（`notify_token`/`notify_encoding_aes_key` 等字段），**第三方接收端必须用与平台配置完全一致的 token/encodingAesKey**，建议存自己的配置文件而非每次查库（参考实现注释 `NotifyCallbackController.java:80`）。

三种加密模式（`MODE_PLAINTEXT` 明文 / `MODE_COMPATIBLE` 兼容 / `MODE_ENCRYPTED` 安全）与平台 `NotifySender` 一一对应。**SDK 侧与服务端（sop-service-support）各有一份同算法实现，改动时必须两侧同步**。

## 5. 回调接收端参考实现

平台在 md-api 内置了一个完整的接收端参考：`NotifyCallbackController`（`api-web/.../NotifyCallbackController.java:51`，路由 `POST /anyUser/notify/callback`）。接收端收到推送后的主要步骤固定为 6 步：**取验签参数 → 取 appKey → 构建解密器 → 验签解密 → 按类型分发 → 应答**。以下为按该控制器提炼的伪代码（只保留必要节点，完整代码见源文件）：

```java
@PostMapping("/notify/callback")
public ApiResponse callback(HttpServletRequest request, @RequestBody String body) {
    // ① 取 URL 上的验签参数（encryptType 仅加密模式存在）
    String signature    = request.getParameter("signature");     // 所有模式都有
    String msgSignature = request.getParameter("msgSignature");  // 仅加密模式
    String timestamp    = request.getParameter("timestamp");
    String nonce        = request.getParameter("nonce");
    String encryptType  = request.getParameter("encryptType");

    // ② 从请求体提取 appKey（三种模式的报文里都有该字段）
    String appKey = JSON.parseObject(body).getString("appKey");

    // ③ 构建解密器：token/encodingAesKey 取本应用配置（建议存本地配置，勿每次查库）
    MdpBizMsgCrypt crypt = new MdpBizMsgCrypt(token, encodingAesKey, appKey);

    // ④ 验签 + 解密，拿到明文 JSON
    String plaintext;
    if (encryptType 为空) {
        // 明文模式：验 signature，body 即明文
        if (!crypt.verifySignature(timestamp, nonce, "", signature)) {
            return ApiResponse.error("验签失败");
        }
        plaintext = body;
    } else {
        // 兼容/安全模式：decryptMsg 内部完成 msgSignature 验签 + AES 解密
        plaintext = crypt.decryptMsg(encrypt, timestamp, nonce, msgSignature);
    }

    // ⑤ 按 type 分发：EVENT_PUSH（事件推送）/ CALLBACK（接口回调）
    //    EVENT_PUSH：按 method（事件码，冒号形式）分支，eventTriggerId 做幂等键
    //    CALLBACK  ：按 method（接口名）分支，callLogId 做幂等键
    //    bizContent 是 JSON 字符串，取出后需二次解析

    // ⑥ 应答：处理成功返回 {"code": 0}
    //    平台只认 code=0，其余一律判定失败并进入梯度重试
    return ApiResponse.success("");
}
```

两个容易踩坑的点：

- **幂等**：同一任务重试期间会重复投递，业务处理必须以 `eventTriggerId`/`callLogId` 去重；
- **先应答后处理**：平台推送 HTTP 超时默认 5 秒，业务复杂时先落库返回 `code=0`，再异步处理。

第三方接入方视角的完整说明（报文字段、密钥派生、三种模式的实际请求体）见[事件回调](../../integration/事件回调.md)、[接口回调](../../integration/接口回调.md)。

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
