import { useState, type FormEvent } from 'react';
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

export function AiStudioPage() {
  const { aiConfig, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');

  const [config, setConfig] = useState({
    assistant_name: aiConfig?.assistant_name ?? 'المساعد',
    tone: aiConfig?.tone ?? 'friendly',
    formality: aiConfig?.formality ?? 'casual',
    brevity: aiConfig?.brevity ?? 'medium',
    persuasion_level: aiConfig?.persuasion_level ?? 3,
    mode: aiConfig?.mode ?? 'sales',
    ai_provider: aiConfig?.ai_provider ?? 'openai',
    ai_model: aiConfig?.ai_model ?? 'gpt-4o-mini',
    fallback_to_human: aiConfig?.fallback_to_human ?? true,
    system_prompt: aiConfig?.system_prompt ?? '',
  });

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
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestOutput('');
    // Simulate AI response
    await new Promise((r) => setTimeout(r, 1200));
    setTestOutput(`أهلًا بك! شكرًا لسؤالك عن "${testInput}". المنتج متوفر بسعر 249 ريال. تحب أطلب لك واحد؟ 😊`);
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
  const [activeTab, setActiveTab] = useState('personality');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="استوديو الذكاء الصناعي"
        description="اضبط شخصية مساعدك الذكي ومصادر معرفته"
        actions={
          <>
            <button className="btn-secondary btn-sm"><Download size={16} /> تصدير</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              {saving ? <Spinner size="sm" /> : <><Save size={16} /> حفظ ونشر</>}
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
        <form onSubmit={handleSave} className="card p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">اسم المساعد</label>
              <input className="input" value={config.assistant_name} onChange={(e) => setConfig({ ...config, assistant_name: e.target.value })} />
            </div>
            <div>
              <label className="label">مزود الذكاء</label>
              <select className="input" value={config.ai_provider} onChange={(e) => {
                const provider = AI_PROVIDERS.find((p) => p.value === e.target.value);
                setConfig({ ...config, ai_provider: e.target.value, ai_model: provider?.models[0] ?? '' });
              }}>
                {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">النموذج</label>
              <select className="input" value={config.ai_model} onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}>
                {AI_PROVIDERS.find((p) => p.value === config.ai_provider)?.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">لهجة الرد</label>
              <select className="input" value={config.tone} onChange={(e) => setConfig({ ...config, tone: e.target.value })}>
                <option value="friendly">ودود</option>
                <option value="formal">رسمي</option>
                <option value="luxury">فاخر</option>
                <option value="fast">سريع ومختصر</option>
              </select>
            </div>
            <div>
              <label className="label">مستوى الرسمية</label>
              <select className="input" value={config.formality} onChange={(e) => setConfig({ ...config, formality: e.target.value })}>
                <option value="casual">غير رسمي</option>
                <option value="mixed">مختلط</option>
                <option value="formal">رسمي</option>
              </select>
            </div>
            <div>
              <label className="label">مستوى الاختصار</label>
              <select className="input" value={config.brevity} onChange={(e) => setConfig({ ...config, brevity: e.target.value })}>
                <option value="short">قصير</option>
                <option value="medium">متوسط</option>
                <option value="detailed">تفصيلي</option>
              </select>
            </div>
            <div>
              <label className="label">مستوى الإقناع ({config.persuasion_level}/5)</label>
              <input type="range" min="1" max="5" className="w-full" value={config.persuasion_level} onChange={(e) => setConfig({ ...config, persuasion_level: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">الوضع</label>
              <select className="input" value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })}>
                <option value="sales">بيع</option>
                <option value="support">دعم فقط</option>
                <option value="hybrid">هجين</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <input type="checkbox" checked={config.fallback_to_human} onChange={(e) => setConfig({ ...config, fallback_to_human: e.target.checked })} className="rounded" />
              تحويل تلقائي للبشر عند الغموض
            </label>
          </div>

          <div>
            <label className="label">System Prompt مخصص</label>
            <textarea className="input min-h-[120px] font-mono text-sm" placeholder="أنت مساعد مبيعات لمتجر... اتبع سياسة المتجر..." value={config.system_prompt} onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })} />
          </div>
        </form>
      )}

      {/* Knowledge sources */}
      {activeTab === 'knowledge' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: FileText, title: 'كتالوج المنتجات', desc: 'الذكاء يقرأ منتجاتك تلقائيًا', connected: true },
            { icon: BookOpen, title: 'ملف السياسات', desc: 'سياسات التوصيل والإرجاع', connected: true },
            { icon: MessageSquare, title: 'الأسئلة الشائعة', desc: 'ردود جاهزة للأسئلة المتكررة', connected: false },
            { icon: FileText, title: 'شروط التوصيل', desc: 'معلومات الشحن والمناطق', connected: true },
            { icon: Zap, title: 'العروض', desc: 'الخصومات والعروض الحالية', connected: false },
            { icon: Link2, title: 'معلومات الشركة', desc: 'عن المتجر وبياناته', connected: true },
            { icon: FileText, title: 'ملفات PDF', desc: 'كتالوجات أو أدلة', connected: false },
            { icon: Link2, title: 'روابط خارجية', desc: 'مصادر معرفة إضافية', connected: false },
          ].map((src) => (
            <div key={src.title} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500"><src.icon size={20} /></div>
                {src.connected ? <Badge color="green">متصل</Badge> : <Badge color="gray">غير متصل</Badge>}
              </div>
              <div className="font-bold text-slate-900 text-sm">{src.title}</div>
              <div className="text-xs text-slate-500 mt-1">{src.desc}</div>
              <button className="mt-3 text-sm text-sky-600 font-semibold">{src.connected ? 'تعديل' : 'ربط'}</button>
            </div>
          ))}
        </div>
      )}

      {/* Rules */}
      {activeTab === 'rules' && (
        <div className="card p-6 space-y-3">
          {[
            'لا يجيب عن أسعار غير موجودة في الكتالوج',
            'إذا لم يفهم، يسأل توضيح بدل التخمين',
            'لا يعد بشيء غير مؤكد (موعد تسليم، توفر)',
            'يعرض منتج بديل عند عدم التوفر',
            'يحيل للبشر عند الغموض أو الشكوى',
            'لا يعطي خصم بدون الرجوع للسياسة',
            'يتأكد من العنوان والهاتف قبل تأكيد الطلب',
          ].map((rule, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600"><Check size={14} /></div>
              <span className="text-sm text-slate-700 flex-1">{rule}</span>
              <button className="text-slate-400 hover:text-red-500 text-xs">تعطيل</button>
            </div>
          ))}
          <button className="btn-secondary btn-sm w-full">+ إضافة قاعدة</button>
        </div>
      )}

      {/* Scenarios */}
      {activeTab === 'scenarios' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <div key={s} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-amber-500" />
                <span className="font-bold text-sm text-slate-900">{s}</span>
              </div>
              <div className="text-xs text-slate-500 mb-3">درّب الذكاء على هذا السيناريو</div>
              <button className="btn-secondary btn-sm w-full"><Play size={14} /> تدريب</button>
            </div>
          ))}
        </div>
      )}

      {/* Test */}
      {activeTab === 'test' && (
        <div className="max-w-2xl mx-auto">
          <div className="card p-6">
            <h3 className="font-bold text-slate-900 mb-4">اختبار الرد</h3>
            <div className="space-y-3">
              <div>
                <label className="label">رسالة العميل</label>
                <textarea className="input min-h-[80px]" placeholder="اكتب رسالة كما لو أنك عميل..." value={testInput} onChange={(e) => setTestInput(e.target.value)} />
              </div>
              <button onClick={runTest} disabled={testing || !testInput.trim()} className="btn-primary w-full">
                {testing ? <Spinner size="sm" /> : <><Play size={16} /> اختبار الرد</>}
              </button>
              {testOutput && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold mb-2"><Bot size={14} /> رد الذكاء</div>
                  <p className="text-sm text-slate-700">{testOutput}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
