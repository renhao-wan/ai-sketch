import TopBar from '@/components/TopBar';
import AIPromptBox from '@/components/AIPromptBox';
import { AppIcon } from '@/components/TopBar';

export default function HomePage() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] noise-overlay">
      <TopBar />

      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="blur-orb blur-orb-indigo"
            style={{ width: '600px', height: '600px', top: '-5%', left: '-8%' }}
          />
          <div
            className="blur-orb blur-orb-violet"
            style={{ width: '500px', height: '500px', top: '25%', right: '-6%', animationDelay: '-7s' }}
          />
          <div
            className="blur-orb blur-orb-cyan"
            style={{ width: '400px', height: '400px', bottom: '0%', left: '30%', animationDelay: '-13s' }}
          />
        </div>

        <div className="relative z-10 w-full max-w-3xl px-6 stagger-children">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <AppIcon size={56} />
              <div className="absolute inset-0 rounded-[16px] bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] opacity-20 blur-xl scale-150" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--fg)] leading-[1.1] mb-3">
              用自然语言
              <br />
              <span className="bg-gradient-to-r from-[var(--accent-indigo)] via-[var(--accent-violet)] to-[var(--accent-cyan)] bg-clip-text text-transparent">
                设计图表
              </span>
            </h1>
            <p className="text-base text-[var(--muted)] max-w-lg mx-auto leading-relaxed">
              描述你的想法，AI 即时生成专业图表
            </p>
          </div>

          {/* Prompt Box */}
          <AIPromptBox />

          {/* Quick Templates */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              '微服务架构图',
              '用户登录流程',
              'ER 数据模型',
              '系统部署图',
              '思维导图',
            ].map((t) => (
              <a
                key={t}
                href={`/editor?prompt=${encodeURIComponent(t)}&format=auto`}
                className="px-4 py-2 text-xs text-[var(--muted)] bg-white/50 backdrop-blur border border-white/20 rounded-full hover:bg-white/70 hover:text-[var(--fg)] hover:border-[var(--accent-indigo)]/20 transition-all duration-200"
              >
                {t}
              </a>
            ))}
          </div>

          {/* Feature hints */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]/60">
            {['智能布局优化', '代码导出', '图片识别', '多 LLM 支持'].map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[var(--accent-indigo)]/30" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
