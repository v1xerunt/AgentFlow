# AgentFlow CLI 使用文档

[English](cli.md) · **简体中文** · [返回 README](../README.zh-CN.md)

CLI 用于在命令行中校验 AgentFlow 流程并协调执行。它的 JSON 任务接口支持 [AI-native skill](../skills/agentflow/SKILL.md)：编程 agent 将用户意图转成 Flow，从 CLI 领取任务并提交结果，宿主会话提供模型、工具和执行权限。

| 命令组 | 用途 |
| --- | --- |
| `host …` | 协调当前编程 agent 会话完成真实任务，返回 JSON。 |
| `validate` | 按共享 Graph Schema 校验 YAML 或 JSON 流程。 |
| `run` | 使用内置 Fake provider 执行演示流程。 |

## 构建与安装

用户要求安装 Skill 时，先按[安装与运行时配置](../skills/agentflow/references/installation.md)检查可用的桌面 CLI，再选择轻量包及宿主自带或独立的 Node 运行时。

桌面包内置命令：Windows 为 `<安装目录>/resources/agentflow/agentflow.cmd`，macOS 为 `AgentFlow.app/Contents/Resources/agentflow/agentflow`。给命令传入 `skill install --host codex --user` 即可安装；Claude Code 使用 `--host claude`，项目安装使用 `--project "<目录>"`。只有执行安装命令才会写入 Skill 目录。安装后的命令入口使用应用内置运行时，GUI 关闭也能工作，无需修改系统 PATH。

完整轻量 Skill 包可用 `<node> "<解压后的 skill>/scripts/agentflow.mjs" skill install --host codex --user` 安装，并将选定的 Node 路径记录到命令入口。较早发布的包可直接复制完整 Skill 目录，详见上方安装流程。

从源码开发需要 Node.js **22.13+**。在仓库根目录运行：

```sh
npm ci
npm run build --workspace @agentflow/cli
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js host --help
```

为编程 agent 安装 skill 和内置 CLI：

```sh
npm run skill:build
node scripts/install-skill.mjs --host both --project "/path/to/your/project"
```

Windows 可使用带引号的路径，例如 `"D:/Projects/My Project"`。通过 Node 直接调用安装脚本，可以在不同 shell 中保留完整参数。

| 安装参数 | 含义 |
| --- | --- |
| `--host codex` | 安装到目标目录下的 `.agents/skills/agentflow`。 |
| `--host claude` | 安装到目标目录下的 `.claude/skills/agentflow`。 |
| `--host both` | 为两个宿主安装；源码便捷脚本默认使用此项。 |
| `--project <directory>` | 安装到指定项目。 |
| `--user` | 安装到用户主目录，与 `--project` 二选一。 |

