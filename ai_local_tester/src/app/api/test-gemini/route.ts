import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { task, content, systemPromptPath } = await req.json();

    // The project root is two levels up from ai_local_tester/src/app/api/test-gemini
    const projectRoot = path.resolve(process.cwd(), '..');
    
    // Determine prompt and system prompt based on task
    let prompt = "";
    let sysPrompt = "";

    if (task === 'TRANSLATE') {
      prompt = "以下の内容を日本語に翻訳してください。結果のみ出力してください。";
      sysPrompt = ""; // Clean system prompt for simple translation
    } else if (task === 'SUMMARIZE') {
      prompt = "以下の内容を3行で簡潔に要約してください。";
      sysPrompt = ""; // Clean system prompt for simple summary
    } else {
      // Default to OPINION (bot01)
      prompt = "この記事について2択を生成してください。Markdownフォーマット厳守。";
      sysPrompt = systemPromptPath || ".gemini/bot01-system.md";
    }

    // Only add GEMINI_SYSTEM_MD if sysPrompt is provided
    const envPart = sysPrompt ? `GEMINI_SYSTEM_MD=${sysPrompt} ` : "";
    const cmd = `echo ${JSON.stringify(content)} | ${envPart}gemini -p "${prompt}" --output-format json --yolo`;

    return new Promise((resolve) => {
      exec(cmd, { cwd: projectRoot, timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Gemini CLI Error:', error);
          return resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(NextResponse.json({ success: true, result: parsed.response }));
        } catch (e) {
          resolve(NextResponse.json({ success: true, result: stdout })); // Fallback if not JSON
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
