'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchConfig, updateConfig } from '@/lib/api';
import { Settings, Save, RefreshCw, Server, Cpu, Thermometer } from 'lucide-react';

export default function SettingsPage() {
    const [config, setConfig] = useState({
        ollama_url: '',
        model_name: '',
        temperature: 0.7
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = () => {
        setLoading(true);
        fetchConfig()
            .then(data => setConfig(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateConfig(config);
            alert('設定を保存しました');
        } catch (e) {
            console.error(e);
            alert('設定の保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto">
                <header className="mb-8 flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                        <Settings size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-white">システム設定</h2>
                        <p className="text-text-muted mt-1">ローカルLLM接続とエージェント動作パラメータの設定</p>
                    </div>
                </header>

                <div className={`glass-panel p-8 space-y-8 ${loading ? 'opacity-50' : ''}`}>
                    {/* Ollama Connection Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold text-white border-b border-white/10 pb-2">
                            <Server size={20} className="text-secondary" />
                            <h3>LLM 接続</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-medium text-text-muted">Ollama ベース URL</label>
                                <input 
                                    type="text" 
                                    value={config.ollama_url}
                                    onChange={e => setConfig({...config, ollama_url: e.target.value})}
                                    className="w-full bg-surface-highlight border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                    placeholder="http://localhost:11434"
                                />
                                <p className="text-xs text-text-muted/60">ローカルの Ollama インスタンスのエンドポイント</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted">モデル名</label>
                                <input 
                                    type="text" 
                                    value={config.model_name}
                                    onChange={e => setConfig({...config, model_name: e.target.value})}
                                    className="w-full bg-surface-highlight border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                    placeholder="llama3"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Agent Parameters Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold text-white border-b border-white/10 pb-2">
                            <Cpu size={20} className="text-primary" />
                            <h3>エージェントパラメータ</h3>
                        </div>

                        <div className="space-y-6">
                             <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-sm font-medium text-text-muted flex items-center gap-2">
                                        <Thermometer size={16} /> Temperature
                                    </label>
                                    <span className="text-white font-mono bg-surface-highlight px-2 rounded">{config.temperature}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1"
                                    value={config.temperature}
                                    onChange={e => setConfig({...config, temperature: parseFloat(e.target.value)})}
                                    className="w-full h-2 bg-surface-highlight rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <p className="text-xs text-text-muted/60">ランダム性の制御: 0 = 決定的、1 = 創造的</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                        <button 
                            onClick={loadConfig}
                            className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-text-muted flex items-center gap-2"
                        >
                            <RefreshCw size={18} /> リセット
                        </button>
                         <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-primary px-8 py-3 flex items-center gap-2 shadow-lg shadow-primary/20"
                        >
                            <Save size={18} />
                            {saving ? '保存中...' : '設定を保存'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
