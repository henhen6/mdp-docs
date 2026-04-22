import { sidebar } from "vuepress-theme-hope";

const COLLAPSIBLE = true;

export const zhSidebar = sidebar({
  "/en/": false,

  "/doc/": [
      "简介",
      "如何让作者积极帮助你",
      {
          text: "项目概览",
          prefix: "info/",
          collapsible: COLLAPSIBLE,
          children: [
              "架构介绍",
          ],
      },
      {
          text: "项目启动",
          prefix: "start/",
          collapsible: COLLAPSIBLE,
          children: [
              "环境准备",
          ],
      },
  ],
});
