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
| 本地用户 | 需预先同步 | **首次登录自动注册**（可配置默认角色/部门/初始密码） |
| 注销 | pushC 接收平台推送注销 | 退出时调用 `/oauth2/revoke` 回收 token |
| 适用场景 | 简单内部对接 | 需要标准协议、控制授权范围 |

若依客户端通过 `ruoyi.oauth2.grant-type` 配置项切换四种授权模式，**修改配置重启即完成切换**，前端自动渲染对应的登录交互：

| 模式 | 交互方式 | 说明 |
| ---- | -------- | ---- |
| `code`（授权码，默认，推荐） | 整页跳转 MDP 认证中心 → 携带 code 回跳 → 后端换 token | code 不落前端存储、token 不经过浏览器，安全性最高 |
| `implicit`（隐藏式） | 整页跳转 MDP 认证中心 → 回跳地址锚点中直接携带 accessToken | token 暴露在地址栏，OAuth 2.1 已废弃，仅兼容旧客户端 |
| `password`（密码式） | 不跳转，登录页弹窗输入 MDP 账号密码 → 后端直接换 token | 若依服务端能接触明文密码，仅第一方高信任应用，OAuth 2.1 已废弃 |
| `client_credentials`（凭证式） | 隐藏「MDP登录」按钮 | 应用级 token（无 openid），**不能用于用户登录**，仅用于服务端间调用 |

::: warning 注意
MDP 服务端需为该应用开放对应的授权模式（应用配置中的「允许授权类型」`oauth2AllowGrantTypes`），否则认证中心会拒绝并提示"应用暂未开放此授权模式"。若依侧的 `grant-type` 配置必须与平台侧签约的模式一致。
:::

## 接入步骤

### 1. 在MDP平台配置应用

在 MDP【控制台】-【开放平台】-【应用管理】新建应用，登录方式选择【OAuth2认证】，重点配置：

| 字段 | 值 | 说明 |
| ---- | ---- | ---- |
| 应用名称 | 若依oauth2 | |
| 登录方式 | OAuth2认证 | 标准的OAuth2协议 |
| 免登录跳转地址 | http://localhost:1024/login | 从工作台跳转进入时的落地页 |
| 跳转地址白名单（oauth2AllowRedirectUris） | http://localhost:1024/login | `redirect_uri` 必须与白名单**完全匹配** |
| 允许授权类型（oauth2AllowGrantTypes） | authorization_code 等 | 勾选您要使用的授权模式 |

应用创建后，在【秘钥】中获取：

- `client_id`：即应用ID（appKey）
- `client_secret`：即应用秘钥（appSecret）

同时确认该应用已签约所需 scope（本文使用 `userinfo,openid,unionid`）。

### 2. 若依侧准备：用户表新增字段

在 `sys_user` 表新增三个单点登录相关字段：

```sql
ALTER TABLE sys_user ADD COLUMN sso_id BIGINT NULL COMMENT '单点登录中心的用户id';
ALTER TABLE sys_user ADD COLUMN openid VARCHAR(64) NULL COMMENT 'MDP开放平台openid（OAuth2模式下该用户在本应用下的唯一标识）';
ALTER TABLE sys_user ADD COLUMN unionid VARCHAR(64) NULL COMMENT 'MDP开放平台unionid（同一主体下跨应用唯一）';
```

```java
public class SysUser extends BaseEntity {
    /** 单点登录中心的用户id（即 userinfo 响应的 sub 字段） */
    private Long ssoId;
    /** MDP开放平台openid（OAuth2模式下该用户在本应用下的唯一标识） */
    private String openid;
    /** MDP开放平台unionid（同一主体下跨应用的用户唯一标识） */
    private String unionid;
}
```

并新增查询/更新链路：

```java
// SysUserMapper.java
SysUser selectUserByOpenid(String openid);
SysUser selectUserBySsoId(Long ssoId);
int updateUserOpenid(@Param("userId") Long userId, @Param("openid") String openid);
```

> 三个字段的分工：**openid** 是授权码/密码式登录的主标识（随 `/oauth2/token` 响应的扩展字段返回，按应用隔离）；**ssoId** 是隐藏式登录的主标识（隐藏式回跳只有 accessToken，无 openid，只能调 `/oauth2/userinfo` 拿 `sub`）；**unionid** 用于同一主体下多个应用间识别同一用户。三个字段共同支撑「自动注册 + 账号打通」（见第 5 节）。

