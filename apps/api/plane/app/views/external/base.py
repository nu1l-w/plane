# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python import
import os
from typing import List, Dict, Tuple

# Third party import
from openai import OpenAI
import requests

from rest_framework import status
from rest_framework.response import Response

# Module import
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ProjectLiteSerializer, WorkspaceLiteSerializer
from plane.db.models import Project, Workspace
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception

from ..base import BaseAPIView


class LLMProvider:
    """Base class for LLM provider configurations"""

    name: str = ""
    models: List[str] = []
    default_model: str = ""
    base_url: str | None = None

    @classmethod
    def get_config(cls) -> Dict[str, str | List[str]]:
        return {
            "name": cls.name,
            "models": cls.models,
            "default_model": cls.default_model,
        }


class OpenAIProvider(LLMProvider):
    name = "OpenAI"
    models = ["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o", "o1-mini", "o1-preview"]
    default_model = "gpt-4o-mini"


class DeepSeekProvider(LLMProvider):
    name = "DeepSeek"
    models = ["deepseek-flash", "deepseek-v4-pro"]
    default_model = "deepseek-flash"
    base_url = "https://api.deepseek.com"


class AnthropicProvider(LLMProvider):
    name = "Anthropic"
    models = [
        "claude-3-5-sonnet-20240620",
        "claude-3-haiku-20240307",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-2.1",
        "claude-2",
        "claude-instant-1.2",
        "claude-instant-1",
    ]
    default_model = "claude-3-sonnet-20240229"


class GeminiProvider(LLMProvider):
    name = "Gemini"
    models = ["gemini-pro", "gemini-1.5-pro-latest", "gemini-pro-vision"]
    default_model = "gemini-pro"


SUPPORTED_PROVIDERS = {
    "openai": OpenAIProvider,
    "deepseek": DeepSeekProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}


def get_llm_config() -> Tuple[str | None, str | None, str | None]:
    """
    Helper to get LLM configuration values, returns:
        - api_key, model, provider
    """
    api_key, provider_key, model = get_configuration_value(
        [
            {
                "key": "LLM_API_KEY",
                "default": os.environ.get("LLM_API_KEY", None),
            },
            {
                "key": "LLM_PROVIDER",
                "default": os.environ.get("LLM_PROVIDER", "openai"),
            },
            {
                "key": "LLM_MODEL",
                "default": os.environ.get("LLM_MODEL", None),
            },
        ]
    )

    provider = SUPPORTED_PROVIDERS.get(provider_key.lower())
    if not provider:
        log_exception(ValueError(f"Unsupported provider: {provider_key}"))
        return None, None, None

    if not api_key:
        log_exception(ValueError(f"Missing API key for provider: {provider.name}"))
        return None, None, None

    # If no model specified, use provider's default
    if not model:
        model = provider.default_model

    # Validate model is supported by provider
    if model not in provider.models:
        log_exception(
            ValueError(
                f"Model {model} not supported by {provider.name}. Supported models: {', '.join(provider.models)}"
            )
        )
        return None, None, None

    return api_key, model, provider_key


