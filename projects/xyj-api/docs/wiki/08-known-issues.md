# 08 已知事实与问题登记

> 追加式登记，带日期。条目包含「为什么这样」与「如何验证」，避免未来把既定事实当 bug 修。
> 协议事实的权威在 `docs/protocol.md`；能力清单权威在 `contract/capabilities.json`。

## 8.1 已知事实（别当 bug 修）

### 8.1a 业务失败不抛异常（2026-09-30 起）

SDK 只要拿到 JSON 信封就返回，业务成败由调用方用 `is_success()` 判定；
服务层同样以 HTTP 200 + `success=false` 表达业务失败。
验证：修改 `_finalize` 让业务失败抛异常 → `sdks/python/tests/test_client.py` 回归失败。

### 8.1b 响应验签只覆盖 data（2026-09-30 实测）

同一请求连续两次调用，`timestamp` 变而 `sign` 不变，证明 `code/msg/timestamp/success`
不在签名范围。验签不能替代 TLS。样本局限：实测 `data` 恒为空数组，
非空 `data` 的规范化口径尚未由真实样本覆盖；用 `xyj verify-probe` 复核。
验证：`sdks/python/tests/test_verify.py` 黄金样本 + verify-probe 非零码出口。

### 8.1c 空结果是正常成功（2026-11-18）

`data: []` / `upstreamTotal=0` 表示确无记录，不是服务故障，也不得伪造数据。
Skill 与服务均明确禁止把「查不到」说成「接口挂了」。

### 8.1d 一个 client = 一套网关凭据（2026-09-30）

上下游与报告分属不同网关/私钥时，各建一个 `XyjClient` 实例；
一个服务实例对应一套 `XYJ_*`，两套凭据请部署两个服务实例。

### 8.1e 服务/MCP 的非回环启动守卫（2026-11-18）

未配置 Token 且监听非回环地址时 `SystemExit(2)`；CIDR 列表全非法时 fail closed。
验证：临时清空 Token 并设 `SERVICE_HOST=0.0.0.0` 启动 → 退出码 2。

### 8.1f 注册表原地写入（2026-11-18）

`issue_token` 用 `open(...,"w") + fsync` 而不是 `os.replace`：容器 bind mount 的
inode 固定，原子替换会让服务端继续读旧文件。

## 8.2 仍待办

- [ ] 拿到非空 `data` 的真实响应样本后，用 `xyj verify-probe` 复核规范化口径并归档；
- [ ] 若有官方网关公钥清单，把验签从「消费方配对公钥」切换到「网关公钥」路径；
- [ ] 报告轮询的编排示例（当前明确留在调用方）；
- [ ] 若上游给出服务号/错误码的官方清单，替换 `docs/protocol.md` 中的实测反推口径。

## 8.3 非缺陷

- `mcp/tools.json` 不存在：工具定义从 `contract/capabilities.json` 运行时派生，避免双份漂移；
- SDK 的 `requests` / `cryptography` 是必需依赖：SHA1withRSA 与 HTTP 是协议本身的需要；
  CLI 与接入层则保持零额外依赖。
