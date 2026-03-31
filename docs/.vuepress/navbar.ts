import { navbar } from "vuepress-theme-hope";
export const zhNavbar = navbar([
  {
    text: "文档",
    link: "/doc/简介",
    icon: "featuresNew",
  },
  {
    text: "配置",
    link: "/config/index",
    // icon: "fas-gears",
  },
  {
    text: "购买",
    icon: "buy",
    link: "/buy/index",
  },
  {
    text: "升级日志",
    icon: "changelog",
    link: "/upgrade/index",
  },
  // {
  //   text: "历史文档",
  //   icon: "team",
  //   link: "/history/index",
  // },
  {
    text: "常见问题",
    icon: "teamwork",
    link: "/faq/index",
  },
  {
    text: "在线演示",
    icon: "bilibili",
    children: [
      {text: "用户中心", link: "http://workbench.mddata.top"},
      {text: "控制台", link: "http://console.mddata.top"},
      {text: "开发者中心", link: "http://open.mddata.top"},
    ],
  },
]);
