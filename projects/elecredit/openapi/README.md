# OpenAPI 契约 —— 仓库唯一真源（source of truth）

本目录下的 `openapi/openapi.yaml` 是 Elecredit API 契约的**唯一真源**，由 Git 托管、属于本仓库资产。
所有外部工具（Apifox / Redoc / Scalar / Prism / Spectral）都从**这个文件**读取，方向是
**「文件是真相，工具是它的视图」**，而不是「在 Apifox 里点点点、偶尔导出一份」。

## 1. 把它当成你的资产

- 所有接口定义、参数、响应字段只在这一个文件里维护。
- 改完跑 Spectral 校验（仓库根 `.cnb.yml` 的 `ci-openapi-contract` / `.spectral.yml`），契约漂移会被 CI 卡住；本地等价命令 `npx -y @stoplight/spectral-cli@6 lint openapi/openapi.yaml`。
- **Apifox 用法**：从 `openapi/openapi.yaml` **导入 / 同步**（Apifox 支持从 OpenAPI 文件导入与同步）。
  不要把接口定义写在 Apifox 里再回头导出——那样 Apifox 就成了真源，违背本目录初衷。

> 当前文件内容沿用 JSON 风格（JSON 是 YAML 的合法子集，所有工具均可解析）。如需更地道的
> YAML（加注释、换行更友好），可用 `npx prettier --parser yaml` 或 `npx @redocly/cli lint` 一键格式化，
> 不改变语义。

## 2. 逃生演练（不依赖 Apifox 也能活）

目的不是马上替换 Apifox，而是把「被锁定」的风险从「未知」变成「已知有备份」。
下面命令首次运行需要联网拉取对应 npm 包（`npx -y` 会自动获取），`openapi/` 目录下提供了等价脚本：

```bash
cd openapi
npm run lint    # Spectral 本地校验（等价 CI）
npm run redoc   # Redoc 渲染文档站，默认 http://localhost:8080
npm run scalar  # Scalar 渲染交互式 API 文档
npm run mock    # Prism 起 Mock 服务，按契约返回示例响应
```

跑通任意一条，就证明：哪怕明天 Apifox 涨价/停服，你也能立刻用开源工具接管文档与 Mock。
（注意：`redoc-cli` 默认端口 8080；`prism mock` 默认 4010；Scalar 命令随版本略有差异，按 `npx @scalar/cli --help` 调整。）

## 3. （可选）MCP 这一层

`apifox-mcp-server` 依赖其云服务；可改为自托管的 OpenAPI → MCP 桥接，工具清单直接从本
`openapi/openapi.yaml` 生成，链路上不依赖 Apifox。需要的话告诉我，我按 `openapi/package.json` 里
的脚本模式再补一个 `npm run mcp`（语言任选 Node/Python，你已有 CNB MCP 经验，成本低）。

## ⚠️ 需要你亲自核对的两件事（我无法代劳）

1. **Apifox 里的测试资产能否导出**：OpenAPI 导出只覆盖接口定义；你在 Apifox 里写的**测试用例、
   环境变量、断言**大概率不在 OpenAPI 里。请去 Apifox 客户端的导出菜单看一眼——若导不出，这部分就是
   真正的锁定点，需要手工迁移或重写来兜底。
2. **你到底用了 Apifox 哪些功能**：如果只是「看文档 + 调接口」，暴露面很小，第 1 步做完就够了；
   若用了自动化测试 / Mock 规则，这两块要单独想办法（对应上面的逃生演练）。
