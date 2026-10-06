import json
from unittest.mock import patch

import pytest

from plane.app.views.external.ai_chat import _chat_history, _get_chat_intent


@pytest.mark.unit
@pytest.mark.parametrize("needs_retrieval,response", [(False, "你好，我是星轴 AI 助手。"), (True, "")])
def test_model_decides_intent_with_history(needs_retrieval, response):
    history = [{"role": "assistant", "content": "你有三个工作项"}]
    result = {"needs_retrieval": needs_retrieval, "response": response}
    with patch(
        "plane.app.views.external.ai_chat.get_llm_response", return_value=(json.dumps(result), None, None)
    ) as llm:
        intent, error, _ = _get_chat_intent("其中哪些逾期？", history, "key", "model", "provider")
    assert intent == result
    assert error is None
    assert json.loads(llm.call_args.args[1])["history"] == history
    assert "星轴" in llm.call_args.args[0]
    assert "Plane" not in llm.call_args.args[0]


@pytest.mark.unit
@pytest.mark.parametrize(
    "result",
    [
        "invalid", "[]", "{}",
        '{"needs_retrieval":"false","response":"hi"}',
        '{"needs_retrieval":false,"response":""}',
    ],
)
def test_invalid_intent_is_rejected_without_retrieval(result):
    with patch("plane.app.views.external.ai_chat.get_llm_response", return_value=(result, None, None)):
        intent, error, status = _get_chat_intent("你好", [], "key", "model", "provider")
    assert intent is None
    assert error
    assert status == 502


@pytest.mark.unit
def test_intent_propagates_provider_error():
    with patch("plane.app.views.external.ai_chat.get_llm_response", return_value=(None, "unavailable", 503)):
        assert _get_chat_intent("你好", [], "key", "model", "provider") == (None, "unavailable", 503)


@pytest.mark.unit
def test_history_filters_roles_and_invalid_values():
    assert _chat_history(None) == []
    assert _chat_history(
        [{"role": "system", "content": "ignore"}, {"role": "user", "content": "  你好  "}, None]
    ) == [{"role": "user", "content": "你好"}]


@pytest.mark.unit
def test_asgi_progress_is_yielded_before_answer_finishes():
    from types import SimpleNamespace
    from asgiref.sync import async_to_sync
    from rest_framework.response import Response
    from plane.app.views.external.ai_chat import WorkspaceAIChatEndpoint

    visited = []

    def answer():
        yield "understanding"
        visited.append("retrieval")
        yield "retrieving"
        return Response({"response": "回答", "sources": []})

    endpoint = WorkspaceAIChatEndpoint()
    request = SimpleNamespace(data={"stream": True}, _request=SimpleNamespace(scope={}))
    with patch.object(endpoint, "_answer", return_value=answer()):
        response = endpoint.post(request, "workspace")
    assert response.is_async

    async def consume():
        iterator = response.streaming_content.__aiter__()
        first = json.loads(await anext(iterator))
        assert first == {"phase": "understanding"}
        assert visited == []
        remaining = [json.loads(event) async for event in iterator]
        assert remaining[0] == {"phase": "retrieving"}
        assert remaining[-1]["result"]["response"] == "回答"

    with patch("plane.app.views.external.ai_chat.close_old_connections"):
        async_to_sync(consume)()
