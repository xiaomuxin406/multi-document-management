from app.services.classification import classify_document


def test_bilingual_classification_returns_topics_and_language():
    zh = classify_document(
        "检索设计.md", "本方案使用向量检索和证据评估，限制 Agent 检索轮数。"
    )
    assert zh["category"] == "技术资料"
    assert "RAG / 检索" in zh["tags"]
    assert zh["language"] == "zh"
    en = classify_document(
        "paper.md",
        "Literature review of retrieval augmented generation with evaluation benchmarks.",
    )
    assert en["category"] == "文献资料"
    assert en["language"] == "en"
