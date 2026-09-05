module.exports = function releaseNotes({ version, commit, unsigned }) {
  const changes = version === '0.2.0' ? {
    zh: `### 本次更新

- **Skill 独立安装与更新**：自带配套 CLI，以 Skill 目录提交 SHA 管理版本，桌面应用和 Skill 各自更新。
- **自动准备 Node 运行时**：优先使用宿主或系统 Node；没有可用版本时，安装脚本下载并校验专用 Node 24 LTS，保持系统 PATH 不变。
- **每个任务检查一次更新**：有新版时提示更新入口，断网或超时继续使用本地版本。用户更新时一起替换 Skill 和 CLI，保留配置；下载或验证失败时保留旧版。
- **完善安装与发布流程**：更新中英文使用说明，精简重复 CI 构建，诊断截图按需生成。

`,
    en: `### What's new

- **Independent Skill installation and updates**: the Skill includes its paired CLI and uses its directory commit SHA as its version. Desktop and Skill updates are managed separately.
- **Automatic Node setup**: use the host or system Node when available; otherwise download and verify private Node 24 LTS, keeping system PATH unchanged.
- **One update check per task**: newer versions provide an update entry point; offline checks and timeouts continue with the local version. Explicit updates replace the Skill and CLI together while retaining configuration. Failed downloads or validation preserve the installed version.
- **Improved setup and releases**: refreshed English and Chinese instructions, fewer duplicate CI builds, and opt-in diagnostic screenshots.

`
  } : { zh: '', en: '' }
  return `# AgentFlow ${version}

## 中文

AgentFlow 传声筒：以图形化或 Skill 的方式自由搭建多 Agent 协作框架，让 AI 之间自由对话。

${changes.zh}### 下载与安装

| 系统 | 下载文件 | 安装方式 |
| --- | --- | --- |
| Windows x64 | \`AgentFlow-${version}-windows-x64-setup.exe\` | 双击安装 |
| macOS 13+，M 系列芯片 | \`AgentFlow-${version}-mac-mchip-arm64.dmg\` | 拖入应用程序 |
| Linux x64 | \`AgentFlow-${version}-linux-x64.AppImage\` | 赋予执行权限后运行 |
| Debian / Ubuntu x64 | \`AgentFlow-${version}-linux-x64.deb\` | 使用系统安装器 |

Mac ZIP、\`.yml\` 和 \`.blockmap\` 文件供自动更新使用，首次安装请选择上表文件。桌面应用自带运行时；外部 Agent 工具可能需要安装和账户权限。

${unsigned ? '本批构建使用未签名 Windows 包和 macOS 临时签名。确认下载可信后，Windows 可按提示选择“更多信息 → 仍要运行”；macOS 可在“系统设置 → 隐私与安全性”中选择“仍要打开”。受管理设备可能限制此操作。' : 'Windows 包已签名，macOS 包已使用 Developer ID 签名并完成 Apple 公证。'}

### Skill 与 CLI

向 Codex 或 Claude Code 提出：“安装 https://github.com/v1xerunt/AgentFlow 这个 Skill。”安装流程见[说明](https://github.com/v1xerunt/AgentFlow/blob/main/skills/agentflow/references/installation.md)。

\`AgentFlow-${version}-skill.tar.gz\` 包含 Skill、配套 CLI 和许可文件。安装脚本使用宿主或系统 Node.js 22.13+，或自动配置专用 Node 24 LTS。\`AgentFlow-${version}-cli.tar.gz\` 为独立 CLI，需要 Node.js 22.13+。

对应源码：\`AgentFlow-${version}-source.tar.gz\`。许可证：AGPL-3.0-only。下载校验见 \`SHA256SUMS.txt\`，构建信息见 \`BUILD_INFO.json\`。

## English

AgentFlow provides visual and Skill-based multi-agent workflows, letting AI agents exchange information and collaborate.

${changes.en}### Downloads and installation

| Platform | Download | Installation |
| --- | --- | --- |
| Windows x64 | \`AgentFlow-${version}-windows-x64-setup.exe\` | Run the installer |
| macOS 13+, M-series | \`AgentFlow-${version}-mac-mchip-arm64.dmg\` | Drag AgentFlow to Applications |
| Linux x64 | \`AgentFlow-${version}-linux-x64.AppImage\` | Make executable and run |
| Debian / Ubuntu x64 | \`AgentFlow-${version}-linux-x64.deb\` | Use the system package installer |

The Mac ZIP, \`.yml\` and \`.blockmap\` files support automatic updates; use an installer from the table for your first installation. The desktop application includes its own runtime. External Agent tools may need installation and account access.

${unsigned ? 'These builds use unsigned Windows packaging and ad-hoc macOS signing. For a trusted download, Windows may offer More info → Run anyway; macOS may offer System Settings → Privacy & Security → Open Anyway. Managed devices can restrict these options.' : 'Windows packages are code-signed. macOS packages use Developer ID signing and Apple notarization.'}

### Skill and CLI

Ask Codex or Claude Code: “Install the Skill from https://github.com/v1xerunt/AgentFlow.” Follow the [installation guide](https://github.com/v1xerunt/AgentFlow/blob/main/skills/agentflow/references/installation.md).

\`AgentFlow-${version}-skill.tar.gz\` contains the Skill, paired CLI and licenses. Setup uses host or system Node.js 22.13+, or provisions private Node 24 LTS. The standalone \`AgentFlow-${version}-cli.tar.gz\` archive requires Node.js 22.13+.

Corresponding source: \`AgentFlow-${version}-source.tar.gz\`. License: AGPL-3.0-only. Verify downloads with \`SHA256SUMS.txt\`; build details are in \`BUILD_INFO.json\`.

Commit: \`${commit}\`
`
}
