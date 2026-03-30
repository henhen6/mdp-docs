import { path } from "vuepress/utils";
import { hopeTheme } from "vuepress-theme-hope";
import { zhNavbar } from "./navbar.js";
import { zhSidebar } from "./sidebar.js";

export default hopeTheme(
  {
    hostname: "http://mddata.top",
    logo: "/img/fastRequest.svg",

    repo: "https://github.com/henhen6/mdp-docs",
    docsDir: "docs",
    docsBranch: "main",

    copyright: "Copyright © 2026-present henhen6",
    displayFooter: true,

    pageInfo: false,
    fullscreen: true,
    editLink: false,
    contributors: false,

    darkmode: "enable",

    locales: {
      "/": {
        footer:
          "主题使用 <a target='blank' href='https://theme-hope.vuejs.press/zh/'>vuepress-theme-hope</a>",

        navbar: zhNavbar,
        sidebar: zhSidebar,
      },
    },

    markdown: {
      highlighter: {
        type: "shiki",
        lineNumbers: 10,
        theme: "one-dark-pro",
      },
      align: true,
      chartjs: true,
      component: true,
      include: {
        resolvePath: (file) =>
          file.startsWith("@src")
            ? file.replace("@src", path.resolve(import.meta.dirname, ".."))
            : file,
      },
      mark: true,
      tasklist: true,
      imgLazyload: true,
      imgSize: true,
      tabs: true,
      codeTabs: true,
    },

    plugins: {
      components: {
        components: [
          "Badge",
          "BiliBili",
          "SiteInfo",
          "VPBanner",
          "VPCard",
          "VidStack",
        ],
      },

      docsearch: {
        appId: "1",
        apiKey: "2",
        indexName: "api-buddy",
        locales: {
        },
      },

      icon: {
        assets: "//at.alicdn.com/t/c/font_2601581_tleme42m6wm.css",
      },

      notice: [
        {
          path: "/",
          title: "将在2026.4.1推出 v1.0.0",
          content:
            '<ul><li>1. 单点登录中心</li>' +
              '<li>2. 开放平台</li>'+
              '<li>3. 后台管理系统</li>'+
              '</ul><div class="addthis_inline_follow_toolbox_qssu"></div>',
          actions: [
            {
              text: "了解详情→",
              link: "/guide/history.html",
              type: "primary",
            },
          ],
          showOnce: true,
          key: "2026.4.1",
        },
      ],
    },
  },
  { custom: true },
);
