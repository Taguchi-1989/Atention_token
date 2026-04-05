'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchTasks, fetchBaselines, createBaseline, runTask, fetchTaskStatus, getTaskPreviewUrl } from '@/lib/api';
import { Play, Loader2, X, Terminal, ArrowRight, Plus, ChevronDown, Eye } from 'lucide-react';

interface Task {
  task_id: string;
  description: string;
  start_condition: string;
  goal_condition: string;
}

interface Baseline {
  baseline_id: string;
  model: string;
  engine: string;
  temperature: number;
  created_at: string;
}

interface LogEvent {
  type: string;
  step?: number;
  message?: string;
  action?: string;
  target?: string;
  note?: string;
  success?: boolean;
  timestamp: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(true);
  const [selectedBaseline, setSelectedBaseline] = useState('');

  // Preview State
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  // Log Viewer State
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [finished, setFinished] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Baseline creation
  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [newBaselineId, setNewBaselineId] = useState('');

  useEffect(() => {
    Promise.all([fetchTasks(), fetchBaselines()])
      .then(([t, b]) => {
        setTasks(t);
        setBaselines(b);
        if (b.length > 0) setSelectedBaseline(b[0].baseline_id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleCreateBaseline = async () => {
    if (!newBaselineId.trim()) return;
    try {
      const bl = await createBaseline({ baseline_id: newBaselineId.trim() });
      setBaselines(prev => [bl, ...prev]);
      setSelectedBaseline(bl.baseline_id);
      setNewBaselineId('');
      setShowBaselineForm(false);
    } catch {
      alert('ベースラインの作成に失敗しました');
    }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowLogs(false);
    stopPolling();
    setRunning(null);
  }, [stopPolling]);

  const handleRun = useCallback(async (taskId: string) => {
    const blId = selectedBaseline || 'BL-DEFAULT';

    // Clear any existing poll before starting a new one
    stopPolling();

    setRunning(taskId);
    setLogs([]);
    setFinished(false);
    setShowLogs(true);

    try {
      await runTask(taskId, blId, mockMode);

      let errorCount = 0;
      pollRef.current = setInterval(async () => {
        try {
          const status = await fetchTaskStatus(taskId);
          errorCount = 0; // reset on success
          if (status.logs) {
            setLogs(status.logs as LogEvent[]);
            const last = status.logs[status.logs.length - 1];
            if (last && (last.type === 'complete' || last.type === 'error' || last.type === 'success')) {
              stopPolling();
              setRunning(null);
              setFinished(true);
            }
          }
        } catch {
          errorCount++;
          if (errorCount >= 10) {
            stopPolling();
            setRunning(null);
            setFinished(true);
            setLogs(prev => [...prev, { type: 'error', message: 'サーバーとの接続が切れました', timestamp: new Date().toISOString() }]);
          }
        }
      }, 1000);
    } catch {
      alert('タスクの開始に失敗しました');
      setRunning(null);
    }
  }, [selectedBaseline, mockMode, stopPolling]);

  return (
    <DashboardLayout>
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            タスクライブラリ
          </h2>
          <p className="text-text-muted mt-2">評価タスクシナリオの管理と実行</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Baseline Selector */}
          <div className="flex items-center gap-2 bg-surface-highlight/50 p-2 rounded-lg border border-white/5">
            <ChevronDown size={14} className="text-text-muted" />
            <select
              value={selectedBaseline}
              onChange={e => setSelectedBaseline(e.target.value)}
              title="Select baseline"
              className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            >
              {baselines.length === 0 && <option value="">ベースラインなし</option>}
              {baselines.map(bl => (
                <option key={bl.baseline_id} value={bl.baseline_id}>
                  {bl.baseline_id}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="新規ベースライン作成"
              onClick={() => setShowBaselineForm(true)}
              className="text-text-muted hover:text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Mock Toggle */}
          <div className="flex items-center gap-3 bg-surface-highlight/50 p-2 px-3 rounded-lg border border-white/5">
            <span className={`text-sm font-medium ${!mockMode ? 'text-white' : 'text-text-muted'}`}>実LLM</span>
            <button
              type="button"
              title={mockMode ? '実LLMに切替' : 'モックに切替'}
              onClick={() => setMockMode(!mockMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mockMode ? 'bg-primary' : 'bg-white/20'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mockMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${mockMode ? 'text-white' : 'text-text-muted'}`}>モック</span>
          </div>
        </div>
      </header>

      {/* Baseline Creation Mini-Form */}
      {showBaselineForm && (
        <div className="mb-6 glass-panel p-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="e.g. BL-2026-H1"
            value={newBaselineId}
            onChange={e => setNewBaselineId(e.target.value)}
            className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary flex-1 max-w-xs"
          />
          <button type="button" onClick={handleCreateBaseline} className="btn-primary text-sm px-4 py-2">
            作成
          </button>
          <button type="button" onClick={() => setShowBaselineForm(false)} className="text-text-muted hover:text-white" title="キャンセル">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-white/10 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-surface-highlight/30">
              <div className="flex items-center gap-2 text-sm">
                <Eye size={16} className="text-primary" />
                <span>プレビュー: {previewTask.description}</span>
              </div>
              <button type="button" onClick={() => setPreviewTask(null)} className="text-text-muted hover:text-white" title="閉じる">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={getTaskPreviewUrl(previewTask.task_id)}
                className="w-full h-full min-h-[500px] bg-white"
                sandbox="allow-same-origin"
                title={`Preview: ${previewTask.task_id}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-surface-highlight/30">
              <div className="flex items-center gap-2 font-mono text-sm">
                <Terminal size={16} className="text-primary" />
                <span>エージェント実行ログ</span>
                {running && <Loader2 size={14} className="animate-spin text-text-muted" />}
                {finished && <span className="text-success text-xs ml-2">完了</span>}
              </div>
              <button type="button" onClick={handleCloseModal} className="text-text-muted hover:text-white" title="ログを閉じる">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d1117] font-mono text-xs md:text-sm">
              {logs.length === 0 && (
                <div className="text-text-muted italic">エージェントの初期化を待っています...</div>
              )}
              {logs.map((log, idx) => (
                <div key={idx} className={`p-2 rounded border-l-2 ${
                  log.type === 'error' ? 'border-error bg-error/5' :
                  log.type === 'complete' || log.type === 'success' ? 'border-success bg-success/5' :
                  log.type === 'action' ? 'border-secondary bg-secondary/5' :
                  'border-transparent'
                }`}>
                  <div className="flex gap-2 text-text-muted/50 text-[10px] mb-1">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {log.step != null && <span>Step {log.step}</span>}
                  </div>
                  {log.type === 'action' ? (
                    <div>
                      <div className="font-bold text-secondary mb-1 flex items-center gap-2">
                        ACTION: {log.action} <ArrowRight size={12} /> {log.target}
                      </div>
                      {log.note && <div className="text-text-muted pl-4">&quot;{log.note}&quot;</div>}
                    </div>
                  ) : log.type === 'complete' ? (
                    <div className="text-success font-bold">
                      {log.success ? '実行が正常に完了しました' : '実行が失敗で終了しました'}
                    </div>
                  ) : log.type === 'error' ? (
                    <div className="text-error font-bold">{log.message}</div>
                  ) : (
                    <div className="text-text-muted">{log.message}</div>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <div key={task.task_id} className="glass-panel p-6 flex flex-col h-full group hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-surface-highlight px-2 py-1 rounded text-xs font-mono text-primary/80 border border-primary/10">
                  {task.task_id}
                </div>
                <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]"></div>
              </div>

              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {task.description}
              </h3>

              <div className="flex-1 space-y-3 mt-4">
                <div className="text-sm text-text-muted">
                  <span className="block text-xs uppercase tracking-wider opacity-50 mb-1">開始条件</span>
                  {task.start_condition}
                </div>
                <div className="text-sm text-text-muted">
                  <span className="block text-xs uppercase tracking-wider opacity-50 mb-1">ゴール</span>
                  {task.goal_condition}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTask(task)}
                  className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-text-muted hover:text-white"
                  title="プレビュー"
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRun(task.task_id)}
                  disabled={!!running}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running === task.task_id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} className="fill-current" />
                  )}
                  {running === task.task_id ? '実行中...' : '分析実行'}
                </button>
              </div>
            </div>
          ))}

          {/* Add New Placeholder */}
          <div className="glass-panel border-dashed border-white/10 flex flex-col items-center justify-center p-6 min-h-[300px] cursor-pointer hover:bg-white/5 transition-colors text-text-muted hover:text-white">
            <div className="w-12 h-12 rounded-full bg-surface-highlight flex items-center justify-center mb-4">
              <span className="text-2xl">+</span>
            </div>
            <p className="font-medium">新規タスク定義</p>
            <p className="text-xs opacity-50 mt-2 text-center">YAML定義を作成して<br/>シナリオを追加</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
