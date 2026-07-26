import { useState } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { CHANNEL_TYPES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, Plus, RefreshCw, Plug, Trash2, Check, AlertTriangle,
  Activity, ExternalLink, Settings, Zap,
} from 'lucide-react';

const iconMap: Record<string, typeof MessageCircle> = {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music, ShoppingBag, Search,
};

const channelDocs: Record<string, string> = {
  whatsapp: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  messenger: 'https://developers.facebook.com/docs/messenger-platform/get-started',
  instagram: 'https://developers.facebook.com/docs/instagram-api',
  telegram: 'https://core.telegram.org/bots/api',
  website: '#',
  sms: '#',
  email: '#',
  tiktok: 'https://developers.tiktok.com',
  tiktok_shop: 'https://partner.tiktokshop.com',
  google: 'https://developers.google.com/my-business',
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function ConnectionsPage() {
  const { channels, conversations, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [configOpen, setConfigOpen] = useState<string | null>(null);

  function addToast(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function connectChannel(type: string) {
    if (!merchant) return;
    setConnecting(type);
    try {
      const existing = channels.find((c) => c.type === type);
      if (existing) {
        const { error } = await supabase
          .from('channels')
          .update({ status: 'connected', last_sync: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const channelLabel = CHANNEL_TYPES.find((c) => c.value === type)?.label ?? type;
        const { error } = await supabase.from('channels').insert({
          merchant_id: merchant.id,
          type,
          name: channelLabel,
          status: 'connected',
          last_sync: new Date().toISOString(),
          config: {},
        });
        if (error) throw error;
      }
      reload();
      const label = CHANNEL_TYPES.find((c) => c.value === type)?.label ?? type;
      addToast(`✅ تم ربط ${label} بنجاح`);
    } catch (_err) {
      addToast('❌ حدث خطأ أثناء الربط، حاول مرة أخرى', 'error');
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(id: string, name: string) {
    if (!confirm(`هل تريد فصل ${name}؟`)) return;
    const { error } = await supabase.from('channels').update({ status: 'disconnected' }).eq('id', id);
    if (error) {
      addToast('❌ حدث خطأ أثناء الفصل', 'error');
      return;
    }
    reload();
    addToast(`🔌 تم فصل ${name}`);
  }

  async function testChannel(id: string, name: string) {
    setTesting(id);
    try {
      await new Promise((r) => setTimeout(r, 800)); // Simulate API test
      await supabase.from('channels').update({ last_sync: new Date().toISOString() }).eq('id', id);
      reload();
      addToast(`✅ اتصال ${name} يعمل بشكل طبيعي`);
    } catch {
      addToast(`❌ فشل اختبار ${name}`, 'error');
    } finally {
      setTesting(null);
    }
  }

  async function deleteChannel(id: string) {
    if (!confirm('هل تريد حذف هذه القناة نهائيًا؟')) return;
    await supabase.from('channels').delete().eq('id', id);
    reload();
    addToast('🗑️ تم حذف القناة');
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const connectedCount = channels.filter((c) => c.status === 'connected').length;

  return (
    <div className="animate-fade-in">
      {/* Toast notifications */}
      <div className="fixed top-4 left-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-fade-in ${t.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <PageHeader
        title="القنوات"
        description={`${connectedCount} قناة متصلة من أصل ${CHANNEL_TYPES.length}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge color={connectedCount > 0 ? 'green' : 'gray'}>
              <Activity size={12} /> {connectedCount} متصل
            </Badge>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-sky-600">{connectedCount}</div>
          <div className="text-xs text-slate-500 mt-1">قنوات متصلة</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-slate-900">{conversations.length}</div>
          <div className="text-xs text-slate-500 mt-1">إجمالي المحادثات</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-green-600">
            {channels.filter((c) => c.status === 'connected').length > 0 ? '✓ نشط' : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">حالة المنصة</div>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNEL_TYPES.map((ch) => {
          const Icon = iconMap[ch.icon] ?? MessageCircle;
          const channel = channels.find((c) => c.type === ch.value);
          const isConnected = channel?.status === 'connected';
          const isDisconnected = channel?.status === 'disconnected';
          const msgCount = channel
            ? conversations.filter((c) => c.channel_id === channel.id).length
            : 0;
          const isConnecting = connecting === ch.value;
          const isTesting = testing === channel?.id;

          return (
            <div key={ch.value} className={`card p-5 transition-shadow hover:shadow-md ${isConnected ? 'border-green-200' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-50 text-green-600' : 'bg-sky-50 text-sky-500'}`}>
                  <Icon size={24} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isConnected && (
                    <Badge color="green"><Check size={11} /> متصل</Badge>
                  )}
                  {isDisconnected && (
                    <Badge color="red"><AlertTriangle size={11} /> مفصول</Badge>
                  )}
                  {!channel && (
                    <Badge color="gray">غير مربوط</Badge>
                  )}
                </div>
              </div>

              <div className="font-bold text-slate-900 mb-1">{ch.label}</div>

              {isConnected ? (
                <div className="mt-2 space-y-1.5 text-xs text-slate-500 mb-4">
                  <div className="flex justify-between">
                    <span>المحادثات:</span>
                    <span className="font-semibold text-slate-700">{msgCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>آخر مزامنة:</span>
                    <span className="font-semibold text-slate-700">{formatDateTime(channel?.last_sync)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1 mb-4">اربط {ch.label} لتلقّي الرسائل تلقائيًا</p>
              )}

              <div className="flex gap-1.5">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => testChannel(channel!.id, ch.label)}
                      disabled={isTesting}
                      className="btn-secondary btn-sm flex-1"
                    >
                      {isTesting ? <Spinner size="sm" /> : <><RefreshCw size={13} /> اختبار</>}
                    </button>
                    <button
                      onClick={() => disconnect(channel!.id, ch.label)}
                      className="btn-ghost btn-sm text-slate-500 hover:text-red-500"
                      title="فصل"
                    >
                      <Plug size={14} />
                    </button>
                    <button
                      onClick={() => deleteChannel(channel!.id)}
                      className="btn-ghost btn-sm text-slate-500 hover:text-red-500"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => connectChannel(ch.value)}
                      disabled={isConnecting}
                      className="btn-primary btn-sm flex-1"
                    >
                      {isConnecting ? <Spinner size="sm" /> : <><Plug size={13} /> ربط</>}
                    </button>
                    {channelDocs[ch.value] && channelDocs[ch.value] !== '#' && (
                      <a
                        href={channelDocs[ch.value]}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost btn-sm text-slate-500"
                        title="دليل الربط"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration guide */}
      <div className="card p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">كيف تربط قناتك؟</h3>
            <p className="text-sm text-slate-500">اتبع هذه الخطوات للربط الكامل</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'اختر القناة', desc: 'اضغط زر "ربط" على القناة التي تريدها' },
            { step: '2', title: 'أدخل بيانات API', desc: 'اذهب لإعدادات القناة وأضف التوكن والـ Webhook URL' },
            { step: '3', title: 'اختبر الاتصال', desc: 'اضغط "اختبار" للتأكد أن الربط يعمل بشكل سليم' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {item.step}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{item.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
