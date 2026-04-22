import { sidebar } from "vuepress-theme-hope";

const COLLAPSIBLE = true;

export default sidebar({
  "/": [
    "",
    "portfolio",
    {
      text: "案例",
      icon: "laptop-code",
      prefix: "demo/",
      link: "demo/",
      children: "structure",
    },
    {
      text: "文档",
      icon: "book",
      prefix: "guide/",
      children: "structure",
    },
    {
      text: "幻灯片",
      icon: "person-chalkboard",
      link: "https://ecosystem.vuejs.press/zh/plugins/markdown/revealjs/demo.html",
    },
  ],
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
