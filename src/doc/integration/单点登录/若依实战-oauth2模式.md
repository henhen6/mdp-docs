---
title: 若依实战（oauth2模式）
order: 8
category:
  - 项目集成
tag:
  - 项目集成
---

## 本章节演示Ruoyi-vue框架以OAuth2模式对接MDP

本章节演示如何在若依（RuoYi-Vue）中对接 MDP 的 **OAuth2 模式**单点登录。协议原理请先阅读[单点登录（OAuth2模式）](oauth2模式.md)，ticket 模式的若依实战见[若依实战（ticket模式）](若依实战-ticket模式.md)。

两种模式在若依侧的差异对比：

| 对比项 | ticket 模式 | OAuth2 模式（本文档） |
| ------ | ----------- | --------------------- |
| 引入依赖 | sa-token-sso + sa-token-forest | 无强制依赖，标准 HTTP 调用即可 |
| 用户标识 | MDP 用户 id（loginId） | openid（或 unionid） |
| 会话凭证 | 本系统 token（由 ticket 换取） | access_token + 本系统 token |
| 注销 | pushC 接收平台推送注销 | 退出时调用 `/oauth2/revoke` 回收 token |
| 适用场景 | 简单内部对接 | 需要标准协议、控制授权范围 |

## 接入步骤

### 1. 在MDP平台配置应用

在 MDP【控制台】-【开放平台】-【应用管理】新建应用，登录方式选择【Oauth2】，重点配置：

| 字段 | 值 | 说明 |
| ---- | ---- | ---- |
| 应用名称 | 若依oauth2 | |
| 登录方式 | Oauth2 | 标准的Oauth2协议 |
| 免登录跳转地址 | http://localhost:1024/login | 从工作台跳转进入时的落地页 |
| 跳转地址白名单（oauth2AllowRedirectUris） | http://localhost:1024/login | `redirect_uri` 必须与白名单**完全匹配** |

应用创建后，在【秘钥】中获取：

- `client_id`：即应用ID（appKey）
- `client_secret`：即应用秘钥（appSecret）

同时确认该应用已签约授权码模式（`authorization_code`）与所需 scope（建议 `userinfo,openid`）。

### 2. 若依侧准备：用户表新增字段

以 openid 作为用户唯一标识，在 `sys_user` 表新增 `openid` 字段：

```mysql
ALTER TABLE sys_user ADD COLUMN openid VARCHAR(64) NULL COMMENT 'MDP开放平台openid';
```

```java
public class SysUser extends BaseEntity {
    /** MDP开放平台openid */
    private String openid;
}
```

并新增根据 openid 查询用户的方法（Service / Mapper 与 ticket 模式的 `getUserBySsoId` 类似，略）。

### 3. 后端：新增 OAuth2 客户端接口

新增 `Oauth2ClientController`，实现 2 个接口：构建授权地址、回调换 token。HTTP 调用可使用若依自带的 `HttpUtils` 或任意 HTTP 客户端。

```java
@RestController
@RequestMapping("/anyUser/client")
@Tag(name = "OAuth2客户端")
public class Oauth2ClientController {
    @Autowired
    private ISysUserService userService;
    @Autowired
    private SysLoginService sysLoginService;
    @Autowired
    private TokenService tokenService;

    // 以下配置建议放入 application.yml，通过 @Value 或 @ConfigurationProperties 注入
    // MDP统一登录页（web-workbench 前端）地址
    static String authUrl = "https://workbench.mddata.top";
    // MDP 后端接口地址（单体版为 boot-server，微服务版为 inner-gateway + workbench 前缀）
    static String serverUrl = "http://localhost:23455";
    static String clientId = "your-app-key";
    static String clientSecret = "your-app-secret";
    static String redirectUri = "http://localhost:1024/login";

    /**
     * 构建授权地址：前端检测到未登录时调用，然后重定向到该地址
     */
    @GetMapping("/getOauth2AuthorizeUrl")
    public AjaxResult getOauth2AuthorizeUrl(String state) {
        String url = authUrl + "/oauth2/authorize"
                + "?response_type=code"
                + "&client_id=" + clientId
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                + "&scope=" + URLEncoder.encode("userinfo,openid", StandardCharsets.UTF_8)
                // state 原样返回，用于防CSRF，建议传当前页面地址（登录后回跳）
                + "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8);
        return AjaxResult.success("操作成功", url);
    }

    /**
     * 授权回调：浏览器带回 code 后，前端调用此接口换取本系统 token
     */
    @GetMapping("/doLoginByCode")
    public AjaxResult doLoginByCode(String code) {
        // 1. 用 code 换取 access_token
        String tokenResp = HttpUtils.sendPost(serverUrl + "/oauth2/token",
                "grant_type=authorization_code"
                + "&client_id=" + clientId
                + "&client_secret=" + clientSecret
                + "&code=" + code
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8));
        JSONObject tokenJson = JSON.parseObject(tokenResp);
        String accessToken = tokenJson.getJSONObject("data").getString("accessToken");
        String openid = tokenJson.getJSONObject("data").getString("openid");

        // 2. 用 access_token 获取用户信息（需 userinfo scope）
        String userResp = HttpUtils.sendPost(serverUrl + "/oauth2/userinfo",
                "access_token=" + accessToken);
        JSONObject userJson = JSON.parseObject(userResp).getJSONObject("data");

        // 3. 以 openid 映射本系统用户，生成本系统会话
        SysUser user = userService.getUserByOpenid(openid);
        if (StringUtils.isNull(user)) {
            // 首次登录：按需自动创建用户（参考 ticket 模式实战的主数据同步章节）
            return AjaxResult.error("用户未同步，请先在MDP平台同步用户数据");
        }
        String token = sysLoginService.login(user);
        return AjaxResult.success("操作成功", token);
    }
}
```

