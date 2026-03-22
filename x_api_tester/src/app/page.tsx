'use client';

import { useState } from 'react';
import { Send, User, Search, CheckCircle, AlertCircle, Loader2, Settings2 } from 'lucide-react';

const prefixes = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'];

export default function Home() {
  const [selectedPrefix, setSelectedPrefix] = useState(prefixes[0]);
  const [apiVersion, setApiVersion] = useState<'v1' | 'v2'>('v2');
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const runTest = async (endpoint: string, params: any = {}) => {
    setLoading(endpoint);
    setResults(null);
    try {
      const res = await fetch('/api/test-x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: selectedPrefix,
          endpoint,
          version: apiVersion,
          params
        }),
      });
      const data = await res.json();
      setResults({ endpoint, version: apiVersion, ...data });
    } catch (err: any) {
      setResults({ endpoint, version: apiVersion, success: false, error: err.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col gap-6 border-b border-slate-700 pb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              X API Multi-Version Tester
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Status:</span>
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-[10px] text-green-400 font-medium">SYSTEM CONNECTED</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <User size={18} className="text-slate-400" />
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Target Bot Account</label>
                <select
                  value={selectedPrefix}
                  onChange={(e) => setSelectedPrefix(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {prefixes.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <Settings2 size={18} className="text-slate-400" />
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">API Version Context</label>
                <div className="flex gap-1 p-1 bg-slate-900 rounded border border-slate-700">
                  <button
                    onClick={() => setApiVersion('v1')}
                    className={`flex-1 py-1 text-xs font-bold rounded transition-all ${apiVersion === 'v1' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}
                  >
                    V1.1 (OAuth 1.0a)
                  </button>
                  <button
                    onClick={() => setApiVersion('v2')}
                    className={`flex-1 py-1 text-xs font-bold rounded transition-all ${apiVersion === 'v2' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-500'}`}
                  >
                    V2 (OAuth 1.0a Context)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Test Controls */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-300 flex items-center gap-2">
              Available Tests <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">{apiVersion.toUpperCase()} MODE</span>
            </h2>

            <button
              onClick={() => runTest('me')}
              disabled={!!loading}
              className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <User size={20} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Verify Identity</div>
                  <div className="text-xs text-slate-500">{apiVersion === 'v1' ? 'v1.1/verify_credentials' : 'v2/me'}</div>
                </div>
              </div>
              {loading === 'me' ? <Loader2 className="animate-spin text-blue-400" /> : <div className="text-slate-600 text-xs">RUN TEST</div>}
            </button>

            <button
              onClick={() => runTest('post', { text: `Kinamon API Test [${apiVersion}] at ${new Date().toLocaleTimeString()}` })}
              disabled={!!loading}
              className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                  <Send size={20} className="text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Post Tweet</div>
                  <div className="text-xs text-slate-500">{apiVersion === 'v1' ? 'v1.1/statuses/update' : 'v2/tweets'}</div>
                </div>
              </div>
              {loading === 'post' ? <Loader2 className="animate-spin text-green-400" /> : <div className="text-slate-600 text-xs">RUN TEST</div>}
            </button>

            {apiVersion === 'v2' && (
              <button
                onClick={() => runTest('search')}
                disabled={!!loading}
                className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                    <Search size={20} className="text-yellow-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Search Recent</div>
                    <div className="text-xs text-slate-500">v2/tweets/search/recent</div>
                  </div>
                </div>
                {loading === 'search' ? <Loader2 className="animate-spin text-yellow-400" /> : <div className="text-slate-600 text-xs">RUN TEST</div>}
              </button>
            )}

            <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-300 leading-relaxed">
                <AlertCircle size={12} className="inline mr-1 mb-0.5" />
                <strong>Debug Tip:</strong> If V1.1 works but V2 fails with 503/403, your App is likely not attached to a Project in the X Developer Console.
              </p>
            </div>
          </section>

          {/* Result Display */}
          <section className="space-y-4 flex flex-col h-full">
            <h2 className="text-xl font-semibold text-slate-300">Execution Result</h2>
            {results ? (
              <div className={`p-6 rounded-xl border flex-1 flex flex-col ${results.success ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700/50">
                  {results.success ? <CheckCircle size={20} className="text-green-500" /> : <AlertCircle size={20} className="text-red-500" />}
                  <div>
                    <div className="font-bold text-sm uppercase tracking-widest">{results.success ? 'Transaction Success' : 'Transaction Failed'}</div>
                    <div className="text-[10px] text-slate-500 font-mono underline decoration-dotted">EP: {results.endpoint} (API {results.version})</div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                  {results.success ? (
                    <div className="flex-1 flex flex-col">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Response Payload:</div>
                      <pre className="flex-1 text-[11px] bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-auto font-mono text-green-400/80">
                        {JSON.stringify(results.data, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-sm font-medium">
                        {results.error}
                      </div>
                      {results.code && <div className="text-slate-500 text-xs font-mono">Status Code: {results.code}</div>}
                      {results.data && (
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Error Details:</div>
                          <pre className="flex-1 text-[11px] bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-auto font-mono text-red-300/80">
                            {JSON.stringify(results.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-800/20 rounded-xl border border-slate-700 border-dashed text-slate-600">
                <Loader2 size={48} className={`mb-4 opacity-5 ${loading ? 'animate-spin opacity-20' : ''}`} />
                <p className="text-sm font-medium">{loading ? 'Negotiating with X API...' : 'Run a test to inspect protocol data'}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
