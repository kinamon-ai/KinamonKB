'use server';

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { postTweet } from './twitter';

const KB_ROOT = path.resolve(process.cwd(), '../kinamon_kb');

export type TaskStatus = 'pending' | 'held' | 'queue' | 'decided';

export type Task = {
    id: string;
    title: string;
    date: string;
    bot: string;
    provider: string;
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
            provider: (body.match(/\*\*生成モデル\*\*: (.*)/)?.[1]) || 'Unknown',
            content: body,
            filePath,
            priority: 'urgent',
            status,
        });
    }

    // Sort by date descending (newest first)
    tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return tasks;
}

export async function getTasks(mode: 'pending' | 'held' | 'queue' = 'pending') {
    let subDir = '_pending';
    if (mode === 'held') subDir = '_held';
    if (mode === 'queue') subDir = '_post_pool';

    const dir = path.join(KB_ROOT, '03_opinion_gate', subDir);
    return readTasksFromDir(dir, mode);
}

export async function decideTask(taskId: string, choice: 'A' | 'B', feedback: string, postContent: string, fromHeld = false) {
    const sourceDir = fromHeld ? '_held' : '_pending';
    const sourcePath = path.join(KB_ROOT, '03_opinion_gate', sourceDir, taskId);
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

    // Update growth_log.md based on assigned bot
    const botMatch = content.match(/\*\*担当ボット\*\*: (.*)/);
    const assignedBot = botMatch && botMatch[1].trim() !== 'Unknown' ? botMatch[1].trim() : 'bot_01_observer';

    const logPath = path.join(KB_ROOT, `01_bots/${assignedBot}/growth_log.md`);
    let logContent = '';
    try {
        logContent = await fs.readFile(logPath, 'utf-8');
    } catch {
        // If file doesn't exist yet, we can create a basic one or fallback
        logContent = `| No | 日付 | 記事タイトル | 選択 | コメント |\n|---|---|---|---|---|\n`;
    }

    const newsTitle = taskId.replace('.md', '');
    const updatedLog = logContent.includes('| - |')
        ? logContent.replace('| - | _(記録なし)_ | | | |', `| 1 | ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`)
        : logContent + `\n| ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`;

    await fs.writeFile(logPath, updatedLog);

    // Generate feedback knowledge asynchronously (fire-and-forget)
    generateFeedback(content, choice, feedback, postContent, assignedBot).catch(console.error);

    return { success: true };
}

export async function holdTask(taskId: string, source: 'pending' | 'held' | 'queue' = 'pending') {
    let sourceDir = '_pending';
    let targetDir = '_held';

    if (source === 'held') {
        sourceDir = '_held';
        targetDir = '_pending';
    } else if (source === 'queue') {
        sourceDir = '_post_pool';
        targetDir = '_held';
    }

    const sourcePath = path.join(KB_ROOT, '03_opinion_gate', sourceDir, taskId);
    const targetPath = path.join(KB_ROOT, '03_opinion_gate', targetDir, taskId);

    const content = await fs.readFile(sourcePath, 'utf-8');

    if (sourceDir !== '_held') {
        // Only add marker if moving TO held, and not already there
        if (!content.includes('<!-- held: true')) {
            const heldContent = `${content}\n\n<!-- held: true | held_at: ${new Date().toLocaleString()} -->`;
            await fs.writeFile(targetPath, heldContent);
        } else {
            await fs.writeFile(targetPath, content);
        }
    } else {
        // Remove the hold marker comment appended at the end
        const markerIndex = content.lastIndexOf('\n\n<!-- held: true');
        const restored = markerIndex >= 0 ? content.slice(0, markerIndex) : content;
        await fs.writeFile(targetPath, restored);
    }

    await fs.unlink(sourcePath);
    return { success: true };
}

export async function trashTask(taskId: string, source: 'pending' | 'held' | 'queue' = 'pending') {
    let sourceDir = '_pending';
    if (source === 'held') sourceDir = '_held';
    if (source === 'queue') sourceDir = '_post_pool';

    const sourcePath = path.join(KB_ROOT, '03_opinion_gate', sourceDir, taskId);
    const trashDir = path.join(KB_ROOT, '03_opinion_gate/_trash');
    await fs.mkdir(trashDir, { recursive: true });
    const targetPath = path.join(trashDir, taskId);

    const content = await fs.readFile(sourcePath, 'utf-8');
    const trashedContent = `${content}\n\n<!-- trashed: true | trashed_from: ${sourceDir} | trashed_at: ${new Date().toLocaleString()} -->`;
    await fs.writeFile(targetPath, trashedContent);
    await fs.unlink(sourcePath);
    return { success: true };
}

// ──────────────────────────────────────────────
// History System
// ──────────────────────────────────────────────

