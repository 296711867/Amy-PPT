import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOpenAICompletions } from '@langchain/openai'
import log from 'electron-log/main.js'
import {
  buildOpenAIModelOptions,
  isOpenAIResponsesProvider,
  normalizeOpenAIBaseUrl,
  resolveOpenAIThinkingModelKwargs
} from './options'
import { CompatibleChatOpenAIResponses } from './responses-compat'
import {
  getCurrentModelTemperatureControl,
  isCurrentModelTemperatureEnabled,
  resolveCurrentModelThinkingParameterMode,
  resolveCurrentModelTemperatureOptions
} from './runtime'
import { ModelUsageCallbackHandler } from './usage'
import type { ModelRuntimeConfig } from './usage'

export function resolveModel(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string,
  temperature?: number,
  maxTokens?: number,
  runtime?: Pick<ModelRuntimeConfig, 'recorder'>
): BaseLanguageModel {
  const resolvedModel = model.trim()
  if (!resolvedModel) {
    throw new Error('model 不能为空，请先在系统设置中配置模型。')
  }
  const temperatureOptions = resolveCurrentModelTemperatureOptions(temperature)
  const resolvedTemperature = temperatureOptions.temperature
  const temperatureControl = getCurrentModelTemperatureControl()
  const thinkingParameterMode = resolveCurrentModelThinkingParameterMode()
  const resolvedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  const resolvedMaxTokens = maxTokens && maxTokens > 0 ? maxTokens : 4096
  const useOpenAIResponsesApi = isOpenAIResponsesProvider(provider)
  const isZhipuProvider = provider === 'zhipu'
  const isDeepSeekProvider = provider === 'deepseek'
  const openAIProtocol =
    provider === 'openai' || isZhipuProvider || isDeepSeekProvider
      ? 'chat-completions'
      : useOpenAIResponsesApi
        ? 'responses'
        : undefined
  const openAIThinkingModelKwargs =
    provider === 'openai' || provider === 'openai-responses'
      ? resolveOpenAIThinkingModelKwargs({
          baseUrl: normalizeOpenAIBaseUrl(resolvedBaseUrl, useOpenAIResponsesApi),
          useResponsesApi: useOpenAIResponsesApi,
          thinkingParameterMode
        })
      : {}
  const usageCallback = new ModelUsageCallbackHandler({
    provider,
    model: resolvedModel,
    modelConfigId: temperatureControl?.modelConfigId
  }, runtime?.recorder ?? null)

  log.info('[llm] resolveModel', {
    provider,
    model: resolvedModel,
    baseUrl: resolvedBaseUrl,
    temperature: resolvedTemperature ?? null,
    temperatureEnabled: isCurrentModelTemperatureEnabled(),
    temperatureControlBound: temperatureControl !== undefined,
    modelConfigId: temperatureControl?.modelConfigId ?? null,
    thinkingParameterMode,
    maxTokens: resolvedMaxTokens,
    openAIProtocol,
    openAICompatibility: 'thinking' in openAIThinkingModelKwargs ? ['thinking.type=disabled'] : []
  })

  switch (provider) {
    case 'openai':
      return new ChatOpenAICompletions({
        ...buildOpenAIModelOptions({
          model: resolvedModel,
          apiKey,
          baseUrl: resolvedBaseUrl,
          temperatureOptions,
          maxTokens: resolvedMaxTokens,
          thinkingParameterMode
        }),
        callbacks: [usageCallback]
      })
    case 'zhipu':
      // 智谱 AI（BigModel）提供 OpenAI 兼容的 Chat Completions 接口，
      // 复用 OpenAI 链路；强制不发送 thinking 参数，避免智谱接口报错。
      return new ChatOpenAICompletions({
        ...buildOpenAIModelOptions({
          model: resolvedModel,
          apiKey,
          baseUrl: resolvedBaseUrl,
          temperatureOptions,
          maxTokens: resolvedMaxTokens,
          // GLM-4.5/4.6 may otherwise consume the whole output budget as hidden
          // reasoning and leave message.content empty during JSON generation.
          // Keep the explicit "omit" setting available for older gateways.
          thinkingParameterMode
        }),
        callbacks: [usageCallback]
      })
    case 'deepseek':
      // DeepSeek 官方 OpenAI 兼容端点 https://api.deepseek.com，
      // 模型 deepseek-v4-flash / deepseek-v4-pro；thinking 参数按用户设置透传。
      return new ChatOpenAICompletions({
        ...buildOpenAIModelOptions({
          model: resolvedModel,
          apiKey,
          baseUrl: resolvedBaseUrl,
          temperatureOptions,
          maxTokens: resolvedMaxTokens,
          thinkingParameterMode
        }),
        callbacks: [usageCallback]
      })
    case 'openai-responses':
      return new CompatibleChatOpenAIResponses({
        ...buildOpenAIModelOptions({
          model: resolvedModel,
          apiKey,
          baseUrl: resolvedBaseUrl,
          temperatureOptions,
          maxTokens: resolvedMaxTokens,
          useResponsesApi: true,
          thinkingParameterMode
        }),
        callbacks: [usageCallback]
      })
    case 'anthropic':
      return new ChatAnthropic({
        model: resolvedModel,
        apiKey,
        ...temperatureOptions,
        maxTokens: resolvedMaxTokens,
        anthropicApiUrl: resolvedBaseUrl || undefined,
        callbacks: [usageCallback]
      })
    case 'google':
      return new ChatGoogleGenerativeAI({
        model: resolvedModel,
        apiKey,
        ...temperatureOptions,
        maxOutputTokens: resolvedMaxTokens,
        baseUrl: resolvedBaseUrl || undefined,
        callbacks: [usageCallback]
      })
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
