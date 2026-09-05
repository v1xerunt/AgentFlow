<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/agentflow-wordmark-panel.svg">
    <img src="docs/assets/brand/agentflow-wordmark-transparent.png" alt="AgentFlow" width="440">
  </picture>
  <h1>AgentFlow</h1>
  <p><strong>Visual Multi-Agent Workflows for LLMs &amp; Coding Agents</strong></p>
  <p>Connect models, give each Agent a role, and turn their conversations into files you can use.</p>
  <p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
  <p><a href="#features">Features</a> · <a href="#get-started">Get started</a> · <a href="#ai-native-skill">AI-native skill</a> · <a href="docs/cli.md">CLI docs</a> · <a href="#connect-your-models">Model connections</a></p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License: AGPL-3.0-only"></a>
</div>

AgentFlow brings model APIs and local coding agents together in a desktop workspace. Build a workflow on the canvas, ask one Agent to review another's work, and collect the results in your own project folders.

![AgentFlow canvas with a customer-feedback workflow](docs/assets/screenshots/flow-en.png)

## Features

- **Design how Agents work together.** Connect steps with Pass, Review, Revise and Merge. Run independent branches in parallel and follow responses as they arrive.
- **Choose a model for each role.** Combine your preferred LLMs with coding agents such as Codex and Claude Code in one workflow.
- **Chat with any Agent.** Double-click a node to open its conversation, ask follow-up questions and refine its work.
- **Describe a task to create a Flow.** Review the suggested workflow before applying it. Use prompt autofill to write each Agent's instructions and lock the parts you want to keep.
- **Bring your files.** Add text, PDFs, Word documents, CSVs and supported images. Choose what each downstream Agent can see, read Markdown results and reuse output files.
- **Save useful Agents.** Keep roles, prompts and model settings in your Agent library for the next task.
- **Work in your own folders.** Organize multiple Flows in a Project, with conversations and results saved locally. Choose English, Chinese or your system language.

## Put it to work

| Task | Example workflow |
| --- | --- |
| Writing and editing | Draft → independent review → revision |
| Comparing ideas | Parallel specialist opinions → combined recommendation |
| Reporting | Source documents → analysis → report |
| Working with data | Coding agent processes a CSV → writing Agent prepares a brief |

Every Agent has its own model, instructions and conversation. You can inspect the work at each step and decide what to pass onward.

## Get started

