# xyj-api 多语言 SDK 矩阵

8 种语言实现同一份协议：**SHA1withRSA 签名（规范化 k=v）+ 统一信封 + 响应验签（只覆盖 `data`）
+ 3 端点 + 通用 request()**。跨语言一致性由 `contract/vectors.json` 强制：

- 唯一权威：`contract/vectors.json` 的 `canonical` / `sign` / `verify` / `envelope` 四组；
- 每个消费者文件带 `PARITY_VECTOR_VERSION: 1` 与 `PARITY_COVERAGE: all` 标记；
- `python contract/verify.py vectors` 校验消费者标记与四组非空。

| 语言 | 目录 | crypto 来源 | 运行时依赖 | 测试命令 |
|---|---|---|---|---|
| Python | `python/` | `cryptography` | requests + cryptography | `cd sdks/python && pytest tests/ -q` |
| TypeScript | `typescript/` | `node:crypto` | 零 | `cd sdks/typescript && npm test` |
| Java | `java/` | `java.security` | jackson-databind | `cd sdks/java && mvn -s settings.xml test` |
| Go | `go/` | `crypto/rsa` | 零 | `cd sdks/go && go test ./...` |
| C# | `csharp/` | `System.Security.Cryptography` | 零 NuGet | `cd sdks/csharp && dotnet run --project tests/Xyj.Tests` |
| Rust | `rust/` | `rsa` crate | rsa/sha1/base64/reqwest(可选) | `cd sdks/rust && cargo test` |
| C | `c/` | OpenSSL `libcrypto` | libcrypto + json-c | `cd sdks/c && make test` |
| C++ | `cpp/` | 复用 C SDK | 继承 C | `cd sdks/cpp && make test` |

> **依赖诚实说明**：Rust/C/C++ 因语言/标准库不提供 crypto，按需引入第三方/系统依赖
> （你已确认「有必要就加」）。其余语言保持零 crypto 依赖或仅用标准库。

## 统一设计约定

- **传输接缝**：所有语言提供 `Pending`（默认 fail-loud）/ `Mapping`（离线回放）/ 真实 HTTP 三种传输；
- **凭据隔离**：`from_env()` / `fromEnv()` / `FromEnv()` 读 `XYJ_*`；私钥/公钥永不进日志；
- **错误分类**：`category` / `retryable` / `hint` 结构化字段，服务层不靠异常类名字符串判断；
- **信封判定**：`success is true` 或 `code ∈ {200, 0000}`，业务失败不抛异常；
- **验签范围**：只覆盖 `data`；`code/msg/success/timestamp` 不在签名范围（既定口径）。

各语言 README 有具体用法与构建说明。
