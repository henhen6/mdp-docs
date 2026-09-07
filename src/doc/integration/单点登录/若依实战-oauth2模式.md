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
| 引入依赖 | sa-token-sso + sa-token-forest | sa-token-oauth2-client-starter（MDP 提供的客户端工具包） |
| 用户标识 | MDP 用户 id（loginId） | openid（该用户在本应用下的唯一标识） |
| 会话凭证 | 本系统 token（由 ticket 换取） | access_token + 本系统 token |
| 注销 | pushC 接收平台推送注销 | 退出时调用 `/oauth2/revoke` 回收 token |
| 适用场景 | 简单内部对接 | 需要标准协议、控制授权范围 |

## 接入步骤

### 1. 在MDP平台配置应用

在 MDP【控制台】-【开放平台】-【应用管理】新建应用，登录方式选择【OAuth2认证】，重点配置：

| 字段 | 值 | 说明 |
| ---- | ---- | ---- |
| 应用名称 | 若依oauth2 | |
| 登录方式 | OAuth2认证 | 标准的OAuth2协议 |
| 免登录跳转地址 | http://localhost:1024/login | 从工作台跳转进入时的落地页 |
| 跳转地址白名单（oauth2AllowRedirectUris） | http://localhost:1024/login | `redirect_uri` 必须与白名单**完全匹配** |

应用创建后，在【秘钥】中获取：

- `client_id`：即应用ID（appKey）
- `client_secret`：即应用秘钥（appSecret）

同时确认该应用已签约授权码模式（`authorization_code`）与所需 scope（本文使用 `userinfo,openid,unionid`）。

### 2. 若依侧准备：用户表新增字段

以 openid 作为用户唯一标识，在 `sys_user` 表新增 `openid` 字段：

```mysql
ALTER TABLE sys_user ADD COLUMN openid VARCHAR(64) NULL COMMENT 'MDP开放平台openid';
```

```java
public class SysUser extends BaseEntity {
    /** 单点登录中心的用户id */
    private Long ssoId;
    /** MDP开放平台openid（OAuth2模式下该用户在本应用下的唯一标识） */
    private String openid;
}
```

并新增根据 openid 查询用户的完整链路：

```java
// SysUserMapper.java
SysUser selectUserByOpenid(String openid);

// SysUserMapper.xml
<select id="selectUserByOpenid" parameterType="String" resultMap="SysUserResult">
    <include refid="selectUserVo"/>
    where u.openid = #{openid}
</select>

// ISysUserService.java / SysUserServiceImpl.java
SysUser selectUserByOpenid(String openid);
```

> openid 在 scope 含 `openid` 时，随 `/oauth2/token` 响应的额外字段返回（`data.openid`）。openid 按应用隔离——不同应用拿到的 openid 不同，平台借此保护用户 id；若您的多个应用需要识别同一个用户，请使用 unionid。

### 3. 后端：引入客户端工具包并配置

引入 MDP 提供的 OAuth2 客户端工具包（封装了授权地址拼接、各接口地址拼接）：

```xml
<dependency>
    <groupId>top.mddata.base</groupId>
    <artifactId>sa-token-oauth2-client-starter</artifactId>
    <version>${mdp-base.version}</version>
</dependency>
```

> 版本号建议通过 Maven 属性统一管理（如 `${mdp-base.version}`），与 MDP 后端版本保持一致，避免多处硬编码版本号在升级时遗漏同步。

在 `application.yml` 中配置：

```yaml
sa-token:
  oauth2-client:
    # 应用ID（即 appKey / client_id）
    clientId: 'ruoyi-vue-oauth'
    # 应用秘钥（即 appSecret / client_secret）
    clientSecret: 'your-app-secret'
    # MDP 后端接口地址（单体版为 boot-server，微服务版为 inner-gateway + workbench 前缀）
    serverUrl: 'http://localhost:23455'
    # 前端 oauth2 授权页地址（web-workbench 前端）
    authorizeUrl: 'http://localhost:7700/#/oauth2/authorize'
```

