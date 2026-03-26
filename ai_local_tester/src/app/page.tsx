'use client';

import { useState, useRef } from 'react';
import { 
  Languages, 
  FileText, 
  MessageSquare, 
  Play, 
  Loader2, 
  Settings, 
  Terminal, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Trash2,
  RefreshCw
} from 'lucide-react';

type AITask = 'TRANSLATE' | 'SUMMARIZE' | 'OPINION';

interface TestResult {
  id: string;
  task: AITask;
  input: string;
  output: string;
  timestamp: string;
  duration: number;
  success: boolean;
}

export default function Home() {
  const [task, setTask] = useState<AITask>('OPINION');
  const [input, setInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGemini, setLoadingGemini] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const runTest = async (isGemini = false) => {
    if (!input.trim()) return;
    
    if (isGemini) setLoadingGemini(true);
    else setLoading(true);

    const startTime = performance.now();
    try {
      const endpoint = isGemini ? '/api/test-gemini' : '/api/test-ai';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          task, 
          content: input, 
          systemPrompt: !isGemini ? systemPrompt : undefined,
          systemPromptPath: isGemini ? (task === 'OPINION' ? '.gemini/bot01-system.md' : undefined) : undefined
        }),
      });
      
      const data = await res.json();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      if (data.success) {
        const newResult: TestResult = {
          id: Date.now().toString(),
          task: isGemini ? (`GEMINI_${task}` as any) : task,
          input,
          output: data.result,
          timestamp: new Date().toLocaleTimeString(),
          duration,
          success: true
        };
        setResults([newResult, ...results]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      const errorResult: TestResult = {
        id: Date.now().toString(),
        task: isGemini ? (`GEMINI_${task}` as any) : task,
        input,
        output: err.message || 'Unknown error occurred',
        timestamp: new Date().toLocaleTimeString(),
        duration,
        success: false
      };
      setResults([errorResult, ...results]);
    } finally {
      if (isGemini) setLoadingGemini(false);
      else setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearResults = () => setResults([]);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <Terminal className="text-blue-400" />
              Local AI Performance Tester
            </h1>
            <p className="text-slate-500 text-sm mt-1">Evaluating LMStudio for KinamonKB Transition</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700 backdrop-blur-md">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-xs font-bold tracking-wider text-slate-300">LMSTUDIO READY (1234)</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={18} className="text-blue-400" />
                Test Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Target Task</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'TRANSLATE', label: 'Translation', icon: Languages, color: 'text-blue-400' },
                      { id: 'SUMMARIZE', label: 'Summary', icon: FileText, color: 'text-green-400' },
                      { id: 'OPINION', label: 'Opinion (A/B)', icon: MessageSquare, color: 'text-yellow-400' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTask(t.id as AITask)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          task === t.id 
                            ? 'bg-blue-600/10 border-blue-500 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <t.icon size={18} className={t.color} />
                          <span className="text-sm font-medium">{t.label}</span>
                        </div>
                        {task === t.id && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">System Prompt (Optional)</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt instructions..."
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] font-mono text-slate-300"
                  />
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setSystemPrompt('You are Kina Fox, a professional news analyst.')}
                      className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 text-slate-400"
                    >
                      Kina Fox Setup
                    </button>
                    <button 
                      onClick={() => setSystemPrompt('')}
                      className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 text-slate-400"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/10 rounded-2xl p-6">
              <p className="text-xs text-blue-300 leading-relaxed italic">
                &quot;Evaluating whether local models can maintain the same nuance and structured output as Gemini-1.5-Flash.&quot;
              </p>
            </div>
          </div>

          {/* Input & Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Play size={18} className="text-green-400" />
                  Source Content
                </h2>
              </div>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the news headline or article body here..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[180px] shadow-inner"
              />
              
              <div className="mt-4 flex flex-col gap-3">
                <button
                  onClick={() => runTest(false)}
                  disabled={loading || loadingGemini || !input.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Processing on Local AI...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Execute Local AI Test
                    </>
                  )}
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => runTest(true)}
                    disabled={loading || loadingGemini || !input.trim()}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl border border-slate-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loadingGemini ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Gemini CLI...
                      </>
                    ) : (
                      <>
                        <Terminal size={18} className="text-blue-400" />
                        Compare with Gemini CLI
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setInput('')}
                    className="bg-slate-800 hover:bg-slate-700 px-4 rounded-xl border border-slate-700 transition-colors"
                    title="Clear Input"
                  >
                    <RefreshCw size={18} className="text-slate-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-400 px-2">Recent Execution History</h2>
                <button 
                  onClick={clearResults}
                  disabled={results.length === 0}
                  className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1"
                >
                  <Trash2 size={12} />
                  Clear All
                </button>
              </div>

              <div className="space-y-6">
                {results.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">
                    <Loader2 size={40} className="mb-4 opacity-5" />
                    <p className="font-medium">No results yet. Run a test to start evaluation.</p>
                  </div>
                ) : (
                  results.map((res) => (
                    <div 
                      key={res.id} 
                      className={`group overflow-hidden rounded-2xl border transition-all animate-in fade-in slide-in-from-top-4 ${
                        res.success ? 'bg-slate-900/60 border-slate-800' : 'bg-red-900/10 border-red-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between px-6 py-3 bg-slate-800/30 border-b border-slate-800/50">
                        <div className="flex items-center gap-3">
                          {res.success ? (
                            <CheckCircle size={14} className="text-green-400" />
                          ) : (
                            <AlertCircle size={14} className="text-red-400" />
                          )}
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{res.task}</span>
                          <span className="text-[10px] text-slate-600 font-mono">{res.timestamp}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950/50 text-blue-400 font-mono border border-blue-500/10">
                            {res.duration}ms
                          </span>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(res.output)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Output"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[9px] font-bold text-slate-600 uppercase mb-2 block tracking-tighter">Input Segment</label>
                          <div className="text-xs text-slate-400 line-clamp-6 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 whitespace-pre-wrap">
                            {res.input}
                          </div>
                        </div>
                        <div>
                          <label className={`text-[9px] font-bold uppercase mb-2 block tracking-tighter ${res.success ? 'text-blue-500' : 'text-red-500'}`}>
                            {res.success ? 'Local AI Response' : 'Execution Failed'}
                          </label>
                          <div className={`text-sm rounded-lg border p-4 font-mono overflow-auto max-h-[300px] whitespace-pre-wrap ${
                            res.success ? 'bg-slate-950 text-slate-200 border-slate-700' : 'bg-red-950/30 text-red-300 border-red-900/50'
                          }`}>
                            {res.output}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
