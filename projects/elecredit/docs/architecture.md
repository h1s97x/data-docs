# 架构：契约驱动 + 代码生成

## 分层

```
contract/sdk.json          ← 机器可读契约唯一真源（10 端点 / 19 错误 / 12 司法 type）
contract/vectors.json      ← 跨语言行为向量
contract/capabilities.json ← 能力注册表（service / MCP / Skill）
        │
        ▼
tools/gen_code.py          ← 校验契约 → 渲染 11 份产物 → 生成 manifest
        │
        ▼
sdks/[lang]/                7 种语言 SDK（生成端点/错误/枚举 + 手写协议逻辑）
service/ mcp/ skills/       能力服务 / AI 接入 / Agent Skill
```

与 `altdatahub` / `xyj-api` **同一架构形态**：数据由生成器保证一致，行为由向量测试保证一致。

## 契约内容（`contract/sdk.json`）

| 段 | 内容 | 生成物 |
|---|---|---|
| `endpoints` | 10 端点：code / path / description / paging / productCode | 各语言端点表 |
| `errors` | 19 条错误码：category / exitCode / retryable / hint | `ERROR_CONTRACT` + `CODE_HINT` |
| `judicial` | D11 的 12 个 type + maxRange=20 | `D11_TYPES` / `D11_MAX_RANGE` |

## 生成物清单（11 份）

- Python：`endpoints_generated.py` / `errors_generated.py` / `judicial_generated.py`
- TypeScript：`src/contracts/generated.ts`
- Java：`com.elecredit.generated.Generated`
- Go：`gen/generated.go`（独立 `gen` 包，避免与手写 `elecredit` 包冲突）
- C#：`Elecredit.Generated.Generated`
- Rust：`src/generated.rs`
- C：`include/elecredit_generated.h` + `src/elecredit_generated.c`
- `contract/generated.json`：manifest（generator sha256 + 公开 API 摘要 + 每份产物 sha256）

elecredit 没有 C++ SDK，因此不渲染 C++（与 altdatahub/xyj-api 的 C++ 薄封装不同）。

## 改契约的流程

1. 编辑 `contract/sdk.json`
2. `python tools/gen_code.py`（重生成 11 份）
3. 回归 + `python tools/gen_code.py --check`
4. 提交时契约与生成物必须同批

## 手写层边界

生成器只产出**数据定义**。协议逻辑仍手写：签名（MD5+SHA256）、信封、客户端编排、CLI、传输。这些由 `contract/vectors.json` 四组向量保证跨语言一致。

此前跨语言一致性靠 TS 的两个 vitest 用正则解析 Python/TS 源码表（`error-contract-consistency.test.ts`、`endpoint-contract-consistency.test.ts`），现在改为生成物 + `--check` 门禁，Go/Java/C#/Rust/C 也首次纳入同一真源。
