import { useState } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner, EmptyState } from '../../components/ui';
import { CHANNEL_TYPES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, Plus, RefreshCw, Plug, Trash2, Check, AlertTriangle, Activity,
} from 'lucide-react';

const iconMap: Record<string, typeof MessageCircle> = {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music, ShoppingBag, Search,
};

export function ConnectionsPage() {
  const { channels, conversations, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [connecting, setConnecting] = useState<string | null>(null);

  async function connectChannel(type: string) {
    if (!merchant) return;
    setConnecting(type);
    const existing = channels.find((c) => c.type === type);
    if (existing) {
      await supabase.from('channels').update({ status: 'connected', last_sync: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('channels').insert({
        merchant_id: merchant.id,
        type,
        name: CHANNEL_TYPES.find((c) => c.value === type)?.label ?? type,
        status: 'connected',
        last_sync: new Date().toISOString(),
      });
    }
    reload();
    setConnecting(null);
  }

  async function disconnect(id: string) {
    await supabase.from('channels').update({ status: 'disconnected' }).eq('id', id);
    reload();
  }

  async function testChannel(id: string) {
    await supabase.from('channels').update({ last_sync: new Date().toISOString() }).eq('id', id);
    reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const connectedTypes = new Set(channels.filter((c) => c.status === 'connected').map((c) => c.type));

  return (
    <div className="animate-fade-in">
      <PageHeader title="القنوات" description="اربط وأدر قنوات التواصل" />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNEL_TYPES.map((ch) => {
          const Icon = iconMap[ch.icon] ?? MessageCircle;
          const channel = channels.find((c) => c.type === ch.value);
          const isConnected = channel?.status === 'connected';
          const msgCount = channel ? conversations.filter((c) => c.channel_id === channel.id).length : 0;

          return (
            <div key={ch.value} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500"><Icon size={24} /></div>
                {isConnected ? <Badge color="green"><Check size={12} /> متصل</Badge> : channel ? <Badge color="red"><AlertTriangle size={12} /> مفصول</Badge> : <Badge color="gray">غير مربوط</Badge>}
              </div>
              <div className="font-bold text-slate-900">{ch.label}</div>
              {isConnected ? (
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between"><span>الرسائل:</span><span className="font-semibold text-slate-700">{msgCount}</span></div>
                  <div className="flex justify-between"><span>آخر مزامنة:</span><span>{formatDateTime(channel?.last_sync)}</span></div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">اربط {ch.label} للبدء</p>
              )}
              <div className="flex gap-1.5 mt-4">
                {isConnected ? (
                  <>
                    <button onClick={() => testChannel(channel!.id)} className="btn-secondary btn-sm flex-1"><RefreshCw size={14} /> اختبار</button>
                    <button onClick={() => disconnect(channel!.id)} className="btn-ghost btn-sm text-red-500"><Trash2 size={14} /></button>
                  </>
                ) : (
                  <button onClick={() => connectChannel(ch.value)} disabled={connecting === ch.value} className="btn-primary btn-sm w-full">
                    {connecting === ch.value ? <Spinner size="sm" /> : <><Plug size={14} /> ربط</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
