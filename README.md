# 知芽校园 · AI 通识教育 App

中小学人工智能通识教育移动端应用 —— 数智创意竞赛作品。

以「AI 伴学 + 知识卡片」为核心，学生通过与 AI 助手连续对话学习 AI 基础概念，选中任意文本即可生成可继续探索的结构化知识卡片。

## 产品定位

- **面向学生**：移动端 AI 伴学对话 + 知识卡片生长
- **核心理念**：不教代码，让学生「体验、理解、探究」AI 基本原理
- **差异化**：不是录播课 + 测评，而是让 AI 本身成为教具

## 技术栈

| 层级 | 技术 |
|---|---|
| 移动端 | React Native + Expo |
| 后端 | FastAPI + Pydantic + SQLAlchemy + SQLite |
| AI | LangChain 编排 / Mock + LongCat + DeepSeek Provider |
| 结构化输出 | 自研 JSON Schema 合同 + 多轮重试 |

## 目录

```
apps/
├─ api/    FastAPI 后端（AI 伴学服务 + 知识卡片生成）
└─ mobile/ React Native + Expo App
```

## 本地启动

### 1. 配置

复制 `.env.example` 为 `.env`。默认使用 Mock Provider，无需任何密钥即可启动。若复用本机已有 DeepSeek 配置，可设置 `AI_PROVIDER=deepseek` 与 `DEEPSEEK_ENV_FILE=已有 .env 的绝对路径`，无需复制密钥。

### 2. 后端

```powershell
cd apps/api
uv sync --dev
uv run uvicorn campus_ai.main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

### 3. 移动端

```powershell
cd apps/mobile
npm install
npm run start
```

## 核心 API

| 接口 | 说明 |
|---|---|
| `POST /api/v1/ai/study-chat` | 结构化伴学对话（返回推理步骤 + 关键词） |
| `POST /api/v1/ai/study-chat/stream` | DeepSeek 推理与正文分离的流式伴学对话（SSE） |
| `POST /api/v1/ai/knowledge-card` | 选中文本生成知识卡片 |
| `GET /api/v1/ai/status` | AI Provider 状态 |

## 测试

```powershell
cd apps/api
uv run pytest
```
