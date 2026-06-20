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
      text: "项目集成",
      prefix: "integration/",
      collapsible: COLLAPSIBLE,
      children: [
        {
          text: "SSO",
          prefix: "sso/",
          collapsible: COLLAPSIBLE,
          children: [
            "若依",
          ],
        },
        {
          text: "Oauth2",
          prefix: "oauth2/",
          collapsible: COLLAPSIBLE,
          children: [
            "若依",
          ],
        },
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
