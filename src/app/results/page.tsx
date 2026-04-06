'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import { ArrowRight, Zap, Eye, Brain, AlertTriangle, CheckCircle, TrendingDown, BarChart2, FlaskConical, Lightbulb } from 'lucide-react';

export default function ResultsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-12 pb-16">

        {/* ─── ヒーローセクション ─── */}
        <section className="relative py-16 px-8 rounded-3xl overflow-hidden bg-gradient-to-br from-surface-highlight via-surface to-background border border-white/5 shadow-2xl">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase">
              <FlaskConical size={14} />
              実験結果レポート
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white/60">
                AIの「迷い」で
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                UIの品質を測る
              </span>
            </h1>

            <p className="text-text-muted text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              シンプルなフォーム（3項目）と複雑なフォーム（18項目）を
              AIエージェントに操作させた結果、認知負荷スコアに<strong className="text-white">7.1倍</strong>の差が出ました。
            </p>

            <div className="flex justify-center gap-4">
              <Link href="/ledger" className="btn-primary flex items-center gap-2 px-6 py-3">
                実行台帳で結果を見る <ArrowRight size={16} />
              </Link>
              <Link href="/tasks" className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-white font-medium">
                自分で試す
              </Link>
            </div>
          </div>
        </section>

        {/* ─── メインの数字 ─── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumberCard
            icon={<BarChart2 className="text-primary" size={24} />}
            number="7.1x"
            label="認知負荷の差"
            desc="シンプル vs 複雑フォーム（テキストモデル）"
          />
          <NumberCard
            icon={<TrendingDown className="text-success" size={24} />}
            number="13.5x"
            label="ビジョンモデルの差"
            desc="良いUI vs 悪いUI（スクリーンショットベース）"
          />
          <NumberCard
            icon={<AlertTriangle className="text-warning" size={24} />}
            number="17回"
            label="複雑フォームのリトライ"
            desc="18項目フォームでAIが迷った回数"
          />
        </section>

        {/* ─── 実験1: テキストモデル シンプル vs 複雑 ─── */}
        <section className="glass-panel p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">実験1: フォームの複雑さと認知負荷</h2>
              <p className="text-sm text-text-muted">テキストモデル (qwen3:4b) — DOM テキスト入力</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <FormCard
              title="経費精算フォーム"
              subtitle="3フィールド（日付・経路・金額）"
              badge="シンプル"
              badgeColor="success"
              score={8431}
              steps={5}
              retries={0}
              success={true}
              tokens={7931}
            />
            <FormCard
              title="問い合わせフォーム"
              subtitle="18フィールド + CAPTCHA + 利用規約"
              badge="複雑"
              badgeColor="error"
              score={60008}
              steps={20}
              retries={17}
              success={false}
              tokens={49508}
            />
          </div>

          <div className="bg-surface-highlight/50 rounded-xl p-6 border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-warning" />
              この結果が意味すること
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              フィールド数が6倍（3→18）なのに対し、認知負荷スコアは<strong className="text-white">7.1倍</strong>。
              単純にフィールドが増えるだけでなく、<strong className="text-white">リトライ17回</strong>が示すように
              AIが繰り返し要素の特定に失敗しています。
              これは人間にとっても「どこに何を入力すればいいかわからない」状態に相当します。
            </p>
          </div>
        </section>

        {/* ─── 実験2: ビジョン vs テキスト ─── */}
        <section className="glass-panel p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Eye size={20} className="text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">実験2: テキスト vs ビジョンモデル</h2>
              <p className="text-sm text-text-muted">同じ UI を異なる入力方式で比較</p>
            </div>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3">条件</th>
                  <th className="text-left p-3">モデル</th>
                  <th className="text-right p-3">悪いUI (v1)</th>
                  <th className="text-right p-3">良いUI (v2)</th>
                  <th className="text-right p-3">方向</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/5">
                  <td className="p-3 text-white font-medium flex items-center gap-2"><Brain size={14} className="text-primary" /> テキスト (DOM)</td>
                  <td className="p-3 text-text-muted font-mono text-xs">qwen3:4b</td>
                  <td className="p-3 text-right font-mono text-white">8,496</td>
                  <td className="p-3 text-right font-mono text-white">9,655</td>
                  <td className="p-3 text-right"><span className="text-error text-xs font-semibold px-2 py-1 rounded-full bg-error/10">↑ 逆転</span></td>
                </tr>
                <tr className="hover:bg-white/5">
                  <td className="p-3 text-white font-medium flex items-center gap-2"><Eye size={14} className="text-secondary" /> ビジョン (スクショ)</td>
                  <td className="p-3 text-text-muted font-mono text-xs">qwen3-vl:4b</td>
                  <td className="p-3 text-right font-mono text-white">994</td>
                  <td className="p-3 text-right font-mono text-white">100</td>
                  <td className="p-3 text-right"><span className="text-success text-xs font-semibold px-2 py-1 rounded-full bg-success/10">✓ 正しい</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-surface-highlight/50 rounded-xl p-6 border border-white/5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-warning" />
              なぜ逆転するのか
            </h3>
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              <strong className="text-white">テキストモデル</strong>は HTML の DOM テキストをそのまま入力として受け取ります。
              良いUI (v2) ほど丁寧なラベル・説明文が多いため、入力が長くなり出力トークンも増加します。
              つまりテキストモデルは「UIの認知負荷」ではなく「DOMの情報密度」を測っています。
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              <strong className="text-white">ビジョンモデル</strong>はスクリーンショットを画像として認識するため、
              DOM テキスト量に左右されません。入力トークン数が同一（画像解像度ベース）なので、
              出力の差は純粋に「<strong className="text-primary">画面の視覚的な明快さ</strong>」を反映しています。
            </p>
          </div>
        </section>

        {/* ─── 重要な知見 ─── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Zap size={24} className="text-primary" />
            重要な知見
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard
              number="1"
              title="リトライ数が最も安定した指標"
              desc="出力トークンやステップ数は条件によって変動しますが、リトライ数は一貫して「悪いUI」で多くなりました。"
            />
            <InsightCard
              number="2"
              title="テキスト + ビジョンの複合評価が最適"
              desc="テキストは「操作フローの複雑さ」、ビジョンは「見た目の明快さ」を測ります。両方を組み合わせることで多角的な評価が可能に。"
            />
            <InsightCard
              number="3"
              title="4B ビジョンモデルの限界"
              desc="シングルステップの画面認識は正確ですが、マルチステップのタスク完遂には 8B 以上のモデルが必要です。"
            />
            <InsightCard
              number="4"
              title="フィールド数 × 曖昧さ = 認知負荷"
              desc="単にフィールドが多いだけでなく、ラベルが曖昧だとリトライが爆発し、スコアが非線形に増加します。"
            />
          </div>
        </section>

        {/* ─── 認知負荷スコアの算出式 ─── */}
        <section className="glass-panel p-8">
          <h2 className="text-xl font-bold text-white mb-4">認知負荷スコアの算出</h2>
          <div className="bg-[#0d1117] rounded-xl p-6 font-mono text-sm mb-4 border border-white/5">
            <span className="text-primary">cognitive_load_score</span> = <span className="text-white">output_tokens</span> + <span className="text-success">step_count</span> × 100 + <span className="text-error">retry_count</span> × 500
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-white font-mono text-lg">output_tokens</div>
              <div className="text-text-muted text-xs mt-1">LLMの「思考量」</div>
              <div className="text-text-muted/50 text-xs">重み: ×1</div>
            </div>
            <div>
              <div className="text-success font-mono text-lg">step_count</div>
              <div className="text-text-muted text-xs mt-1">操作の複雑さ</div>
              <div className="text-text-muted/50 text-xs">重み: ×100</div>
            </div>
            <div>
              <div className="text-error font-mono text-lg">retry_count</div>
              <div className="text-text-muted text-xs mt-1">「迷い」の強さ</div>
              <div className="text-text-muted/50 text-xs">重み: ×500</div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="text-center py-8">
          <h2 className="text-2xl font-bold text-white mb-3">あなたのUIで試してみませんか？</h2>
          <p className="text-text-muted mb-6">
            Playwright で任意の URL を測定できます。ローカルで完結、データは外部に送信されません。
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/tasks" className="btn-primary flex items-center gap-2 px-8 py-3 text-base">
              タスクを作成して測定 <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function NumberCard({ icon, number, label, desc }: { icon: React.ReactNode; number: string; label: string; desc: string }) {
  return (
    <div className="glass-panel p-6 text-center hover:border-primary/20 transition-colors">
      <div className="flex justify-center mb-3">{icon}</div>
      <div className="text-4xl font-bold text-white tracking-tight mb-1">{number}</div>
      <div className="text-sm font-semibold text-primary mb-1">{label}</div>
      <div className="text-xs text-text-muted">{desc}</div>
    </div>
  );
}

