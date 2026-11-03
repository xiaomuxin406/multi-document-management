import json
import re
import math
from typing import Protocol
import httpx


class ProviderError(RuntimeError):
    pass


class LanguageModel(Protocol):
    def complete(
        self, system: str, payload: dict, json_output: bool = False
    ) -> str: ...


class SearchProvider(Protocol):
    def search(self, query: str, limit: int = 5) -> list[dict]: ...


class OpenAICompatible:
    def __init__(
        self,
        base_url,
        model,
        key,
        transport=None,
        *,
        timeout_seconds=90,
        enable_thinking=None,
    ):
        self.base_url, self.model, self.key = base_url.rstrip("/"), model, key
        self.transport = transport
        self.timeout_seconds, self.enable_thinking = timeout_seconds, enable_thinking

    def complete(self, system, payload, json_output=False):
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            "temperature": 0.2,
            "max_tokens": 4500,
        }
        if json_output:
            body["response_format"] = {"type": "json_object"}
        if self.enable_thinking is not None:
            body["enable_thinking"] = self.enable_thinking
        try:
            with httpx.Client(
                timeout=httpx.Timeout(self.timeout_seconds, connect=15),
                transport=self.transport,
                follow_redirects=False,
            ) as client:
                response = client.post(
                    self.base_url + "/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json=body,
                )
                response.raise_for_status()
                choice = response.json()["choices"][0]
                if choice.get("finish_reason") == "length":
                    raise ProviderError(
                        "模型达到输出上限，结果可能被截断；请关闭供应商支持的思考模式或更换适合该任务的模型后重试"
                    )
                content = choice["message"]["content"]
                if not isinstance(content, str) or not content.strip():
                    raise ValueError("empty completion")
                return content
        except httpx.HTTPStatusError as error:
            raise ProviderError(
                f"模型 API 返回 HTTP {error.response.status_code}，请检查模型名称、地址、额度和密钥"
            ) from None
        except httpx.TimeoutException:
            raise ProviderError(
                f"模型请求超时（读取等待上限 {self.timeout_seconds:g} 秒）；"
                "可在 .env 调整 LLM_TIMEOUT_SECONDS，或关闭供应商支持的思考模式、切换更快模型后重试"
            ) from None
        except httpx.HTTPError:
            raise ProviderError(
                "模型网络连接失败，请检查网络、代理和供应商服务后重试"
            ) from None
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise ProviderError(
                "模型响应格式无效或正文为空，请检查接口是否返回兼容 OpenAI 的 choices/message/content"
            ) from None


def read_json(text):
    try:
        parsed = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip()))
        if not isinstance(parsed, dict):
            raise ValueError()
        return parsed
    except (ValueError, TypeError):
        raise ProviderError("模型未返回有效 JSON，任务可重试") from None


class TavilySearch:
    def __init__(self, key, transport=None):
        self.key, self.transport = key, transport

    def search(self, query, limit=5):
        try:
            with httpx.Client(
                timeout=30, transport=self.transport, follow_redirects=False
            ) as client:
                response = client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.key,
                        "query": query[:500],
                        "max_results": limit,
                        "search_depth": "basic",
                        "include_answer": False,
                        "include_raw_content": False,
                    },
                )
                response.raise_for_status()
                results = response.json()["results"]
                if not isinstance(results, list):
                    raise ValueError()
                return [
                    dict(
                        title=str(r.get("title", "Web source"))[:300],
                        text=str(r.get("content", ""))[:4000],
                        url=str(r["url"]),
                        location="网页搜索片段 · 未抓取全文",
                        source_type="web",
                        document_id=None,
                        score=float(r.get("score", 0)),
                    )
                    for r in results[:limit]
                    if isinstance(r, dict)
                    and str(r.get("url", "")).startswith(("https://", "http://"))
                    and r.get("content")
                ]
        except httpx.HTTPStatusError as error:
            raise ProviderError(
                f"联网搜索返回 HTTP {error.response.status_code}，请检查 Tavily 密钥或额度"
            ) from None
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise ProviderError(
                "联网搜索失败或响应无效，请检查网络与搜索配置"
            ) from None


class OpenAIEmbeddings:
    """Optional semantic provider. Separate index namespace prevents vector mixing."""

    def __init__(self, base_url, model, key, transport=None):
        self.base_url, self.model, self.key = base_url.rstrip("/"), model, key
        self.transport = transport

    def embed(self, texts):
        try:
            with httpx.Client(
                timeout=60, transport=self.transport, follow_redirects=False
            ) as client:
                response = client.post(
                    self.base_url + "/embeddings",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json={"model": self.model, "input": texts},
                )
                response.raise_for_status()
                data = sorted(response.json()["data"], key=lambda item: item["index"])
                if [item["index"] for item in data] != list(range(len(texts))):
                    raise ValueError()
                vectors = [item["embedding"] for item in data]
                dimensions = len(vectors[0])
                if not dimensions or any(
                    len(v) != dimensions
                    or not all(
                        isinstance(n, (int, float)) and math.isfinite(n) for n in v
                    )
                    for v in vectors
                ):
                    raise ValueError()
                return vectors
        except httpx.HTTPStatusError as error:
            raise ProviderError(
                f"Embedding API 返回 HTTP {error.response.status_code}。"
                "请检查 EMBEDDING_MODEL 是否为供应商支持的嵌入模型（不能使用对话模型），"
                "以及 EMBEDDING_BASE_URL、密钥、输入长度和批量限制。"
                "如需先恢复本地检索，请在 .env 设置 EMBEDDING_MODEL= 并重启后端；"
                "这不会关闭模型生成或 Tavily 联网搜索。"
            ) from None
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            raise ProviderError("Embedding API 响应无效或网络请求失败") from None
