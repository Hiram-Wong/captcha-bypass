import { generateText, type LanguageModel, type ModelMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { isHttp } from '@/utils/validate';

type LLMSupportProvider = 'openai';
type LLMProvider = (modelId: string) => LanguageModel;
type LLMTextOptions = Parameters<typeof generateText>;

interface LLMOptions {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class AiCaptchaService {
  private provider: LLMProvider | null = null;

  private validLLMOptions(messages: ModelMessage[], options: LLMOptions): void {
    if (!Array.isArray(messages) || !messages.length) {
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
      case 'openai':
      default:
        return createOpenAICompatible({ apiKey, baseURL, name: 'openai' });
    }
  }

  private getLLMProvider(options: Omit<LLMOptions, 'model'>): LLMProvider {
    try {
      this.provider = this.createLLMProvider('openai', {
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
        temperature: 1,
        providerOptions: {},
        allowSystemInMessages: true,
        timeout: 30_000,
        ...textOptions,
      });

      return text;
    } catch (err) {
      console.error(err);
      console.error(
        `Failed to complete chat, the status code is ${(err as any).statusCode}, reason detail with ${(err as any).responseBody}`,
      );
      return '';
    }
  }
}
