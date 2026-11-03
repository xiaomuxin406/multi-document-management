import re

TOPICS = {
    "RAG / 检索": ("rag", "retrieval", "检索", "向量"),
    "Agent / 工作流": ("agent", "workflow", "langgraph", "工作流", "自主"),
    "评估与证据": ("evidence", "evaluation", "benchmark", "证据", "评估", "评测"),
    "成本与风险": ("risk", "cost", "limitation", "成本", "风险", "局限"),
}


def classify_document(name, text):
    """Transparent bilingual heuristic labels. Replace independently with an LLM classifier."""
    content = (name + " " + text[:12000]).lower()
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    english = len(re.findall(r"[a-zA-Z]", text))
    language = (
        "mixed"
        if chinese > 30 and english > 120
        else "zh"
        if chinese > english / 3
        else "en"
    )
    category = (
        "文献资料"
        if any(
            term in content
            for term in ("literature", "论文", "文献", "doi:", "abstract")
        )
        else "技术资料"
        if any(
            term in content
            for term in ("rag", "retrieval", "检索", "agent", "技术", "方案")
        )
        else "一般资料"
    )
    return {
        "category": category,
        "tags": [
            topic
            for topic, terms in TOPICS.items()
            if any(term in content for term in terms)
        ],
        "language": language,
        "classification_method": "bilingual_rules",
    }
