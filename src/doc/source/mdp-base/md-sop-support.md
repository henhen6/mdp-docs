---
title: md-sop-support
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

SOP 开放平台网关支持模块（源自 gitee sop 项目改造，包名保留 `com.gitee.sop.support`），坐标 `top.mddata.base:md-sop-support`，下辖 `sop-service-support`（核心）与 `sop-spring-boot-starter`（装配）。职责：把 MDP 的接口以**开放平台 API** 形式注册到 SOP 网关——第三方经网关（鉴权/签名/加解密）调用业务服务的 Dubbo 接口。是 [mdp-sdk](../mdp-sdk/README.md) 的服务端对侧。

## 2. 源码解读

```
com.gitee.sop.support
├── annotation/{Open, OpenGroup}.java        # 开放接口标记
├── register/
│   ├── ApiRegister.java                      # 注册器：@DubboService Bean → 网关 ApiRegisterService
│   └── ApiRegisterRunner.java                # 启动时执行注册（经 @DubboReference）
├── aes/                                      # AES 消息加解密（MdpBizMsgCrypt、PKCS7Encoder、SHA1）
├── dubbo/                                    # Dubbo 过滤器（Provider/Consumer/Attachment 透传）
├── context/{WebContext, OpenContext}.java     # 请求上下文抽象（Default 实现）
├── message/                                  # 响应消息（OpenMessage、I18n 国际化）
├── doc/                                      # smart-doc 扩展：SopDocBuildTemplate
└── dto/ApiConfig.java                        # API 元信息
```

### 2.1 开放接口注册链路

```mermaid
flowchart LR
    A["业务实现类<br/>@DubboService + @Open(\"user.getById\")"] --> B["ApiRegisterRunner<br/>启动扫描"]
    B --> C["ApiRegister<br/>组装 ApiConfig（method/version/参数）"]
    C -->|"@DubboReference<br/>ApiRegisterService"| D["SOP 网关<br/>sop-gateway-server"]
    E["第三方应用"] -->|"HTTP + 签名"| D
    D -->|"Dubbo 回调"| A
```

- `@Open` 的 value 即 API 的 `method` 参数（与 mdp-simple-sdk 各 `XxxApi#method()` 返回值一一对应）；
- `@OpenGroup` 做分组管理；
- 签名/验签用 `SignUtil`/RSA（与 mdp-sdk-core 的 `SignUtil` 同一套算法约定）。

### 2.2 装配条件

`SopAutoConfiguration` 的装配前提是 `dubbo.enabled`（默认 true）。spring.factories 与 AutoConfiguration.imports **双注册**（兼容 Boot 2/3 两个时代的加载机制）。

## 3. 可配置参数

无自有配置前缀。相关配置：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `dubbo.enabled` | true | 本模块装配条件（关掉即不注册到网关） |
| Dubbo 注册中心/协议 | — | 经 Dubbo 官方配置，网关与服务同注册中心 |

## 4. 扩展点

| 扩展点 | 类型 | 说明 |
|---|---|---|
| `WebContext` / `OpenContext` | 接口 | 请求上下文，可替换 Default 实现 |
| `OpenMessage` / `OpenMessageFactory` | 接口 | 响应消息与国际化工厂 |
| `RegisterCallback` | 回调 | 注册完成后的钩子 |
| `SopDocBuildTemplate` | SPI | `META-INF/services/com.ly.doc.template.IDocBuildTemplate` 注册到 smart-doc——基于 `@Open` 注解生成开放接口文档 |

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 新增开放接口 | 服务实现类 `@DubboService` + `@Open("xx.yy")`，重启自动注册；SDK 侧加对应 `XxxApi` 三件套（见 [mdp-simple-sdk](../mdp-sdk/mdp-simple-sdk.md)） |
| 自定义响应/错误码 | 扩展 `OpenMessage` 体系，注意与网关侧格式约定一致 |
| 开放接口文档 | smart-doc + `SopDocBuildTemplate` 生成 |
| 消息加解密 | `MdpBizMsgCrypt`（三模式：明文/兼容/加密），回调推送同样用它 |

## 6. 二次开发注意事项

::: warning 源码副本的升级问题
与 md-sa-token 同理，本模块是 gitee sop 的改造副本（包名 `com.gitee.sop.support`），升级上游需手动 diff；注意保留 MdpBizMsgCrypt（AES 加解密与 mdp-sdk-core 的实现必须保持算法一致）。
:::

::: warning @Open 接口即对外契约
`@Open` 的 method/version 一旦发布，改值等于破坏第三方 SDK 调用（method 不存在）。新增参数走可选/新版本（version 递增），不要修改既有参数语义。
:::