> 说明：示例中将 openid 作为用户唯一标识。如果您的多个应用需要识别同一个用户，请向平台申请 `unionid` scope 并改用 unionid 映射。

### 4. 后端：配置调整

`SecurityConfig` 中放行 OAuth2 相关接口（与 ticket 模式一致）：

```java
// 关键点：OAuth2 相关接口忽略权限
.requestMatchers("/anyUser/**").permitAll()
```

退出登录时回收 token：若依的 `LogoutSuccessHandlerImpl` 中，在原有退出逻辑前补充：

```java
// 通知MDP回收access_token（OAuth2模式没有推送注销，回收自己的token即可）
// token与openid建议登录时存入LoginUser或缓存，退出时取出
HttpUtils.sendPost(serverUrl + "/oauth2/revoke",
        "client_id=" + clientId
        + "&client_secret=" + clientSecret
        + "&access_token=" + accessToken);
```

### 5. 前端：改造登录页

新建 `login_oauth2.vue` 中转页，逻辑与 ticket 模式一致，只是「无凭证」时跳授权地址、「有 code」时调 `doLoginByCode`：

```javascript
created() {
  (this.code ? this.handleLoginByCode(this.code) : this.goOauth2AuthorizeUrl());
},
methods: {
  handleLoginByCode(code) {
    doLoginByCode(code).then((res) => {
      if (res.code == 200) {
        this.$store.dispatch("Login2", res.data).then(() => {
          location.href = decodeURIComponent(this.back);
        })
      }
    })
  },
  goOauth2AuthorizeUrl() {
    // state 传当前地址（含back参数），回调时原样返回
    getOauth2AuthorizeUrl(location.href).then((res) => {
      location.href = res.data;
    });
  },
}
```

配套修改与 ticket 模式完全一致（`src/api/login.js`、`src/router/index.js`、`src/permission.js`，参考[若依实战（ticket模式）](若依实战-ticket模式.md#前端)），此处不再重复。

## 验证清单

1. 未登录访问若依任意页面 → 自动跳转 MDP 授权页；
2. 首次授权时显示确认授权页（应用未开启自动确认授权时）；
3. 授权后浏览器重定向回 `http://localhost:1024/login?code=xxx&state=xxx`，自动登录成功；
4. 从 MDP 工作台「我的应用」点击应用图标，免登录进入；
5. 若依侧点击退出 → 本系统会话销毁 + MDP 侧 access_token 已回收（再次进入时需重新授权）。

## 常见问题

**Q1：提示 redirect_uri 不合法？**

授权时的 `redirect_uri` 必须与应用配置的白名单**完全匹配**（协议、域名、端口、路径），换 token 时的 `redirect_uri` 必须与授权时传入的一致。

**Q2：提示 grant_type 未开放？**

两级开关都需打开：平台全局配置 + 应用的「允许授权类型」。请联系平台管理员确认应用已签约授权码模式。

**Q3：登录成功但 userinfo 拿不到手机号等字段？**

确认应用已签约 `userinfo` scope，且 token 请求的 `scope` 参数中包含 `userinfo`。

**Q4：code 换 token 失败？**

授权码 `code` 是一次性的且有效期很短，请确认：回调后立即换 token、没有重复使用（如页面刷新导致同一 code 提交两次）、换 token 的 redirect_uri 与授权时一致。
