---
title: md-scan-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

系统 API 扫描模块，坐标 `top.mddata.base:md-scan-starter`。服务启动时扫描全部 Controller 的 `@RequestMapping`，对外暴露一个**匿名**接口 `GET /anyone/systemApiScan` 返回接口清单，供 SOP 开放平台/网关侧采集"这个服务有哪些接口"。

## 2. 源码解读

```
top.mddata.base.scan
├── ScanAutoConfigure.java               # 自动配置：@ComponentScan + 注册 RequestMappingScanUtils
├── controller/SystemApiScanController.java  # GET /anyone/systemApiScan → R<Map<String, List<SystemApiVO>>>
├── utils/RequestMappingScanUtils.java   # 扫描 RequestMappingHandlerMapping，提取 path/method/参数
├── model/SystemApiVO.java               # 接口视图对象
└── properties/ScanProperties.java       # mdp.scan.* 配置
```

工作流程：`ScanAutoConfigure` 注册 `RequestMappingScanUtils`；请求 `/anyone/systemApiScan` 时遍历 Spring MVC 的 handler mapping，按 controller 分组输出接口路径、HTTP 方法、参数信息。

## 3. 可配置参数

`ScanProperties`（前缀 `mdp.scan`，`ScanProperties.java:14-27`）：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.scan.enabled` | true | 是否启用扫描接口 |
| `mdp.scan.base-package` | — | 扫描包路径（限定范围） |

## 4. 扩展点

- 整体关闭：`mdp.scan.enabled=false`。
- 输出结构如需扩展（如带权限标识），改 `SystemApiVO` + `RequestMappingScanUtils` 的提取逻辑——上游消费方（网关/SOP）要同步适配。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 网关自动发现服务接口 | 保持默认开启，网关定时拉 `/anyone/systemApiScan` |
| 接口清单落库做权限映射 | 在管理端消费该接口的返回，别改扫描逻辑 |
| 限定扫描范围 | 配 `mdp.scan.base-package` 排除无关 controller |

## 6. 二次开发注意事项

::: danger 匿名接口，注意暴露面
`/anyone/systemApiScan` 走 `anyone` 放行约定（登录但不鉴权，甚至外网可达，取决于网关配置）。它返回**全部**接口路径与方法签名——生产环境如果服务直接暴露公网，建议关闭（`mdp.scan.enabled=false`）或在网关屏蔽该路径，仅在内网供平台采集。
:::

::: warning 路径约定
`anyone` 前缀在 md-public 的 `IgnoreProperties`（`mdp.ignore.anyone`）中有全局语义："需登录但免鉴权"。给新接口起路径时避开误用该前缀。
:::
