const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

const DEFAULT_MODEL = 'gemini-2.5-flash';

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  return apiKey;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part?.text || '').join('').trim();
}

export async function POST(req) {
  try {
    const { selection, kind, context, model } = await req.json();

    if (!selection || typeof selection !== 'string') {
      return Response.json({ error: 'No text selected.' }, { status: 400 });
    }

    const envModel = process.env.GEMINI_MODEL;
    const chosenModel = ALLOWED_MODELS.has(model)
      ? model
      : (ALLOWED_MODELS.has(envModel) ? envModel : DEFAULT_MODEL);

    const safeContext = String(context || '').slice(0, 6000);
    const selected = selection.slice(0, 1000);
    const apiKey = getApiKey();

    const systemInstruction = `You are an English-learning assistant for an IELTS learner. Explain selected text clearly, accurately and simply. Adapt the explanation to whether it is a word, phrase, or sentence. Avoid unnecessary jargon. Return ONLY valid JSON with this exact shape:
{
  "type": "word|phrase|sentence",
  "selectedText": "...",
  "simpleMeaning": "...",
  "hinglish": "...",
  "breakdown": [{"part":"...","meaning":"..."}],
  "inContext": "...",
  "ieltsAlternative": "..."
}
For a single word, breakdown may be empty or include a concise sense split. For a phrase, break it into meaningful components. For a sentence, explain the overall message and 2-5 important chunks. Hinglish should be natural Roman Hindi, short and easy. IELTS alternative should be a simpler natural synonym or paraphrase, not forced vocabulary.`;

    const prompt = `Detected type: ${kind}\nSelected text: ${selected}\nFull context: ${safeContext}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent`;
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      }),
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      const apiMessage = data?.error?.message || `Gemini API returned ${geminiRes.status}.`;
      throw new Error(apiMessage);
    }

    const rawText = extractText(data);
    if (!rawText) throw new Error('Gemini returned an empty response.');

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      parsed = JSON.parse(cleaned);
    }

    const usage = data?.usageMetadata || {};
    const inputTokens = Number(usage.promptTokenCount || 0);
    const outputTokens = Number(usage.candidatesTokenCount || 0);
    const totalTokens = Number(usage.totalTokenCount || inputTokens + outputTokens);

    return Response.json({
      ...parsed,
      model: chosenModel,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });
  } catch (err) {
    console.error('Explain API error:', err);
    const message = String(err?.message || '');
    const isConfigError = message.includes('GEMINI_API_KEY');
    return Response.json(
      {
        error: isConfigError
          ? 'Server Gemini API key is not configured.'
          : `Explanation failed: ${message || 'Check the Gemini API key, model access, or quota.'}`,
      },
      { status: 500 },
    );
  }
}