export type HistoryItem = {
    id: string;
    title: string;
    date: string;
    bot: string;
    sourceUrl: string;
    choice: string;
    finalPost: string;
    feedback: string;
    approvedAt: string;
    tweetId: string;
    postedAt: string;
    type: 'decided' | 'trash';
    trashedFrom: string;
};

export async function getHistory(filter: 'decided' | 'trash' | 'all' = 'all'): Promise<HistoryItem[]> {
    const items: HistoryItem[] = [];

    const readDir = async (dir: string, type: 'decided' | 'trash') => {
        let files: string[] = [];
        try { files = await fs.readdir(dir); } catch { return; }

        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const filePath = path.join(dir, file);
            const raw = await fs.readFile(filePath, 'utf-8');

            const title = raw.split('\n')[0]?.replace(/^# /, '') || file;
            const date = raw.match(/\*\*日付\*\*: (.*)/)?.[1] || file.slice(0, 10);
            const bot = raw.match(/\*\*担当ボット\*\*: (.*)/)?.[1] || '';
            const sourceUrl = raw.match(/\*\*ソースURL\*\*: `?(https?:\/\/[^\s`]+)`?/)?.[1] || '';
            const choice = raw.match(/- \*\*選択\*\*: ([AB])/)?.[1] || '';
            const postMatch = raw.match(/- \*\*最終ポスト\*\*: \n([\s\S]*?)(?=\n- \*\*コメント\*\*)/);
            const finalPost = postMatch?.[1]?.split('\n').map(l => l.replace(/^> /, '')).join('\n').trim() || '';
            const feedback = raw.match(/- \*\*コメント\*\*: (.*)/)?.[1] || '';
            const approvedAt = raw.match(/- \*\*承認日時\*\*: (.*)/)?.[1] || '';
            const tweetId = raw.match(/tweet_id: (\d+)/)?.[1] || '';
            const postedAt = raw.match(/posted_at: ([^-\s>][^>]*?)(?:\s*-->)/)?.[1]?.trim() || '';
            const trashedFrom = raw.match(/trashed_from: (\S+)/)?.[1] || '';

            items.push({
                id: file,
                title: title.trim(),
                date,
                bot,
                sourceUrl,
                choice,
                finalPost,
                feedback,
                approvedAt,
                tweetId,
                postedAt,
                type,
                trashedFrom,
            });
        }
    };

    if (filter === 'all' || filter === 'decided') {
        await readDir(path.join(KB_ROOT, '03_opinion_gate/_decided'), 'decided');
    }
    if (filter === 'all' || filter === 'trash') {
        await readDir(path.join(KB_ROOT, '03_opinion_gate/_trash'), 'trash');
    }

    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
}

export async function restoreFromTrash(itemId: string): Promise<{ success: boolean }> {
    const trashDir = path.join(KB_ROOT, '03_opinion_gate/_trash');
    const sourcePath = path.join(trashDir, itemId);
    const raw = await fs.readFile(sourcePath, 'utf-8');

    // Determine original location from metadata
    const fromMatch = raw.match(/trashed_from: (\S+)/);
    const targetDir = fromMatch?.[1] || '_pending';
    const targetPath = path.join(KB_ROOT, '03_opinion_gate', targetDir, itemId);

    // Remove trash metadata
    const markerIndex = raw.lastIndexOf('\n\n<!-- trashed:');
    const restored = markerIndex >= 0 ? raw.slice(0, markerIndex) : raw;

    await fs.writeFile(targetPath, restored);
    await fs.unlink(sourcePath);
    return { success: true };
}

export async function deleteFromTrash(itemId: string): Promise<{ success: boolean }> {
    const trashDir = path.join(KB_ROOT, '03_opinion_gate/_trash');
    await fs.unlink(path.join(trashDir, itemId));
    return { success: true };
}

// ──────────────────────────────────────────────
// System Health Status
// ──────────────────────────────────────────────

export type SystemHealthData = {
    os: {
        platform: string;
        uptime: number;
        totalMem: number;
        freeMem: number;
        loadAvg: number[];
        hostname: string;
    };
    storage: {
        candidates: number;
        pending: number;
        held: number;
        queue: number;
        decided: number;
        trash: number;
        proposals: number;
    };
    lastPatrol?: string; // We can parse this from growth_log.md or files
};

export async function getSystemHealth(): Promise<SystemHealthData> {
    const safeReadDirCount = async (dirPath: string) => {
        try {
            const files = await fs.readdir(dirPath);
            return files.filter(f => !f.startsWith('.')).length;
        } catch { return 0; }
    };

    const candidates = await safeReadDirCount(path.join(KB_ROOT, '02_news_candidates'));
    const pending = await safeReadDirCount(path.join(KB_ROOT, '03_opinion_gate/_pending'));
    const held = await safeReadDirCount(path.join(KB_ROOT, '03_opinion_gate/_held'));
    const queue = await safeReadDirCount(path.join(KB_ROOT, '03_opinion_gate/_post_pool'));
    const decided = await safeReadDirCount(path.join(KB_ROOT, '03_opinion_gate/_decided'));
    const trash = await safeReadDirCount(path.join(KB_ROOT, '03_opinion_gate/_trash'));
    const proposals = await safeReadDirCount(path.join(KB_ROOT, '01_bots/bot_01_observer/_identity_proposals'));

    return {
        os: {
            platform: os.platform(),
            uptime: os.uptime(),
            totalMem: os.totalmem(),
            freeMem: os.freemem(),
            loadAvg: os.loadavg(),
            hostname: os.hostname(),
        },
        storage: {
            candidates, pending, held, queue, decided, trash, proposals
        }
    };
}

async function generateFeedback(taskContent: string, choice: 'A' | 'B', userFeedback: string, postContent: string, botId: string = 'bot_01_observer') {
    const { exec } = require('child_process');
    const projectRoot = path.resolve(process.cwd(), '..');
    const feedbackKnowledgePath = path.join(KB_ROOT, `01_bots/${botId}/feedback_knowledge.md`);

    const sharedKnowledgePath = path.join(KB_ROOT, '01_bots/common/shared_knowledge.md');
    const sharedPersonaPath = path.join(KB_ROOT, '01_bots/common/shared_persona.md');

    const [sharedKnowledge, sharedPersona] = await Promise.all([
        fs.readFile(sharedKnowledgePath, 'utf-8').catch(() => ''),
        fs.readFile(sharedPersonaPath, 'utf-8').catch(() => ''),
    ]);

    // Build analysis input
    const analysisInput = [
        '## Shared Knowledge (Org Level)',
        sharedKnowledge,
        '---',
        '## Shared Persona (Org Level)',
        sharedPersona,
        '---',
        '## Current Conversation Context',
        taskContent,
        '---',
        `kinamonの選択: ${choice}案`,
        `kinamonの修正後最終ポスト: ${postContent}`,
        `kinamonのフィードバック: ${userFeedback || '(コメントなし)'}`,
    ].join('\n');

    try {
        const stdout = await callAI(analysisInput, '.gemini/feedback-system.md', 'feedback');
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
    } catch (error: any) {
        console.error('Feedback generation failed:', error.message);
        throw error;
    }
}

export async function runPatrol(): Promise<{ success: boolean; message: string }> {
    const { exec } = require('child_process');
    const scriptPath = path.resolve(process.cwd(), '../scripts/auto_patrol.sh');
    const logPath = path.join(KB_ROOT, 'system.log');

    const log = (msg: string) => fs.appendFile(logPath, `[${new Date().toLocaleString()}] [UI] ${msg}\n`);

    log("ACTION: runPatrol started");
    return new Promise((resolve) => {
        exec(scriptPath, { cwd: path.resolve(process.cwd(), '..'), timeout: 600000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                log(`ERROR: runPatrol failed: ${error.message}`);
                resolve({ success: false, message: `Error: ${error.message}\n${stderr}` });
            } else {
                log("DONE: runPatrol completed");
                resolve({ success: true, message: stdout });
            }
        });
    });
}

// ──────────────────────────────────────────────
// Identity Proposal System
// ──────────────────────────────────────────────

export type IdentityProposal = {
    id: string;           // filename
    date: string;
    decisionRange: string;
    content: string;      // raw markdown
};

/** growth_log.md の行数から前回の提案以降の Decide 件数を返す */
export async function getDecisionCount(botId: string = 'bot_01_observer'): Promise<{ count: number; threshold: number }> {
    const threshold = 10;
    const logPath = path.join(KB_ROOT, '01_bots', botId, 'growth_log.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots', botId, '_identity_proposals');

    let logContent = '';
    try { logContent = await fs.readFile(logPath, 'utf-8'); } catch { return { count: 0, threshold }; }

    // Count table rows (lines starting with | and containing a date YYYY-MM-DD)
    const decisionLines = logContent.match(/^\| \d{4}-\d{2}-\d{2}/gm) || [];
    const totalDecisions = decisionLines.length;

    // Find how many decisions existed at the time of last proposal
    let lastProposalDecisionCount = 0;
    try {
        const files = await fs.readdir(proposalsDir);
        const proposals = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));
        if (proposals.length > 0) {
            const lastFile = proposals.sort().at(-1)!;
            const content = await fs.readFile(path.join(proposalsDir, lastFile), 'utf-8');
            const match = content.match(/from (\d+) decisions/);
            lastProposalDecisionCount = match ? parseInt(match[1]) : 0;
        }
    } catch { /* no proposals yet */ }

    const count = totalDecisions - lastProposalDecisionCount;
    return { count, threshold };
}

/** Gemini で persona.md の更新提案を生成し _identity_proposals/ に保存する */
export async function generateIdentityProposal(botId: string = 'bot_01_observer'): Promise<{ success: boolean; message: string }> {
    const { exec } = require('child_process');
    const projectRoot = path.resolve(process.cwd(), '..');
    const personaPath = path.join(KB_ROOT, '01_bots', botId, 'persona.md');
    const feedbackPath = path.join(KB_ROOT, '01_bots', botId, 'feedback_knowledge.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots', botId, '_identity_proposals');
    const logPath = path.join(KB_ROOT, '01_bots', botId, 'growth_log.md');
    
    // Ensure proposals dir exists
    await fs.mkdir(proposalsDir, { recursive: true });

    const sharedKnowledgePath = path.join(KB_ROOT, '01_bots/common/shared_knowledge.md');
    const sharedPersonaPath = path.join(KB_ROOT, '01_bots/common/shared_persona.md');

    const [personaContent, feedbackContent, logContent, sharedKnowledge, sharedPersona] = await Promise.all([
        fs.readFile(personaPath, 'utf-8'),
        fs.readFile(feedbackPath, 'utf-8'),
        fs.readFile(logPath, 'utf-8'),
        fs.readFile(sharedKnowledgePath, 'utf-8').catch(() => ''),
        fs.readFile(sharedPersonaPath, 'utf-8').catch(() => ''),
    ]);

    // Count total decisions for context
    const decisionLines = logContent.match(/^\| \d{4}-\d{2}-\d{2}/gm) || [];

    const analysisInput = [
        '## Shared Knowledge (Org Level)',
        sharedKnowledge,
        '---',
        '## Shared Persona (Org Level)',
        sharedPersona,
        '---',
        '## Bot-Specific persona.md',
        personaContent,
        '---',
        '## Bot-Specific feedback_knowledge.md',
        feedbackContent,
        '---',
        `## 分析対象: 合計 ${decisionLines.length} 件の選択記録`,
    ].join('\n');

    try {
        const stdout = await callAI(analysisInput, '.gemini/identity-system.md', 'identity');
        const parsed = JSON.parse(stdout);
        let rawResponse = parsed.response || '';
        rawResponse = rawResponse.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

        if (!rawResponse) {
            return { success: false, message: 'Empty response from AI' };
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `${dateStr}_proposal.md`;
        await fs.writeFile(path.join(proposalsDir, filename), rawResponse);
        return { success: true, message: filename };
    } catch (error: any) {
        return { success: false, message: `AI call failed: ${error.message}` };
    }
}

/** 保存された提案ファイル一覧を読み込んで返す */
export async function getIdentityProposals(botId: string = 'bot_01_observer'): Promise<IdentityProposal[]> {
    const proposalsDir = path.join(KB_ROOT, '01_bots', botId, '_identity_proposals');
    let files: string[] = [];
    try { files = await fs.readdir(proposalsDir); } catch { return []; }

    const proposals: IdentityProposal[] = [];
    for (const file of files.filter(f => f.endsWith('.md') && !f.startsWith('.')).sort().reverse()) {
        const content = await fs.readFile(path.join(proposalsDir, file), 'utf-8');
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        const rangeMatch = content.match(/Generated from .*\((.*)\)/);
        proposals.push({
            id: file,
            date: dateMatch?.[1] || file,
            decisionRange: rangeMatch?.[1] || '',
            content,
        });
    }
    return proposals;
}

/** 承認された提案内容を persona.md に追記する */
export async function applyProposalToPersona(
    proposalId: string,
    acceptedTexts: string[],
    botId: string = 'bot_01_observer'
): Promise<{ success: boolean }> {
    const personaPath = path.join(KB_ROOT, '01_bots', botId, 'persona.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots', botId, '_identity_proposals');

    const currentPersona = await fs.readFile(personaPath, 'utf-8');
    const timestamp = new Date().toLocaleString('ja-JP');

    const appendSection = [
        '',
        `---`,
        ``,
        `## 成長記録 (${timestamp} 承認)`,
        ``,
        ...acceptedTexts.map((t, i) => `### 承認 ${i + 1}\n${t}`),
    ].join('\n');

    await fs.writeFile(personaPath, currentPersona + appendSection);

    // Rename proposal to mark as applied
    const src = path.join(proposalsDir, proposalId);
    const dst = path.join(proposalsDir, `applied_${proposalId}`);
    await fs.rename(src, dst);

    return { success: true };
}

// ──────────────────────────────────────────────
// X (Twitter) Posting
// ──────────────────────────────────────────────

/** Post Queue (_post_pool) のタスクをXに投稿し _decided に移動する */
export async function postToX(
    taskId: string,
    botId: string,
    postText: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    const result = await postTweet(botId, postText);

    if (!result.success) {
        return result;
    }

    // Move file from _post_pool → _decided
    const srcPath = path.join(KB_ROOT, '03_opinion_gate/_post_pool', taskId);
    const decidedDir = path.join(KB_ROOT, '03_opinion_gate/_decided');
    const dstPath = path.join(decidedDir, taskId);

    const content = await fs.readFile(srcPath, 'utf-8');
    const postedContent = `${content}\n\n<!-- posted_to_x: true | tweet_id: ${result.tweetId} | posted_at: ${new Date().toLocaleString()} -->`;
    await fs.writeFile(dstPath, postedContent);
    await fs.unlink(srcPath);

    return { success: true, tweetId: result.tweetId };
}// ──────────────────────────────────────────────
// News Feed System
// ──────────────────────────────────────────────

export type NewsCandidate = {
    id: string;
    title: string;
    url: string;
    content: string;
    date: string;
    evaluation: 'A' | 'B' | 'C';
    reason: string;
    assignedBot: string;
    aiProvider: string;
};

export async function fetchRSSAction() {
    const { exec } = require('child_process');
    const pythonPath = path.resolve(process.cwd(), '../venv/bin/python');
    const scriptPath = path.resolve(process.cwd(), '../scripts/fetch_news.py');
    const logPath = path.join(KB_ROOT, 'system.log');

    const log = (msg: string) => fs.appendFile(logPath, `[${new Date().toLocaleString()}] [UI] ${msg}\n`);

    log("ACTION: fetchRSSAction started");
    return new Promise<{ success: boolean; message: string }>((resolve) => {
        exec(`${pythonPath} ${scriptPath}`, { cwd: path.resolve(process.cwd(), '..'), timeout: 300000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                log(`ERROR: fetchRSSAction failed: ${error.message}`);
                resolve({ success: false, message: `${error.message}${stderr ? '\n' + stderr : ''}` });
            } else {
                log("DONE: fetchRSSAction completed successfully");
                resolve({ success: true, message: stdout });
            }
        });
    });
}

