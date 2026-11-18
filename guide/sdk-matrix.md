# 多语言 SDK 矩阵

三个项目都提供多语言实现，统一在 `sdks/<lang>/` 下（Python 也在其中）。

| 语言 | 目录 | 典型依赖 | 备注 |
|---|---|---|---|
| Python | `sdks/python/` | xyj-api: `cryptography`；其余零依赖 | 发布名与 import 名见各项目 |
| TypeScript | `sdks/typescript/` | 零运行时依赖（Node 内置 crypto / fetch） | npm 包 `@h1s97x/<project>` |
| Java | `sdks/java/` | JDK 内置 crypto；Jackson | Maven + 阿里云镜像 |
| Go | `sdks/go/` | 零第三方依赖（标准库） | `go vet` + `go test` |
| C# | `sdks/csharp/` | 零 NuGet（BCL） | 自跑 console 测试 |
| Rust | `sdks/rust/` | crypto crate（如实标注） | `cargo test` |
| C | `sdks/c/` | OpenSSL libcrypto + JSON 库 | 系统依赖，CI 安装 |
| C++ | `sdks/cpp/` | 复用 C 库 | header-only RAII 包装 |

并非每个项目都有全部 8 种语言：以各项目主仓 `sdks/README.md` 为准。

## 跨语言一致性

每种语言SDK的测试文件在 `contract/vectors.json` 的 `meta.consumers` 里登记，并带：

```
PARITY_VECTOR_VERSION: 1
PARITY_COVERAGE: all
```

`verify.py vectors` 门禁校验：消费者文件存在、版本标记一致、覆盖声明为 `all`。向量分四组（按项目略有差异）：

| 组 | 覆盖 |
|---|---|
| `canonical` | 规范化算法（key 排序、跳过规则、嵌套结构） |
| `sign` | 确定签名精确断言 |
| `verify` | 响应验签合法 / 篡改 |
| `envelope` | 成功码 / 业务失败语义 |

## 零依赖口径

能使用语言内置能力就不引第三方：TS 用 `node:crypto`、Java 用 `java.security`、Go 用 `crypto/*`、C# 用 `System.Security.Cryptography`。Rust / C 因标准库无 crypto 而引入依赖，各项目 README 已诚实标注。