> 工具包提供 `Oauth2ClientConfig` 配置类与 `SaOauth2ClientUtil` 工具类。`authorizeUrl` 需单独配置为前端授权页地址（区别于后端 `serverUrl`），其余接口地址（token/refresh/revoke/userinfo）由工具包自动拼接。

### 4. 后端：新增 OAuth2 客户端接口

新增 `Oauth2ClientController`，实现 2 个接口：构建授权地址（含防 CSRF 的 state）、回调换 token 并登录：

```java
@RestController
@Tag(name = "OAuth2登录客户端")
public class Oauth2ClientController {
    @Autowired
    private SysLoginService sysLoginService;
    @Autowired
    private Oauth2ClientConfig oauth2ClientConfig;

    /**
     * 返回OAuth2认证中心登录地址。
     * state 为随机串，用于防CSRF，授权中心回跳时原样返回，由前端校验一致性
     */
    @GetMapping("/anyUser/oauth2/getOauth2ServerUrl")
    public AjaxResult getOauth2ServerUrl(String clientLoginUrl) {
        String state = SaFoxUtil.getRandomString(16);
        String serverAuthUrl = SaOauth2ClientUtil.buildServerAuthorizeUrl(
                clientLoginUrl, "userinfo,openid,unionid", state);
        return AjaxResult.success("操作成功", serverAuthUrl);
    }

    /**
     * 授权回调：用 code 换取 token，以 openid 映射本系统用户并登录
     */
    @PostMapping("/anyUser/oauth2/loginByCode")
    public AjaxResult loginByCode(String code, @RequestParam(required = false) String redirectUri) {
        // 1. 用 code 换取 access_token（注意：响应字段为 snake_case）
        JSONObject resultAccessToken = getAccessTokenByCode(code, redirectUri);
        Integer resultCode = resultAccessToken.getInteger("code");
        if (resultCode != 0) {
            throw new ServiceException(resultAccessToken.getString("msg"), resultCode);
        }
        JSONObject resultData = resultAccessToken.getJSONObject("data");
        String accessToken = resultData.getString("access_token");
        String openid = resultData.getString("openid");

        // 2. 以 openid 自动登录，并缓存 MDP 的 accessToken 供退出时回收
        String token = sysLoginService.loginByOpenid(openid, accessToken);
        return AjaxResult.success("操作成功", token);
    }

    public JSONObject getAccessTokenByCode(String code, String redirectUri) {
        // 调用 sa-token-oauth2-client 封装的方法（内部走 SaHttpTemplate，由 sa-token-forest 提供实现）
        String res = SaOauth2ClientUtil.getAccessTokenByCode(code, redirectUri);
        return JSON.parseObject(res);
    }

    public JSONObject getUserInfoByAccessToken(String accessToken) {
        String res = SaOauth2ClientUtil.getUserInfoByAccessToken(accessToken);
        return JSON.parseObject(res);
    }
}
```

> `SaOauth2ClientUtil` 由 `sa-token-oauth2-client-starter` 提供，封装了与 MDP 后端 OAuth2 接口的全部交互：
>
> | 方法 | 调用的服务端接口 | 用途 |
> | ---- | ---- | ---- |
> | `buildServerAuthorizeUrl` | - | 构建授权地址（含 response_type/client_id/redirect_uri/scope/state） |
> | `getAccessTokenByCode` | `POST /oauth2/token` | 授权码换 access_token |
> | `getUserInfoByAccessToken` | `POST /oauth2/userinfo` | 获取用户公开信息 |
> | `refreshAccessToken` | `POST /oauth2/refresh` | 刷新 access_token |
> | `revokeAccessToken` | `POST /oauth2/revoke` | 回收 access_token（退出登录时） |
> | `getClientToken` | `POST /oauth2/client_token` | 凭证式获取 client_token |

要点说明：

- **响应字段是 snake_case**：`/oauth2/token` 返回 `access_token`、`refresh_token`（OAuth2 标准命名），不是驼峰的 `accessToken`，解析时注意；
- **openid 从 token 响应中获取**，无需再调 `/oauth2/userinfo`（仅当需要昵称、头像等更多资料时才调用）；
- **redirect_uri 回传**：授权地址中的 `redirect_uri` 是发起授权时的完整页面地址（可能含 `back` 参数），换 token 时必须回传一致的值，由前端通过 sessionStorage 缓存回传（见第 6 节）。

