import { NextRequest, NextResponse } from 'next/server';
import { runAITask, AITask } from '@/lib/lmstudio';

export async function POST(req: NextRequest) {
  try {
    const { task, content, systemPrompt } = await req.json();

    if (!task || !content) {
      return NextResponse.json({ success: false, error: 'Task and content are required' }, { status: 400 });
    }

    const result = await runAITask(task as AITask, content, systemPrompt);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('AI Task Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to connect to LMStudio. Make sure it is running on http://localhost:1234' 
    }, { status: 500 });
  }
}
