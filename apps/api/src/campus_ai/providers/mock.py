import json

from campus_ai.providers.base import AICompletion, AICompletionRequest, AIProvider


class MockAIProvider(AIProvider):
    name = "mock"

    @property
    def configured(self) -> bool:
        return True

    async def complete(self, request: AICompletionRequest) -> AICompletion:
        output_kind = next(
            (
                message.content.split("\n", 1)[0].split("=", 1)[1]
                for message in request.messages
                if message.content.startswith("CAMPUS_OUTPUT_KIND=")
            ),
            None,
        )
        if output_kind == "study_chat":
            return AICompletion(
                provider=self.name,
                model="deterministic-demo",
                content=json.dumps(_mock_study_chat(), ensure_ascii=False),
            )
        if output_kind == "knowledge_card":
            selected_text = _extract_selected_text(request)
            return AICompletion(
                provider=self.name,
                model="deterministic-demo",
                content=json.dumps(_mock_knowledge_card(selected_text), ensure_ascii=False),
            )
        if output_kind == "stream_keywords":
            return AICompletion(
                provider=self.name,
                model="deterministic-demo",
                content=json.dumps(
                    {
                        "keywords": [
                            {
                                "text": "Agent",
                                "normalized_text": "agent",
                                "importance": 3,
                            },
                            {
                                "text": "工具调用",
                                "normalized_text": "tool-calling",
                                "importance": 2,
                            },
                        ]
                    },
                    ensure_ascii=False,
                ),
            )

        prompt = request.messages[-1].content
        summary = prompt.strip().replace("\n", " ")[:72]
        content = (
            f"已收到你的探索目标：“{summary}”。"
            "建议先建立核心概念卡，再分别沿“深入理解”“关联比较”和“问题分支”三个方向生长。"
            "完成每个节点后，用一句自己的话复述，系统会据此更新思维锚点。"
        )
        return AICompletion(provider=self.name, model="deterministic-demo", content=content)


def _extract_selected_text(request: AICompletionRequest) -> str:
    for message in reversed(request.messages):
        if "选中文本：" in message.content:
            return message.content.split("选中文本：", 1)[1].split("\n", 1)[0].strip()
    return "当前知识点"


def _mock_study_chat() -> dict:
    return {
        "schema_version": "1.0",
        "answer_markdown": (
            "Agent 会根据当前目标和上下文决定下一步，并通过 Tool 执行具体动作；"
            "Skill 则沉淀完成某类任务的稳定方法。工程上可以先用结构化输出固定边界，"
            "再用 Middleware 统一处理权限、重试和审计。"
        ),
        "reasoning_summary": "从决策、执行和治理三个层次组织概念，帮助建立 Agent 工程全貌。",
        "reasoning_steps": [
            {
                "step": 1,
                "title": "识别决策主体",
                "explanation": "Agent 负责结合目标与上下文决定下一步行动。",
                "based_on": ["message:latest-user"],
            },
            {
                "step": 2,
                "title": "区分能力与方法",
                "explanation": "Tool 提供可执行能力，Skill 描述完成任务的可复用流程。",
                "based_on": ["concept:tool-skill"],
            },
            {
                "step": 3,
                "title": "补充工程治理",
                "explanation": "Middleware 把权限、重试、日志等横切规则统一放入执行链。",
                "based_on": ["concept:middleware"],
            },
        ],
        "assumptions": ["学习者已经了解基础的大模型对话"],
        "uncertainties": [],
        "keywords": [
            {
                "text": "Agent",
                "normalized_text": "agent",
                "definition": "能够根据目标和上下文选择行动的运行主体",
                "selection_reason": "它是当前知识体系的决策核心",
                "confidence": 0.98,
            },
            {
                "text": "Tool",
                "normalized_text": "tool",
                "definition": "供 Agent 调用的确定性外部能力",
                "selection_reason": "它解释了模型如何对外执行动作",
                "confidence": 0.95,
            },
            {
                "text": "Middleware",
                "normalized_text": "middleware",
                "definition": "介入模型和工具调用过程的统一治理机制",
                "selection_reason": "它连接可靠性、安全和可观测性",
                "confidence": 0.93,
            },
        ],
        "follow_up_questions": ["你想先深入 Tool、Skill，还是 Middleware？"],
    }


def _mock_knowledge_card(selected_text: str) -> dict:
    focus = selected_text[:10] or "当前知识点"
    return {
        "schema_version": "1.0",
        "title": f"理解 {focus}",
        "plain_explanation": (
            f"“{focus}”可以放回 Agent 的决策、执行和反馈循环中理解。"
            "先明确它解决的问题，再观察它与上下游组件如何交换结构化信息。"
        ),
        "reasoning_summary": "从来源语境、核心职责和相邻概念三步形成可继续生长的理解。",
        "reasoning_steps": [
            {
                "step": 1,
                "title": "回到来源语境",
                "explanation": f"选区“{focus}”来自当前对话，应先保留原问题的目标。",
                "based_on": ["message:source"],
            },
            {
                "step": 2,
                "title": "提炼核心职责",
                "explanation": "用一句可验证的话说明它在系统中负责什么。",
                "based_on": ["message:source"],
            },
            {
                "step": 3,
                "title": "连接相邻概念",
                "explanation": "通过输入、输出和约束找到可以继续探索的概念。",
                "based_on": ["concept:relationship"],
            },
        ],
        "key_points": ["来源语境", "核心职责", "上下游关系"],
        "keywords": [
            {
                "text": "结构化输出",
                "normalized_text": "structured-output",
                "definition": "按照明确 Schema 交付的模型结果",
                "selection_reason": "便于卡片内容被程序验证和复用",
                "confidence": 0.96,
            },
            {
                "text": "上下文",
                "normalized_text": "context",
                "definition": "当前解释所依赖的消息、资料和状态",
                "selection_reason": "它决定当前知识点的具体含义",
                "confidence": 0.91,
            },
            {
                "text": "知识 DAG",
                "normalized_text": "knowledge-dag",
                "definition": "用有向无环关系保存知识生长路径的结构",
                "selection_reason": "它承载卡片之间可追溯的父子关系",
                "confidence": 0.94,
            },
        ],
        "assumptions": ["当前卡片用于 Agent 工程学习"],
        "uncertainties": [],
    }