export async function getCandidates(): Promise<NewsCandidate[]> {
    const dir = path.join(KB_ROOT, '02_news_candidates');
    let files: string[] = [];
    try {
        files = await fs.readdir(dir);
    } catch {
        return [];
    }

    const candidates: NewsCandidate[] = [];
    for (const file of files) {
        if (!file.endsWith('.txt')) continue;
        const filePath = path.join(dir, file);
        const raw = await fs.readFile(filePath, 'utf-8');

        const title = raw.match(/^Title: (.*)/m)?.[1] || file;
        const evaluationStr = raw.match(/^Evaluation: (.*)/m)?.[1]?.trim() || 'B';
        const evaluation = (['A', 'B', 'C'].includes(evaluationStr) ? evaluationStr : 'B') as 'A'|'B'|'C';
        const reason = raw.match(/^Reason: (.*)/m)?.[1]?.trim() || '';
        const url = raw.match(/^Source: (.*)/m)?.[1] || '';
        const assignedBot = raw.match(/^Assigned Bot: (.*)/m)?.[1]?.trim() || 'None';
        const aiProviderEval = raw.match(/^AI Provider \(Evaluation\): (.*)/m)?.[1]?.trim() || '';
        const aiProviderTrans = raw.match(/^AI Provider \(Translation\): (.*)/m)?.[1]?.trim() || '';
        const aiProvider = aiProviderEval || aiProviderTrans || 'unknown';
        
        const bodyMatch = raw.split('\n\n');
        const body = bodyMatch.length > 1 ? bodyMatch.slice(1).join('\n\n') : '';

        candidates.push({
            id: file,
            title: title.trim(),
            url: url.trim(),
            content: body.trim(),
            date: file.slice(0, 8), // Assuming YYYYMMDD prefix
            evaluation,
            reason,
            assignedBot,
            aiProvider,
        });
    }

    return candidates.sort((a, b) => b.id.localeCompare(a.id));
}

