# AI 问答聊天组件（demo）— 概览

参考 `https://ai.explore.poker/chat`，在「知芽校园」移动端新增了一个**模块化、可复用的 AI 聊天界面**。
目前挂在「伴学」Tab 下的「通用问答」按钮进入，之后可复用到 web 端。

## 做了什么

### 后端（apps/api）
- `ai_companion/schemas.py`：`StudyChatRequest` 新增可选 `model` 字段。
- `ai_companion/service.py`：`stream_chat_events` 把 `request.model` 透传到 `AICompletionRequest`，
  `meta` 事件里的 `model` 反映传入值；缺省时回退 `deterministic-demo`。
- 复用现有 `POST /api/v1/ai/study-chat/stream` —— 它本就是纯 Markdown 流式聊天（reasoning + answer），很契合通用聊天场景，**未改动结构化输出逻辑**。

### 前端（apps/mobile/src/features/chat/，全新模块化组件）
- `api.ts`：自包含 SSE 客户端（调 `/study-chat/stream`，带 `model` 参数），不耦合伴学模块。
- `useChat.ts`：状态机 hook（发送 / 中断 AbortController / 新对话重置）。
- `MessageMarkdown.tsx`：**零依赖** Markdown 渲染（标题/列表/代码块/引用/粗斜体/行内代码），只用 RN 原语，web 端后续可直接复用。
- `MessageBubble.tsx`：气泡；assistant 渲染流式 Markdown + 可折叠「思考过程」面板。
- `ModelPicker.tsx`：顶部模型选择，仿参考站「可用 / 升级解锁 / BYOK」分层（locked 项仅占位）。
- `ChatInput.tsx`：输入框 + 发送 / 停止。
- `ChatScreen.tsx`：顶栏（返回 / 模型选择 / 新对话）+ 消息列表 + 输入区。

### 挂载
- `app/chat.tsx`：新路由，渲染 `ChatScreen`，并在根 `_layout.tsx` 的 Stack 注册。
- `companion` 页新增「通用问答」入口按钮 → `router.push('/chat')`。

## 验证结果
- 后端：`uv run pytest` **9 passed**（含 3 个 model 透传单测），无回归。
- 前端：`npm run typecheck`（tsc --noEmit）**0 errors**。
- ⚠️ RN 界面渲染需在真机/模拟器跑 `expo start` 才能冒烟，本环境无法渲染 UI。

## 如何本地跑起来看效果
1. 后端（默认 8000，与移动端 apiBase 一致）：
   ```bash
   cd apps/api && uv run uvicorn campus_ai.main:app --reload --port 8000
   ```
2. 移动端（保持 Mock 即可无密钥启动）：
   ```bash
   cd apps/mobile && npm run start
   ```
   打开 App → 「伴学」Tab → 右上「通用问答」→ 选模型 → 发消息。
   （若用 `dev.bat` 起后端在 8010，请设 `EXPO_PUBLIC_API_BASE_URL=http://localhost:8010/api/v1`。）

## 已知边界（demo 范围，已和你确认）
- 模型选择目前是 **UI 层**：`free` 项会把 `id` 作为 `model` 透传给后端；`locked`/`byok` 仅为视觉占位，真实多模型路由 + BYOK 需后续后端改造。
- `study-chat/stream` 仍走服务端已配置的 Provider；非 DeepSeek 模型若不满足 JSON 合同会走现有错误兜底。
- Markdown 是轻量子集渲染，非完整 CommonMark。
