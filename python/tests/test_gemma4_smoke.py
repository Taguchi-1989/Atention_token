"""Smoke test: verify gemma4:e4b responds via OllamaAdapter.

これらは実際の Ollama エンドポイント（gemma4:e4b）を叩くスモークテスト。
Ollama サーバーに接続できない環境（CI 等）では失敗ではなくスキップし、
ローカルにモデルがある時だけ実モデルに対して実行されるようにする。
"""
import httpx
import pytest
from attention_ledger.core.llm.adapter import OllamaAdapter

pytestmark = pytest.mark.ollama

# Ollama エンドポイントに到達できないときに投げられる接続系の例外。
# これらはテスト対象の不具合ではなく実行環境の都合なのでスキップする。
_CONNECTION_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout)


@pytest.mark.asyncio
async def test_gemma4_e4b_generate():
    adapter = OllamaAdapter(model="gemma4:e4b")
    try:
        resp = await adapter.generate(
            prompt='Return ONLY valid JSON: {"status": "ok"}',
            system_prompt="You are a JSON-only responder.",
        )
        assert resp.content, "Empty response from gemma4:e4b"
        assert resp.usage.total_tokens > 0, "No token usage reported"
        print(f"Response: {resp.content[:200]}")
        print(f"Tokens: {resp.usage}")
    except _CONNECTION_ERRORS as e:
        pytest.skip(f"Ollama エンドポイントに接続できないためスキップ: {e}")
    finally:
        await adapter.close()


@pytest.mark.asyncio
async def test_gemma4_e4b_agent_action():
    """Test that FirstTimeUserAgent can parse gemma4:e4b output."""
    from attention_ledger.core.agent.agent import FirstTimeUserAgent

    adapter = OllamaAdapter(model="gemma4:e4b")
    agent = FirstTimeUserAgent(adapter=adapter)
    try:
        action = await agent.decide_next_action(
            "A login page with username and password fields and a Login button."
        )
        assert action.action in ("click", "input", "search", "retry", "done")
        print(f"Action: {action.model_dump_json(indent=2)}")
    except _CONNECTION_ERRORS as e:
        pytest.skip(f"Ollama エンドポイントに接続できないためスキップ: {e}")
    finally:
        await adapter.close()
