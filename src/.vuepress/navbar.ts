import { navbar } from "vuepress-theme-hope";

export default navbar([
  "/",
  {
    text: "文档",
    link: "/doc/简介",
  },
  {
    text: "配置",
    link: "/config/index",
  },
  {
    text: "购买",
    link: "/buy/立即购买",
  },
  {
    text: "升级日志",
    link: "/upgrade/1.x版本升级日志",
  },
  {
    text: "常见问题",
    link: "/faq/index",
  },
  {
    text: "在线演示",
    children: [
      {text: "用户中心", link: "http://workbench.mddata.top"},
      {text: "控制台", link: "http://console.mddata.top"},
      {text: "开发者中心", link: "http://open.mddata.top"},
    ],
  },
  {
    text: "历史文档",
    children: [
      { text: "1.5.1", link: "http://mddata.top/1.5.1/" },
    ],
  },
]);
