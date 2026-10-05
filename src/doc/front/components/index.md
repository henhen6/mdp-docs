---
title: 业务组件总览
order: 1
category:
  - 前端开发
tag:
  - 业务组件
---

`@vben/components`（源码 `packages/effects/components`）是 mdp 在官方 vben 之上**新增的业务组件包**，三个应用（workbench/console/open）共用。它封装了 MDP 业务中高频使用的组件：接口驱动的表单控件、字典回显、文件上传/预览、表格操作列、页面布局等。

::: tip 与官方组件的关系
vben 官方组件（`Page`、`VbenForm`、`VbenModal`、`vxe-table` 封装等）在 `@vben/common-ui`、`@vben/plugins` 中，用法见 [vben 官方文档](https://doc.vben.pro/)。本章节只介绍 mdp 新增的 `@vben/components`。
:::

## 1. 引入方式

组件包按**子路径导出**，按需引入（无全量入口）：

```ts
import { TableAction } from '@vben/components/table-action';
import { ApiDict, ApiSelect, FileUpload } from '@vben/components/form';
import { ApiDict as ApiDictView, FilePreview } from '@vben/components/view';
import { PageLayout } from '@vben/components/page-layout';
import { useMessage } from '@vben/components/hooks';
import { useDictStore } from '@vben/components/store';
```

## 2. 组件清单

| 分类 | 模块 | 导出 | 文档 |
| ---- | ---- | ---- | ---- |
| 适配层 | `adapter` | `useVbenForm`、`useVbenVxeGrid`、`initComponentAdapter`、`initVxeTable`、`VbenTableAction` | [表单与表格适配层](表单与表格适配层.md) |
| 表单 | `form` | `ApiSelect`、`ApiTreeSelect`、`ApiCascader`、`ApiRadioGroup`、`ApiCheckboxGroup`、`ApiSwitch`、`ApiDict`、`IconPicker`、`FileUpload`、`ImageUpload`、`FilePartUpload`、`StringSplitter` | [表单组件](表单组件.md) |
| 展示 | `view`、`description` | `ApiDict`（回显）、`ApiView`、`Text`、`FilePreview`、`FileAudioModal`、`FileVideoModal`、`Description` | [展示组件](展示组件.md) |
| 表格 | `table-action` | `TableAction` | [表格操作列](表格操作列.md) |
| 布局 | `page-layout`、`container`、`scrollbar` | `PageLayout`、`CollapseContainer`、`ScrollContainer`、`LazyContainer`、`Scrollbar` | [页面容器与布局](页面容器与布局.md) |
| 编辑器 | `markdown-editor` | `MarkdownEditor` | [Markdown 编辑器](Markdown编辑器.md) |
| 上传 | `multipart-upload` | `MultipartUploadModal`、`useMultipartUploader` | [分片上传](分片上传.md) |
| 基础 | `basic`、`icon`、`avatar`、`transition` | `BasicTitle`、`BasicArrow`、`BasicHelp`、`Icon`、`MdpAvatar`、`CollapseTransition` 等 | [基础组件与工具](基础组件与工具.md) |
| 支撑 | `store`、`api`、`hooks`、`utils` | `useDictStore`、`useSchemaStore`、`useMessage`、上传/字典/分片接口 | [基础组件与工具](基础组件与工具.md) |

## 3. 启动初始化

`adapter` 模块的三个初始化函数在每个应用的 `src/bootstrap.ts` 启动阶段执行一次，之后业务页面才能通过 `useVbenForm` / `useVbenVxeGrid` 使用全部组件与渲染器，详见 [表单与表格适配层](表单与表格适配层.md)。

## 4. 设计理念

理解这三点，组件的用法就自然了：

1. **接口驱动**：`Api*` 系列组件不直接写死选项数据，而是传入 `api` 或字典类型 `type`，组件自行请求并渲染，option 的字段名通过 `labelField` / `valueField` 适配；
2. **表单/展示成对**：`form` 下的组件用于编辑态（配合 `useVbenForm` 的 schema 使用），`view` 下的同名组件用于只读回显（配合 `Description` 或表格列），`component-map.ts` 通过 `import.meta.glob` 自动注册，schema 里写组件名字符串即可；
3. **字典统一走 store**：所有字典数据由 `useDictStore` 缓存，`ApiDict` 组件传入字典 `type` 即可，不重复请求。
