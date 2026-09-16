---
title: md-codegen
index: false
category:
  - 后端源码分析
tag:
  - 后端源码分析
  - mdp-base
---

## 1. 模块定位

代码生成器模块，坐标 `top.mddata.base:md-codegen`（包名 `top.mddata.codegen`），基于 mybatis-flex 官方 codegen 改造。读数据库表结构，一键生成**前后端全套代码**：后端三层 + 实体拆层（Entity/EntityBase/Mapper/MapperXml/Service/ServiceImpl/Controller/Dto/Vo/Query/TableDef），前端 TS 类型/Api/权限/多语言 + table/tree 两种形态的 Vue 页面。独立使用，不进 md-all。

## 2. 源码解读

```
top.mddata.codegen
├── Generator.java                    # 入口：generate(DataSource, GlobalConfig[, IDialect])
├── config/
│   ├── GlobalConfig / StrategyConfig / PackageConfig / TemplateConfig / TableConfig
│   └── front/FrontConfig.java         # 前端输出配置
├── generator/
│   ├── IGenerator.java                # 生成器接口
│   └── impl/                          # 后端各文件生成器 + front/{table,tree}/ 前端生成器
├── dialect/
│   ├── IDialect.java                  # 元数据读取方言（MySql/Oracle/PostgreSQL/Sqlite/Default）
│   └── JdbcTypeMapping / TsTypeMapping # Java/TS 类型映射
├── template/ITemplate.java + impl/EnjoyTemplate.java   # JFinal Enjoy 模板引擎
├── entity/                            # 表/列元模型
└── constant/                          # GenerationType（主键策略）、GenTypeEnum 等枚举
```

### 2.1 装配方式：GeneratorFactory 硬编码注册（非 SPI）

`GeneratorFactory` 静态注册全部生成器——新增生成器必须改工厂类，不能像 SPI 一样外部注入。这是与插件式设计最大的区别。

### 2.2 生成物清单（两类形态）

| 端 | 生成物 |
|---|---|
| 后端 | Entity/EntityBase（拆层）、Mapper、MapperXml、Service、ServiceImpl、Controller、Dto、Vo、Query、TableDef（APT 联动）、PackageInfo |
| 前端 | ApiTs、ModelTs、PermTs、LangZh/LangEn JSON、table 型页面（Index/Form/Detail/Wrapper）、tree 型页面（含 Move） |

生成的后端代码遵循 [md-mvc-flex](md-mvc-flex.md) 三层基类与 [md-common-pojo](../md-public/md-common-pojo.md) 的 Base+DO 实体拆层约定。

## 3. 可配置参数

无 Spring 配置类——**编程式配置**，入口是各 config 类（GlobalConfig/StrategyConfig/PackageConfig/TemplateConfig/TableConfig/FrontConfig）。典型用法见 MDP 应用层的代码生成服务（generator 服务）。

## 4. 扩展点

| 扩展点 | 类型 | 说明 |
|---|---|---|
| `IGenerator` | 接口 | 新增一种文件的生成器（需同步在 GeneratorFactory 注册） |
| `IDialect` | 接口 | 新数据库方言（达梦等） |
| `ITemplate` | 接口 | 模板引擎替换（默认 Enjoy） |
| 模板本身 | 资源文件 | 改输出样式优先改模板，不动 Java 代码 |
| `GenerationStrategyEnum` / `GenTypeEnum` | 枚举 | 主键策略与生成类型选择 |

## 5. 功能扩展建议

| 想做什么 | 推荐做法 |
|---|---|
| 改生成代码风格 | 改模板（Enjoy），别改生成器逻辑 |
| 支持新数据库 | 实现 `IDialect` + 类型映射，参考 PostgreSQL 实现 |
| 公司脚手架差异（包名/注释规范） | `PackageConfig`/`StrategyConfig` 传参解决，再不行改模板 |
| 树表 CRUD | 用 tree 型生成器（含移动节点页面） |

## 6. 二次开发注意事项

::: warning GeneratorFactory 不是 SPI
生成器注册是**硬编码**的：自定义生成器除了实现 `IGenerator`，还必须修改 `GeneratorFactory`——二次开发后合并平台版本时这里是常见冲突点。
:::

::: warning 生成后以业务代码对待

- 生成的代码在业务工程生成后就是**普通代码**，可自由修改；
- 生成代码的 `@md.generator auto insert` 锚点注释（见 md-common-pojo 的 EchoApi 等）是自动插入的定位标记，别手工删。

:::