function FormCard({ title, subtitle, badge, badgeColor, score, steps, retries, success, tokens }: {
  title: string; subtitle: string; badge: string; badgeColor: string;
  score: number; steps: number; retries: number; success: boolean; tokens: number;
}) {
  const colors: Record<string, string> = {
    success: 'bg-success/10 text-success border-success/20',
    error: 'bg-error/10 text-error border-error/20',
  };
  return (
    <div className="bg-surface-highlight/30 rounded-xl p-6 border border-white/5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-text-muted mt-1">{subtitle}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${colors[badgeColor]}`}>{badge}</span>
      </div>

      <div className="text-3xl font-bold text-white mb-4 font-mono">{score.toLocaleString()}</div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-text-muted text-xs block">出力トークン</span>
          <span className="font-mono text-white">{tokens.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-text-muted text-xs block">ステップ数</span>
          <span className="font-mono text-white">{steps}</span>
        </div>
        <div>
          <span className="text-text-muted text-xs block">リトライ</span>
          <span className={`font-mono ${retries > 0 ? 'text-error' : 'text-success'}`}>{retries}</span>
        </div>
        <div>
          <span className="text-text-muted text-xs block">成功</span>
          <span className="flex items-center gap-1">
            {success ? <CheckCircle size={14} className="text-success" /> : <AlertTriangle size={14} className="text-error" />}
            <span className={success ? 'text-success' : 'text-error'}>{success ? 'Yes' : 'No'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="glass-panel p-5 hover:border-primary/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
          {number}
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
          <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}
