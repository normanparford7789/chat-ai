import { useState, useEffect, type FormEvent } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { AI_PROVIDERS } from '../../lib/constants';
import {
  Bot, Save, Play, RotateCcw, Eye, Upload, Download, Power, Check,
  Sparkles, FileText, Link2, BookOpen, AlertCircle, Zap, MessageSquare,
} from 'lucide-react';

const scenarios = [
  'عميل يسأل عن السعر', 'عميل يسأل عن المقاس', 'عميل يريد خصم',
  'عميل غاضب', 'عميل يكرر السؤال', 'عميل يطلب إلغاء',
  'عميل يطلب استبدال', 'عميل يكتب مختصر جدًا', 'عميل يرسل صور',
];

const defaultRules = [
  'لا تذكر المنافسين أبدًا',
  'إذا سأل عن الدفع، اعطه تعليمات واضحة',
  'إذا تكرر السؤال 3 مرات، حوّل لموظف',
  'لا ترد بأكثر من 5 جمل في رسالة واحدة',
  'أضف emoji مناسب في كل رسالة',
];

export function AiStudioPage() {
  const { aiConfig, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  // ✅ FIXED: useState must be called before any conditional return
  const [activeTab, setActiveTab] = useState('personality');

  const [config, setConfig] = useState({
    assistant_name: 'المساعد',
    tone: 'friendly',
    formality: 'casual',
    brevity: 'medium',
    persuasion_level: 3,
    mode: 'sales',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    fallback_to_human: true,
    system_prompt: '',
  });

  // ✅ FIXED: Sync config state when aiConfig loads from Supabase
  useEffect(() => {
    if (aiConfig) {
      setConfig({
        assistant_name: aiConfig.assistant_name ?? 'المساعد',
        tone: aiConfig.tone ?? 'friendly',
        formality: aiConfig.formality ?? 'casual',
        brevity: aiConfig.brevity ?? 'medium',
        persuasion_level: aiConfig.persuasion_level ?? 3,
        mode: aiConfig.mode ?? 'sales',
        ai_provider: aiConfig.ai_provider ?? 'openai',
        ai_model: aiConfig.ai_model ?? 'gpt-4o-mini',
        fallback_to_human: aiConfig.fallback_to_human ?? true,
        system_prompt: aiConfig.system_prompt ?? '',
      });
    }
  }, [aiConfig]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setSaving(true);
    try {
      if (aiConfig) {
        await supabase.from('ai_configs').update(config).eq('id', aiConfig.id);
      } else {
        await supabase.from('ai_configs').insert({ ...config, merchant_id: merchant.id });
      }
      reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestOutput('');
    await new Promise((r) => setTimeout(r, 1200));
    const responses: Record<string, string> = {
      'السعر': `أهلًا بك! 😊 سعر المنتج هو 249 ريال فقط وشامل الشحن. هل تحب تطلب الآن؟`,
      'المقاس': `يسعدني مساعدتك! 📦 المقاسات المتاحة: S، M، L، XL. أي مقاس يناسبك؟`,
      'خصم': `🎁 عندنا خصم 10% على الطلبات فوق 200 ريال! هل تحب تستفيد منها؟`,
      'توصيل': `🚚 التوصيل خلال 2-4 أيام عمل. الشحن مجاني للطلبات فوق 150 ريال!`,
      'ألوان': `✨ المنتج متوفر بألوان: أسود، أبيض، كحلي، وأحمر. أيها يعجبك؟`,
    };
    const matchedKey = Object.keys(responses).find((k) => testInput.includes(k));
    const reply = matchedKey
      ? responses[matchedKey]
      : `أهلًا بك! شكرًا لسؤالك عن "${testInput}". سأساعدك بكل سرور! 😊 هل تحتاج مزيدًا من التفاصيل؟`;
    setTestOutput(reply);
    setTesting(false);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const tabs = [
    { id: 'personality', label: 'إعداد الشخصية', icon: Bot },
    { id: 'knowledge', label: 'مصادر المعرفة', icon: BookOpen },
    { id: 'rules', label: 'قواعد الرد', icon: AlertCircle },
    { id: 'scenarios', label: 'سيناريوهات', icon: Sparkles },
    { id: 'test', label: 'اختبار', icon: Play },
  ];

  const currentProvider = AI_PROVIDERS.find((p) => p.value === config.ai_provider);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="استوديو الذكاء الصناعي"
        description="اضبط شخصية مساعدك الذكي ومصادر معرفته"
        actions={
          <>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              {saving ? <Spinner size="sm" /> : saved ? <><Check size={16} /> تم الحفظ</> : <><Save size={16} /> حفظ ونشر</>}
            </button>
          </>
        }
      />

      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Personality */}
      {activeTab === 'personality' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Bot size={18} className="text-sky-500" /> هوية المساعد</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">اسم المساعد</label>
                <input className="input" value={config.assistant_name} onChange={(e) => setConfig({ ...config, assistant_name: e.target.value })} />
              </div>
              <div>
                <label className="label">نمط الذكاء</label>
                <select className="input" value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
                  <option value="sales">مبيعات</option>
                  <option value="support">دعم عملاء</option>
                  <option value="hybrid">هجين (مبيعات + دعم)</option>
                  <option value="informational">معلوماتي</option>
                </select>
              </div>
              <div>
                <label className="label">نبرة الصوت</label>
                <select className="input" value={config.tone} onChange={(e) => setConfig({ ...config, tone: e.target.value })}>
                  <option value="friendly">ودي</option>
                  <option value="professional">محترف</option>
                  <option value="casual">عامي</option>
                  <option value="formal">رسمي</option>
                </select>
              </div>
              <div>
                <label className="label">مستوى الرسمية</label>
                <select className="input" value={config.formality} onChange={(e) => setConfig({ ...config, formality: e.target.value })}>
                  <option value="casual">غير رسمي</option>
                  <option value="neutral">محايد</option>
                  <option value="formal">رسمي</option>
                </select>
              </div>
              <div>
                <label className="label">طول الرد</label>
                <select className="input" value={config.brevity} onChange={(e) => setConfig({ ...config, brevity: e.target.value })}>
                  <option value="short">قصير</option>
                  <option value="medium">متوسط</option>
                  <option value="detailed">مفصّل</option>
                </select>
              </div>
              <div>
                <label className="label">مستوى الإقناع ({config.persuasion_level}/5)</label>
                <input
                  type="range" min="1" max="5" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  value={config.persuasion_level}
                  onChange={(e) => setConfig({ ...config, persuasion_level: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label">التعليمات المخصصة (System Prompt)</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="مثال: أنت مساعد مبيعات متجر ملابس عربي. ركّز على عرض المنتجات بوضوح وأسلوب ودي..."
                value={config.system_prompt}
                onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Zap size={18} className="text-amber-500" /> مزوّد الذكاء الصناعي</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">المزوّد</label>
                <select className="input" value={config.ai_provider} onChange={(e) => setConfig({ ...config, ai_provider: e.target.value, ai_model: AI_PROVIDERS.find((p) => p.value === e.target.value)?.models[0] ?? '' })}>
                  {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">النموذج</label>
                <select className="input" value={config.ai_model} onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}>
                  {(currentProvider?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">تحويل تلقائي للموظف</div>
                <div className="text-xs text-slate-500">إذا لم يستطع الذكاء الإجابة، يحوّل المحادثة لموظف</div>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, fallback_to_human: !config.fallback_to_human })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.fallback_to_human ? 'bg-sky-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.fallback_to_human ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Knowledge Sources */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4">مصادر المعرفة</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {[
                { icon: FileText, label: 'كتالوج المنتجات', desc: 'يتزامن تلقائيًا مع منتجاتك', active: true, color: 'sky' },
                { icon: MessageSquare, label: 'الأسئلة الشائعة', desc: 'أضف أسئلة وأجوبة مخصصة', active: false, color: 'violet' },
                { icon: Link2, label: 'رابط موقعك', desc: 'سيقرأ الذكاء محتوى موقعك', active: false, color: 'amber' },
                { icon: Upload, label: 'ملف PDF', desc: 'ارفع سياساتك، دليل المنتج...', active: false, color: 'green' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border-2 p-4 cursor-pointer transition-colors ${s.active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`h-10 w-10 rounded-xl bg-${s.color}-50 flex items-center justify-center text-${s.color}-500`}><s.icon size={20} /></div>
                    {s.active && <Badge color="green"><Check size={12} /> مفعّل</Badge>}
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{s.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
                </div>
              ))}
            </div>
            <div>
              <label className="label">رابط الموقع</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="https://yourstore.com" />
                <button className="btn-primary btn-sm"><Eye size={14} /> معاينة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules */}
      {activeTab === 'rules' && (
        <div className="card p-6">
          <h3 className="font-bold text-slate-900 mb-4">قواعد الرد</h3>
          <div className="space-y-2 mb-4">
            {defaultRules.map((rule) => (
              <div key={rule} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <Check size={16} className="text-green-500 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1">{rule}</span>
                <button className="text-slate-400 hover:text-red-500 text-xs transition-colors">تعطيل</button>
              </div>
            ))}
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-4">
            <label className="label">إضافة قاعدة جديدة</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="مثال: لا ترسل أرقام هواتف شخصية..." />
              <button className="btn-primary btn-sm"><Zap size={14} /> إضافة</button>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center gap-3 bg-amber-50 border-amber-200">
            <Sparkles size={20} className="text-amber-500" />
            <p className="text-sm text-amber-700">التدريب على السيناريوهات يحسّن دقة ردود الذكاء بشكل كبير. درّب على أكبر عدد ممكن.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s) => (
              <div key={s} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-amber-500" />
                  <span className="font-bold text-sm text-slate-900">{s}</span>
                </div>
                <div className="text-xs text-slate-500 mb-3">درّب الذكاء على هذا السيناريو</div>
                <button className="btn-secondary btn-sm w-full"><Play size={14} /> تدريب</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test */}
      {activeTab === 'test' && (
        <div className="max-w-2xl mx-auto">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-2">اختبار الرد</h3>
            <p className="text-sm text-slate-500 mb-4">جرّب رسائل مختلفة لتشوف كيف سيرد مساعدك الذكي على عملائك</p>
            <div className="space-y-3">
              <div>
                <label className="label">رسالة العميل</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="مثال: كم سعر المنتج؟ أو: عندك خصومات؟"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) runTest(); }}
                />
                <p className="text-xs text-slate-400 mt-1">Ctrl+Enter للاختبار السريع</p>
              </div>
              <div className="flex gap-2">
                <button onClick={runTest} disabled={testing || !testInput.trim()} className="btn-primary flex-1">
                  {testing ? <Spinner size="sm" /> : <><Play size={16} /> اختبار الرد</>}
                </button>
                {testOutput && (
                  <button onClick={() => { setTestInput(''); setTestOutput(''); }} className="btn-secondary btn-sm"><RotateCcw size={16} /></button>
                )}
              </div>
              {testOutput && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold mb-2"><Bot size={14} /> رد {config.assistant_name}</div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{testOutput}</p>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 mb-2">جرّب هذه الأسئلة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['كم السعر؟', 'عندك خصم؟', 'كيف التوصيل؟', 'الألوان المتاحة؟', 'المقاسات؟'].map((q) => (
                    <button key={q} onClick={() => setTestInput(q)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