export async function addManualNews(title: string, url: string, content: string) {
    const dir = path.join(KB_ROOT, '02_news_candidates');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `${dateStr}_manual_${Date.now()}.txt`;
    const filePath = path.join(dir, filename);

    const data = `Title: ${title}\nSource: ${url}\n\n${content}`;
    await fs.writeFile(filePath, data);
}
const RSS_FEEDS_FILE = path.resolve(KB_ROOT, '../scripts/rss_feeds.json');

export async function getRSSFeeds(): Promise<string[]> {
    try {
        const raw = await fs.readFile(RSS_FEEDS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export async function addRSSFeed(url: string) {
    const feeds = await getRSSFeeds();
    if (!feeds.includes(url)) {
        feeds.push(url);
        await fs.writeFile(RSS_FEEDS_FILE, JSON.stringify(feeds, null, 4));
    }
    return { success: true };
}

export async function removeRSSFeed(url: string) {
    const feeds = await getRSSFeeds();
    const updated = feeds.filter((f: string) => f !== url);
    await fs.writeFile(RSS_FEEDS_FILE, JSON.stringify(updated, null, 4));
    return { success: true };
}

export async function processCandidates(decisions: {id: string, decision: 'A'|'B'|'C'}[]) {
    const { spawn } = require('child_process');
    const scriptPath = path.resolve(process.cwd(), '../scripts/generate_opinion.sh');
    const candidatesDir = path.join(KB_ROOT, '02_news_candidates');
    const logPath = path.join(KB_ROOT, 'system.log');

    const results: { id: string; success: boolean; error?: string }[] = [];
    if (decisions.length === 0) return results;

    const logStream = createWriteStream(logPath, { flags: 'a' });
    const log = (msg: string) => logStream.write(`[${new Date().toLocaleString()}] ${msg}\n`);

    log(`--- Start Processing Queue (${decisions.length} items) ---`);

    for (const {id, decision} of decisions) {
        const filePath = path.join(candidatesDir, id);

        // Sync decision to disk first (prevents "reverting to B" if script fails)
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const currentEvalMatch = raw.match(/^Evaluation: (.*)$/m);
            const currentEval = currentEvalMatch ? currentEvalMatch[1] : null;

            if (currentEval !== decision) {
                const updated = raw.replace(/^Evaluation: .*$/m, `Evaluation: ${decision}`);
                await fs.writeFile(filePath, updated);
            }
        } catch (e) {
            log(`Failed to sync decision for ${id}: ${e}`);
        }

        if (decision === 'A') {
            log(`ACTION [A]: ${id} -> Starting Pipeline`);
            const promise = new Promise<{ id: string; success: boolean; error?: string }>((resolve) => {
                const child = spawn('bash', [scriptPath, filePath], { 
                    cwd: path.resolve(process.cwd(), '..'),
                    env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' }
                });

                let errorOutput = '';
                child.stdout.on('data', (data: Buffer | string) => logStream.write(`${data}`));
                child.stderr.on('data', (data: Buffer | string) => {
                    const str = data.toString();
                    errorOutput += str;
                    logStream.write(`[ERROR] ${str}`);
                });

                child.on('close', async (code: number) => {
                    if (code === 0) {
                        log(`DONE: ${id} processed successfully.`);
                        // Move to _processed instead of delete
                        try { 
                            const processedDir = path.join(KB_ROOT, '02_news_candidates/_processed');
                            await fs.mkdir(processedDir, { recursive: true }); 
                            await fs.rename(filePath, path.join(processedDir, id));
                        } catch (e) {
                            log(`Failed to move article to _processed: ${e}`);
                        }
                        resolve({ id, success: true });
                    } else {
                        log(`FAIL: ${id} failed with code ${code}.`);
                        resolve({ id, success: false, error: errorOutput.trim() || `Exit code ${code}` });
                    }
                });
            });
            results.push(await promise);
        } else if (decision === 'C') {
            log(`ACTION [C]: ${id} -> DeletingCandidate`);
            try { await fs.unlink(filePath); } catch { }
            results.push({ id, success: true });
        } else if (decision === 'B') {
            log(`ACTION [B]: ${id} -> Remaining in candidates`);
            results.push({ id, success: true });
        }
    }

    log(`--- Queue Processing Completed ---\n`);
    logStream.end();
    return results;
}

export async function getSystemLogs(limit: number = 100) {
    const logPath = path.join(KB_ROOT, 'system.log');
    try {
        const data = await fs.readFile(logPath, 'utf-8');
        const lines = data.trim().split('\n');
        return lines.slice(-limit).join('\n');
    } catch {
        return 'No logs found.';
    }
}

export async function clearSystemLogs() {
    const logPath = path.join(KB_ROOT, 'system.log');
    await fs.writeFile(logPath, '');
    return { success: true };
}

export async function getAISettings() {
    const settingsPath = path.join(KB_ROOT, 'ai_settings.json');
    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        // Default if file doesn't exist
        return {
            active_provider: 'gemini',
            lmstudio_url: 'http://localhost:1234/v1/chat/completions',
            lmstudio_model: 'gemma-4-e2b-it'
        };
    }
}

export async function updateAISettings(settings: any) {
    const settingsPath = path.join(KB_ROOT, 'ai_settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
}

export async function checkLocalAIServer() {
    try {
        const res = await fetch('http://localhost:1234/v1/models', {
            next: { revalidate: 0 },
            signal: AbortSignal.timeout(2000)
        } as any);
        return { online: res.ok };
    } catch {
        return { online: false };
    }
}

/** 
 * Centralized AI Caller that branches based on active_provider.
 * Supporting granular settings per actionKey.
 */
async function callAI(prompt: string, systemMdPath?: string, actionKey?: string): Promise<string> {
    const settings = await getAISettings();
    
    // Determine provider: granular first, then global active_provider, then gemini default
    let provider = settings.active_provider || 'gemini';
    if (actionKey && settings.providers && settings.providers[actionKey]) {
        provider = settings.providers[actionKey];
    }

    const logPath = path.join(KB_ROOT, 'system.log');
    const log = async (msg: string) => {
        try {
            await fs.appendFile(logPath, `[${new Date().toLocaleString()}] [AI_CALL:${actionKey || 'direct'}] ${msg}\n`);
        } catch {}
    };

    await log(`-> Starting AI call using [${provider}] provider.`);

    if (provider === 'gemini') {
        const { exec } = require('child_process');
        const envPart = systemMdPath ? `GEMINI_SYSTEM_MD=${systemMdPath} ` : '';
        const projectRoot = path.resolve(process.cwd(), '..');
        
        // Use the same prompt structure as CLI calls for consistency
        const cmd = `echo ${JSON.stringify(prompt)} | ${envPart}gemini -p "Analyze and generate response" --output-format json --yolo`;
        
        return new Promise((resolve, reject) => {
            exec(cmd, { cwd: projectRoot, timeout: 180000 }, async (error: any, stdout: string) => {
                if (error) {
                    await log(`[ERROR] Gemini call failed: ${error.message}`);
                    reject(error);
                } else {
                    await log(`<- Gemini call completed successfully (${stdout.length} chars).`);
                    resolve(stdout);
                }
            });
        });
    } else {
        const url = settings.lmstudio_url || 'http://localhost:1234/v1/chat/completions';
        const model = settings.lmstudio_model || 'gemma-4-e2b-it';
        
        const projectRoot = path.resolve(process.cwd(), '..');
        let systemContent = '';
        if (systemMdPath) {
            const fullPath = path.join(projectRoot, systemMdPath);
            systemContent = await fs.readFile(fullPath, 'utf-8').catch(() => '');
        }

        const messages: any[] = [];
        if (systemContent) messages.push({ role: 'system', content: systemContent });
        messages.push({ role: 'user', content: prompt });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.3
                }),
                next: { revalidate: 0 }
            });

            if (!response.ok) {
                const errBody = await response.text();
                await log(`[ERROR] AI API failed (${response.status}): ${errBody}`);
                throw new Error(`AI API failed (${response.status}): ${errBody}`);
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            await log(`<- AI call completed successfully (${content.length} chars).`);
            
            // Return wrapped in a JSON structure that matches original CLI behavior
            return JSON.stringify({ response: content });
        } catch (error: any) {
            await log(`[ERROR] AI API fetch failed: ${error.message}`);
            throw error;
        }
    }
}

