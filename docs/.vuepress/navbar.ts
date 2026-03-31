import { navbar } from "vuepress-theme-hope";
export const zhNavbar = navbar([
  {
    text: "文档",
    link: "/doc/简介",
    icon: "start1",
  },
  {
    text: "配置",
    link: "/config",
    icon: "featuresNew",
  },
  {
    text: "购买",
    icon: "buy",
    children: ["/guide/buy", "/guide/versionCompare"],
  },
  {
    text: "在线演示",
    link: "/guide/demo",
    icon: "bilibili",
    children: [
      {text: "用户中心", link: "http://workbench.mddata.top"},
      {text: "控制台", link: "http://console.mddata.top"},
      {text: "开发者中心", link: "http://open.mddata.top"},
    ],
  },
  {
    text: "升级日志",
    link: "/upgrade",
  },
  {
    text: "历史文档",
    icon: "team",
    link: "/history",
  },
  {
    text: "常见问题",
    link: "/faq",
  }
]);