### 3. 后端：引入客户端工具包并配置

引入 MDP 提供的 OAuth2 客户端工具包（封装了授权地址拼接、各接口调用与响应解析）：

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
ruoyi:
  oauth2:
    # OAuth2客户端授权模式：code-授权码(默认) implicit-隐藏式 password-密码式 client_credentials-凭证式(应用级token，不接入登录)
    grant-type: code
    # OAuth2自动注册用户的默认角色ID，留空则不分配角色（新用户登录后无菜单权限，需管理员手动分配）
    defaultRoleId: 2
    # OAuth2自动注册用户的默认部门ID
    defaultDeptId: 105
    # OAuth2自动注册用户的初始密码（BCrypt加密存储，用户可用该密码走原始账密登录）
    defaultPassword: 'your-init-password'

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

新增 `Oauth2ClientController`，按 `ruoyi.oauth2.grant-type` 配置提供对应接口：

```java
@RestController
@Tag(name = "OAuth2登录客户端")
public class Oauth2ClientController {
    private static final String GRANT_TYPE_CODE = "code";
    private static final String GRANT_TYPE_IMPLICIT = "implicit";
    private static final String SCOPE = "userinfo,openid,unionid";

    @Autowired
    private SysLoginService sysLoginService;

    /** 当前客户端授权模式，前端通过 getClientConfig 获取并渲染对应的登录交互 */
    @Value("${ruoyi.oauth2.grant-type:code}")
    private String grantType;

    /** 返回当前客户端配置（授权模式），前端据此渲染（密码式弹窗、凭证式隐藏入口） */
    @GetMapping("/anyUser/oauth2/getClientConfig")
    public AjaxResult getClientConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("grantType", grantType);
        return AjaxResult.success("操作成功", config);
    }

    /** 返回OAuth2认证中心登录地址（state 为随机串，用于防CSRF，回调时原样返回供前端校验） */
    @GetMapping("/anyUser/oauth2/getOauth2ServerUrl")
    public AjaxResult getOauth2ServerUrl(String clientLoginUrl) {
        if (!GRANT_TYPE_CODE.equals(grantType) && !GRANT_TYPE_IMPLICIT.equals(grantType)) {
            throw new ServiceException("当前授权模式[" + grantType + "]不支持跳转认证中心登录");
        }
        String state = SaFoxUtil.getRandomString(16);
        String serverAuthUrl = GRANT_TYPE_IMPLICIT.equals(grantType)
                ? SaOauth2ClientUtil.buildImplicitAuthorizeUrl(clientLoginUrl, SCOPE, state)
                : SaOauth2ClientUtil.buildCodeAuthorizeUrl(clientLoginUrl, SCOPE, state);
        return AjaxResult.success("操作成功", serverAuthUrl);
    }

    /** 授权码模式：用 code 换取 accessToken（openid 随扩展字段返回），再按 openid 登录或自动注册 */
    @PostMapping("/anyUser/oauth2/loginByCode")
    public AjaxResult loginByCode(String code, @RequestParam(required = false) String redirectUri) {
        Oauth2TokenRequest tokenRequest = new Oauth2TokenRequest();
        tokenRequest.setCode(code);
        tokenRequest.setRedirectUri(redirectUri);
        Oauth2TokenResponse tokenResponse;
        try {
            tokenResponse = SaOauth2ClientUtil.getAccessTokenByCode(tokenRequest);
        } catch (Oauth2ClientException e) {
            log.error("根据 code 换取 access_token 失败", e);
            throw new ServiceException("认证中心令牌换取失败：" + e.getMessage());
        }
        String accessToken = tokenResponse.getAccessToken();
        // openid 是该用户在本应用下的唯一标识，scope 含 openid 时随 token 响应的扩展字段返回
        Object openid = tokenResponse.getExtra().get("openid");
        if (openid == null) {
            throw new ServiceException("认证中心未返回 openid，请检查授权 scope 配置");
        }
        Object unionid = tokenResponse.getExtra().get("unionid");
        String token = sysLoginService.loginOrRegisterByOpenid(String.valueOf(openid),
                unionid == null ? null : String.valueOf(unionid), accessToken);
        return AjaxResult.success("操作成功", token);
    }

    /** 隐藏式：回跳只有 accessToken（无 openid），先取用户信息，再按 MDP 用户id（sub）登录或自动注册 */
    @PostMapping("/anyUser/oauth2/loginByToken")
    public AjaxResult loginByToken(String accessToken) {
        if (StrUtil.isBlank(accessToken)) {
            throw new ServiceException("accessToken 不能为空");
        }
        Oauth2UserInfoResponse userInfo;
        try {
            userInfo = SaOauth2ClientUtil.getUserInfoByAccessToken(accessToken);
        } catch (Oauth2ClientException e) {
            log.error("隐藏式登录：根据accessToken获取用户信息失败", e);
            throw new ServiceException("获取认证中心用户信息失败：" + e.getMessage());
        }
        String token = sysLoginService.loginOrRegisterByUserInfo(userInfo, accessToken);
        return AjaxResult.success("操作成功", token);
    }

    /** 密码式：拿用户在MDP的账号密码直接换取 accessToken，再按 openid 登录。密码为敏感信息，严禁写入日志 */
    @PostMapping("/anyUser/oauth2/loginByPassword")
    public AjaxResult loginByPassword(String username, String password) {
        if (StrUtil.isBlank(username) || StrUtil.isBlank(password)) {
            throw new ServiceException("账号或密码不能为空");
        }
        Oauth2TokenRequest tokenRequest = new Oauth2TokenRequest();
        tokenRequest.setUsername(username);
        tokenRequest.setPassword(password);
        tokenRequest.setScope(SCOPE);
        Oauth2TokenResponse tokenResponse;
        try {
            tokenResponse = SaOauth2ClientUtil.getAccessTokenByPassword(tokenRequest);
        } catch (Oauth2ClientException e) {
            log.error("密码式登录失败：{}", e.getMessage());
            throw new ServiceException("认证中心校验失败：" + e.getMessage());
        }
        String accessToken = tokenResponse.getAccessToken();
        Object openid = tokenResponse.getExtra().get("openid");
        if (openid == null) {
            throw new ServiceException("认证中心未返回 openid，请检查授权 scope 配置");
        }
        Object unionid = tokenResponse.getExtra().get("unionid");
        String token = sysLoginService.loginOrRegisterByOpenid(String.valueOf(openid),
                unionid == null ? null : String.valueOf(unionid), accessToken);
        return AjaxResult.success("操作成功", token);
    }
}
```

