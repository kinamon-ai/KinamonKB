import OpenAI from 'openai';

const lmstudio = new OpenAI({
  apiKey: 'lm-studio', // LM Studio doesn't require a real API key
  baseURL: 'http://localhost:1234/v1',
});

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

  const response = await lmstudio.chat.completions.create({
    model: 'ms-not-specified', // LM Studio uses the currently loaded model
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}