### 5. 后端：登录服务与注销回收

`SysLoginService` 新增按 openid 登录的方法，登录时将 MDP 的 accessToken 存入 `LoginUser`：

```java
/**
 * OAuth2模式：根据MDP开放平台openid登录，并缓存MDP的accessToken供退出时回收
 */
public String loginByOpenid(String openid, String mdpAccessToken) {
    SysUser user = userService.selectUserByOpenid(openid);
    if (StringUtils.isNull(user)) {
        throw new ServiceException(MessageUtils.message("user.not.exists"));
    }
    // ...（用户状态校验、authenticationManager 验证与 login(Long ssoId) 相同，略）

    LoginUser loginUser = (LoginUser) authentication.getPrincipal();
    // 缓存MDP的accessToken，退出时用于调用 /oauth2/revoke 回收
    loginUser.setMdpAccessToken(mdpAccessToken);
    recordLoginInfo(loginUser.getUserId());
    return tokenService.createToken(loginUser);
}
```

`LoginUser` 增加字段：

```java
/** MDP的OAuth2 accessToken（OAuth2单点登录时缓存，退出时调用 /oauth2/revoke 回收） */
private String mdpAccessToken;
```

退出时回收 token。OAuth2 模式没有推送注销，各应用持有独立的 access_token，退出时回收自己的 token 即可。在 `LogoutSuccessHandlerImpl` 中调用 SDK 封装好的 `SaOauth2ClientUtil.revokeAccessToken`：

```java
/**
 * 调用MDP的 /oauth2/revoke 回收access_token（由 sa-token-oauth2-client 封装，内部走 SaHttpTemplate）。
 * 回收失败不阻断本系统退出流程（token到达有效期会自然失效），仅记录日志。
 */
private void revokeMdpAccessToken(String accessToken) {
    if (StrUtil.isBlank(accessToken)) {
        // 本账号不是OAuth2单点登录进来的（如账密登录），无需回收
        return;
    }
    try {
        String res = SaOauth2ClientUtil.revokeAccessToken(accessToken);
        log.info("回收MDP access_token 完成，返回结果：{}", res);
    } catch (Exception e) {
        log.error("回收MDP access_token 失败", e);
    }
}
```

`SecurityConfig` 中放行 OAuth2 相关接口（与 ticket 模式一致）：

```java
// 关键点：OAuth2 相关接口忽略权限
.requestMatchers("/anyUser/**").permitAll()
```

### 6. 前端：改造登录页

新建 `login_oauth2.vue` 中转页，完整逻辑：

- **无 code**：缓存当前地址与授权 state，跳转授权地址；
- **有 code**：校验 state 一致性（防 CSRF）→ 调 `loginByCode` 换本系统 token → 跳回原页面；
- **授权被拒**（`error=access_denied`）：展示授权中心的错误描述。

```typescript
// 授权发起时 state 的缓存键：回跳时校验一致性，防止 CSRF（攻击者伪造携带他人code的回调地址）
const STATE_KEY = 'oauth2State'

function initLogin(): void {
  if (error === 'access_denied') {
    loading.value = false
    resultMsg.value = errorDescription
  } else if (code) {
    // state 一致性校验：与授权发起时缓存的不一致，说明回跳地址被伪造，拒绝登录
    const cachedState = cache.session.get(STATE_KEY)
    if (!cachedState || cachedState !== state) {
      loading.value = false
      codeError.value = true
      resultMsg.value = 'state 校验失败，请重新登录'
      return
    }
    cache.session.remove(STATE_KEY)
    handleLoginByCode(code)
  } else {
    goOauth2ServerUrl()
  }
}

// 重定向至认证中心
function goOauth2ServerUrl(): void {
  cache.session.setJSON(REDIRECT_URI_KEY, location.href)
  getOauth2ServerUrl(location.href).then((res) => {
    if (res.code === 200 && res.data) {
      // 从授权地址中解析后端生成的 state 并缓存，回跳时校验一致性（防CSRF）
      // 注意：MDP 授权页为 hash 路由（#/oauth2/authorize?...），state 在 hash 段的 query 中，
      // URL.searchParams 只能解析 # 之前的内容，取不到时需手动解析 hash 段
      const url = new URL(res.data)
      let state = url.searchParams.get('state')
      if (!state && url.hash.includes('?')) {
        state = new URLSearchParams(url.hash.split('?')[1]).get('state')
      }
      if (state) {
        cache.session.set(STATE_KEY, state)
      }
      location.href = res.data
    }
  })
}
```

