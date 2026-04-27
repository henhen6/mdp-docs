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
        "概念解释",
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
  "/buy/": [
    "立即购买",
    "交付物",
    "购买须知",
    "功能对比",
    "广告位"
  ]
});