`SaOauth2ClientUtil` 由 `sa-token-oauth2-client-starter` 提供，所有方法均为**类型化调用**（请求/响应对象封装，无需手动解析 JSON）：

| 方法 | 调用的服务端接口 | 用途 |
| ---- | ---- | ---- |
| `buildCodeAuthorizeUrl(clientLoginUrl, scope, state)` | - | 构建授权码模式授权地址 |
| `buildImplicitAuthorizeUrl(clientLoginUrl, scope, state)` | - | 构建隐藏式授权地址 |
| `buildServerAuthorizeUrl(clientLoginUrl, scope, state, responseType)` | - | 按 responseType（code/token）构建授权地址 |
| `getAccessTokenByCode(Oauth2TokenRequest)` | `POST /oauth2/token` | 授权码换 token，返回 `Oauth2TokenResponse` |
| `getAccessTokenByPassword(Oauth2TokenRequest)` | `POST /oauth2/token` | 密码式换 token |
| `getUserInfoByAccessToken(accessToken)` | `GET/POST /oauth2/userinfo` | 获取用户信息，返回 `Oauth2UserInfoResponse` |
| `refreshAccessToken(Oauth2TokenRequest)` | `POST /oauth2/refresh` | 刷新 access_token |
| `revokeAccessToken(Oauth2RevokeRequest)` | `POST /oauth2/revoke` | 回收 token（退出登录时，返回 void） |
| `getClientToken(Oauth2TokenRequest)` | `POST /oauth2/client_token` | 凭证式获取应用级 token |

要点说明：

