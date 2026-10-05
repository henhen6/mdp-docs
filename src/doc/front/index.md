---
title: 前端开发
order: 1
category:
  - 前端开发
tag:
  - 前端开发
---

MDP 前端（`mdp-vben`）基于 [Vue Vben Admin](https://doc.vben.pro/) 5.x 深度定制，是 Vite + Vue3 + TypeScript 的 monorepo 工程，包含三个独立部署的应用。本板块介绍它的结构、与官方 vben 的差异、开发规范、部署方式，以及 mdp 新增业务组件库的用法。

## 1. 应用全景

| 应用 | 目录 | 开发端口 | 线上演示 | 定位 |
| ---- | ---- | -------- | -------- | ---- |
| 工作台 | `apps/web-workbench` | 7700 | [workbench.mddata.top](http://workbench.mddata.top) | 统一登录页、用户门户（消息、日志、安全设置） |
| 控制台 | `apps/web-console` | 7710 | [console.mddata.top](http://console.mddata.top) | 后台管理（组织、权限、消息、统计、系统管理） |
| 开发者平台 | `apps/web-open` | 7720 | [open.mddata.top](http://open.mddata.top) | 开放平台控制台（应用、秘钥、文档、事件订阅） |

## 2. 技术栈

| 类别 | 选型 |
| ---- | ---- |
| 框架 | Vue 3 + TypeScript + Vite |
| UI 组件 | **antdv-next**（注意：不是官方 vben 默认的 ant-design-vue） |
| 表格 | VXE Table |
| 状态管理 | Pinia（持久化加密存储） |
| 路由 | Vue Router 4（后端动态菜单 + 前端四层路由） |
| 样式 | TailwindCSS + SCSS |
| 工程化 | Turbo + pnpm（catalog 统一版本） |
| 测试 | Vitest + Playwright |

## 3. 文档导读

| 我想… | 看这篇 |
| ---- | ------ |
| 本地把三个前端应用跑起来 | [项目启动 / 前端启动](../start/前端启动.md) |
| 了解 monorepo 目录划分、路由四层结构 | [项目结构](项目结构.md) |
| 基于官方 vben 二次开发，想知道 mdp 改了什么 | [与官方 vben 的差异](与官方vben的差异.md) |
| 提交代码前确认 lint、提交信息、命名约定 | [开发规范](开发规范.md) |
| 打包、nginx 配置、Jenkins/Docker 部署 | [构建与部署](构建与部署.md) |
| 配置 .env、代理、boot/cloud 模式切换 | [配置 / 前端配置](../../config/前端配置.md) |
| 使用 mdp 封装的表单、上传、字典等业务组件 | [业务组件总览](components/index.md) |

## 4. 常用命令速查

```bash
pnpm bootstrap          # 安装依赖
pnpm dev:workbench      # 启动工作台（7700）      根据 VITE_GLOB_MODE 决定是单体版还是微服务版
pnpm dev:console        # 启动控制台（7710）      根据 VITE_GLOB_MODE 决定是单体版还是微服务版
pnpm dev:open           # 启动开发者平台（7720）   根据 VITE_GLOB_MODE 决定是单体版还是微服务版
pnpm dev:boot           # 单体版启动
pnpm dev:cloud          # 微服务版启动
pnpm build:workbench    # 单独构建某个应用（console/open 同理）
pnpm check              # 循环依赖 + 依赖 + 类型 + 拼写检查
pnpm lint               # 代码检查
```

::: tip 基础文档先看官方
本板块只讲 **mdp 定制与新增**的内容。vben 框架本身的通用能力（偏好设置、布局、主题、国际化、vxe-table 封装等）请直接查阅 [vben 官方文档](https://doc.vben.pro/)，mdp-vben 与官方保持一致的部分不再重复。
:::
