import type { LanguageModel, ModelMessage } from 'ai';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';

import { log } from '../../utils/logger';
import { isPackaged } from '../../utils/systemInfo';
import { isHttp, isJSONArray, isString } from '../../utils/validate';

type LLMSupportProvider = 'anthropic' | 'google' | 'ollama' | 'openai' | 'openai-response';
type LLMProvider = (modelId: string) => LanguageModel;
type LLMTextOptions = Parameters<typeof generateText>;

interface LLMOptions {
  type: LLMSupportProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

const logger = log.withContext('MODULE<ai>');

if (isPackaged) globalThis.AI_SDK_LOG_WARNINGS = false;

export class AiCaptchaService {
  private provider: LLMProvider | null = null;

  private formatApiHost(host: string, supportApiVersion: boolean = true, apiVersion: string = 'v1'): string {
    if (!isString(host) || !host.trim()) return '';

    const normalizedHost = host.trim().replace(/\/+$/, '');

    const VERSION_REGEX = /\/v\d+(?:alpha|beta)?(?:\/|$)/i;

    const hasApiVersion = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        return VERSION_REGEX.test(parsedUrl.pathname);
      } catch {
        return VERSION_REGEX.test(url);
      }
    };

    const shouldAppendApiVersion = !(
      normalizedHost.endsWith('#') ||
      !supportApiVersion ||
      hasApiVersion(normalizedHost)
    );

    if (shouldAppendApiVersion) {
      return `${normalizedHost}/${apiVersion}`;
    } else {
      return normalizedHost.replace(/#$/, '');
    }
  }

  private validLLMOptions(messages: ModelMessage[], options: LLMOptions): void {
    if (!isJSONArray(messages) || !messages.length) {
      throw new Error('Messages invalid');
    }

    if (typeof options !== 'object' || !Object.keys(options).length) {
      throw new Error('Invalid LLM options');
    }

    const { baseURL, model } = options;
    if (!isHttp(baseURL)) throw new Error('Invalid LLM options - baseURL must be a valid URL');
    if (!model) throw new Error('Invalid LLM options - model is required');
  }

  private createLLMProvider(provider: LLMSupportProvider, options: { apiKey: string; baseURL: string }): LLMProvider {
    const { apiKey, baseURL } = options;

    switch (provider) {
      case 'anthropic':
        return createAnthropic({ apiKey, baseURL });
      case 'google':
        return createGoogleGenerativeAI({ apiKey, baseURL });
      case 'ollama':
        return createOllama({
          baseURL,
          ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
        });
      case 'openai-response':
        return createOpenAI({ apiKey, baseURL });
      case 'openai':
      default:
        return createOpenAICompatible({ apiKey, baseURL, name: 'openai' });
    }
  }

  private getLLMProvider(options: Omit<LLMOptions, 'model'>): LLMProvider {
    try {
      this.provider = this.createLLMProvider(options.type, {
        apiKey: options.apiKey,
        baseURL: options.baseURL,
      });
      return this.provider;
    } catch (err) {
      this.provider = null;
      throw err;
    }
  }

  public async chatText(
    messages: ModelMessage[],
    options: LLMOptions,
    textOptions: LLMTextOptions = {} as LLMTextOptions,
  ): Promise<string> {
    this.validLLMOptions(messages, options);

    const client = this.getLLMProvider(options);
    if (!client) throw new Error('LLM client is not initialized.');

    const model = options.model;

    try {
      const { text } = await generateText({
        model: client(model),
        messages: [...messages],
        providerOptions: {},
        allowSystemInMessages: true,
        timeout: 30_000,
        ...textOptions,
      });

      return text;
    } catch (err) {
      logger.error(
        `Failed to complete chat, the status code is ${(err as any).statusCode}, reason detail with ${(err as any).responseBody}`,
      );
      throw new Error('LLM request failed');
    }
  }
}