- **类型化响应**：`Oauth2TokenResponse` 直接提供 `getAccessToken()` / `getRefreshToken()` / `getExpiresIn()` 等方法；`openid`、`unionid` 在扩展字段中，通过 `getExtra().get("openid")` 获取；
- **openid 从 token 响应中获取**，无需再调 `/oauth2/userinfo`（仅当需要昵称、头像等更多资料，或隐藏式拿不到 openid 时才调用）；
- **redirect_uri 回传**：授权地址中的 `redirect_uri` 是发起授权时的完整页面地址，换 token 时必须回传一致的值，由前端通过 sessionStorage 缓存回传（见第 6 节）；
- **异常处理**：工具包调用失败抛出 `Oauth2ClientException`，其 message 为认证中心返回的标准错误描述（如"应用暂未开放此授权模式"），可直接包装为业务异常返回前端。

### 5. 后端：登录服务（自动注册）与注销回收

`SysLoginService` 新增两个登录入口，**本地用户不存在时自动注册**：

```java
/**
 * 授权码/密码式：根据 openid 登录，用户不存在时自动注册
 */
public String loginOrRegisterByOpenid(String openid, String unionid, String mdpAccessToken) {
    SysUser user = userService.selectUserByOpenid(openid);
    if (StringUtils.isNull(user)) {
        Oauth2UserInfoResponse userInfo = getUserInfoByToken(mdpAccessToken);
        // 账号打通：该用户可能此前通过隐藏式注册（只有 ssoId 没有 openid），按 ssoId 再查一次，命中则补写 openid
        Long ssoId = parseSsoId(userInfo.getSub());
        if (ssoId != null) {
            user = userService.selectUserBySsoId(ssoId);
            if (StringUtils.isNotNull(user)) {
                userService.updateUserOpenid(user.getUserId(), openid);
                user.setOpenid(openid);
            }
        }
        if (StringUtils.isNull(user)) {
            registerByOauth2(userInfo, openid, unionid);
            user = userService.selectUserByOpenid(openid);
        }
    }
    return createTokenByUser(user, mdpAccessToken);
}

/**
 * 隐藏式：回跳只有 accessToken（无 openid），先取用户信息，再按 MDP 用户id（ssoId）登录或注册
 */
public String loginOrRegisterByUserInfo(Oauth2UserInfoResponse userInfo, String mdpAccessToken) {
    Long ssoId = parseSsoId(userInfo.getSub());
    if (ssoId == null) {
        throw new ServiceException("认证中心返回的用户标识无效");
    }
    SysUser user = userService.selectUserBySsoId(ssoId);
    if (StringUtils.isNull(user)) {
        // 隐藏式回跳只携带 accessToken，openid 与 unionid 均无法获取，注册时留空
        registerByOauth2(userInfo, null, null);
        user = userService.selectUserBySsoId(ssoId);
    }
    return createTokenByUser(user, mdpAccessToken);
}
```

自动注册（`registerByOauth2`）的要点：

- 以 userinfo 中的资料（账号、昵称、邮箱、手机号、性别）建档，ssoId/openid/unionid 按模式写入；
- 登录账号与本地已有账号冲突时自动追加随机后缀（`buildUniqueUserName`），**避免把 MDP 账号错误关联到他人账号**；
- 默认角色、部门、初始密码取自 `ruoyi.oauth2.defaultRoleId` / `defaultDeptId` / `defaultPassword` 配置；角色留空则新用户无菜单权限，需管理员手动分配；
- 初始密码 BCrypt 加密存储，用户可用该密码走原始账密登录，建议首次登录后自行修改。

`LoginUser` 增加字段缓存 MDP 的 accessToken：

```java
/** MDP的OAuth2 accessToken（OAuth2单点登录时缓存，退出时调用 /oauth2/revoke 回收） */
private String mdpAccessToken;
```

退出时回收 token。OAuth2 模式没有推送注销，各应用持有独立的 access_token，退出时回收自己的 token 即可。在 `LogoutSuccessHandlerImpl` 中调用 SDK 封装好的 `SaOauth2ClientUtil.revokeAccessToken`：

```java
/**
 * 调用MDP的 /oauth2/revoke 回收access_token（RFC 7009，由 sa-token-oauth2-client 封装）。
 * 回收失败不阻断本系统退出流程（token到达有效期会自然失效），仅记录日志。
 */
private void revokeMdpAccessToken(String accessToken) {
    if (StrUtil.isBlank(accessToken)) {
        // 本账号不是OAuth2单点登录进来的（如账密登录），无需回收
        return;
    }
    try {
        Oauth2RevokeRequest revokeRequest = new Oauth2RevokeRequest();
        revokeRequest.setToken(accessToken);
        // RFC 7009：成功时响应体为空；撤销 access_token 时Server端会级联撤销关联的 refresh_token
        SaOauth2ClientUtil.revokeAccessToken(revokeRequest);
        log.info("回收MDP access_token 完成");
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

直接改造若依登录页 `login.vue`，在账密登录表单下方增加「MDP登录」按钮，页面初始化时先获取授权模式并处理认证中心回跳：

```typescript
import { getOauth2ServerUrl, doLoginByCode, getOauth2ClientConfig, doLoginByToken, doLoginByPassword } from "@/api/login"

