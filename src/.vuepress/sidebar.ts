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
        "服务介绍",
        "项目导入",
        {
          text: "后端启动",
          prefix: "backend/",
          collapsible: COLLAPSIBLE,
          children: [
            "单体版启动",
            "微服务版启动"
          ],
        },
        "前端启动",
      ],
    },
    {
      text: "应用接入",
      prefix: "integration/",
      collapsible: COLLAPSIBLE,
      children: [
        "",
        "准备工作",
        {
          text: "单点登录",
          prefix: "单点登录/",
          collapsible: COLLAPSIBLE,
          children: [
            { text: "ticket模式", link: "ticket模式" },
            { text: "oauth2模式", link: "oauth2模式" },
            { text: "若依实战（ticket模式）", link: "若依实战-ticket模式" },
            { text: "若依实战（oauth2模式）", link: "若依实战-oauth2模式" },
          ],
        },
        "接口调用",
        "事件回调",
        "接口回调",
      ],
    },
  ],
  "/buy/": [
    "立即购买",
    "交付物",
    "购买须知",
    "功能对比",
    "广告位"
  ],
  "/config/": [

  ],
  "/upgrade/": [
    "1.x版本升级日志",
    "0.x版本升级日志",
    "功能蓝图",
  ],
  "/faq/": [

  ]
});
