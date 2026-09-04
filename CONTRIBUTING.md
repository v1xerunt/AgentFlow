# Contributing to AgentFlow / 参与贡献

## English

Bug reports, translations, documentation improvements and focused code changes are welcome. For a substantial feature, open an issue describing the user need and proposed behavior before starting implementation.

### Development

Use Node.js 22.13+ and npm. Run `npm ci`, then `npm run dev`.

For code changes, run `npm run typecheck` and the tests relevant to the changed behavior. Run `npm test` and `npm run build` before submitting a runtime or dependency change. Changes to paths, process execution, native modules or packaging should pass the multi-platform release workflow. State which platforms you actually tested.

Keep English and Chinese text aligned. Keep generated output, local projects, credentials and archived evidence out of commits. Update the lockfile when dependencies change; preserve third-party notices when importing code or assets.

### Issues and pull requests

Describe the problem, expected behavior and reproduction steps. Include the app version, operating system and CPU architecture. Review exported diagnostics for private information before attaching them.

A pull request should explain the resulting behavior and its validation. Include screenshots for visible interface changes. Discuss one coherent change per pull request.

### Contribution licensing

By intentionally submitting original code, documentation or artwork for inclusion, you license that contribution under **AGPL-3.0-only**, unless a different arrangement is explicitly agreed in writing. You retain copyright and must have permission to contribute the material. Identify third-party material and its license.

The project may pursue separate commercial licensing. Including a contribution in a distribution under different terms requires the relevant copyright holder's separate permission. An AGPL contribution alone does not grant that permission. Before merging a contribution intended for such a distribution, maintainers must record the necessary agreement with its rights holder.

## 简体中文

欢迎提交问题复现、翻译、文档改进和范围明确的代码修改。较大的功能请先通过 issue 说明用户需求及预期行为。

### 开发与验证

使用 Node.js 22.13+ 和 npm，运行 `npm ci` 后通过 `npm run dev` 启动。

代码修改应通过 `npm run typecheck` 及相关行为测试；运行时或依赖修改还需通过 `npm test` 和 `npm run build`。路径、后台进程、原生模块和打包变更应通过多平台发布工作流，并注明实际测试过的平台。

同步维护中英文文案。提交时排除生成文件、本地项目、凭据和归档证据；依赖变更同步更新锁文件，引入第三方代码或素材时保留许可声明。

### 提交问题与改进

说明问题、预期行为和复现步骤，附上应用版本、操作系统与 CPU 架构。上传诊断报告前检查其中的私人信息。Pull request 应说明最终行为及验证结果；界面变更附截图，每次提交围绕一个完整改进展开。

### 贡献许可

主动提交供本项目收录的原创代码、文档或素材，默认按 **AGPL-3.0-only** 授权，另有明确书面约定的除外。贡献者保留版权，并须拥有提交该内容所需的权限。第三方内容应标明来源和许可证。

项目可探索独立商业授权。若要将某项贡献纳入其他许可条款的发行版，须取得相关版权方的单独授权；仅以 AGPL 提交贡献并不授予这一权限。维护者在合并拟纳入此类发行版的贡献前，应与权利人完成并记录相应协议。
