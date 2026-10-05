---
title: Markdown 编辑器
order: 6
category:
  - 前端开发
tag:
  - 业务组件
---

`MarkdownEditor`（`@vben/components/markdown-editor`，默认导出）基于 [ByteMD](https://github.com/bytedance/bytemd) 封装，编辑/预览双模式，内置 GFM、代码高亮、emoji 插件。用于帮助文档、开放平台文档等场景。

```ts
import MarkdownEditor from '@vben/components/markdown-editor';
```

## 1. Props

| Prop | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| `v-model:modelValue` | `string` | - | Markdown 文本 |
| `placeholder` | `string` | `'请输入内容，支持Markdown语法'` | 占位提示 |
| `readonly` | `boolean` | `false` | 只读模式（渲染为 Viewer） |

## 2. 用法

```vue
<script setup lang="ts">
import MarkdownEditor from '@vben/components/markdown-editor';

const content = ref('');
</script>

<template>
  <!-- 编辑模式 -->
  <MarkdownEditor v-model="content" />

  <!-- 只读预览模式 -->
  <MarkdownEditor v-model="content" readonly />
</template>
```

::: warning 高度说明
编辑器容器样式为 `height: calc(100vh - 100px)`（占满视口），适合独立的文档编辑页。若要在弹窗或局部区域使用，需要通过外层 CSS 覆盖 `.bytemd` 的高度。
:::

实际使用可参考开发者平台的文档管理模块 `apps/web-open/src/views/open/client/doc/`。
