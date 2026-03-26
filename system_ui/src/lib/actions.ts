'use server';

import fs from 'fs/promises';
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

    // Update growth_log.md
    const logPath = path.join(KB_ROOT, '01_bots/bot_01_observer/growth_log.md');
    const logContent = await fs.readFile(logPath, 'utf-8');
    const newsTitle = taskId.replace('.md', '');
    const updatedLog = logContent.includes('| - |')
        ? logContent.replace('| - | _(記録なし)_ | | | |', `| 1 | ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`)
        : logContent + `\n| ${new Date().toISOString().split('T')[0]} | ${newsTitle} | ${choice} | ${feedback} |`;

    await fs.writeFile(logPath, updatedLog);

    // Generate feedback knowledge asynchronously (fire-and-forget)
    generateFeedback(content, choice, feedback, postContent).catch(console.error);

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

    const candidates = await safeReadDirCount(path.join(KB_ROOT, '01_bots/bot_01_observer/_news_candidates'));
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

async function generateFeedback(taskContent: string, choice: 'A' | 'B', userFeedback: string, postContent: string) {
    const { exec } = require('child_process');
    const projectRoot = path.resolve(process.cwd(), '..');
    const feedbackKnowledgePath = path.join(KB_ROOT, '01_bots/bot_01_observer/feedback_knowledge.md');

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
        exec(scriptPath, { cwd: path.resolve(process.cwd(), '..'), timeout: 600000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                resolve({ success: false, message: `Error: ${error.message}\n${stderr}` });
            } else {
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
export async function getDecisionCount(): Promise<{ count: number; threshold: number }> {
    const threshold = 10;
    const logPath = path.join(KB_ROOT, '01_bots/bot_01_observer/growth_log.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots/bot_01_observer/_identity_proposals');

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
export async function generateIdentityProposal(): Promise<{ success: boolean; message: string }> {
    const { exec } = require('child_process');
    const projectRoot = path.resolve(process.cwd(), '..');
    const personaPath = path.join(KB_ROOT, '01_bots/bot_01_observer/persona.md');
    const feedbackPath = path.join(KB_ROOT, '01_bots/bot_01_observer/feedback_knowledge.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots/bot_01_observer/_identity_proposals');
    const logPath = path.join(KB_ROOT, '01_bots/bot_01_observer/growth_log.md');

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

    return new Promise((resolve) => {
        const cmd = `echo ${JSON.stringify(analysisInput)} | GEMINI_SYSTEM_MD=.gemini/identity-system.md gemini -p "persona.mdへの更新提案を生成してください" --output-format json --yolo`;

        exec(cmd, { cwd: projectRoot, timeout: 180000 }, async (error: Error | null, stdout: string) => {
            if (error) {
                return resolve({ success: false, message: `Error: ${error.message}` });
            }
            try {
                const parsed = JSON.parse(stdout);
                let rawResponse = parsed.response || '';
                rawResponse = rawResponse.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

                if (!rawResponse) {
                    return resolve({ success: false, message: 'Empty response from Gemini' });
                }

                const dateStr = new Date().toISOString().split('T')[0];
                const filename = `${dateStr}_proposal.md`;
                await fs.writeFile(path.join(proposalsDir, filename), rawResponse);
                resolve({ success: true, message: filename });
            } catch (e: unknown) {
                resolve({ success: false, message: `Parse error: ${String(e)}` });
            }
        });
    });
}

/** 保存された提案ファイル一覧を読み込んで返す */
export async function getIdentityProposals(): Promise<IdentityProposal[]> {
    const proposalsDir = path.join(KB_ROOT, '01_bots/bot_01_observer/_identity_proposals');
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
    acceptedTexts: string[]   // 承認された提案の文言リスト
): Promise<{ success: boolean }> {
    const personaPath = path.join(KB_ROOT, '01_bots/bot_01_observer/persona.md');
    const proposalsDir = path.join(KB_ROOT, '01_bots/bot_01_observer/_identity_proposals');

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
};

export async function fetchRSSAction() {
    const { exec } = require('child_process');
    const pythonPath = path.resolve(process.cwd(), '../venv/bin/python');
    const scriptPath = path.resolve(process.cwd(), '../scripts/fetch_news.py');

    return new Promise<{ success: boolean; message: string }>((resolve) => {
        exec(`${pythonPath} ${scriptPath}`, { cwd: path.resolve(process.cwd(), '..'), timeout: 300000 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                resolve({ success: false, message: `${error.message}${stderr ? '\n' + stderr : ''}` });
            } else {
                resolve({ success: true, message: stdout });
            }
        });
    });
}

export async function getCandidates(): Promise<NewsCandidate[]> {
    const dir = path.join(KB_ROOT, '01_bots/bot_01_observer/_news_candidates');
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

        const title = raw.match(/^Title: (.*)/)?.[1] || file;
        const evaluationStr = raw.match(/^Evaluation: (.*)/)?.[1]?.trim() || 'B';
        const evaluation = (['A', 'B', 'C'].includes(evaluationStr) ? evaluationStr : 'B') as 'A'|'B'|'C';
        const reason = raw.match(/^Reason: (.*)/)?.[1]?.trim() || '';
        const url = raw.match(/^Source: (.*)/)?.[1] || '';
        
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
        });
    }

    return candidates.sort((a, b) => b.id.localeCompare(a.id));
}

export async function addManualNews(title: string, url: string, content: string) {
    const dir = path.join(KB_ROOT, '01_bots/bot_01_observer/_news_candidates');
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
    const { exec } = require('child_process');
    const scriptPath = path.resolve(process.cwd(), '../scripts/generate_opinion.sh');
    const candidatesDir = path.join(KB_ROOT, '01_bots/bot_01_observer/_news_candidates');

    const results = [];
    for (const {id, decision} of decisions) {
        const filePath = path.join(candidatesDir, id);

        if (decision === 'A') {
            const promise = new Promise<{ id: string; success: boolean }>((resolve) => {
                exec(`"${scriptPath}" "${filePath}"`, { cwd: path.resolve(process.cwd(), '..'), timeout: 180000 }, async (error: Error | null) => {
                    if (!error) {
                        try { await fs.unlink(filePath); } catch { }
                        resolve({ id, success: true });
                    } else {
                        resolve({ id, success: false });
                    }
                });
            });
            results.push(await promise);
        } else if (decision === 'C') {
            try { await fs.unlink(filePath); } catch { }
            results.push({ id, success: true });
        } else if (decision === 'B') {
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                if (!raw.includes(`Evaluation: ${decision}`)) {
                    const updated = raw.replace(/^Evaluation: .*$/m, `Evaluation: ${decision}`);
                    await fs.writeFile(filePath, updated);
                }
            } catch { }
            results.push({ id, success: true });
        }
    }

    return results;
}
