---
title: md-captcha-starter
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

验证码聚合模块，坐标 `top.mddata.base:md-captcha-starter`（聚合 pom），下辖两个独立子 starter：

- **md-graphic-captcha-starter**：图形验证码（hutool/easy-captcha 内核），`GraphicCaptchaService` 生成图片；
- **md-slider-captcha-starter**：滑块/点选验证码（anji-captcha 内核），内置缓存实现。

## 2. 源码解读

```
md-captcha-starter
├── md-graphic-captcha-starter
│   └── top.mddata.base.captcha.graphic
│       ├── GraphicCaptchaService.java        # 生成/校验图形验证码
│       └── properties/GraphicCaptchaProperties.java  # mdp.captcha.graphic.*
└── md-slider-captcha-starter
    └── top.mddata.base.captcha.slider
        ├── SliderCaptchaAutoConfiguration.java       # 自动配置（含缓存三分支装配）
        ├── SliderCaptchaCacheServiceImpl.java / SliderCaptchaCacheAutoConfiguration.java
        └── properties/SliderCaptchaProperties.java   # mdp.captcha.slider.*
```

滑块验证码的缓存有三种装配分支（`cache-type`）：`default`（本地内存）、`redis`（分布式，多实例部署必选）、`custom`（应用自己提供缓存 Bean）。

## 3. 可配置参数

### 3.1 图形验证码（前缀 `mdp.captcha.graphic`）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.captcha.graphic.enabled` | true | 开关 |
| `mdp.captcha.graphic.type` | SPEC | 类型（SPEC 等，见 `GraphicCaptchaType`） |
| `mdp.captcha.graphic.length` | 4 | 字符数 |
| `mdp.captcha.graphic.width` | 111 | 宽（px） |
| `mdp.captcha.graphic.height` | 36 | 高（px） |
| `mdp.captcha.graphic.font-name` | — | 字体 |
| `mdp.captcha.graphic.font-size` | 25 | 字号 |

### 3.2 滑块验证码（前缀 `mdp.captcha.slider`，字段核对自 `SliderCaptchaProperties`）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `mdp.captcha.slider.enabled` | true | 开关 |
| `mdp.captcha.slider.enable-aes` | true | 前端轨迹 AES 加密 |
| `mdp.captcha.slider.type` | BLOCKPUZZLE | BLOCKPUZZLE 滑块拼图 / PICCLICK 文字点选 |
| `mdp.captcha.slider.cache-type` | default | **default 本地内存 / redis / custom**（多实例部署必须 redis） |
| `mdp.captcha.slider.jigsaw-base-map-path` | — | 滑块底图资源路径 |
| `mdp.captcha.slider.pic-click-base-map-path` | — | 点选底图资源路径 |
| `mdp.captcha.slider.slip-offset` | 5 | 容错偏移量 |
| `mdp.captcha.slider.font-type` / `water-font` / `font-style` / `font-size` | WenQuanZhengHei.ttf 等 | 字体与水印样式 |
| `mdp.captcha.slider.water-mark` | "" | 水印文案 |
| `mdp.captcha.slider.req-frequency-limit-enable` | 0 | 接口防刷开关 |
| `mdp.captcha.slider.req-get-lock-limit` / `req-get-lock-seconds` | 5 / 300 | get 接口锁定阈值/秒数 |
| `mdp.captcha.slider.req-get-minute-limit` / `req-check-minute-limit` / `req-verify-minute-limit` | 100 / 100 / 100 | 各接口每分钟限次 |
| `mdp.captcha.slider.cache-number` | 1000 | 本地缓存验证码数量 |
| `mdp.captcha.slider.timing-clear` | 180 | 定时清理周期（秒） |
| `mdp.captcha.slider.history-data-clear-enable` | 0 | 历史数据清理 |

## 4. 扩展点

- **滑块缓存**：`cache-type=custom` 时应用提供自己的缓存实现 Bean（`SliderCaptchaCacheAutoConfiguration` 按 `@ConditionalOnProperty` 三分支装配）。
- **底图资源**：`jigsaw-base-map-path`/`pic-click-base-map-path` 可指向 classpath 或自定义目录，换图不换代码。
- 两种验证码相互独立，可只引其一。

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 集群部署滑块验证码 | `cache-type=redis`（本地内存在多实例下校验必失败） |
| 登录防刷 | 开 `req-frequency-limit-enable`，按业务量调 `req-*-minute-limit` |
| 短信/邮件发码前加人机校验 | 滑块通过后再放行发码接口，复用现有登录流程的接法 |
| 自定义验证码样式 | 换 `*-base-map-path` 底图；图形验证码调 type/length/width/height |

## 6. 二次开发注意事项

::: warning 多实例 + default 缓存 = 验证失败
滑块验证码状态默认存本地内存，负载均衡打到不同实例时"这边生成、那边校验"必然失败。**多实例部署必须 `cache-type=redis`**（redis 未配好时启动也会暴露问题，留意日志）。
:::

::: warning 配置值多为字符串类型
`SliderCaptchaProperties` 中限流/尺寸等大量字段是 String 类型（anji-captcha 约定），配置时按字符串写（如 `"5"`/`"100"` 语义），改造成数字字段需同步 anji-captcha 读取逻辑。
:::
