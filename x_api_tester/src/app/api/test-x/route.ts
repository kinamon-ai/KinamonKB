import { NextResponse } from 'next/server';
import { testEndpoint } from '@/lib/x-test';

export async function POST(request: Request) {
    const { prefix, endpoint, version, params } = await request.json();

    if (!prefix || !endpoint || !version) {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const result = await testEndpoint(prefix, endpoint, version, params);
    return NextResponse.json(result);
}
