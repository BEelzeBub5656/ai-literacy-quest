# 项目记忆：知芽校园 (Zhiya Campus)

- 技术栈：React Native + Expo（移动端）/ FastAPI（后端）/ LangChain/Mock/DeepSeek。
- 后端 AI 接口：`POST /api/v1/ai/study-chat/stream`（SSE，纯 Markdown 流式：reasoning_delta + answer_delta）、`/study-chat`（结构化 JSON 合同）、`/knowledge-card`、`/status`。
- 移动端别名 `@/*` → `apps/mobile/*`（见 tsconfig paths）。
- 新增 expo 路由文件（app/x.tsx）后，必须跑一次 `expo start` 重新生成 `.expo/types/router.d.ts`，否则 `router.push('/x')` 类型检查失败。
- 端口坑：`dev.bat` 后端在 8010，移动端默认 apiBase 是 8000；联调时统一或设 `EXPO_PUBLIC_API_BASE_URL`。
