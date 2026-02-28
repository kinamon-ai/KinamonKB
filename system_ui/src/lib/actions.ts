'use server';

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const KB_ROOT = path.resolve(process.cwd(), '../kinamon_kb');

export type TaskStatus = 'pending' | 'held' | 'queue' | 'decided';

export type Task = {
    id: string;
    title: string;
    date: string;
    bot: string;
    content: string;
    filePath: string;
    priority: 'urgent' | 'normal' | 'someday';
    status: TaskStatus;
};

async function readTasksFromDir(dir: string, status: TaskStatus): Promise<Task[]> {
    let files: string[] = [];
    try {
        files = await fs.readdir(dir);
    } catch {
        return [];
    }

    const tasks: Task[] = [];
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(dir, file);
        const raw = await fs.readFile(filePath, 'utf-8');
        const { content: body } = matter(raw);
        const title = body.split('\n')[0].replace('# ', '') || file;
        tasks.push({
            id: file,
            title: title.trim(),
            date: (body.match(/\*\*日付\*\*: (.*)/)?.[1]) || new Date().toISOString().split('T')[0],
            bot: (body.match(/\*\*担当ボット\*\*: (.*)/)?.[1]) || 'Unknown',
            content: body,
            filePath,
            priority: 'urgent',
            status,
        });
    }
    return tasks;
}

export async function getTasks(mode: 'pending' | 'held' | 'queue' = 'pending') {
    let subDir = '_pending';
    if (mode === 'held') subDir = '_held';
    if (mode === 'queue') subDir = '_post_pool';

    const dir = path.join(KB_ROOT, '03_opinion_gate', subDir);
    return readTasksFromDir(dir, mode);
}

export async function decideTask(taskId: string, choice: 'A' | 'B', feedback: string, postContent: string) {
    const sourcePath = path.join(KB_ROOT, '03_opinion_gate/_pending', taskId);
    const targetPath = path.join(KB_ROOT, '03_opinion_gate/_post_pool', taskId);

    const content = await fs.readFile(sourcePath, 'utf-8');
    const updatedContent = `${content}\n\n---
## 承認結果 (Auto-recorded via Web UI)
- **選択**: ${choice}
- **最終ポスト**: 
> ${postContent.split('\n').join('\n> ')}
- **コメント**: ${feedback}
- **承認日時**: ${new Date().toLocaleString()}
`;

    await fs.writeFile(targetPath, updatedContent);
    await fs.unlink(sourcePath);

    // Update growth_log.md
    const logPath = path.join(KB_ROOT, '01_bots/bot_01_observer/growth_log.md');
    const logContent = await fs.readFile(logPath, 'utf-8');
    const newsTitle = taskId.replace('.md', '');
    const updatedLog = logContent.includes('| - |')
        ? logContent.replace('| - | _(記録なし)_ | | | |', `| 1 | ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`)
        : logContent + `\n| ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`;

    await fs.writeFile(logPath, updatedLog);

    // Generate feedback knowledge asynchronously (fire-and-forget)
    generateFeedback(content, choice, feedback).catch(console.error);

    return { success: true };
}

export async function holdTask(taskId: string, fromHeld = false) {
    const sourceDir = fromHeld ? '_held' : '_pending';
    const targetDir = fromHeld ? '_pending' : '_held';
    const sourcePath = path.join(KB_ROOT, '03_opinion_gate', sourceDir, taskId);
    const targetPath = path.join(KB_ROOT, '03_opinion_gate', targetDir, taskId);

    const content = await fs.readFile(sourcePath, 'utf-8');

    if (!fromHeld) {
        const heldContent = `${content}\n\n<!-- held: true | held_at: ${new Date().toLocaleString()} -->`;
        await fs.writeFile(targetPath, heldContent);
    } else {
        // Remove the hold marker comment appended at the end
        const markerIndex = content.lastIndexOf('\n\n<!-- held: true');
        const restored = markerIndex >= 0 ? content.slice(0, markerIndex) : content;
        await fs.writeFile(targetPath, restored);
    }

    await fs.unlink(sourcePath);
    return { success: true };
}

async function generateFeedback(taskContent: string, choice: 'A' | 'B', userFeedback: string) {
    const { exec } = require('child_process');
    const projectRoot = path.resolve(process.cwd(), '..');
    const feedbackKnowledgePath = path.join(KB_ROOT, '01_bots/bot_01_observer/feedback_knowledge.md');

    // Build analysis input
    const analysisInput = [
        taskContent,
        '---',
        `kinamonの選択: ${choice}案`,
        `kinamonのフィードバック: ${userFeedback || '(コメントなし)'}`,
    ].join('\n');

    return new Promise<void>((resolve, reject) => {
        const cmd = `echo ${JSON.stringify(analysisInput)} | GEMINI_SYSTEM_MD=.gemini/feedback-system.md gemini -p "選択を分析してフィードバックを生成" --output-format json --yolo`;

        exec(cmd, { cwd: projectRoot, timeout: 120000 }, async (error: Error | null, stdout: string) => {
            if (error) {
                console.error('Feedback generation failed:', error.message);
                return reject(error);
            }

            try {
                const parsed = JSON.parse(stdout);
                let rawResponse = parsed.response || '';
                // Strip markdown backticks if present
                rawResponse = rawResponse.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');

                if (rawResponse.trim()) {
                    const existing = await fs.readFile(feedbackKnowledgePath, 'utf-8');
                    const updated = existing.replace(
                        '### Success Patterns\n(まだ記録なし)',
                        `### Success Patterns\n${rawResponse}`
                    );
                    // If already has content, just append
                    if (updated === existing) {
                        await fs.writeFile(feedbackKnowledgePath, existing + '\n\n' + rawResponse);
                    } else {
                        await fs.writeFile(feedbackKnowledgePath, updated);
                    }
                    console.log('Feedback knowledge updated successfully.');
                }
                resolve();
            } catch (parseErr) {
                console.error('Failed to parse feedback JSON:', parseErr);
                reject(parseErr);
            }
        });
    });
}

export async function runPatrol(): Promise<{ success: boolean; message: string }> {
    const { exec } = require('child_process');
    const scriptPath = path.resolve(process.cwd(), '../scripts/auto_patrol.sh');

    return new Promise((resolve) => {
        exec(scriptPath, { cwd: path.resolve(process.cwd(), '..'), timeout: 300000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                resolve({ success: false, message: `Error: ${error.message}\n${stderr}` });
            } else {
                resolve({ success: true, message: stdout });
            }
        });
    });
}
