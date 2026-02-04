'use client';

import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchTasks, runTask, fetchTaskStatus } from '@/lib/api';
import { Play, CheckCircle, AlertOctagon, Loader2, X, Terminal, ArrowRight } from 'lucide-react';

interface Task {
  task_id: string;
  description: string;
  start_condition: string;
  goal_condition: string;
}

interface LogEvent {
  type: 'start' | 'step' | 'action' | 'success' | 'error';
  step?: number;
  message?: string;
  action?: string;
  target?: string;
  note?: string;
  timestamp: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(true);
  
  // Log Viewer State
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks()
      .then(data => setTasks(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Scroll to bottom of logs
  useEffect(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, showLogs]);

  const handleRun = async (taskId: string) => {
    setRunning(taskId);
    setLogs([]);
    setShowLogs(true);
    
    try {
      await runTask(taskId, 'BL-UI-001', mockMode); 
      
      // Start Polling
      const pollInterval = setInterval(async () => {
          try {
              const status = await fetchTaskStatus(taskId);
              if (status.logs) {
                  setLogs((status.logs as LogEvent[])); // Replace robustly for MVP
                  
                  // Check termination
                  const lastLog = status.logs[status.logs.length - 1];
                  if (lastLog && (lastLog.type === 'success' || lastLog.type === 'error')) {
                      clearInterval(pollInterval);
                      setRunning(null);
                  }
              }
          } catch (e) {
              console.error("Polling error", e);
          }
      }, 1000);

    } catch (e) {
      alert('Failed to start task');
      setRunning(null);
    }
  };

  return (
    <DashboardLayout>
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
            Task Library
          </h2>
          <p className="text-text-muted mt-2">Manage and execute evaluation tasks scenarios.</p>
        </div>

        <div className="flex items-center gap-3 bg-surface-highlight/50 p-3 rounded-lg border border-white/5">
            <span className={`text-sm font-medium ${!mockMode ? 'text-white' : 'text-text-muted'}`}>Real LLM</span>
            
            <button 
                onClick={() => setMockMode(!mockMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface ${mockMode ? 'bg-primary' : 'bg-white/20'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mockMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            
            <span className={`text-sm font-medium ${mockMode ? 'text-white' : 'text-text-muted'}`}>Mock Mode</span>
        </div>
      </header>
      
      {/* Log Viewer Overlay/Modal */}
      {showLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-surface border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center p-4 border-b border-white/10 bg-surface-highlight/30">
                      <div className="flex items-center gap-2 font-mono text-sm">
                          <Terminal size={16} className="text-primary" />
                          <span>Agent Execution Logs</span>
                          {running && <Loader2 size={14} className="animate-spin text-text-muted" />}
                      </div>
                      <button onClick={() => setShowLogs(false)} className="text-text-muted hover:text-white">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d1117] font-mono text-xs md:text-sm">
                      {logs.length === 0 && (
                          <div className="text-text-muted italic">Waiting for agent to initialize...</div>
                      )}
                      
                      {logs.map((log, idx) => (
                          <div key={idx} className={`p-2 rounded border-l-2 ${
                              log.type === 'error' ? 'border-error bg-error/5' : 
                              log.type === 'success' ? 'border-success bg-success/5' : 
                              log.type === 'action' ? 'border-secondary bg-secondary/5' :
                              'border-transparent'
                          }`}>
                              <div className="flex gap-2 text-text-muted/50 text-[10px] mb-1">
                                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                  {log.step && <span>Step {log.step}</span>}
                              </div>
                              
                              {log.type === 'action' ? (
                                  <div>
                                     <div className="font-bold text-secondary mb-1 flex items-center gap-2">
                                        ACTION: {log.action} <ArrowRight size={12} /> {log.target}
                                     </div>
                                     <div className="text-text-muted pl-4">"{log.note}"</div>
                                  </div>
                              ) : log.type === 'start' ? (
                                  <div className="text-primary font-bold">{log.message}</div>
                              ) : log.type === 'success' ? (
                                  <div className="text-success font-bold text-lg">{log.message}</div>
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
          {tasks.map((task) => (
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
                  <span className="block text-xs uppercase tracking-wider opacity-50 mb-1">Start Condition</span>
                  {task.start_condition}
                </div>
                <div className="text-sm text-text-muted">
                  <span className="block text-xs uppercase tracking-wider opacity-50 mb-1">Goal</span>
                  {task.goal_condition}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => handleRun(task.task_id)}
                  disabled={!!running}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running === task.task_id ? (
                      <Loader2 size={16} className="animate-spin" />
                  ) : (
                      <Play size={16} className="fill-current" />
                  )}
                  {running === task.task_id ? 'Queued...' : 'Run Analysis'}
                </button>
              </div>
            </div>
          ))}

          {/* Add New Placeholder */}
          <div className="glass-panel border-dashed border-white/10 flex flex-col items-center justify-center p-6 min-h-[300px] cursor-pointer hover:bg-white/5 transition-colors text-text-muted hover:text-white">
             <div className="w-12 h-12 rounded-full bg-surface-highlight flex items-center justify-center mb-4">
                <span className="text-2xl">+</span>
             </div>
             <p className="font-medium">Define New Task</p>
             <p className="text-xs opacity-50 mt-2 text-center">Create a YAML definition<br/>to add a new scenario.</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
