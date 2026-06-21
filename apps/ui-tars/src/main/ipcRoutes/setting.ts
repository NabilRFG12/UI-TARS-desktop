/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { OpenAI } from 'openai';
import { initIpc } from '@ui-tars/electron-ipc/main';
import { logger } from '../logger';

const t = initIpc.create();

export const settingRoute = t.router({
  checkVLMResponseApiSupport: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      try {
        const openai = new OpenAI({
          apiKey: input.apiKey,
          baseURL: input.baseUrl,
        });
        const result = await openai.responses.create({
          model: input.modelName,
          input: 'return 1+1=?',
          stream: false,
        });
        console.log('result', result);
        return Boolean(result?.id || result?.previous_response_id);
      } catch (e) {
        logger.warn('[checkVLMResponseApiSupport] failed:', e);
        return false;
      }
    }),
  checkModelAvailability: t.procedure
    .input<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>()
    .handle(async ({ input }) => {
      try {
        const openai = new OpenAI({
          apiKey: input.apiKey,
          baseURL: input.baseUrl,
        });
        const completion = await openai.chat.completions.create({
          model: input.modelName,
          messages: [{ role: 'user', content: 'return 1+1=?' }],
          stream: false,
        });
        console.log('result', completion);

        return Boolean(completion?.id || completion.choices[0].message.content);
      } catch (e) {
        throw e;
      }
    }),
  // Fetch the OpenRouter model catalog and return only multimodal (image-input)
  // models, so the Settings UI can offer them as a searchable picker. The
  // `/models` endpoint is public, so no API key is required.
  listOpenRouterModels: t.procedure.handle(async () => {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) {
      throw new Error(`OpenRouter /models responded ${res.status}`);
    }
    const json = (await res.json()) as { data?: OpenRouterRawModel[] };
    const models: OpenRouterModel[] = (json.data ?? [])
      .filter((m) => (m.architecture?.input_modalities ?? []).includes('image'))
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length ?? null,
        // OpenRouter prices are per-token strings; expose $/1M tokens.
        promptPricePerM: m.pricing?.prompt
          ? Number(m.pricing.prompt) * 1_000_000
          : null,
        description: m.description || '',
        // UI-TARS / GUI-grounding family is what actually drives the agent.
        isGuiGrounding: /ui-?tars/i.test(m.id),
      }))
      .sort((a, b) => {
        if (a.isGuiGrounding !== b.isGuiGrounding) {
          return a.isGuiGrounding ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
      });
    logger.info(`[listOpenRouterModels] returned ${models.length} models`);
    return models;
  }),
});

interface OpenRouterRawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
  pricing?: { prompt?: string };
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number | null;
  promptPricePerM: number | null;
  description: string;
  isGuiGrounding: boolean;
}
