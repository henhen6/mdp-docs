---
title: mdp-sdk（第三方SDK）
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-sdk
---

# mdp-sdk 总览

`mdp-sdk` 是 MDP 开放平台提供给 **ISV / 第三方开发者** 的 Java SDK，用于调用平台开放的 `@Open` 接口（用户、机构、消息、文件等主数据能力）。

源码位置：`mdp/mdp-sdk`，Maven 坐标 `top.mddata.sdk`，当前版本随 `${revision}`（1.5.0-SNAPSHOT）。

## 1. 设计定位

::: warning 独立 jar，严禁依赖内部模块
mdp-sdk 是要**交付给第三方**的独立 jar，依赖项必须尽可能少（仅 okhttp + fastjson2 + commons-logging + commons-io）。二次开发时**千万不要**让它依赖 mdp-base、mdp-apps 下的任何内部模块，否则会把平台内部实现泄露给第三方。
:::

- 不依赖 Spring，纯 POJO + HTTP，任何 Java 项目均可直接使用
- 用 HTTP 表单协议封装服务端 `@Open` 标记的开放接口
- 安全机制：RSA/RSA2 请求签名 + accessToken 认证 + AES 回调消息加解密

## 2. 调用链路

```mermaid
flowchart LR
    A[第三方应用] -->|"OpenClient.execute(api)"| B[mdp-simple-sdk<br/>API 封装层]
    B --> C[mdp-sdk-core<br/>签名/HTTP/解析]
    C -->|"HTTP 表单请求"| D[sop-gateway-server<br/>鉴权、验签、限流]
    D --> E[mdp-openapi<br/>@Open 接口业务逻辑]
```

- **sop-gateway-server**：负责 appKey/accessToken 鉴权与签名校验
- **mdp-openapi**：负责接口的业务逻辑（服务端模块，见 SOP 开放平台相关文档）

## 3. 子模块导航

| 模块 | 职责 | 文档 |
|---|---|---|
| mdp-sdk-core | SDK 内核：HTTP 客户端、RSA 签名、AES 消息加解密、统一返回体与分页模型、请求基类 | [mdp-sdk-core](mdp-sdk-core.md) |
| mdp-simple-sdk | 交付给第三方的具体 SDK：按业务域（token/user/org/msg/demo）封装的 API 三件套 | [mdp-simple-sdk](mdp-simple-sdk.md) |

依赖关系：`mdp-simple-sdk → mdp-sdk-core`，单向依赖。

## 4. 五分钟上手

```java
// 1. 声明客户端（全局一个即可），url 为开放平台网关地址
OpenClient client = new OpenClient("https://{gateway-host}/api", "{appKey}", "{你的RSA私钥}");

// 2. 换取 accessToken 并设置到客户端（之后所有请求自动携带）
AccessTokenGetApi tokenApi = new AccessTokenGetApi();
tokenApi.setBizModel(new AccessTokenGetDto()
        .setAppKey("{appKey}")
        .setAppSecret("{appSecret}"));
Result<AccessTokenGetResp> tokenResult = client.execute(tokenApi);
client.setDefaultAccessToken(tokenResult.getData().getAccessToken());

// 3. 调用业务接口
UserGetByIdApi api = new UserGetByIdApi();
api.setBizModel(new IdRequest().setId(680083598598475778L));
Result<UserResp> result = client.execute(api);
if (result.isSuccess()) {
    UserResp user = result.getData();
}
```

::: tip accessToken.get 是特例
`AccessTokenGetApi` 重写了 `getSignEnabled()` 返回 `true`——换取令牌时必须 RSA 签名；其余接口默认不签名（`OpenConfig.signEnabled=false`），由网关校验 accessToken。
:::

## 5. 与现有文档的关系

- 开放平台的**服务端**接入（`@Open` 注解、网关配置）见 [开放平台网关配置](../../../config/开放平台网关配置.md)
- 平台整体架构见 [架构介绍](../../info/架构介绍.md)
- 事件回调/接口回调的报文加解密（`MdpBizMsgCrypt`）对应服务端文档 [事件回调](../../integration/事件回调.md)
