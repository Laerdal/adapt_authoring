// AI service — wraps compress() from headroom-ai around Anthropic fetch calls.
// headroom-ai intercepts messages before they reach Claude, compressing
// repeated course context, conversation history, and tool outputs.

import { compress } from 'headroom-ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendMessageOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  courseContext?: unknown;
  model?: string;
  maxTokens?: number;
}

export interface SendMessageResult {
  text: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
}

const HEADROOM_BASE_URL = import.meta.env.VITE_HEADROOM_URL ?? 'http://localhost:8787';
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export async function sendMessage(opts: SendMessageOptions): Promise<SendMessageResult> {
  const { messages, systemPrompt, courseContext, model = DEFAULT_MODEL, maxTokens = 1024 } = opts;

  // Build the raw messages array in Anthropic format
  const rawMessages: Array<{ role: string; content: string }> = [];

  // Inline course context into the first user turn if provided
  if (courseContext && messages.length > 0) {
    const [first, ...rest] = messages;
    rawMessages.push({
      role: 'user',
      content: `Course context:\n${JSON.stringify(courseContext)}\n\n${first.content}`,
    });
    rawMessages.push(...rest);
  } else {
    rawMessages.push(...messages);
  }

  // Compress with Headroom before sending to Anthropic
  const result = await compress(rawMessages, {
    model,
    baseUrl: HEADROOM_BASE_URL,
    fallback: true, // pass through uncompressed if proxy is unreachable
  });

  // Build Anthropic messages API request
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: result.messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error?.error?.message ?? `Anthropic API error ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';

  return {
    text,
    tokensBefore: result.tokensBefore,
    tokensAfter: result.tokensAfter,
    tokensSaved: result.tokensSaved,
  };
}
