<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/chuanshengtong-wordmark-panel.svg">
    <img src="docs/assets/brand/chuanshengtong-wordmark-transparent.png" alt="传声筒 AgentFlow" width="440">
  </picture>
  <h1>传声筒 AgentFlow</h1>
  <p><strong>面向 LLM 与编程 Agent 的可视化多智能体工作流桌面应用</strong></p>
  <p>连接不同模型，分配各自角色，把 Agent 之间的对话变成可用的文件成果。</p>
  <p><a href="README.md">English</a> · <strong>简体中文</strong></p>
  <p><a href="#功能特色">功能特色</a> · <a href="#快速开始">快速开始</a> · <a href="#ai-native-skill">AI-native skill</a> · <a href="docs/cli.zh-CN.md">CLI 文档</a> · <a href="#连接你的模型">模型连接</a></p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="许可证：AGPL-3.0-only"></a>
</div>

**传声筒 AgentFlow** 将模型 API 和本地编程 Agent 汇集到一个桌面工作台中。在画布上搭建流程，让一个 Agent 审阅另一个的工作，并把最终成果保存在自己的项目文件夹里。

![AgentFlow 画布中的客户回访工作流](docs/assets/screenshots/flow-en.png)

## 功能特色

- **设计 Agent 之间的协作。** 通过 Pass、Review、Revise、Merge 连接传递、审阅、修订与汇总步骤。独立分支可以并行运行，回复实时呈现。
- **为每个角色选择模型。** 将常用 LLM 与 Codex、Claude Code 等编程 Agent 组合在同一个流程中。
- **与任意 Agent 对话。** 双击节点打开它的会话，继续追问、讨论并完善结果。
- **描述任务，生成 Flow。** 检查建议流程后应用，用自动填写 Prompt 帮助编写各个 Agent 的指令，并锁定想保留的内容。
- **带着文件开始工作。** 添加文本、PDF、Word 文档、CSV 和模型支持的图片；选择下游可见的内容，阅读 Markdown 结果并复用输出文件。
- **保存好用的 Agent。** 将角色、Prompt 和模型设置存入 Agent 库，留给下一次任务使用。
- **在自己的文件夹中管理成果。** 一个 Project 可以组织多个 Flow，对话与结果保存在本地。界面支持中文、English 和跟随系统。

## 可以用它做什么

| 任务 | 工作流示例 |
| --- | --- |
| 撰写与编辑 | 初稿 → 独立审阅 → 修订 |
| 比较想法 | 多个专业视角并行分析 → 汇总建议 |
| 整理报告 | 原始材料 → 分析 → 报告 |
| 处理数据 | 编程 Agent 处理 CSV → 撰写 Agent 生成简报 |

每个 Agent 都有自己的模型、指令和会话。你可以检查每一步的工作，再决定向后传递哪些内容。

## 快速开始