// 授权发起时回调地址的缓存键：整页跳转后组件会重建，token 交换需回传一致的 redirect_uri
const REDIRECT_URI_KEY = 'oauth2RedirectUri'
// 授权发起时 state 的缓存键：回跳时校验一致性，防止 CSRF（攻击者伪造携带他人code的回调地址）
const STATE_KEY = 'oauth2State'

// 当前授权模式（code/implicit/password/client_credentials），初始化时从后端获取
const grantType = ref('code')

// 获取当前授权模式，据此渲染登录交互（密码式弹窗、凭证式隐藏入口）
getOauth2ClientConfig().then((res) => {
  if (res.data?.grantType) {
    grantType.value = res.data.grantType
  }
})
```

四种模式的交互差异：

- **凭证式**：`v-if="grantType !== 'client_credentials'"` 隐藏「MDP登录」按钮；
- **密码式**：点击按钮弹出对话框输入 MDP 账号密码，调 `doLoginByPassword` 直接登录；
- **授权码/隐藏式**：点击按钮缓存 redirect_uri 后整页跳转认证中心。

```typescript
// 跳转MDP认证中心进行单点登录（密码式则打开账号密码弹窗）
function handleMdpLogin(): void {
  if (grantType.value === 'password') {
    mdpDialogVisible.value = true
    return
  }
  // 回跳地址固定为登录页，带上 redirect 参数以便登录后跳回来源页面
  const clientLoginUrl = window.location.origin + window.location.pathname
      + (redirect.value ? '?redirect=' + encodeURIComponent(redirect.value) : '')
  cache.session.setJSON(REDIRECT_URI_KEY, clientLoginUrl)
  getOauth2ServerUrl(clientLoginUrl).then((res: AjaxResult<string>) => {
    // 从授权地址中解析后端生成的 state 并缓存，回跳时校验一致性（防CSRF）
    // 授权页为 hash 路由（#/oauth2/authorize?...），state 在 hash 段的 query 中，URL.searchParams 取不到需手动解析
    const url = new URL(res.data)
    const state = url.searchParams.get('state') || (url.hash.includes('?') ? new URLSearchParams(url.hash.split('?')[1]).get('state') : null)
    if (state) {
      cache.session.set(STATE_KEY, state)
    }
    window.location.href = res.data
  })
}
```

回跳处理：授权码模式参数在 search 段（`?code=xxx&state=yyy`），隐藏式在 hash 段（`#token=xxx&state=yyy`），两处都需解析；校验 state 一致性后调对应后端接口换取本系统 token：

```typescript
// 处理MDP认证中心回跳：授权码模式携带 code，隐藏式在锚点中携带 token
function handleOauth2Callback(): void {
  const error = getUrlParam('error')
  if (error) {
    ElMessage.error(decodeURIComponent(getUrlParam('error_description') || '') || '认证中心授权失败')
    clearOauth2Params()
    return
  }
  const code = getUrlParam('code')
  if (code) {
    handleLoginByCode(code)
    return
  }
  const hashToken = getHashParam('token')
  if (hashToken) {
    handleLoginByToken(hashToken)
  }
}

// 授权码模式回跳处理：state 一致性校验（防CSRF）通过后，用 code 换取本系统 token
function handleLoginByCode(code: string): void {
  const state = getUrlParam('state')
  const cachedState = cache.session.get(STATE_KEY)
  const redirectUri = cache.session.getJSON(REDIRECT_URI_KEY) as string
  cache.session.remove(STATE_KEY)
  cache.session.remove(REDIRECT_URI_KEY)
  // state 不一致说明回跳地址被伪造，拒绝登录
  if (!cachedState || cachedState !== state) {
    ElMessage.error('state 校验失败，请重新发起MDP登录')
    clearOauth2Params()
    return
  }
  doLoginByCode(code, redirectUri).then((res: AjaxResult<string>) => {
    userStore.login2(res.data)
    router.push({ path: redirect.value || '/' })
  }).catch(() => {
    // 清理地址栏中的 code，避免刷新重复使用已失效的授权码
    clearOauth2Params()
  })
}
```

