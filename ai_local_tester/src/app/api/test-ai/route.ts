import { NextRequest, NextResponse } from 'next/server';
import { runAITask, AITask } from '@/lib/lmstudio';

export async function POST(req: NextRequest) {
  try {
    const { task, content, systemPrompt } = await req.json();
    console.log(`[AI Tester] Incoming task: ${task}`);

    if (!task || !content) {
      return NextResponse.json({ success: false, error: 'Task and content are required' }, { status: 400 });
    }

    const result = await runAITask(task as AITask, content, systemPrompt);
    console.log(`[AI Tester] Success`);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[AI Tester] Detailed Error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      code: error.code
    });
    return NextResponse.json({ 
      success: false, 
      error: `Connection Failed: ${error.message}. Ensure LMStudio is running on http://localhost:1234 and the API server is enabled.` 
    }, { status: 500 });
  }
}
