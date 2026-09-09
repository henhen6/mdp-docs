import { container } from "@mdit/plugin-container";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { defineUserConfig } from "vuepress";
import { path } from "vuepress/utils";

import theme from "./theme.js";

/**
 * 解析主题所用 markdown-chart 插件的 client 入口。
 *
 * 该插件不是本项目的直接依赖，pnpm 隔离下无法直接 import；而 .pnpm 里存在它的多份副本，
 * defineMermaidConfig 写入的是模块级单例，必须与主题生成代码实际 import 的那份一致，
 * 因此从主题包自身的位置去解析，而不是凭猜测拼路径。
 */
function resolveMarkdownChartClient(): string {
  const fromProject = createRequire(pathToFileURL(`${import.meta.dirname}/config.ts`).href);
  const themePkg = fromProject.resolve("vuepress-theme-hope/package.json");

  return createRequire(pathToFileURL(themePkg).href).resolve(
    "@vuepress/plugin-markdown-chart/client",
  );
}

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "Mdp",
  description: "主数据平台",

  theme,

  // 和 PWA 一起启用
  shouldPrefetch: false,
  pagePatterns: ["**/*.md", "!*.snippet.md", "!.vuepress", "!node_modules"],

  alias: {
    // 供 client.ts 注入 mermaid 全局配置（图标包注册 + treeView 默认值）
    "@vuepress/plugin-markdown-chart/client": resolveMarkdownChartClient(),
    "@theme-hope/layouts/Layout": path.resolve(
        import.meta.dirname,
        "./layouts/Layout.vue",
    ),
    // "@theme-hope/components/HomePage": path.resolve(
    //     __dirname,
    //     "./components/HomePage.vue"
    // ),
    // "@theme-hope/components/NormalPage": path.resolve(
    //     __dirname,
    //     "./components/NormalPage.vue"
    // ),
    // "@theme-hope/modules/sidebar/components/Sidebar": path.resolve(
    //     __dirname,
    //     "./components/Sidebar.vue"
    // ),
  },
  extendsMarkdown: (md) => {
    md.use(container, {
      name: "hint",
      openRender: (tokens, index, _options) => {
        const info = tokens[index].info.trim().slice(4).trim();
        let style = "background:#262626";

        if (info.indexOf("style") > -1) {
          style = info.split("style=")[1].split('"')[1];
        }

        const title = info.replace('style="' + style + '"', "") || "Hint";
        return `<div class="custom-container hint" style="${style}">\n<p class="custom-container-title">${title}</p>\n`;
      },
    });
  },
});
