---
title: md-xss-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

XSS 防护模块，坐标 `top.mddata.base:md-xss-starter`。基于 Servlet Filter 清洗请求参数，覆盖三条通道：URL 参数/Form 表单（`XssFilter` + `XssRequestWrapper`）、`@RequestBody` JSON（Jackson 反序列化清洗，默认关）。底层用 hutool HTMLFilter。

## 2. 源码解读

```
top.mddata.base.xss
├── XssAuthConfiguration.java          # 自动配置：注册 XssFilter
├── filter/XssFilter.java              # Servlet Filter 入口
├── wrapper/XssRequestWrapper.java     # request 装饰：getParameter 系列清洗
├── converter/
│   ├── XssStringJsonDeserializer.java # Jackson 反序列化时清洗（request-body-enabled）
│   └── XssStringJsonSerializer.java
├── properties/XssProperties.java      # mdp.xss.* 配置
└── utils/XssUtils.java                # hutool HTMLFilter 封装
```

三通道覆盖：

| 通道 | 生效条件 | 实现类 |
|---|---|---|
| URL 参数 / 表单 | `enabled=true`（默认） | `XssFilter` → `XssRequestWrapper` |
| `@RequestBody` JSON | `request-body-enabled=true`（**默认 false**） | `XssStringJsonDeserializer` |
| 富文本豁免 | 参数值命中 `ignore-param-values` | 跳过清洗 |

## 3. 可配置参数

`XssProperties`（前缀 `mdp.xss`，`XssProperties.java:17-44`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.xss.enabled` | true | XSS 过滤总开关 |
| `mdp.xss.request-body-enabled` | false | JSON body 反序列化清洗开关 |
| `mdp.xss.order` | 1 | Filter 注册顺序 |
| `mdp.xss.patterns` | ["/*"] | 拦截的 URL 模式 |
| `mdp.xss.ignore-paths` | favicon.ico、/**/doc.html、/v2/**、/actuator/** 等 16 条 | 放行路径（含 `/**/noxss/**`） |
| `mdp.xss.ignore-param-values` | ["noxss"] | 参数值白名单：值等于这些字符串时跳过清洗（富文本场景约定值） |

## 4. 扩展点

- **Filter 顺序**：`order` 可调，需要在本 Filter 之前处理编码/租户时要配小。
- **放行规则**：`ignore-paths` 支持 Ant 风格；`ignore-param-values` 是按**参数值**匹配的约定（参数值等于 `noxss` 即跳过），新项目可改约定值，但要前后端同步。
- 想换清洗实现：改 `XssUtils`（不建议，影响全局行为）。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 富文本内容提交（含 HTML） | 前端把字段值以约定值包裹/使用 `noxss` 约定路径，并在存储层做白名单过滤（如 antisamy），**不要直接全局关 XSS** |
| JSON body 也清洗 | `request-body-enabled=true`，回归测试 JSON 反序列化（特殊字符）是否正常 |
| 第三方回调接口跳过 | 回调地址加进 `ignore-paths`，避免清洗破坏签名原文 |

## 6. 二次开发注意事项

::: warning 清洗会破坏签名/原文
回调验签、开放平台接口的报文如果被清洗，验签必失败。第三方回调、webhook 路径要显式加进 `ignore-paths`。
:::

::: warning request-body-enabled 默认关
`@RequestBody` 默认**不清洗**（避免破坏合法 JSON）——二开时别以为开了 starter 就全覆盖；评估富文本入库场景，必要时开启并用白名单值豁免。
:::
