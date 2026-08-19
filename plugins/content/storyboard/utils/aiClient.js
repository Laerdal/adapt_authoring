// Server-side AI client for the storyboard (ADAPT-3760, Phase 6 / AC7).
//
// Mirrors the LEATS Azure OpenAI pattern (plugins/services/translation/routes/
// leats/leatsClient.js): the API key stays on the server (config or env), never
// in the browser. Uses Node's global fetch (Node 18+).

const configuration = require('../../../../lib/configuration');

const PLACEHOLDERS = new Set(['', 'CHANGE_ME', 'YOUR_KEY', 'undefined', 'null']);

function cfg(key, envKey, fallback) {
  let v;
  try {
    v = configuration.getConfig(key);
  } catch (e) {
    v = undefined;
  }
  if (v == null || v === '') v = process.env[envKey];
  if (v == null || v === '') v = fallback;
  return v;
}

// Prefer storyboard-specific config, then fall back to the shared Samaritan
// (ckEditor AI) credentials already used elsewhere in the tool.
function getSettings() {
  const key = cfg('storyboardAiKey', 'STORYBOARD_AI_KEY', cfg('ckEditorAIApiKey', 'CKEditor_AI_ASST_API_KEY', ''));
  const endpoint = String(
    cfg('storyboardAiEndpoint', 'STORYBOARD_AI_ENDPOINT', 'https://p-ais-ne-ais-adapt.openai.azure.com')
  )
    .trim()
    .replace(/\/+$/, '');
  const deployment = String(cfg('storyboardAiDeployment', 'STORYBOARD_AI_DEPLOYMENT', 'gpt-4o-mini')).trim();
  const apiVersion = String(cfg('storyboardAiApiVersion', 'STORYBOARD_AI_APIVERSION', '2025-01-01-preview')).trim();
  return { key: String(key || '').trim(), endpoint, deployment, apiVersion };
}

function isConfigured() {
  const s = getSettings();
  return !PLACEHOLDERS.has(s.key) && !PLACEHOLDERS.has(s.endpoint);
}

const SYSTEM_PROMPTS = {
  improve:
    'You improve instructional e-learning content. Improve the clarity, grammar and flow of the text without changing its meaning. Return ONLY the improved text, with no preamble or quotes.',
  rewrite:
    'You rewrite instructional e-learning content to be clear, concise and engaging while preserving meaning and reading level. Return ONLY the rewritten text.',
  summarize:
    'You summarise instructional e-learning content. Produce a concise summary of the text. Return ONLY the summary.',
  suggest:
    'You are an instructional designer. Given the content, suggest concrete improvements and additional content ideas. Return a short markdown bullet list.',
  // Samaritan-parity actions (match the CKEditor "Samaritan Assistance" tool).
  shorten:
    'Make this text shorter while preserving its complete meaning. Return ONLY the shortened text, with no preamble or quotes.',
  lengthen:
    'Make this text longer with relevant details while preserving its core meaning. Return ONLY the expanded text, with no preamble or quotes.',
  spelling:
    'Check and correct spelling and grammar without changing the meaning. Return ONLY the corrected text, with no preamble or quotes.',
  // Free-text: the user's own instruction drives the model (edit selection or
  // generate from scratch). The instruction is injected into the user message.
  custom:
    'You are Samaritan, an assistant for authoring instructional e-learning content. Follow the user instruction precisely. Return ONLY the resulting content, with no preamble, explanation or quotes.',
};

// Run an AI action on `text`. For action === 'custom', `instruction` carries the
// user's free-text request (and `text` is the optional content to operate on).
// Returns the assistant message content.
async function run(action, text, context, instruction) {
  const s = getSettings();
  if (PLACEHOLDERS.has(s.key) || PLACEHOLDERS.has(s.endpoint)) {
    const err = new Error('Storyboard AI is not configured on the server.');
    err.statusCode = 501;
    throw err;
  }
  const system = SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.improve;
  const instr = String(instruction || '').trim();
  const srcText = String(text || '');
  const coursePrefix = context ? `Course: ${context}\n\n` : '';
  const user =
    action === 'custom'
      ? coursePrefix + (srcText ? `${srcText}\n\nInstruction: ${instr}` : instr)
      : coursePrefix + srcText;
  const url = `${s.endpoint}/openai/deployments/${s.deployment}/chat/completions?api-version=${s.apiVersion}`;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': s.key },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_completion_tokens: 2048,
      }),
    });
  } catch (e) {
    const err = new Error(`Azure OpenAI request failed: ${e.message}`);
    err.statusCode = 502;
    throw err;
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`Azure OpenAI error ${resp.status}: ${detail.slice(0, 200)}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await resp.json().catch(() => null);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content || '';
}

module.exports = { run, isConfigured };
