---
title: md-openapi3-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

在线接口文档模块，坐标 `top.mddata.base:md-openapi3-starter`。对 springdoc + [nextdoc4j](https://gitee.com/nextdoc4j) 做统一封装：文档信息（标题/描述/版本/联系人/许可证）与认证方案集成。

::: warning knife4j 已移除
平台已从 knife4j 切换到 nextdoc4j（1.7.0 起）：pom 依赖为 `nextdoc4j-spring-boot-starter` + `springdoc-openapi-starter-webmvc-ui` + `nextdoc4j-plugin-security-schemes`，旧的 `knife4j.*` 配置项与 `mdp.swagger.*` 前缀均已失效。
:::

## 2. 源码解读

模块只有两个类：

```
top.mddata.base.openapi3
├── NextDoc4jAutoConfiguration.java        # 自动配置：注册 OpenAPI Bean（文档元信息）
└── properties/NextDoc4jProperties.java    # mdp.nextdoc4j.* 配置
```

`NextDoc4jAutoConfiguration`（imports 注册）只做一件事：注册 `OpenAPI` Bean，把 `mdp.nextdoc4j.*` 的标题、描述、版本、服务条款、联系人、许可证写入文档元信息。装配条件为 nextdoc4j 官方开关 `nextdoc4j.enabled`（matchIfMissing=true，默认开）。

UI 界面与接口分组由 nextdoc4j / springdoc 自身提供，本模块不做增强定制。

## 3. 可配置参数

`NextDoc4jProperties`（前缀 `mdp.nextdoc4j`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.nextdoc4j.title` | 在线文档 | 文档标题 |
| `mdp.nextdoc4j.description` | md-cloud 在线文档 | 描述 |
| `mdp.nextdoc4j.version` | 1.0 | 版本 |
| `mdp.nextdoc4j.license` / `license-url` / `terms-of-service-url` | 空 | 许可证与服务条款 |
| `mdp.nextdoc4j.contact.name` / `url` / `email` | 空 | 联系人 |

另有 nextdoc4j 官方总开关：`nextdoc4j.enabled`（默认 true）。

## 4. 扩展点

- **`OpenAPI` Bean 可覆盖**：应用定义自己的 `OpenAPI` Bean 即替换默认文档信息。
- **nextdoc4j / springdoc 官方配置**：分组文档用 `springdoc.group-configs.*`，安全方案由 `nextdoc4j-plugin-security-schemes` 提供。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 分组文档 | springdoc 官方 `springdoc.group-configs.*` 配置，与本模块不冲突 |
| 生产环境关闭文档 | `nextdoc4j.enabled=false`（或 springdoc `springdoc.api-docs.enabled=false`），**生产必须关** |
| 接口级注释 | `@Operation`/`@Schema`（swagger-annotations-jakarta），实体注解由 md-codegen 自动生成 |

## 6. 二次开发注意事项

::: warning 生产环境必须关闭
在线文档默认可匿名访问，会暴露全部接口签名。生产环境用 profile 配置关闭：`nextdoc4j.enabled=false`，同时确认网关/安全框架对 `/v3/api-docs` 及文档 UI 路径的拦截。
:::

::: warning 从 knife4j 迁移
旧配置 `mdp.swagger.*`、`knife4j.enable`、`global-operation-parameters` 全部失效，迁移时改为 `mdp.nextdoc4j.*` 与 `nextdoc4j.enabled`；原来靠全局参数在文档上声明 token 头的，改由 nextdoc4j 的 security-schemes 插件配置认证方案。
:::