// ──────────────────────────────────────────────
// Bots Status Management
// ──────────────────────────────────────────────

export type SNSAccount = {
    platform: string;
    handle: string;
    url: string;
};

export type BotAttributes = {
    name: string;
    color: string;
    character: string;
    hobby: string;
    role: string;
    google_account: string;
    sns: SNSAccount[];
    pfp_path: string;
    tone_comments?: {
        style?: string;
        voice?: string;
        excerpts?: string;
        likes?: string;
        dislikes?: string;
    };
};

const BOT_DIRS = [
    'bot_01_observer',
    'bot_02_trader',
    'bot_03_creator',
    'bot_04_auditor',
    'bot_05_wolf'
];

export async function getBotsData() {
    const bots = await Promise.all(BOT_DIRS.map(async (dir, index) => {
        const botPath = path.join(KB_ROOT, '01_bots', dir);
        const attrPath = path.join(botPath, 'attributes.json');
        
        let attributes: BotAttributes = {
            name: dir,
            color: '#4f46e5',
            character: '',
            hobby: '',
            role: '',
            google_account: '',
            sns: [],
            pfp_path: '',
            tone_comments: { style: '', voice: '', excerpts: '', likes: '', dislikes: '' }
        };

        try {
            const attrData = await fs.readFile(attrPath, 'utf-8');
            attributes = JSON.parse(attrData);
        } catch (e) {
            console.warn(`Could not read attributes.json for ${dir}, using defaults.`);
        }

        const persona = await fs.readFile(path.join(botPath, 'persona.md'), 'utf-8').catch(() => '');
        const memory = await fs.readFile(path.join(botPath, 'memory.md'), 'utf-8').catch(() => '');
        const toneVoice = await fs.readFile(path.join(botPath, 'tone_and_voice.md'), 'utf-8').catch(() => '');
        
        return {
            id: dir,
            index: index + 1,
            attributes,
            persona,
            memory,
            toneVoice
        };
    }));

    return { bots };
}

