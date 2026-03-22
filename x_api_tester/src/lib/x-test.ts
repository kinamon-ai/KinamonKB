import { TwitterApi } from 'twitter-api-v2';

export function getXClient(prefix: string, version: 'v1' | 'v2' = 'v2') {
    const apiKey = process.env[`${prefix}_X_API_KEY`];
    const apiSecret = process.env[`${prefix}_X_API_SECRET`];
    const accessToken = process.env[`${prefix}_X_ACCESS_TOKEN`];
    const accessTokenSecret = process.env[`${prefix}_X_ACCESS_TOKEN_SECRET`];

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        throw new Error(`Missing credentials for ${prefix}`);
    }

    const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret,
    });

    return client;
}

export async function testEndpoint(prefix: string, endpoint: string, version: 'v1' | 'v2', params?: any) {
    const client = getXClient(prefix, version);

    try {
        if (version === 'v1') {
            switch (endpoint) {
                case 'me':
                    const verify = await client.v1.verifyCredentials();
                    return { success: true, data: verify };
                case 'post':
                    const tweet = await client.v1.tweet(params.text || 'Test tweet (v1.1) from Kinamon X API Tester');
                    return { success: true, data: tweet };
                default:
                    throw new Error(`Endpoint ${endpoint} not implemented for v1 in tester`);
            }
        } else {
            switch (endpoint) {
                case 'me':
                    const me = await client.v2.me();
                    return { success: true, data: me.data };
                case 'post':
                    const tweet = await client.v2.tweet(params.text || 'Test tweet (v2) from Kinamon X API Tester');
                    return { success: true, data: tweet.data };
                case 'search':
                    const search = await client.v2.search('javascript', { 'tweet.fields': ['created_at'] });
                    return { success: true, data: search.data };
                default:
                    throw new Error(`Endpoint ${endpoint} not implemented for v2 in tester`);
            }
        }
    } catch (error: any) {
        console.error(`X API Error (${version}/${endpoint}):`, error);
        return {
            success: false,
            error: error.message,
            data: error.data,
            code: error.code,
        };
    }
}
