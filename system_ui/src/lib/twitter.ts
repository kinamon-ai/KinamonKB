'use server';

import { TwitterApi } from 'twitter-api-v2';

// ボットIDから .env.local のプレフィックスに変換
// bot_01_observer → BOT_01
function getBotPrefix(bot: string): string {
    const match = bot.match(/bot_(\d+)/i);
    if (!match) throw new Error(`Unknown bot: ${bot}`);
    return `BOT_${match[1].padStart(2, '0')}`;
}

function getClientForBot(botId: string): { client: TwitterApi, version: 'v1' | 'v2' } {
    const prefix = getBotPrefix(botId);
    const apiKey = process.env[`${prefix}_X_API_KEY`]?.trim();
    const apiSecret = process.env[`${prefix}_X_API_SECRET`]?.trim();
    const accessToken = process.env[`${prefix}_X_ACCESS_TOKEN`]?.trim();
    const accessTokenSecret = process.env[`${prefix}_X_ACCESS_TOKEN_SECRET`]?.trim();

    // Default to v2, but allow v1 via env var
    const version = (process.env[`${prefix}_X_VERSION`]?.trim() || 'v2') as 'v1' | 'v2';

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        console.error(`[X Debug] Missing credentials for prefix: ${prefix}`);
        console.error(`[X Debug] Keys checked: ${prefix}_X_API_KEY, etc.`);
        console.error(`[X Debug] BOT_01_X_API_KEY value length: ${process.env.BOT_01_X_API_KEY?.trim().length || 0}`);
        throw new Error(`Missing X API credentials for ${prefix}. Check .env.local and ensure the server was restarted.`);
    }

    // ⛔️ デバッグ用ログ（ターミナルに出力されます）
    console.log(`[X Debug] Prefix: ${prefix}, Version: ${version}`);
    console.log(`[X Debug] process.env.${prefix}_X_API_KEY length: ${apiKey?.length || 0}`);
    console.log(`[X Debug] process.env.${prefix}_X_ACCESS_TOKEN length: ${accessToken?.length || 0}`);

    const client = new TwitterApi({
        appKey: apiKey as string,
        appSecret: apiSecret as string,
        accessToken: accessToken as string,
        accessSecret: accessTokenSecret as string,
    });

    return { client, version };
}

export async function postTweet(botId: string, text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
        const { client, version } = getClientForBot(botId);
        console.log(`[X Debug] Text length: ${text.length} characters`);
        console.log(`[X Debug] Text preview: ${text.substring(0, 50)}...`);

        if (version === 'v1') {
            const tweet = await client.v1.tweet(text);
            return { success: true, tweetId: tweet.id_str };
        } else {
            // Match tester implementation (use string directly)
            console.log(`[X Debug] Calling v2.tweet(text) with text length: ${text.length}`);
            const result = await client.v2.tweet(text);
            return { success: true, tweetId: result.data.id };
        }
    } catch (err: any) {
        console.error(`[postTweet] Failed for ${botId}. Full error:`);
        console.dir(err, { depth: null });

        // Twitter API errors often have a .data or .errors field
        const errorDetail = err.data?.detail || err.data?.message || (err.errors ? JSON.stringify(err.errors) : '');
        let message = err instanceof Error ? err.message : String(err);

        // X V2 often returns 403 for duplicate tweets
        if (err.code === 403) {
            message = "Forbidden (Possible duplicate post or content filter)";
        }

        const finalMessage = errorDetail ? `${message} (${errorDetail})` : message;

        return { success: false, error: finalMessage };
    }
}