目标 skill 已存在时，安装器会停止。更新前保留本地修改，并将原安装移到其他位置，再安装新版。安装位置遵循宿主的 skill 发现规则：[Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)、[Claude Code](https://code.claude.com/docs/en/skills)。

`dist/skills/agentflow` 是完整分发目录，包含运行时和许可文件。将它复制到 skill 目录后，只需要 Node.js 即可使用，无须项目源码或安装依赖。在已为 Codex 安装的项目中：

```sh
node .agents/skills/agentflow/scripts/agentflow.mjs host --help
```

Claude Code 对应的入口是 `.claude/skills/agentflow/scripts/agentflow.mjs`。Agent 应根据 skill 的实际位置解析脚本绝对路径，并在用户工作区中执行命令。

## 使用宿主 Agent 运行 Flow

以下命令在仓库根目录执行。[示例流程](../skills/agentflow/assets/review-flow.json) 包含原始材料、撰写、审阅和定稿节点。日常使用时，由编程 agent 根据用户描述生成流程文件。

### 1. 校验并开始运行

```sh
node apps/cli/dist/index.js host validate skills/agentflow/assets/review-flow.json
node apps/cli/dist/index.js host start skills/agentflow/assets/review-flow.json --workspace . --run-dir .agentflow/runs/weekly-brief
```

`start` 保存已确定的流程和 Input 产物，返回 `runDirectory`、当前 `ready` 节点 ID 和产物路径。工作区必须存在，运行目录必须是新目录。省略 `--run-dir` 时，会在 `<workspace>/.agentflow/runs/` 下分配唯一目录。

### 2. 领取任务

```sh
node apps/cli/dist/index.js host next .agentflow/runs/weekly-brief
```

返回内容包括：

| 字段 | 宿主如何使用 |
| --- | --- |
| `task.id` | 本次任务的准确 ID，用于提交结果或记录失败。 |
| `task.nodeId`、`task.attempt` | 要执行的节点及尝试次数。 |
| `node.name` | 面向用户的角色名称。 |
| `workspace` | 执行工具操作和读写文件的工作目录。 |
| `messages` | 组装后的 System/User 指令与连接的材料。 |
| `relations` | 上游关系标签，例如 `review`、`merge`。 |
| `upstream` | 直接来源节点 ID、产物 ID 和可读文件路径。 |
| `resultPath` | 建议由宿主写入的 UTF-8 Markdown 结果文件。 |

领取后，任务状态变为 `running`。**此时由宿主 agent 实际完成任务**：根据返回的消息调用当前模型和可用工具，将完整结果写入 `resultPath`。任务要求生成文件时，结果中应包含已核验的工作区相对路径，以及足够下游角色继续工作的内容。

### 3. 提交结果并继续

将 `<task-id>` 和 `<result-path>` 替换为上一步返回的实际值：

```sh
node apps/cli/dist/index.js host submit .agentflow/runs/weekly-brief "<task-id>" --file "<result-path>"
node apps/cli/dist/index.js host next .agentflow/runs/weekly-brief
```

重复“领取 → 执行 → 提交”，直到 `status` 为 `completed`。每份接收的结果保存为不可覆盖的产物；下游节点在全部直接依赖完成后就绪。Merge 会收到它明确指定的各个来源。

没有就绪任务时，`next` 返回 `task: null` 和运行状态。此时需检查状态：可能还有正在执行的任务或失败的依赖需要处理。只有 `status: completed` 才表示整个 Flow 完成。

## 命令参考

下表命令前加 `node apps/cli/dist/index.js`，或已安装 skill 入口的绝对路径。各子命令均支持 `--help`。

| 命令 | 行为 |
| --- | --- |
| `host validate <graph>` | 校验 JSON/YAML 的流程结构及宿主执行约束。 |
| `host start <graph> [--workspace <directory>] [--run-dir <directory>]` | 按流程快照开始新运行，工作区默认为 `.`。 |
| `host status <run>` | 读取运行与节点状态、就绪 ID、待完成任务 ID、错误和产物路径。 |
| `host next <run> [--node <id>]` | 领取一个就绪 Agent，可指定节点 ID。 |
| `host request <run> <task>` | 读取已有运行中任务的完整请求。 |
| `host submit <run> <task> --file <path>` | 接收该任务的完整 Markdown 结果。 |
| `host fail <run> <task> --reason <text>` | 记录运行中任务未能完成的原因。 |
| `host retry <run> <node>` | 为失败节点领取一次新尝试，并返回请求。 |
| `host panel <graph-or-run> --out <html>` | 将离线流程编辑器或只读运行快照写入新文件。 |

`<run>` 是运行目录，`<task>` 是一次执行尝试的任务 ID，`<node>` 是流程节点 ID。`retry` 会立即创建一个运行中的新尝试；直接执行它返回的请求，并用新的任务 ID 提交结果。

## JSON 与状态处理

宿主命令将 JSON 写入 stdout。操作错误以 `{"error":"…"}` 写入 stderr，退出码为 1；调用成功时退出码为 0。参数错误也以非零状态退出，参数提示与帮助信息为纯文本。宿主命令默认返回 JSON，无须添加 `--json`。

| 节点状态 | 含义 |
| --- | --- |
| `ready` | 依赖已完成，可以领取任务。 |
| `waiting` | 还有直接依赖未完成，见 `waitingFor`。 |
| `running` | 任务已领取，等待提交结果。 |
| `completed` | 已有接收的产物。 |
| `failed` | 最近一次尝试失败，查看 `error`。 |

所有节点完成时，运行状态为 `completed`；有任务执行中时为 `running`；没有执行中任务且仍有失败节点时为 `blocked`；其余情况为 `ready`。处于 `blocked` 的运行也可能有独立分支就绪，下一步操作应同时依据各节点状态和 `ready` 列表。

同一任务提交完全相同的内容是幂等操作。已完成产物无法被不同内容覆盖；空结果和已失败任务 ID 的提交会被拒绝。要修改已经接收的工作，编辑原始 Flow 并开始新运行。

## 中断恢复、重试与并行执行

会话中断后：

```sh
node apps/cli/dist/index.js host status "<run>"
node apps/cli/dist/index.js host request "<run>" "<task>"
```

使用 `request` 恢复运行中任务的请求。如果已核验的结果文件存在，可以直接提交。重新执行前，检查已有文件修改和外部操作是否已经完成。

执行者已经停止，且问题原因已经解决时：

```sh
node apps/cli/dist/index.js host fail "<run>" "<task>" --reason "Worker interrupted before producing a result"
node apps/cli/dist/index.js host retry "<run>" "<node>"
```

之前的尝试保留在记录中，同一次运行已完成的上游产物会继续复用。Skill 采用有限重试：原因修复后重试一次，持续阻塞时向用户说明；CLI 本身由调用方决定重试策略。

需要并行时，从 `status.ready` 中领取不同节点，并在宿主支持时分配给原生子 agent。短暂的 CLI 写操作应串行执行，模型任务可以重叠进行，工作区文件写入应避免冲突。也可以在单个宿主会话中依次执行各个角色，此时角色共享会话上下文。

运行锁会拒绝重叠写入，等待另一条命令结束后再试。若命令崩溃，检查 `.lock` 中的进程 ID，确认该进程已经退出，再移除残留锁。停止执行者由宿主负责，`host fail` 用于记录中断状态。

## 查看和编辑 Flow

```sh
node apps/cli/dist/index.js host panel skills/agentflow/assets/review-flow.json --out flow-panel.html
node apps/cli/dist/index.js host panel .agentflow/runs/weekly-brief --out run-panel.html
```

使用浏览器或支持本地 HTML 的宿主预览打开文件。流程面板可编辑 Flow 名称和目标、节点名称、文本输入、未锁定的提示词，以及单来源 Agent 关系标签。导出会下载 `flow.json`；将文件交回 agent，校验后开始新运行。节点和连接等结构修改可通过对话或编辑流程文件完成。

运行面板显示生成时的进度与结果。需要最新进度时，重新生成面板。每次 `--out` 都应指定新文件路径。面板离线工作，通过导出的流程文件将执行交回宿主。

## 文件与支持的流程

```text
<workspace>/
  .agentflow/runs/<run-id>/
    graph.json               已确定的流程快照
    state.json               带校验和的运行、任务与产物记录
    artifacts/<hash>.md      不可覆盖的结果，通过 host status 获取路径
    results/<task-id>.md      由宿主写入的建议提交文件
    .lock                    CLI 写操作期间存在的锁
```

运行状态通过原子替换保存。将运行文件视为记录，需要调整时修改原始 Flow。流程修改后开始新运行；迁移到其他工作区也需开始新运行，因为记录中的工作区路径为绝对路径。桌面项目使用独立的 `.flow/project.json` 容器。

命令参数中的路径相对于调用目录解析：有 `INIT_CWD` 时使用该值，否则使用当前工作目录。`--workspace` 设置任务执行上下文，其他命令参数仍按调用目录解析。入口脚本与工作目录不同时，可以使用带引号的绝对路径。

宿主流程使用共享的 version 1 Schema，各 Agent 设置 `provider: host`、`model: inherit`，并填写非空的 System 与 Output 提示词，提供可见文本输入，保持流程无环。PDF、图片等文件由宿主工具读取，再以提取文本或工作区相对文件引用的形式提供输入。宿主输出为 Markdown 产物，文件交付物由宿主生成。桌面 Output 节点、教程模式、节点模型参数和隐式 `for-each` 输入需要转换为宿主模式支持的形式。完整编写约定见 [Flow 规范](../skills/agentflow/references/flow-spec.md)。

## 流程校验与演示执行

```sh
node apps/cli/dist/index.js validate examples/review-flow.yaml --json
node apps/cli/dist/index.js run examples/review-flow.yaml --no-delay --json
```

`validate` 校验共享流程格式；添加 `--json` 后返回路径、名称、节点数和连接数。`host validate` 会进一步检查宿主执行要求。

`run` 用于内置 Fake provider 演示，`--no-delay` 去掉模拟等待，`--json` 输出运行记录、事件和产物。使用编程 agent 会话完成真实工作时，采用 `host` 任务协议；使用配置的服务商执行时，采用桌面应用。