def get_llm_error(error: Exception) -> Tuple[str, int]:
    """Return a safe, actionable message for common provider errors."""
    error_name = error.__class__.__name__
    error_code = getattr(error, "code", None)
    error_type = getattr(error, "type", None)
    response_status = getattr(error, "status_code", None)
    details = f"{error_code or ''} {error_type or ''} {error}".lower()
    normalized_error_code = str(error_code or "").lower()
    normalized_error_type = str(error_type or "").lower()

    if (
        response_status == status.HTTP_402_PAYMENT_REQUIRED
        or normalized_error_code in {"credit_balance_exhausted", "insufficient_balance"}
        or normalized_error_type == "insufficient_quota"
        or "no credits remaining" in details
        or "insufficient balance" in details
    ):
        return (
            "AI 服务账户余额不足或已达到使用额度，请到服务商控制台检查余额和限额。",
            status.HTTP_402_PAYMENT_REQUIRED,
        )

    if error_name == "AuthenticationError" or response_status == status.HTTP_401_UNAUTHORIZED:
        return (
            "AI API 密钥无效或无权访问所选模型，请检查服务商和密钥配置。",
            status.HTTP_401_UNAUTHORIZED,
        )

    if error_name == "RateLimitError" or response_status == status.HTTP_429_TOO_MANY_REQUESTS:
        return (
            "AI 服务请求过于频繁，请稍后重试；如果持续发生，请检查服务商的限流设置。",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if response_status == status.HTTP_403_FORBIDDEN:
        return (
            "当前 API 密钥无权调用此模型，请检查模型权限或服务商账户状态。",
            status.HTTP_403_FORBIDDEN,
        )

    if response_status == status.HTTP_404_NOT_FOUND:
        return (
            "所选模型不存在或当前服务商暂不支持，请检查模型名称。",
            status.HTTP_400_BAD_REQUEST,
        )

    if response_status in {status.HTTP_400_BAD_REQUEST, 422}:
        return (
            "AI 服务无法处理此请求，请检查所选模型是否正确，以及输入内容是否过长。",
            status.HTTP_400_BAD_REQUEST,
        )

    if error_name in {"APIConnectionError", "APITimeoutError", "ConnectError", "Timeout"}:
        return "无法连接 AI 服务，请检查服务器网络后重试。", status.HTTP_503_SERVICE_UNAVAILABLE

    if response_status in {status.HTTP_500_INTERNAL_SERVER_ERROR, 502, status.HTTP_503_SERVICE_UNAVAILABLE}:
        return "AI 服务商暂时不可用，请稍后重试。", status.HTTP_503_SERVICE_UNAVAILABLE

    return (
        "AI 请求失败，请稍后重试；如果问题持续，请联系实例管理员查看服务端日志。",
        status.HTTP_502_BAD_GATEWAY,
    )


def get_llm_response(
    task, prompt, api_key: str, model: str, provider: str
) -> Tuple[str | None, str | None, int | None]:
    """Helper to get LLM completion response"""
    final_text = task + "\n" + prompt
    try:
        provider_config = SUPPORTED_PROVIDERS[provider.lower()]
        # For Gemini, prepend provider name to model
        if provider.lower() == "gemini":
            model = f"gemini/{model}"

        client_options = {"api_key": api_key}
        if provider_config.base_url:
            client_options["base_url"] = provider_config.base_url
        client = OpenAI(**client_options)
        chat_completion = client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": final_text}]
        )
        text = chat_completion.choices[0].message.content
        return text, None, None
    except Exception as error:
        log_exception(error)
        message, status_code = get_llm_error(error)
        return None, message, status_code


class GPTIntegrationEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        api_key, model, provider = get_llm_config()

        if not api_key or not model or not provider:
            return Response(
                {"error": "AI 配置不完整，请检查服务商、模型和 API 密钥。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error, error_status = get_llm_response(
            task, request.data.get("prompt", False), api_key, model, provider
        )
        if not text and error:
            return Response({"error": error}, status=error_status or status.HTTP_502_BAD_GATEWAY)

        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(pk=project_id)

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
                "project_detail": ProjectLiteSerializer(project).data,
                "workspace_detail": WorkspaceLiteSerializer(workspace).data,
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceGPTIntegrationEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        api_key, model, provider = get_llm_config()

        if not api_key or not model or not provider:
            return Response(
                {"error": "AI 配置不完整，请检查服务商、模型和 API 密钥。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error, error_status = get_llm_response(
            task, request.data.get("prompt", False), api_key, model, provider
        )
        if not text and error:
            return Response({"error": error}, status=error_status or status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
            },
            status=status.HTTP_200_OK,
        )


class UnsplashEndpoint(BaseAPIView):
    def get(self, request):
        (UNSPLASH_ACCESS_KEY,) = get_configuration_value(
            [
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY"),
                }
            ]
        )
        # Check unsplash access key
        if not UNSPLASH_ACCESS_KEY:
            return Response([], status=status.HTTP_200_OK)

        # Query parameters
        query = request.GET.get("query", False)
        page = request.GET.get("page", 1)
        per_page = request.GET.get("per_page", 20)

        url = (
            f"https://api.unsplash.com/search/photos/?client_id={UNSPLASH_ACCESS_KEY}&query={query}&page=${page}&per_page={per_page}"
            if query
            else f"https://api.unsplash.com/photos/?client_id={UNSPLASH_ACCESS_KEY}&page={page}&per_page={per_page}"
        )

        headers = {"Content-Type": "application/json"}

        resp = requests.get(url=url, headers=headers)
        return Response(resp.json(), status=resp.status_code)