另外两个安全细节：

- **redirect_uri 一致性**：授权地址中的 `redirect_uri` 是发起授权时的完整地址（含 `back` 参数），整页跳转后组件会重建，因此用 sessionStorage 缓存（`REDIRECT_URI_KEY`），调 `loginByCode` 时回传，保证换 token 的 `redirect_uri` 与授权时一致；
- **开放重定向防护**：登录成功后的回跳地址仅允许站内相对路径，防止 `back` 参数被构造成外部钓鱼链接：

```typescript
// back 仅允许站内相对路径，防止被构造成外部钓鱼链接
function getSafeBackUrl(target: string): string {
  return target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
```

配套修改与 ticket 模式完全一致（`src/api/login.ts`、路由注册、路由守卫，参考[若依实战（ticket模式）的「对接单点登录」一节](若依实战-ticket模式.md#对接单点登录)），此处不再重复。

## 验证清单

1. 未登录访问若依任意页面 → 自动跳转 MDP 授权页；
2. 首次授权时显示确认授权页（应用未开启自动确认授权时）；
3. 授权后浏览器重定向回 `http://localhost:1024/login?code=xxx&state=xxx`，state 校验通过，自动登录成功；
4. 篡改回调 URL 中的 state → 拒绝登录，显示「重新登录」按钮；
5. 从 MDP 工作台「我的应用」点击应用图标，免登录进入；
6. 若依侧点击退出 → 本系统会话销毁 + MDP 侧 access_token 已回收（后端日志可见 revoke 状态码 200，再次进入时需重新授权）。

## 常见问题

**Q1：提示 redirect_uri 不合法？**

授权时的 `redirect_uri` 必须与应用配置的白名单**完全匹配**（协议、域名、端口、路径），换 token 时的 `redirect_uri` 必须与授权时传入的一致——这也是前端用 sessionStorage 缓存回传 redirect_uri 的原因。

**Q2：提示 grant_type 未开放？**

两级开关都需打开：平台全局配置 + 应用的「允许授权类型」。请联系平台管理员确认应用已签约授权码模式。

**Q3：登录成功但拿不到 openid？**

确认应用已签约 `openid` scope，且授权地址的 `scope` 参数中包含 `openid`——openid 随 `/oauth2/token` 响应的额外字段返回（`data.openid`）。

**Q4：code 换 token 失败？**

授权码 `code` 是一次性的且有效期很短，请确认：回调后立即换 token、没有重复使用（如页面刷新导致同一 code 提交两次）、换 token 的 redirect_uri 与授权时一致。

**Q5：登录后提示用户不存在？**

OAuth2 模式以 openid 映射用户（`sys_user.openid` 字段），与 ticket 模式的 `sso_id` 是两个不同的字段。用户需先通过事件回调（主数据同步）或手工方式将 openid 写入 `sys_user`。

**Q6：state 总是校验失败（缓存里取不到）？**

MDP 统一登录页使用 hash 路由（`http://localhost:7700/#/oauth2/authorize?...`），state 参数在 hash 段的 query 中。前端用 `URL.searchParams` 解析授权地址时，**只能解析 `#` 之前的内容**，取不到 hash 段里的 state，导致 sessionStorage 里始终是空的。此时需要手动解析 hash 段：

```typescript
const url = new URL(res.data)
let state = url.searchParams.get('state')
if (!state && url.hash.includes('?')) {
  state = new URLSearchParams(url.hash.split('?')[1]).get('state')
}
```
