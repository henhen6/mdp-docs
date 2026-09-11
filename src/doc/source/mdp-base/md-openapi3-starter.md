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

在线接口文档模块，坐标 `top.mddata.base:md-openapi3-starter`。对 springdoc + knife4j 做统一封装：文档信息（标题/联系人/许可证）、全局 header 参数（如 token）、knife4j 增强定制。依赖 knife4j。

## 2. 源码解读

```
top.mddata.base.openapi3
├── MyKnife4jOpenApiCustomizer.java   # knife4j 增强定制（文档排序等）
├── SwaggerAutoConfiguration.java     # 自动配置：OpenAPI / GlobalOperationCustomizer 等 Bean
├── SwaggerWebMvcConfigurer.java       # 文档相关静态资源映射
└── properties/SwaggerProperties.java # mdp.swagger.* 配置
```

`SwaggerAutoConfiguration` 注册的关键 Bean：

- `OpenAPI`——文档元信息（标题、描述、版本、许可证、联系人），来源 `mdp.swagger.*`；
- `Knife4jOpenApiCustomizer`（实现类 `MyKnife4jOpenApiCustomizer`）；
- `GlobalOperationCustomizer`——把 `global-operation-parameters` 配置成每个接口的公共参数（默认放 header，典型用途：token、租户标识）。

访问入口：`/doc.html`（knife4j UI）。

## 3. 可配置参数

`SwaggerProperties`（前缀 `mdp.swagger`，`SwaggerProperties.java:24`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.swagger.title` | 在线文档 | 文档标题 |
| `mdp.swagger.description` | md-cloud 在线文档 | 描述 |
| `mdp.swagger.version` | 1.0 | 版本 |
| `mdp.swagger.license` / `license-url` / `terms-of-service-url` | 空 | 许可证信息 |
| `mdp.swagger.contact.name` / `url` / `email` | 空 | 联系人 |
| `mdp.swagger.global-operation-parameters` | — | 全局参数列表（见下） |

`global-operation-parameters` 元素结构（`SwaggerProperties.java:61-94`）：`name`（参数名）、`description`（默认"全局参数"）、`model-ref`（默认 String）、`parameter-type`（默认 header，可选 query/path/body/form）、`required`（默认 false）、`default-value`、`allow-empty-value`（默认 true）。

另有 knife4j 官方总开关：`knife4j.enable`。

## 4. 扩展点

- **`OpenAPI` Bean 可覆盖**：应用定义自己的 `OpenAPI` Bean 即替换默认文档信息（`@ConditionalOnMissingBean` 语义）。
- **`GlobalOperationCustomizer`**：自定义每个操作的文档增强逻辑。
- **`SwaggerWebMvcConfigurer`**：文档静态资源映射定制。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 所有接口自动带 token 参数 | `global-operation-parameters` 配一条 header 参数，不用每个 `@Operation` 重复写 |
| 分组文档 | springdoc 官方 `springdoc.group-configs.*` 配置，与本模块不冲突 |
| 生产环境关闭文档 | `knife4j.enable=false`（或 springdoc `springdoc.api-docs.enabled=false`），**生产必须关** |
| 接口级注释 | `@Operation`/`@Schema`（swgger-annotations-jakarta），实体注解由 md-codegen 自动生成 |

## 6. 二次开发注意事项

::: warning 生产环境必须关闭
doc.html 默认可匿名访问（XssFilter 默认放行 `/**/doc.html`），会暴露全部接口签名。生产环境用 profile 配置关闭：`knife4j.enable=false`，同时确认网关/安全框架对 `/v3/api-docs`、`/doc.html` 的拦截。
:::

::: warning 全局参数只是"文档声明"
`global-operation-parameters` 只影响文档展示，不做真实校验；真实校验在拦截器/过滤器层（见 [md-common-config](../md-public/md-common-config.md)）。
:::