Open [GitHub Releases](https://github.com/v1xerunt/AgentFlow/releases) and download the installer for your computer. The desktop app includes its own runtime. The independently installed [Skill](#ai-native-skill) uses the coding agent's Node environment or a private runtime prepared during setup.

| Your computer | Download | Install |
| --- | --- | --- |
| Windows x64 | `AgentFlow-<version>-windows-x64-setup.exe` | Run the setup wizard |
| Mac with an Apple M-series chip, macOS 13+ | `AgentFlow-<version>-mac-mchip-arm64.dmg` | Drag AgentFlow into Applications |
| Linux x64 | `AgentFlow-<version>-linux-x64.AppImage` | Make executable, then open |
| Debian / Ubuntu x64 | `AgentFlow-<version>-linux-x64.deb` | Open with the system package installer |

The Mac ZIP is used by automatic updates. The `.yml` and `.blockmap` files are update metadata; choose the installer listed above to get started.

After installation:

1. **Try the guided tutorial.** Follow a customer-feedback workflow through to a weekly brief. Its prepared demo responses let you explore without an API key.
2. **Connect a model.** Open Settings and add a model API, connect an account or configure a local Agent tool.
3. **Create a Project.** Add your input files and Agents, then connect their roles. You can also describe your task to generate a Flow.
4. **Run and refine.** Watch the workflow progress, double-click an Agent to continue its conversation, and open the resulting files.

### Updates

Open **Settings → App updates** to see your version, check for updates, and control automatic checking and downloads. Both switches are enabled by default. The app checks once after startup; downloaded updates install when you exit, after your work is saved. You can also choose **Quit and install update** once a download is ready.

Automatic installation is available for Windows installers, Linux AppImages, and signed macOS builds. Other builds provide a link to Releases for manual installation. Only published releases with matching update metadata are offered; drafts are not available to the updater.

### Run from source

Install [Node.js](https://nodejs.org/) **22.13 or newer**, then run these commands from the repository folder:

```sh
npm ci
npm run dev
```

## AI-native skill

The [AgentFlow skill](skills/agentflow/SKILL.md) brings Flow creation and execution into Codex and Claude Code. Describe the outcome, and your coding agent builds the graph and runs each role with its current model and tools:

> Analyze these customer comments, review the evidence, and turn the findings into an action plan. Generate and run the Flow, and show me an editable panel.

- **From intent to Flow.** The skill teaches the agent the graph format and relation semantics so it can generate explicit roles, prompts, and dependencies from your request.
- **Use your current agent session.** Each role inherits the host's model and tools, with no additional provider setup. Native subagents can handle separate roles when available; sequential execution works in a single session.
- **Inspect and resume execution.** The JSON CLI validates the Flow, hands off ready tasks, and saves completed outputs with their source dependencies. Interrupted work can continue from its saved state.
- **Edit through conversation or a panel.** Ask the agent to change the Flow, or edit goals, inputs, prompts, and relation labels in an offline HTML panel. Export the graph to start a new run.

Ask your coding agent: **“Install the Skill from https://github.com/v1xerunt/AgentFlow.”** The [installation procedure](skills/agentflow/references/installation.md) downloads the complete Skill at a pinned directory commit and configures Node automatically, using the host's runtime when available. The lightweight Skill supports Flow creation, execution, saved results and offline HTML panels. Download the desktop app for the full interactive editor.

To build from source after `npm ci`:

```sh
npm run skill:build
node scripts/install-skill.mjs --host both --project "/path/to/your/project"
```

Use `--host codex` or `--host claude` for one host, or `--user` instead of `--project` for a personal installation. Existing installations are preserved. `skills/agentflow` contains the matched CLI and licenses. Its setup scripts configure Node.js 22.13+ and record the executable path without changing system PATH. See [CLI setup](docs/cli.md#build-and-install).

Each Skill task checks once for changes to `skills/agentflow` on `main`. When an update is available, it provides an update command; an offline check silently continues with the local version. Updating the Skill replaces its instructions and matching CLI together while preserving configuration. Desktop and Skill versions are managed independently.

In your project, invoke `$agentflow` in Codex or `/agentflow` in Claude Code, followed by your task. The skill guides the CLI calls, and the host performs the reasoning and tool use. For direct CLI use, start with the [walkthrough](docs/cli.md#run-a-flow-with-the-host-agent).

### Instructions for LLMs

You can ask your coding agent:

> Read https://github.com/v1xerunt/AgentFlow/tree/main and install the AgentFlow skill for this project. Follow the README's Instructions for LLMs.

When the user requests installation:

1. Read [installation and runtime setup](skills/agentflow/references/installation.md). Resolve the latest commit affecting `skills/agentflow` on `main`, then download that complete directory at the pinned SHA.
2. Install for the current host and requested project; otherwise use its personal Skill location. Run `scripts/setup.ps1` on Windows or `scripts/setup.sh` on macOS/Linux with the SHA. Pass the host's Node path when available; otherwise setup detects or provisions Node in a private user directory.
3. Report success after the setup command validates the example with `valid: true`, including the installed SHA, runtime, Skill location and `$agentflow` / `/agentflow` invocation. Skill updates use its own update command; offer the desktop editor as a separate download.

Installation uses the host's documented [Codex skill directories](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills) or [Claude Code skill directories](https://code.claude.com/docs/en/skills#where-skills-live).

## Connect your models

Configure these connections in the desktop app when you want to choose providers and models for individual roles:

| Connection | Choices |
| --- | --- |
| Model APIs | OpenAI, Anthropic, Google Gemini, DeepSeek, Z.AI, Z.AI GLM Coding Plan, Kimi / Moonshot, OpenRouter |
| Custom endpoints | OpenAI-compatible, Anthropic and Gemini APIs |
| Local Agent tools | Codex, Claude Code, Kimi Code, Antigravity, DeepSeek Harness |
| Account connections | ChatGPT / Codex, Claude Code, Kimi, Gemini / Antigravity |
| Experimental connection | DeepSeek Web Bridge |

Use your own API keys or supported accounts. API access and subscription access are configured separately and follow the provider's account and usage requirements. Local Agent tools use their own installation and permissions.

Your project stays in your folders. When you run a connected model, selected prompts and files are sent to that provider or Agent tool. On Linux, saving API credentials requires an available system keyring.

## Documentation

- [CLI guide](docs/cli.md): setup, host execution, JSON responses, recovery, panels, and demo commands.
- [Flow specification](skills/agentflow/references/flow-spec.md): graph structure, relation semantics, and supported host inputs.
- [AgentFlow skill](skills/agentflow/SKILL.md): the instructions used by coding agents to generate and execute Flows.

## License

AgentFlow is open source under the [GNU AGPLv3](LICENSE). Third-party components retain their [respective licenses](THIRD_PARTY_NOTICES.md).