export async function updateBotAttributes(botId: string, attributes: BotAttributes) {
    const attrPath = path.join(KB_ROOT, '01_bots', botId, 'attributes.json');
    await fs.writeFile(attrPath, JSON.stringify(attributes, null, 2));
    return { success: true };
}

export async function uploadBotPFP(botId: string, formData: FormData) {
    const file = formData.get('image') as File;
    if (!file) return { success: false, message: 'No file uploaded' };

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || '.png';
    const filename = `${botId}_${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads/bots');
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicPath = `/uploads/bots/${filename}`;
    
    // Update attributes.json
    const attrPath = path.join(KB_ROOT, '01_bots', botId, 'attributes.json');
    const attrData = await fs.readFile(attrPath, 'utf-8');
    const attributes = JSON.parse(attrData);
    attributes.pfp_path = publicPath;
    await fs.writeFile(attrPath, JSON.stringify(attributes, null, 2));

    return { success: true, path: publicPath };
}

/** 
 * Pending Task を再生成する
 * _pending 内のファイルから SOURCE_FILE を特定し、scripts/generate_opinion.sh を再実行する
 */
export async function regenerateTask(taskId: string, forcedProvider?: 'gemini' | 'lmstudio'): Promise<{ success: boolean; error?: string }> {
    const pendingDir = path.join(KB_ROOT, '03_opinion_gate/_pending');
    const taskPath = path.join(pendingDir, taskId);
    
    try {
        const content = await fs.readFile(taskPath, 'utf-8');
        const sourceMatch = content.match(/<!-- SOURCE_FILE: (.*) -->/);
        let sourceFile = sourceMatch ? sourceMatch[1] : null;

        // Legacy compatibility: If not metadata exists, try to reconstruct from slug
        if (!sourceFile) {
            // Task: 2026-04-03_bot_01_observer_SlugName.md
            const parts = taskId.split('_');
            if (parts.length >= 4) {
                const slugPart = parts.slice(3).join('_').replace('.md', '');
                // Find in _processed
                const processedDir = path.join(KB_ROOT, '02_news_candidates/_processed');
                const files = await fs.readdir(processedDir).catch(() => []);
                const matchFound = files.find(f => f.includes(slugPart));
                if (matchFound) sourceFile = matchFound;
            }
        }

        if (!sourceFile) {
            return { success: false, error: "Original source article not found for this task." };
        }

        const sourcePath = path.join(KB_ROOT, '02_news_candidates/_processed', sourceFile);
        if (!(await fs.access(sourcePath).then(() => true).catch(() => false))) {
            return { success: false, error: `Processed source file missing: ${sourceFile}` };
        }

        const scriptPath = path.resolve(process.cwd(), '../scripts/generate_opinion.sh');
        
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const env: any = { ...process.env };
            if (forcedProvider) {
                env.FORCED_PROVIDER = forcedProvider;
            }

            const child = spawn('bash', [scriptPath, sourcePath], {
                cwd: path.resolve(process.cwd(), '..'),
                env
            });

            let err = '';
            child.stdout.on('data', (d: any) => console.log(d.toString()));
            child.stderr.on('data', (d: any) => err += d.toString());

            child.on('close', async (code: number) => {
                if (code === 0) {
                    // Regeneration succeeded. We now check if the old file still exists.
                    // If the script generated a NEW filename (e.g. today's date),
                    // the old file (taskPath) might still be there.
                    try {
                        // We rely on generate_opinion.sh to overwrite the file if the name stays consistent.
                        // If it changed, we'd have a duplicate, but better than losing the task.
                        // We will avoid force-unlinking here to prevent deleting exactly what we just made.
                    } catch (e) {}

                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: err.trim() || `Regeneration failed with code ${code}` });
                }
            });
        });

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ──────────────────────────────────────────────
// RSS Source System
// ──────────────────────────────────────────────

export type RSSSourceFile = {
    id: string;
    filename: string;
    date: string;
    time: string;
    feedUrl: string;
    size: number;
};

export async function getRSSSources(): Promise<RSSSourceFile[]> {
    const dir = path.join(KB_ROOT, '05_rss_sources');
    let files: string[] = [];
    try {
        files = await fs.readdir(dir);
    } catch {
        return [];
    }

    const sources: RSSSourceFile[] = [];
    for (const file of files) {
        if (!file.endsWith('.xml')) continue;
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        // Expected format: YYYYMMDD_HHMMSS_hash.xml
        const parts = file.split('_');
        const dateStr = parts[0] || '';
        const timeStr = parts[1] || '';
        
        let feedUrl = 'Unknown';
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const match = content.match(/<!-- Source: (.*) -->/);
            if (match) feedUrl = match[1];
        } catch {}

        sources.push({
            id: file,
            filename: file,
            date: dateStr,
            time: timeStr,
            feedUrl,
            size: stats.size,
        });
    }

    // Sort by date/time descending
    return sources.sort((a, b) => b.id.localeCompare(a.id));
}

export async function getRSSSourceContent(filename: string) {
    const filePath = path.join(KB_ROOT, '05_rss_sources', filename);
    const raw = await fs.readFile(filePath, 'utf-8');
    return raw;
}

export async function deleteRSSSource(filename: string) {
    const filePath = path.join(KB_ROOT, '05_rss_sources', filename);
    await fs.unlink(filePath);
    return { success: true };
}
