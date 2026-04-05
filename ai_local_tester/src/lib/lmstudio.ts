import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const lmstudio = new OpenAI({
  apiKey: 'lm-studio', // LM Studio doesn't require a real API key
  baseURL: 'http://localhost:1234/v1',
});

async function getLoadedModel(): Promise<string> {
  try {
    const res = await fetch('http://localhost:1234/v1/models');
    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        return json.data[0].id;
      }
    }
  } catch (e) {
    console.error("Failed to fetch currently loaded model from LMStudio", e);
  }
  
  // Fallback to ai_settings.json if API is unreachable or returns empty
  try {
    const settingsPath = path.resolve(process.cwd(), '../kinamon_kb/ai_settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      return settings.lmstudio_model || 'local-model';
    }
  } catch (e) {}
  
  return 'local-model';
}

export type AITask = 'TRANSLATE' | 'SUMMARIZE' | 'OPINION';

export async function runAITask(task: AITask, content: string, systemPrompt?: string) {
  let prompt = '';
  
  switch (task) {
    case 'TRANSLATE':
      prompt = `以下の情報を日本語に翻訳してください。翻訳結果のみを出力してください。\n\n${content}`;
      break;
    case 'SUMMARIZE':
      prompt = `以下の情報を3行程度で要約してください。\n\n${content}`;
      break;
    case 'OPINION':
      prompt = `以下のニュースに対して、対立するA案とB案の2つのツイート案を作成してください。Markdown形式で出力してください。\n\n${content}`;
      break;
  }

  const model = await getLoadedModel();

  const response = await lmstudio.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}
