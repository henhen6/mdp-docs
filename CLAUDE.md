# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

MDP（主数据平台）产品文档站点，基于 VuePress 2 (rc) + vuepress-theme-hope 主题，使用 pnpm 管理依赖。所有文档内容均为简体中文。

本项目主要是 MDP（主数据平台）产品的使用文档、开发文档。
- mdp后端存放路径： @~/gitee/mdp
- mdp前端存放路径： @~/gitee/mdp-vben

## 常用命令

```bash
pnpm bootstrap        # 安装依赖
pnpm docs:dev         # 启动本地开发服务器（热更新）
pnpm docs:clean-dev   # 清除缓存后启动开发服务器（配置或主题改动异常时使用）
pnpm docs:build       # 构建生产版本到 src/.vuepress/dist
```

## 架构

### 目录结构

- `src/` — 文档源码根目录（即 VuePress 的 sourceDir，不是代码 src）
- `src/.vuepress/config.ts` — VuePress 主配置：页面匹配规则、主题别名（alias）、自定义 `hint` 容器
- `src/.vuepress/theme.ts` — hopeTheme 配置：Markdown 增强（mermaid、flowchart、chartjs 等）、评论（Giscus）、公告（notice）、组件等
- `src/.vuepress/navbar.ts` / `sidebar.ts` — 导航栏与侧边栏配置
- `src/.vuepress/layouts/Layout.vue` — 通过 alias 覆盖主题默认布局，用于在侧边栏顶部注入赞助商内容
- `src/doc/` — 核心产品文档（简介、项目概览、项目启动、项目集成等）
- `src/buy/`、`src/upgrade/`、`src/faq/`、`src/guide/` — 购买、升级日志、常见问题等板块

### 关键机制

**新增页面必须同步更新侧边栏**：页面文件不会自动出现在导航中，需在 `src/.vuepress/sidebar.ts` 对应路径前缀下添加条目（支持 `children: "structure"` 自动按目录结构生成）。

**snippet 文件不渲染为页面**：`*.snippet.md` 被 `config.ts` 的 `pagePatterns` 排除，仅供其他页面通过 include 引入，用法：

```markdown
<!-- @include: 相对路径.snippet.md -->
<!-- @include: @src/compare.snippet.md -->  <!-- @src 别名指向 src/ 目录，见 theme.ts 的 include.resolvePath -->
```

**自定义 hint 容器**：`config.ts` 通过 `@mdit/plugin-container` 注册了 `::: hint` 容器，支持自定义标题和内联 style。

**主题覆盖**：修改全局布局时通过 `config.ts` 的 `alias` 将 `@theme-hope/layouts/Layout` 指向本地 `layouts/Layout.vue`，而非直接修改 node_modules 中的主题文件。

## 约定

- Git 分支：日常在 `dev` 分支工作，PR 目标分支为 `main`
- 提交信息使用中文，格式：`type(scope): 描述`（如 `docs(doc): 更新简介文档账号信息`）
- 文档中的代码示例若涉及敏感信息（数据库连接、密钥），一律使用占位符，不得写入真实凭证
