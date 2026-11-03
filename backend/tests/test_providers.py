import json
import httpx
import pytest
from app.services.providers import (
    OpenAICompatible,
    OpenAIEmbeddings,
    TavilySearch,
    ProviderError,
)


def test_openai_compatible_sends_model_and_evidence_and_extracts_content():
    def handle(request):
        body = json.loads(request.content)
        assert request.url.path == "/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-secret"
        assert body["model"] == "custom-model"
        assert "enable_thinking" not in body
        assert "[E1]" in body["messages"][1]["content"]
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Supported statement [E1]"}}]},
        )

    provider = OpenAICompatible(
        "https://model.example/v1",
        "custom-model",
        "test-secret",
        httpx.MockTransport(handle),
    )
    assert (
        provider.complete("Use evidence", {"evidence": "[E1] text"})
        == "Supported statement [E1]"
    )


def test_provider_error_does_not_expose_remote_body_or_credentials():
    provider = OpenAICompatible(
        "https://model.example/v1",
        "model",
        "private-secret",
        httpx.MockTransport(lambda request: httpx.Response(401, text="private-secret")),
    )
    with pytest.raises(ProviderError) as error:
        provider.complete("system", {})
    assert "401" in str(error.value)
    assert "private-secret" not in str(error.value)


def test_optional_thinking_flag_and_read_timeout_reach_provider():
    def handle(request):
        assert json.loads(request.content)["enable_thinking"] is False
        assert request.extensions["timeout"]["read"] == 180
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    provider = OpenAICompatible(
        "https://model.example/v1",
        "model",
        "secret",
        httpx.MockTransport(handle),
        timeout_seconds=180,
        enable_thinking=False,
    )
    assert provider.complete("system", {}, True) == "{}"


def test_model_read_timeout_is_distinct_from_invalid_response():
    def handle(request):
        raise httpx.ReadTimeout("private-secret", request=request)

    provider = OpenAICompatible(
        "https://model.example/v1",
        "model",
        "private-secret",
        httpx.MockTransport(handle),
    )
    with pytest.raises(ProviderError) as error:
        provider.complete("system", {})
    assert "超时" in str(error.value)
    assert "LLM_TIMEOUT_SECONDS" in str(error.value)
    assert "private-secret" not in str(error.value)


def test_model_token_exhaustion_is_reported_before_json_parsing():
    provider = OpenAICompatible(
        "https://model.example/v1",
        "model",
        "secret",
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "finish_reason": "length",
                            "message": {
                                "content": "",
                                "reasoning_content": "private reasoning",
                            },
                        }
                    ]
                },
            )
        ),
    )
    with pytest.raises(ProviderError) as error:
        provider.complete("system", {}, True)
    assert "输出上限" in str(error.value)
    assert "private reasoning" not in str(error.value)


def test_tavily_marks_results_as_search_snippets_and_filters_unsafe_urls():
    search = TavilySearch(
        "secret",
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "title": "Research",
                            "url": "https://example.org/paper",
                            "content": "Evidence",
                            "score": 0.9,
                        },
                        {
                            "title": "Bad",
                            "url": "javascript:alert(1)",
                            "content": "bad",
                            "score": 1,
                        },
                    ]
                },
            )
        ),
    )
    results = search.search("研究 research")
    assert len(results) == 1
    assert results[0]["source_type"] == "web"
    assert "未抓取全文" in results[0]["location"]


def test_embeddings_restore_input_order_and_reject_missing_vectors():
    provider = OpenAIEmbeddings(
        "https://model.example/v1",
        "multilingual",
        "secret",
        httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "data": [
                        {"index": 1, "embedding": [0.0, 1.0]},
                        {"index": 0, "embedding": [1.0, 0.0]},
                    ]
                },
            )
        ),
    )
    assert provider.embed(["中文", "English"]) == [[1.0, 0.0], [0.0, 1.0]]
    with pytest.raises(ProviderError):
        provider.embed(["one"])


def test_embedding_rejection_explains_recovery_without_exposing_remote_secrets():
    provider = OpenAIEmbeddings(
        "https://model.example/v1",
        "chat-model",
        "private-secret",
        httpx.MockTransport(
            lambda request: httpx.Response(
                400, json={"message": "Model does not exist. private-secret"}
            )
        ),
    )
    with pytest.raises(ProviderError) as error:
        provider.embed(["中文 English"])
    message = str(error.value)
    assert "400" in message
    assert "EMBEDDING_MODEL" in message
    assert "重启" in message
    assert "private-secret" not in message
