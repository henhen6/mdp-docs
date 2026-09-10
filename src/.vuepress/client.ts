import { defineMermaidConfig } from "@vuepress/plugin-markdown-chart/client";
import { defineClientConfig } from "vuepress/client";

import { EXTENSION_ICONS, FILE_ICONS, FILENAME_ICONS, ICON_SIZE } from "./fileIcons.js";

const ICON_PACK = "mdp-file";

// treeView 只自带 mermaid-treeview:folder|file 两个图标，引用别的包名前缀若不先注册，
// 会画成 "?" 占位符；而 qualifyIcon() 对含 ":" 的全限定名原样透传，故这里必须写 `mdp-file:xml`
const TREE_VIEW_CONFIG = {
  showIcons: true,
  extensionIcons: Object.fromEntries(
    Object.entries(EXTENSION_ICONS).map(([ext, icon]) => [
      ext,
      `${ICON_PACK}:${icon}`,
    ]),
  ),
  // 按文件名精确匹配，优先级高于 extensionIcons：文档里 pom.xml 共 19 处，
  // 若只按 .xml 后缀回退会全画成通用 xml 图标，看不出它是 Maven 构建文件
  filenameIcons: Object.fromEntries(
    Object.entries(FILENAME_ICONS).map(([file, icon]) => [
      file,
      `${ICON_PACK}:${icon}`,
    ]),
  ),
};

let registering: Promise<void> | undefined;

/**
 * 把文件图标包注册进 mermaid。
 *
 * 必须注册到主题实际加载的那份 bundle：mermaid/dist 下 mermaid.core、mermaid.esm、
 * mermaid.esm.min 是三套互不相通的 chunk，图标表 iconsStore 是模块级 Map，
 * 注册到另一份实例会静默失效（`import 'mermaid'` 走的就是 mermaid.core.mjs）。
 */
function registerFileIcons(): void {
  registering ??= import("mermaid/dist/mermaid.esm.min.mjs").then(
    ({ default: mermaid }) => {
      mermaid.registerIconPacks([
        {
          name: ICON_PACK,
          icons: {
            prefix: ICON_PACK,
            width: ICON_SIZE,
            height: ICON_SIZE,
            icons: FILE_ICONS,
          },
        },
      ]);
    },
  );
}

export default defineClientConfig({});

defineMermaidConfig({
  // 用 getter 触发注册：主题的 Mermaid 组件在 setup() 里就解构这份配置，
  // 而其自身要到 onMounted() 才动态 import mermaid —— 如此能保证注册先于首次渲染，
  // 又不会让没有图表的页面白白加载 mermaid。
  get treeView() {
    if (!__VUEPRESS_SSR__) registerFileIcons();

    return TREE_VIEW_CONFIG;
  },
});