另外两个安全细节：

- **redirect_uri 一致性**：授权地址中的 `redirect_uri` 是发起授权时的完整地址（含 `redirect` 参数），整页跳转后组件会重建，因此用 sessionStorage 缓存（`REDIRECT_URI_KEY`），调 `loginByCode` 时回传，保证换 token 的 `redirect_uri` 与授权时一致；
- **一次性参数清理**：登录成功或失败后调用 `clearOauth2Params()`，用 `history.replaceState` 从地址栏移除 code/state/token 等参数，避免刷新页面重复使用已失效的授权码、以及 token 残留地址栏泄露。

配套修改与 ticket 模式完全一致（`src/api/login.ts` 新增上述 4 个接口的请求方法，参考[若依实战（ticket模式）的「对接单点登录」一节](若依实战-ticket模式.md#对接单点登录)），此处不再重复。

## 验证清单

1. 未登录访问若依任意页面 → 跳转登录页，点击「MDP登录」→ 整页跳转 MDP 授权页；
2. 首次授权时显示确认授权页（应用未开启自动确认授权时）；
3. 授权后浏览器重定向回 `http://localhost:1024/login?code=xxx&state=xxx`，state 校验通过，自动登录成功（本地无用户时自动注册并登录）；
4. 篡改回调 URL 中的 state → 拒绝登录，提示「state 校验失败」；
5. 从 MDP 工作台「我的应用」点击应用图标，免登录进入；
6. 若依侧点击退出 → 本系统会话销毁 + MDP 侧 access_token 已回收（后端日志可见"回收MDP access_token 完成"，再次进入时需重新授权）；
7. 切换 `ruoyi.oauth2.grant-type` 为 `password` 重启 → 点击「MDP登录」弹出账号密码对话框，输入 MDP 账号密码直接登录；
8. 切换为 `client_credentials` 重启 → 登录页不再显示「MDP登录」按钮。

## 常见问题

**Q1：提示 redirect_uri 不合法？**

授权时的 `redirect_uri` 必须与应用配置的白名单**完全匹配**（协议、域名、端口、路径），换 token 时的 `redirect_uri` 必须与授权时传入的一致——这也是前端用 sessionStorage 缓存回传 redirect_uri 的原因。

**Q2：提示 grant_type 未开放 / 应用暂未开放此授权模式？**

两级开关都需打开：平台全局配置 + 应用的「允许授权类型」（`oauth2AllowGrantTypes`）。请确认若依侧 `ruoyi.oauth2.grant-type` 配置的模式与平台侧签约的模式一致。

**Q3：登录成功但拿不到 openid？**

确认应用已签约 `openid` scope，且授权地址的 `scope` 参数中包含 `openid`——openid 随 `/oauth2/token` 响应的扩展字段返回（`Oauth2TokenResponse.getExtra().get("openid")`）。

**Q4：code 换 token 失败？**

授权码 `code` 是一次性的且有效期很短，请确认：回调后立即换 token、没有重复使用（如页面刷新导致同一 code 提交两次，新版前端已通过 `clearOauth2Params` 清理地址栏规避）、换 token 的 redirect_uri 与授权时一致。

**Q5：自动注册的用户没有菜单权限？**

自动注册时按 `ruoyi.oauth2.defaultRoleId` 分配角色，该配置留空则新用户无任何角色（登录后无菜单）。请配置一个合适的默认角色，或由管理员在用户管理中手动分配。

**Q6：state 总是校验失败（缓存里取不到）？**

MDP 统一登录页使用 hash 路由（`http://localhost:7700/#/oauth2/authorize?...`），state 参数在 hash 段的 query 中。前端用 `URL.searchParams` 解析授权地址时，**只能解析 `#` 之前的内容**，取不到 hash 段里的 state，导致 sessionStorage 里始终是空的。此时需要手动解析 hash 段：

```typescript
const url = new URL(res.data)
const state = url.searchParams.get('state')
    || (url.hash.includes('?') ? new URLSearchParams(url.hash.split('?')[1]).get('state') : null)
```
