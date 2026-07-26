import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantData, fetchMessages, sendMessage } from '../../lib/hooks';
import { Badge, Spinner, EmptyState } from '../../components/ui';
import { timeAgo, formatDateTime, formatCurrency } from '../../lib/format';
import { CONVERSATION_STATUSES } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import type { Message } from '../../lib/types';
import {
  Bot, Send, Search, Filter, UserPlus, BellOff, Ban, Star, FileText,
  ShoppingCart, Tag, MapPin, Mail, Zap, ZapOff, Plus, StickyNote, X,
  Check, ChevronDown, Package, Receipt,
} from 'lucide-react';

export function InboxPage() {
  const { conversations, customers, channels, loading } = useMerchantData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selectedId) {
      setMsgLoading(true);
      fetchMessages(selectedId).then((msgs) => {
        setMessages(msgs);
        setMsgLoading(false);
      });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !selectedId) return;
    const content = input;
    setInput('');
    await sendMessage(selectedId, content, 'agent', false);
    const msgs = await fetchMessages(selectedId);
    setMessages(msgs);
  }

  async function toggleAi() {
    if (!selected) return;
    await supabase.from('conversations').update({ ai_enabled: !selected.ai_enabled }).eq('id', selected.id);
    window.location.reload();
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    await supabase.from('conversations').update({ status }).eq('id', selected.id);
    window.location.reload();
  }

  const filteredConvs = conversations.filter((c) => {
    const customer = customers.find((x) => x.id === c.customer_id);
    const matchesSearch = !search || customer?.name?.toLowerCase().includes(search.toLowerCase()) || c.last_message?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.status === filter || (filter === 'ai' && c.ai_enabled);
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">المحادثات</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm"><UserPlus size={16} /> تحويل</button>
          <button className="btn-primary btn-sm"><Plus size={16} /> رسالة جديدة</button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 card flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative mb-2">
              <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
              <input className="input pr-9 py-2 text-sm" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {[
                { v: 'all', l: 'الكل' },
                { v: 'open', l: 'مفتوحة' },
                { v: 'assigned', l: 'محالة' },
                { v: 'ai', l: 'AI' },
              ].map((f) => (
                <button key={f.v} onClick={() => setFilter(f.v)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${filter === f.v ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">لا توجد محادثات</div>
            ) : (
              filteredConvs.map((c) => {
                const customer = customers.find((x) => x.id === c.customer_id);
                const status = CONVERSATION_STATUSES.find((s) => s.value === c.status);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full flex items-start gap-3 p-3 text-right border-b border-slate-50 hover:bg-slate-50 ${selectedId === c.id ? 'bg-sky-50' : ''}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                      {customer?.name?.charAt(0) ?? '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{customer?.name ?? 'عميل جديد'}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.ai_enabled && <Bot size={12} className="text-indigo-500" />}
                        {customer?.vip && <Badge color="amber">VIP</Badge>}
                        {status && <span className={`text-xs ${status.color === 'green' ? 'text-green-600' : status.color === 'amber' ? 'text-amber-600' : 'text-slate-500'}`}>• {status.label}</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{c.last_message ?? 'ابدأ المحادثة'}</div>
                    </div>
                    {c.unread_count > 0 && <div className="h-5 w-5 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center flex-shrink-0">{c.unread_count}</div>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 card flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={<Send size={28} />} title="اختر محادثة" description="اختر محادثة من القائمة لعرض الرسائل." />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold">
                    {customers.find((x) => x.id === selected.customer_id)?.name?.charAt(0) ?? '؟'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{customers.find((x) => x.id === selected.customer_id)?.name ?? 'عميل جديد'}</div>
                    <div className="text-xs text-slate-500">{channels.find((x) => x.id === selected.channel_id)?.name ?? 'قناة'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={toggleAi} className={`p-2 rounded-lg ${selected.ai_enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`} title={selected.ai_enabled ? 'إيقاف الذكاء' : 'تشغيل الذكاء'}>
                    {selected.ai_enabled ? <Bot size={18} /> : <ZapOff size={18} />}
                  </button>
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="تحويل لموظف"><UserPlus size={18} /></button>
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="ملاحظة"><StickyNote size={18} /></button>
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="صامت"><BellOff size={18} /></button>
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="مهم"><Star size={18} /></button>
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="حظر"><Ban size={18} /></button>
                  <div className="relative">
                    <button onClick={() => setShowActions(!showActions)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="إجراءات"><ChevronDown size={18} /></button>
                    {showActions && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 w-48">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Tag size={16} /> إرسال عرض</button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Receipt size={16} /> إرسال فاتورة</button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><MapPin size={16} /> إرسال موقع</button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Package size={16} /> إرسال كتالوج</button>
                        <Link to="/app/orders/new" className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ShoppingCart size={16} /> إنشاء طلب</Link>
                        <hr className="my-1 border-slate-100" />
                        <button onClick={() => changeStatus('closed')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><X size={16} /> إغلاق المحادثة</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {msgLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 py-8">لا توجد رسائل بعد. ابدأ بالرد!</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.sender === 'customer' ? '' : 'justify-end'} animate-fade-in`}>
                      {msg.sender === 'customer' && (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">ع</div>
                      )}
                      <div className={`max-w-[70%] ${msg.sender === 'customer' ? 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tr-sm' : msg.sender === 'ai' ? 'bg-indigo-500 text-white rounded-2xl rounded-tl-sm' : 'bg-sky-500 text-white rounded-2xl rounded-tl-sm'} px-4 py-2.5`}>
                        <div className="text-sm">{msg.content}</div>
                        <div className={`text-xs mt-1 flex items-center gap-1 ${msg.sender === 'customer' ? 'text-slate-400' : 'text-white/70'}`}>
                          {msg.sender === 'ai' && <><Bot size={10} /> رد آلي</>}
                          {msg.sender === 'agent' && <Check size={10} />}
                          {formatDateTime(msg.created_at)}
                        </div>
                      </div>
                      {msg.sender !== 'customer' && (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'ai' ? 'bg-indigo-500' : 'bg-sky-500'}`}>
                          {msg.sender === 'ai' ? <Bot size={16} className="text-white" /> : <span className="text-white text-xs font-bold">أ</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title="رد جاهز"><FileText size={18} /></button>
                  <input
                    className="input flex-1"
                    placeholder="اكتب ردك..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  />
                  <button onClick={handleSend} className="btn-primary" disabled={!input.trim()}>
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Customer details */}
        {selected && (
          <div className="hidden xl:block w-72 flex-shrink-0 card p-4 overflow-y-auto">
            <CustomerPanel conversationId={selected.id} customerId={selected.customer_id} />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerPanel({ customerId }: { conversationId: string; customerId: string | null }) {
  const { customers, orders } = useMerchantData();
  const customer = customers.find((c) => c.id === customerId);
  const customerOrders = orders.filter((o) => o.customer_id === customerId);

  if (!customer) return <div className="text-sm text-slate-400 text-center py-8">لا توجد بيانات للعميل</div>;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
          {customer.name?.charAt(0) ?? '؟'}
        </div>
        <div className="font-bold text-slate-900">{customer.name ?? 'عميل'}</div>
        <div className="text-xs text-slate-500">{customer.phone ?? '—'}</div>
        <div className="flex justify-center gap-1.5 mt-2">
          {customer.vip && <Badge color="amber">VIP</Badge>}
          {customer.total_orders > 0 && <Badge color="blue">{customer.total_orders} طلب</Badge>}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">المدينة:</span><span className="font-semibold text-slate-700">{customer.city ?? '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">القناة:</span><span className="font-semibold text-slate-700">{customer.channel ?? '—'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">آخر تواصل:</span><span className="font-semibold text-slate-700">{timeAgo(customer.last_contact)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">إجمالي المشتريات:</span><span className="font-semibold text-slate-700">{formatCurrency(Number(customer.total_spent))}</span></div>
      </div>

      {customer.tags.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">العلامات</div>
          <div className="flex flex-wrap gap-1">{customer.tags.map((t) => <Badge key={t} color="sky">{t}</Badge>)}</div>
        </div>
      )}

      <div>
        <div className="text-xs font-bold text-slate-500 mb-2">آخر الطلبات</div>
        {customerOrders.length === 0 ? (
          <p className="text-xs text-slate-400">لا توجد طلبات</p>
        ) : (
          <div className="space-y-1.5">
            {customerOrders.slice(0, 3).map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{o.order_number ?? `#${o.id.slice(0, 6)}`}</span>
                <span className="text-slate-500">{formatCurrency(Number(o.total))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <button className="w-full btn-secondary btn-sm"><Mail size={14} /> إرسال رسالة</button>
        <button className="w-full btn-secondary btn-sm"><ShoppingCart size={14} /> إنشاء طلب</button>
        <button className="w-full btn-secondary btn-sm"><StickyNote size={14} /> إضافة ملاحظة</button>
      </div>
    </div>
  );
}
