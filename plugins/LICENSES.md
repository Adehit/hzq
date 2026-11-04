# 第三方库许可（vendored）

本项目把以下库打包进 `vendor/`，以便在 `file://` 下完全离线运行。它们各自的版权归原作者所有。

| 库 | 版本 | 许可 | 用途 | 文件 |
|---|---|---|---|---|
| KaTeX | 与 hzq 0.0.2 `plugins/katex` 同版本 | MIT | 公式渲染（编辑器与比赛现场一致） | `vendor/katex/` |
| MathLive | 0.110.0 | MIT | 图形化公式输入（WYSIWYG + 虚拟键盘），输出 LaTeX | `vendor/mathlive/mathlive.min.js` |
| marked | 12.0.2 | MIT | Markdown（GFM）解析 | `vendor/marked/marked.min.js` |
| DOMPurify | 3.1.6 | Apache-2.0 OR MPL-2.0 | 用户内容消毒，防 XSS | `vendor/dompurify/purify.min.js` |
| fflate | 0.8.2 | MIT | `problem.zip` 打包 / 解包 | `vendor/fflate/fflate.umd.js` |

说明：

- MathLive 与 KaTeX 使用**同一套字体文件**（`KaTeX_*.woff2`，已核对 SHA-256 一致），
  因此 `vendor/katex/fonts/` 被两者共用，`vendor/mathlive/` 下只保留了 JS。
- 本项目自身代码（`index.html`、`css/`、`js/`）随 hzq 仓库的 LICENSE 发布。
