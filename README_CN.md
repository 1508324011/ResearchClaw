<p align="center">
  <img src="assets/icon.png" width="160" alt="ResearchClaw Logo">
</p>

<h1 align="center">ResearchClaw</h1>

<p align="center">
  <strong>面向桌面与单用户 Web 工作流的 AI 科研工作台</strong>
</p>

<p align="center">
  ResearchClaw 保留原始 Electron 桌面应用，同时新增了一个 server-first、Docker-first 的浏览器运行时，用于导入、文献库、搜索、阅读和笔记。
</p>

<p align="center">
  <a href="https://github.com/Noietch/ResearchClaw/stargazers"><img src="https://img.shields.io/github/stars/Noietch/ResearchClaw?style=for-the-badge&logo=github" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Noietch/ResearchClaw/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome"></a>
</p>

---

## 什么是 ResearchClaw？

**ResearchClaw** 最初是一个面向科研工作者的 **Electron 桌面应用**。这个 fork 在保留原桌面应用的同时，继续把它扩展为一个 **server-first、单用户、Docker-first 的 Web 运行时**，让核心论文工作流也可以在浏览器中完成。

### 当前 fork 状态

- **桌面应用仍然可用**，保留原始 Electron 工作流。
- **Web 运行时已具备第一阶段能力**：文献库、浏览器导入工作区（arXiv / DOI / URL / PDF）、搜索、论文概览页、由服务端本地 PDF 支撑的阅读页、笔记页。
- **同源部署**：一个 Node 服务同时提供浏览器页面和 Web API。
- **Docker-first**：构建 `dist/web` + `dist/server/index.js` 后即可作为单服务运行。

## 界面截图

### 主界面

![Dashboard](assets/screenshot_01.png)

_今日 arXiv 论文，附带 AI 自动生成的分类标签（transformer、nlp、planning、instruction-following 等）_

### 阅读笔记

![Reading Cards](assets/screenshot_02.png)

_AI 驱动的阅读界面，支持结构化笔记卡片。_

### 项目与创意

![Projects](assets/screenshot_v3.png)

_将论文组织成项目，并生成 AI 驱动的研究创意。_

## 核心能力

| 模块             | 说明                                                                                      |
| :--------------- | :---------------------------------------------------------------------------------------- |
| **桌面应用**     | 保留原始 Electron 工作流，包括仪表盘、项目、聊天式阅读等完整桌面能力                      |
| **Web 文献库**   | 浏览器原生论文列表，后端接口为 `GET /papers`                                              |
| **Web 导入**     | 浏览器原生导入工作区，支持 arXiv / DOI / URL 标识符与直接 PDF 上传                        |
| **Web 概览页**   | 浏览器原生论文概览页 `/papers/:paperId`，展示元数据、摘要以及阅读/笔记/来源入口           |
| **Web 搜索**     | 同源文本/语义搜索，接口为 `GET /search`                                                   |
| **Web 阅读页**   | 浏览器原生、由服务端本地 PDF 支撑的阅读视图与最新笔记预览，接口为 `GET /reading/:paperId` |
| **Web 笔记页**   | 通过 `POST /reading/:paperId/notes` 保存结构化笔记摘要                                    |
| **后台任务 API** | 面向浏览器长任务的 job 列表、状态和 SSE 事件流                                            |
| **单用户运行时** | 以一位研究者为中心优化的 server-first + Docker 部署路径                                   |

## 环境要求

- macOS 12+（arm64 / x64）、Windows 10+（x64 / arm64）或 Linux（x64 / arm64）
- 建议 Node.js >= 20
- 建议 npm >= 10

## 快速开始

### 桌面开发（原始应用）

```bash
git clone https://github.com/Noietch/ResearchClaw.git
cd ResearchClaw
npm install

# Electron 桌面开发
npm run dev

# 桌面发行构建
npm run release:mac
npm run release:win
npm run release:linux
```

### Web 运行时（本 fork）

```bash
git clone https://github.com/Noietch/ResearchClaw.git
cd ResearchClaw
npm install

# 构建浏览器客户端 + Node 服务端运行时
npm run build:web

# 启动同源 Web 运行时
npm run start:web
```

启动后访问 `http://localhost:3456`。

### Docker-first 运行方式

```bash
docker compose -f docker-compose.web.yml up --build
```

该方式会在 `http://localhost:3456` 提供同一套单用户运行时，并把数据保存在命名卷 `researchclaw-web-data` 中。

## Web 运行时环境变量

| 变量                         | 默认值           | 用途                              |
| :--------------------------- | :--------------- | :-------------------------------- |
| `RESEARCH_CLAW_HOST`         | `0.0.0.0`        | Node HTTP 服务绑定地址            |
| `PORT`                       | `3456`           | 同源 Web 运行时端口               |
| `RESEARCH_CLAW_STORAGE_DIR`  | 平台默认存储目录 | SQLite 与导入论文文件的存储根目录 |
| `RESEARCH_CLAW_WEB_ROOT_DIR` | `dist/web`       | 浏览器构建产物目录                |

## 项目架构

```text
src/
  main/       # Electron 主进程、IPC 处理器、桌面专用工作流
  renderer/   # Electron 渲染层应用（Vite + React）
  server/     # Server-first Web 运行时、API 路由、静态页面服务
  web/        # 浏览器原生 Web UI 入口、路由与页面
  shared/     # 共享 contracts、提示词与浏览器安全工具
  db/         # Prisma + SQLite 数据层
prisma/       # schema.prisma
tests/        # 单元、前端与集成测试
scripts/      # Electron 与 Web 运行时构建脚本
dist/
  renderer/   # Electron 渲染层构建产物
  server/     # Web 运行时服务端 bundle（`dist/server/index.js`）
  web/        # 浏览器客户端构建产物（`dist/web`）
```

- **数据库**：SQLite via Prisma，路径为 `{RESEARCH_CLAW_STORAGE_DIR}/researchclaw.db`
- **AI**：Vercel AI SDK，支持 Anthropic、OpenAI、Gemini 以及 OpenAI 兼容提供商
- **构建**：esbuild（Node/Electron bundle）+ Vite（renderer 与浏览器 Web UI）

## Web 运行时说明

- 浏览器应用和 Web API 共享同一个 origin。
- `/search` 既是浏览器页面路由，也是 API 端点。当请求带有 `Accept: text/html` 时返回 SPA HTML；JSON/API 请求仍进入现有搜索接口。
- Phase 1 的浏览器工作流刻意保持精简：显式选择标识符类型（`arXiv`、`DOI`、`URL`）、直接上传 PDF、先进入 `/papers/:paperId` 概览页，再衔接到由服务端本地 PDF 支撑的阅读页，以及笔记页/来源链接。
- 当前 Docker/Web 运行时采用 **可靠性优先** 策略：它复用了现有服务图，因此仍会带上一些通过 `src/main/services` 间接引入的 Electron 邻接依赖。

## 许可证

[CC BY-NC 4.0](LICENSE) — 免费用于非商业用途，需注明来源，禁止商业使用。

## Star History

<a href="https://star-history.com/#Noietch/VibeResearch&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Noietch/VibeResearch&type=Date" width="100%" />
 </picture>
</a>

---

<p align="center">
  Built with ❤️ for the research community.
</p>