安装 [Node.js](https://nodejs.org/) **22.13 或更高版本**，然后在仓库目录运行：

```sh
npm ci
npm run dev
```

1. **体验引导教程。** 跟随客户回访工作流生成周会简报。教程使用预设演示回复，无需 API Key。
2. **连接模型。** 打开设置，添加模型 API、连接账户，或配置本地 Agent 工具。
3. **创建 Project。** 添加输入文件和 Agent，连接它们的角色；也可以描述任务来生成 Flow。
4. **运行并完善。** 查看执行过程，双击 Agent 继续对话，打开最终生成的文件。

## AI-native skill

[AgentFlow skill](skills/agentflow/SKILL.md) 让 Codex、Claude Code 直接生成并执行 Flow。说出目标，编程 agent 就能规划流程，使用当前会话的模型和工具完成各个角色的工作：

> 分析这些客户反馈，审阅分析的证据，最后生成行动建议。请自动生成并运行 Flow，再给我一个可编辑面板。

- **从意图生成 Flow。** Skill 提供流程格式和关系语义，让 agent 根据需求编写明确的角色、提示词与依赖。
- **使用当前 Agent 会话。** 各个角色直接继承宿主的模型和工具，无须额外配置服务商。宿主支持时可以分配给原生子 agent，也可以在单个会话中按角色顺序执行。
- **检查过程并恢复运行。** JSON CLI 校验流程、分配就绪任务，记录完成结果和来源依赖，中断后可以从保存的状态继续。
- **通过对话或面板编辑。** 让 agent 调整流程，或在本地 HTML 面板中修改目标、输入、提示词和关系标签，导出后开始新运行。

在仓库执行 `npm ci` 后，构建并安装 skill：

```sh
npm run skill:build
node scripts/install-skill.mjs --host both --project "/path/to/your/project"
```

只安装一个宿主时使用 `--host codex` 或 `--host claude`；个人安装用 `--user` 替换 `--project`。安装器会保留已有安装。生成的 `dist/skills/agentflow` 包含运行时，复制到其他机器后只需要 Node.js 22.13+。详见[安装说明](docs/cli.zh-CN.md#构建与安装)。

在项目中使用 Codex 的 `$agentflow` 或 Claude Code 的 `/agentflow`，后面接要执行的任务。Skill 引导 CLI 调用，宿主完成实际推理和工具操作。直接使用命令行时，可以从[执行示例](docs/cli.zh-CN.md#使用宿主-agent-运行-flow)开始。

### Instructions for LLMs

可以直接对编程 agent 说：

> 读取 https://github.com/v1xerunt/AgentFlow/tree/dev，按照 README 的 Instructions for LLMs，把 AgentFlow skill 安装到我当前的项目。

用户请求安装时，按以下步骤操作：

1. 确定当前宿主是 Codex 还是 Claude Code，以及用户的目标项目目录。区分目标项目与 AgentFlow 源码目录；用户要求个人安装时使用个人范围。
2. 阅读 [CLI 安装说明](docs/cli.zh-CN.md#构建与安装)和[安装器](scripts/install-skill.mjs)。仓库中的 `skills/agentflow` 与 `apps/cli` 是配套的 skill 和 CLI 源码。
3. 需要获取源码时，将 `https://github.com/v1xerunt/AgentFlow.git` 的 `dev` 分支克隆到独立目录。在源码目录检查 Node.js 22.13+，依次运行 `npm ci`、`npm run skill:build`。
4. 用 `node scripts/install-skill.mjs --host codex --project "<目标项目的绝对路径>"` 安装完整包。Claude Code 使用 `--host claude`；用户要求两者时使用 `--host both`；个人安装用 `--user` 替换 `--project …`。遇到已有安装时，由用户明确决定如何更新。
5. 从安装器输出取得实际 skill 目录，运行 `node "<已安装的 skill>/scripts/agentflow.mjs" host validate "<已安装的 skill>/assets/review-flow.json"`，确认返回 `valid: true`。
6. 告知安装目录和调用方式：Codex 使用 `$agentflow`，Claude Code 使用 `/agentflow`。如果宿主尚未列出 skill，在目标项目中重新打开会话。

安装位置遵循 [Codex 的 skill 目录](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)和 [Claude Code 的 skill 目录](https://code.claude.com/docs/en/skills#where-skills-live)。

## 连接你的模型

需要为不同角色选择服务商和模型时，在桌面应用中配置以下连接：

| 连接方式 | 可选服务或工具 |
| --- | --- |
| 模型 API | OpenAI、Anthropic、Google Gemini、DeepSeek、Z.AI、Z.AI GLM Coding Plan、Kimi / Moonshot、OpenRouter |
| 自定义端点 | OpenAI 兼容、Anthropic、Gemini API |
| 本地 Agent 工具 | Codex、Claude Code、Kimi Code、Antigravity、DeepSeek Harness |
| 账户连接 | ChatGPT / Codex、Claude Code、Kimi、Gemini / Antigravity |
| 实验连接 | DeepSeek Web Bridge |

使用你自己的 API Key 或受支持的账户。API 与订阅账户分别配置，适用各服务商的账户和用量要求。本地 Agent 工具使用各自的安装环境与权限。

项目保存在你的文件夹中。运行已连接的模型时，选中的提示词和文件会发送给对应服务商或 Agent 工具。Linux 保存 API 凭据需要可用的系统钥匙环。

## 文档

- [CLI 使用文档](docs/cli.zh-CN.md)：安装、宿主执行、JSON 响应、中断恢复、可视化面板与演示命令。
- [Flow 规范](skills/agentflow/references/flow-spec.md)：流程结构、关系语义与宿主模式支持的输入。
- [AgentFlow skill](skills/agentflow/SKILL.md)：编程 agent 用于生成和执行 Flow 的完整指令。

## 许可证

AgentFlow 采用 [GNU AGPLv3](LICENSE) 开源许可证。第三方组件保留其[各自许可](THIRD_PARTY_NOTICES.md)。
