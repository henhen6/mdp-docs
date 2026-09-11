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
    {
      text: "后端源码分析",
      prefix: "source/",
      collapsible: COLLAPSIBLE,
      children: [
        "",
        { text: "mdp-parent（依赖与规范基线）", link: "mdp-parent" },
        {
          text: "mdp-base（基础框架）",
          prefix: "mdp-base/",
          collapsible: COLLAPSIBLE,
          children: [
            "",
            "md-bom",
            "md-annotation",
            "md-core",
            "md-util",
            "md-boot",
            "md-db",
            "md-db-uid",
            "md-db-mybatis-flex",
            "md-mvc-flex",
            "md-cache-starter",
            "md-echo-starter",
            "md-log-starter",
            "md-json-starter",
            "md-openapi3-starter",
            "md-scan-starter",
            "md-validator-starter",
            "md-xss-starter",
            "md-captcha-starter",
            "md-sa-token",
            "md-cloud-starter",
            "md-sop-support",
            "md-powerjob-worker-spring-boot-starter",
            "md-codegen",
          ],
        },
        {
          text: "mdp-sdk（第三方SDK）",
          prefix: "mdp-sdk/",
          collapsible: COLLAPSIBLE,
          children: [
            "",
            "mdp-sdk-core",
            "mdp-simple-sdk",
          ],
        },
        {
          text: "md-public（业务公共模块）",
          prefix: "md-public/",
          collapsible: COLLAPSIBLE,
          children: [
            "",
            "md-common-pojo",
            "md-common-dao",
            "md-common-config",
            "md-cache-key",
            "md-enumeration-scanning",
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
    "",
    { text: "编译期配置（filters）", link: "编译期配置filters" },
    { text: "后端配置（单体版）", link: "后端配置-单体版" },
    { text: "后端配置（微服务版）", link: "后端配置-微服务版" },
    "前端配置",
    "单点登录客户端配置",
    "开放平台网关配置",
    "重要配置项详解",
    { text: "系统配置（mdc_config）", link: "系统配置" },
  ],
  "/upgrade/": [
    "1.x版本升级日志",
    "0.x版本升级日志",
    "功能蓝图",
  ],
  "/faq/": [

  ]
});
