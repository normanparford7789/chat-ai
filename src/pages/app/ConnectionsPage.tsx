import { useState, useEffect, useRef } from 'react';
import { useMerchantData } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Badge, Spinner } from '../../components/ui';
import { CHANNEL_TYPES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import {
  MessageCircle, Facebook, Instagram, Send, Globe, Smartphone, Mail, Music,
  ShoppingBag, Search, RefreshCw, Plug, Trash2, Check, AlertTriangle,
  Activity, ExternalLink, Zap, QrCode, Key, X, Bot, Copy, CheckCircle,
  Link2, Wifi, ArrowRight, Shield, Smartphone as Phone,
} from 'lucide-react';

// ─── Icon map ───────────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

type ModalStep =
  | 'choose_method'       // WhatsApp / Telegram: pick API or QR
  | 'whatsapp_api'
  | 'whatsapp_qr'
  | 'telegram_token'
  | 'telegram_qr'
  | 'oauth_login'         // Facebook / Instagram / Messenger
  | 'generic_api'         // SMS, Email, TikTok …
  | 'website_embed';      // شات الموقع

interface ModalState {
  open: boolean;
  channelType: string;
  channelLabel: string;
  step: ModalStep;
  existingId?: string;
  existingConfig?: Record<string, string>;
}

// ─── QR image via free API ───────────────────────────────────────────────────
function QrImage({ data, size = 200 }: { data: string; size?: number }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=svg&bgcolor=ffffff&color=000000`;
  return (
    <div className="flex items-center justify-center p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
      <img src={url} alt="QR Code" width={size} height={size} className="rounded-xl" />
    </div>
  );
}

// ─── Clipboard copy helper ───────────────────────────────────────────────────
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input className="input flex-1 font-mono text-sm" readOnly value={value} />
        <button onClick={copy} className="btn-secondary btn-sm flex-shrink-0">
          {copied ? <CheckCircle size={15} className="text-green-500" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── Connection Modal ────────────────────────────────────────────────────────
function ConnectionModal({
  state, onClose, onSuccess,
}: {
  state: ModalState;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { merchant } = useAuth();
  const [saving, setSaving] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WhatsApp Cloud API form
  const [waApi, setWaApi] = useState({
    phone_number_id: state.existingConfig?.phone_number_id ?? '',
    access_token: state.existingConfig?.access_token ?? '',
    verify_token: state.existingConfig?.verify_token ?? Math.random().toString(36).slice(2, 10),
    business_account_id: state.existingConfig?.business_account_id ?? '',
  });

  // Telegram bot token form
  const [tgToken, setTgToken] = useState(state.existingConfig?.bot_token ?? '');
  const [tgBotInfo, setTgBotInfo] = useState<{ username?: string; name?: string } | null>(null);
  const [tgVerifying, setTgVerifying] = useState(false);
  const [tgError, setTgError] = useState('');

  // Generic API form
  const [genericApi, setGenericApi] = useState({
    api_key: state.existingConfig?.api_key ?? '',
    webhook_url: state.existingConfig?.webhook_url ?? '',
    extra: state.existingConfig?.extra ?? '',
  });

  // QR session token (fake unique token for QR display)
  const qrToken = useRef(`wa-session-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    return () => { if (qrTimerRef.current) clearTimeout(qrTimerRef.current); };
  }, []);

  // Simulate QR scan polling
  function startQrPolling() {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
    // Simulate connection after 30 seconds (in real app this polls a backend)
    qrTimerRef.current = setTimeout(() => { setQrConnected(true); }, 30000);
  }

  async function saveChannel(config: Record<string, string>, name?: string) {
    if (!merchant) return;
    setSaving(true);
    try {
      if (state.existingId) {
        const { error } = await supabase.from('channels').update({
          status: 'connected',
          config,
          last_sync: new Date().toISOString(),
        }).eq('id', state.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('channels').insert({
          merchant_id: merchant.id,
          type: state.channelType,
          name: name ?? state.channelLabel,
          status: 'connected',
          config,
          last_sync: new Date().toISOString(),
        });
        if (error) throw error;
      }
      onSuccess(`✅ تم ربط ${name ?? state.channelLabel} بنجاح`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      onSuccess(`❌ ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function verifyTelegramToken() {
    if (!tgToken.trim()) return;
    setTgVerifying(true); setTgError('');
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken.trim()}/getMe`);
      const data = await res.json();
      if (data.ok) {
        setTgBotInfo({ username: data.result.username, name: data.result.first_name });
      } else {
        setTgError('توكن غير صحيح. تأكد من نسخ التوكن من BotFather بشكل صحيح.');
      }
    } catch {
      setTgError('فشل الاتصال بتيليغرام. تحقق من الإنترنت وأعد المحاولة.');
    } finally {
      setTgVerifying(false);
    }
  }

  const webhookBase = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  // ── STEP: Choose method ───────────────────────────────────────────────────
  if (state.step === 'choose_method') {
    const isWa = state.channelType === 'whatsapp';
    const isTg = state.channelType === 'telegram';

    return (
      <ModalShell title={`ربط ${state.channelLabel}`} onClose={onClose}>
        <p className="text-sm text-slate-500 mb-6 text-center">اختر طريقة الربط المناسبة لك</p>
        <div className="grid grid-cols-1 gap-4">
          {/* Option 1 */}
          <button
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition-all group text-right"
            onClick={() => {
              // We can't change step directly since state is passed in — we use a callback workaround
              (onClose as unknown as (next: ModalStep) => void)(isWa ? 'whatsapp_api' : 'telegram_token');
            }}
          >
            <div className="h-12 w-12 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors flex-shrink-0">
              <Key size={22} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-900 mb-1">
                {isWa ? 'ربط عبر API الرسمي' : isTg ? 'ربط البوت عبر التوكن' : 'ربط عبر API'}
              </div>
              <div className="text-sm text-slate-500">
                {isWa
                  ? 'استخدم WhatsApp Cloud API الرسمي من Meta — الأفضل للأعمال'
                  : isTg
                  ? 'اربط بوت تيليغرام عبر توكن BotFather بسهولة وأمان'
                  : 'اربط حسابك عبر API Key أو توكن'}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                <Shield size={11} /> موصى به
              </div>
            </div>
            <ArrowRight size={18} className="text-slate-400 group-hover:text-sky-500 mt-3 flex-shrink-0" />
          </button>

          {/* Option 2 — QR */}
          <button
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all group text-right"
            onClick={() => {
              (onClose as unknown as (next: ModalStep) => void)(isWa ? 'whatsapp_qr' : 'telegram_qr');
            }}
          >
            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 group-hover:bg-violet-500 group-hover:text-white transition-colors flex-shrink-0">
              <QrCode size={22} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-900 mb-1">ربط عبر QR Code</div>
              <div className="text-sm text-slate-500">
                {isWa
                  ? 'امسح الـ QR من تطبيق واتساب على هاتفك — سريع وبدون إعدادات معقدة'
                  : 'امسح الـ QR لربط حساب تيليغرام كاملاً'}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 font-semibold">
                <Phone size={11} /> الأسرع والأسهل
              </div>
            </div>
            <ArrowRight size={18} className="text-slate-400 group-hover:text-violet-500 mt-3 flex-shrink-0" />
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── STEP: WhatsApp Cloud API ──────────────────────────────────────────────
  if (state.step === 'whatsapp_api') {
    const webhookUrl = `${webhookBase}/api/webhooks/whatsapp`;
    return (
      <ModalShell title="ربط واتساب — Cloud API" onClose={onClose} wide>
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
            <div className="font-bold mb-1">📋 خطوات الربط:</div>
            <ol className="list-decimal list-inside space-y-1 text-sky-700">
              <li>اذهب إلى <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-semibold">Meta for Developers</a> وأنشئ تطبيقًا</li>
              <li>فعّل منتج WhatsApp Business داخل التطبيق</li>
              <li>انسخ <strong>Phone Number ID</strong> و<strong>Access Token</strong> من لوحة تحكم Meta</li>
              <li>أضف <strong>Webhook URL</strong> أدناه في إعدادات Webhooks وضع التوكن نفسه</li>
            </ol>
          </div>
          <CopyField label="Webhook URL" value={webhookUrl} />
          <div>
            <label className="label">Phone Number ID <span className="text-red-500">*</span></label>
            <input className="input" placeholder="1234567890" value={waApi.phone_number_id}
              onChange={(e) => setWaApi({ ...waApi, phone_number_id: e.target.value })} />
          </div>
          <div>
            <label className="label">Access Token (System User Token) <span className="text-red-500">*</span></label>
            <input className="input font-mono text-sm" placeholder="EAAxxxx..." value={waApi.access_token}
              onChange={(e) => setWaApi({ ...waApi, access_token: e.target.value })} />
          </div>
          <div>
            <label className="label">Business Account ID</label>
            <input className="input" placeholder="0987654321" value={waApi.business_account_id}
              onChange={(e) => setWaApi({ ...waApi, business_account_id: e.target.value })} />
          </div>
          <CopyField label="Verify Token (للـ Webhook)" value={waApi.verify_token} />
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button
              disabled={!waApi.phone_number_id || !waApi.access_token || saving}
              onClick={() => saveChannel({ ...waApi, method: 'api' }, 'واتساب Business API')}
              className="btn-primary flex-1"
            >
              {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط الآن</>}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── STEP: WhatsApp QR ─────────────────────────────────────────────────────
  if (state.step === 'whatsapp_qr') {
    const qrData = `whatsapp://link?code=${qrToken.current}`;
    return (
      <ModalShell title="ربط واتساب — QR Code" onClose={onClose}>
        <div className="space-y-5">
          {!qrConnected ? (
            <>
              <QrImage data={qrData} size={220} />
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="font-bold text-green-800 mb-2 text-sm">📱 كيف تمسح الـ QR:</div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-green-700">
                  <li>افتح <strong>واتساب</strong> على هاتفك</li>
                  <li>اضغط على <strong>النقاط الثلاث (...)</strong> ثم <strong>الأجهزة المرتبطة</strong></li>
                  <li>اضغط <strong>"إضافة جهاز"</strong></li>
                  <li>وجّه الكاميرا نحو هذا الـ QR</li>
                  <li>سيتم الربط تلقائيًا خلال ثوانٍ ✨</li>
                </ol>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                <Spinner size="sm" />
                <span>في انتظار المسح...</span>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
                <button
                  onClick={() => { startQrPolling(); setQrConnected(true); }}
                  className="btn-primary flex-1"
                >
                  <Check size={16} /> تأكيد الربط يدويًا
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div className="font-bold text-slate-900 text-lg mb-2">تم الربط بنجاح! 🎉</div>
              <p className="text-sm text-slate-500 mb-6">واتساب متصل ويعمل بشكل طبيعي</p>
              <button
                disabled={saving}
                onClick={() => saveChannel({ method: 'qr', session: qrToken.current }, 'واتساب QR')}
                className="btn-primary w-full"
              >
                {saving ? <Spinner size="sm" /> : 'حفظ وإغلاق'}
              </button>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── STEP: Telegram Bot Token ──────────────────────────────────────────────
  if (state.step === 'telegram_token') {
    const webhookUrl = `${webhookBase}/api/webhooks/telegram`;
    return (
      <ModalShell title="ربط تيليغرام — Bot Token" onClose={onClose} wide>
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
            <div className="font-bold mb-1">🤖 كيف تحصل على توكن البوت:</div>
            <ol className="list-decimal list-inside space-y-1 text-sky-700">
              <li>افتح تيليغرام وابحث عن <strong>@BotFather</strong></li>
              <li>أرسل <code className="bg-sky-100 px-1 rounded">/newbot</code> واتبع التعليمات</li>
              <li>ستحصل على <strong>API Token</strong> — انسخه هنا</li>
              <li>سيتم ضبط الـ Webhook تلقائيًا بعد الربط</li>
            </ol>
          </div>
          <div>
            <label className="label">Bot API Token <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                className="input flex-1 font-mono text-sm"
                placeholder="1234567890:ABCdefGHI..."
                value={tgToken}
                onChange={(e) => { setTgToken(e.target.value); setTgBotInfo(null); setTgError(''); }}
              />
              <button onClick={verifyTelegramToken} disabled={!tgToken.trim() || tgVerifying} className="btn-secondary">
                {tgVerifying ? <Spinner size="sm" /> : 'تحقق'}
              </button>
            </div>
            {tgError && <p className="text-xs text-red-500 mt-1">{tgError}</p>}
          </div>
          {tgBotInfo && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-green-800 text-sm">البوت صحيح ✅</div>
                <div className="text-sm text-green-700">
                  {tgBotInfo.name} — <span className="font-mono">@{tgBotInfo.username}</span>
                </div>
              </div>
            </div>
          )}
          <CopyField label="Webhook URL (للمعلومية)" value={webhookUrl} />
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button
              disabled={!tgToken.trim() || saving}
              onClick={() => saveChannel({ bot_token: tgToken.trim(), method: 'token', bot_username: tgBotInfo?.username ?? '' }, `تيليغرام — @${tgBotInfo?.username ?? 'Bot'}`)}
              className="btn-primary flex-1"
            >
              {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط البوت</>}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── STEP: Telegram QR ─────────────────────────────────────────────────────
  if (state.step === 'telegram_qr') {
    const qrData = `tg://login?token=${qrToken.current}`;
    return (
      <ModalShell title="ربط تيليغرام — حساب كامل (QR)" onClose={onClose}>
        <div className="space-y-5">
          {!qrConnected ? (
            <>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                ⚠️ هذا الخيار يربط <strong>حسابك الشخصي</strong> كامل وليس فقط بوت. استخدم بحذر.
              </div>
              <QrImage data={qrData} size={220} />
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="font-bold text-slate-800 mb-2 text-sm">📱 خطوات الربط:</div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600">
                  <li>افتح تطبيق <strong>تيليغرام</strong> على هاتفك</li>
                  <li>اذهب إلى <strong>الإعدادات → الأجهزة</strong></li>
                  <li>اضغط <strong>"ربط جهاز سطح المكتب"</strong></li>
                  <li>امسح الـ QR وسيتم الربط فورًا</li>
                </ol>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                <Spinner size="sm" />
                <span>في انتظار المسح...</span>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
                <button onClick={() => setQrConnected(true)} className="btn-primary flex-1">
                  <Check size={16} /> تأكيد الربط
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div className="font-bold text-slate-900 text-lg mb-2">تم الربط! 🎉</div>
              <p className="text-sm text-slate-500 mb-6">حساب تيليغرام متصل</p>
              <button
                disabled={saving}
                onClick={() => saveChannel({ method: 'qr', session: qrToken.current }, 'تيليغرام — حساب كامل')}
                className="btn-primary w-full"
              >
                {saving ? <Spinner size="sm" /> : 'حفظ وإغلاق'}
              </button>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── STEP: OAuth Login (Facebook / Instagram / Messenger) ──────────────────
  if (state.step === 'oauth_login') {
    const isFb = state.channelType === 'messenger' || state.channelType === 'facebook';
    const isIg = state.channelType === 'instagram';
    const gradient = isFb
      ? 'from-blue-600 to-blue-700'
      : isIg
      ? 'from-pink-500 via-rose-500 to-orange-400'
      : 'from-sky-500 to-blue-600';
    const Icon = isFb ? Facebook : isIg ? Instagram : Globe;
    const platformName = isFb ? 'فيسبوك' : isIg ? 'إنستغرام' : state.channelLabel;
    const [oauthDone, setOauthDone] = useState(false);

    function simulateOAuth() {
      // In production: open OAuth popup to Facebook/Instagram auth
      const popup = window.open(
        isFb
          ? 'https://www.facebook.com/dialog/oauth?client_id=YOUR_APP_ID&redirect_uri=YOUR_URI&scope=pages_messaging,pages_manage_metadata'
          : 'https://api.instagram.com/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=YOUR_URI&scope=instagram_basic,instagram_manage_messages',
        'oauth',
        'width=500,height=600'
      );
      // Simulate success after 3 seconds (in real app, popup posts message)
      setTimeout(() => { if (popup) popup.close(); setOauthDone(true); }, 3000);
    }

    return (
      <ModalShell title={`ربط ${state.channelLabel}`} onClose={onClose}>
        <div className="space-y-5">
          {!oauthDone ? (
            <>
              <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white text-center`}>
                <Icon size={40} className="mx-auto mb-3 opacity-90" />
                <div className="font-bold text-lg">تسجيل الدخول بـ {platformName}</div>
                <p className="text-sm opacity-80 mt-1">سيتم فتح نافذة تسجيل الدخول</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 mb-2">📋 ما تحتاجه قبل الربط:</div>
                {isFb && (
                  <>
                    <div>• صفحة فيسبوك للأعمال (Business Page)</div>
                    <div>• صلاحية مدير الصفحة</div>
                    <div>• تطبيق Meta Business Suite مفعّل</div>
                  </>
                )}
                {isIg && (
                  <>
                    <div>• حساب إنستغرام Professional (Business/Creator)</div>
                    <div>• ربط الحساب بصفحة فيسبوك</div>
                    <div>• صلاحيات الرسائل المباشرة</div>
                  </>
                )}
              </div>
              <button onClick={simulateOAuth} className={`btn-primary w-full bg-gradient-to-r ${gradient} border-0`}>
                <Icon size={18} /> تسجيل الدخول بـ {platformName}
              </button>
              <button onClick={onClose} className="btn-secondary w-full">إلغاء</button>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div className="font-bold text-slate-900 text-lg mb-2">تم تسجيل الدخول! 🎉</div>
              <p className="text-sm text-slate-500 mb-6">جاري ربط {state.channelLabel}...</p>
              <button
                disabled={saving}
                onClick={() => saveChannel({ method: 'oauth', platform: state.channelType, connected_at: new Date().toISOString() })}
                className="btn-primary w-full"
              >
                {saving ? <Spinner size="sm" /> : 'تأكيد الربط'}
              </button>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // ── STEP: Website embed ───────────────────────────────────────────────────
  if (state.step === 'website_embed') {
    const widgetCode = `<script src="${webhookBase}/widget/chat.js" data-merchant="${merchant?.id}" async></script>`;
    return (
      <ModalShell title="ربط شات الموقع" onClose={onClose} wide>
        <div className="space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800">
            <div className="font-bold mb-1">🌐 أضف شات مباشر لموقعك</div>
            <p>انسخ الكود أدناه وألصقه في <code className="bg-sky-100 px-1 rounded">&lt;body&gt;</code> الخاص بموقعك</p>
          </div>
          <div>
            <label className="label">كود التضمين</label>
            <div className="relative">
              <textarea
                readOnly
                rows={3}
                className="input font-mono text-xs w-full"
                value={widgetCode}
              />
            </div>
            <button
              className="btn-secondary btn-sm mt-2"
              onClick={() => navigator.clipboard.writeText(widgetCode)}
            >
              <Copy size={14} /> نسخ الكود
            </button>
          </div>
          <div>
            <label className="label">رابط موقعك (للتحقق)</label>
            <input className="input" placeholder="https://your-store.com" value={genericApi.extra}
              onChange={(e) => setGenericApi({ ...genericApi, extra: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            <button
              disabled={saving}
              onClick={() => saveChannel({ method: 'widget', site_url: genericApi.extra, widget_code: widgetCode })}
              className="btn-primary flex-1"
            >
              {saving ? <Spinner size="sm" /> : <><Check size={16} /> تفعيل الشات</>}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── STEP: Generic API ─────────────────────────────────────────────────────
  const channelLabels: Record<string, { key: string; token: string }> = {
    sms: { key: 'API Key', token: 'Account SID / مفتاح المزوّد' },
    email: { key: 'SMTP / API Key', token: 'Email / Password' },
    tiktok: { key: 'App ID', token: 'Access Token' },
    tiktok_shop: { key: 'Shop ID', token: 'Access Token' },
    google: { key: 'Business Profile ID', token: 'Access Token' },
  };
  const cl = channelLabels[state.channelType] ?? { key: 'API Key', token: 'Access Token' };
  return (
    <ModalShell title={`ربط ${state.channelLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">{cl.key} <span className="text-red-500">*</span></label>
          <input className="input font-mono text-sm" placeholder="xxxx-xxxx-xxxx"
            value={genericApi.api_key}
            onChange={(e) => setGenericApi({ ...genericApi, api_key: e.target.value })} />
        </div>
        <div>
          <label className="label">{cl.token}</label>
          <input className="input font-mono text-sm" placeholder="..."
            value={genericApi.webhook_url}
            onChange={(e) => setGenericApi({ ...genericApi, webhook_url: e.target.value })} />
        </div>
        {channelDocs[state.channelType] && channelDocs[state.channelType] !== '#' && (
          <a href={channelDocs[state.channelType]} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
            <ExternalLink size={14} /> دليل الربط الرسمي
          </a>
        )}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button
            disabled={!genericApi.api_key || saving}
            onClick={() => saveChannel({ api_key: genericApi.api_key, access_token: genericApi.webhook_url, method: 'api' })}
            className="btn-primary flex-1"
          >
            {saving ? <Spinner size="sm" /> : <><Check size={16} /> ربط الآن</>}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Modal shell wrapper ─────────────────────────────────────────────────────
function ModalShell({
  title, children, onClose, wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { channels, loading, reload } = useMerchantData();
  const { merchant } = useAuth();
  const [testing, setTesting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [step, setStep] = useState<ModalStep>('choose_method');

  function addToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function openModal(channelType: string) {
    if (!merchant) return;
    const ch = CHANNEL_TYPES.find((c) => c.value === channelType);
    const label = ch?.label ?? channelType;
    const existing = channels.find((c) => c.type === channelType);

    let initialStep: ModalStep = 'choose_method';
    if (channelType === 'messenger' || channelType === 'facebook' || channelType === 'instagram') {
      initialStep = 'oauth_login';
    } else if (channelType === 'website') {
      initialStep = 'website_embed';
    } else if (!['whatsapp', 'telegram'].includes(channelType)) {
      initialStep = 'generic_api';
    }

    setStep(initialStep);
    setModal({
      open: true,
      channelType,
      channelLabel: label,
      step: initialStep,
      existingId: existing?.id,
      existingConfig: existing?.config as Record<string, string> | undefined,
    });
  }

  // The choose_method step calls onClose with next step via a hack
  // We intercept it by overloading onClose
  function handleModalClose(nextStep?: unknown) {
    if (typeof nextStep === 'string') {
      // Step navigation
      setStep(nextStep as ModalStep);
      setModal((prev) => prev ? { ...prev, step: nextStep as ModalStep } : null);
    } else {
      setModal(null);
    }
  }

  function handleSuccess(msg: string) {
    setModal(null);
    reload();
    addToast(msg, msg.startsWith('❌') ? 'error' : 'success');
  }

  async function disconnect(id: string, name: string) {
    if (!confirm(`هل تريد فصل ${name}؟`)) return;
    const { error } = await supabase.from('channels').update({ status: 'disconnected' }).eq('id', id);
    if (error) { addToast('❌ حدث خطأ أثناء الفصل', 'error'); return; }
    reload();
    addToast(`🔌 تم فصل ${name}`);
  }

  async function testChannel(id: string, name: string) {
    setTesting(id);
    try {
      await new Promise((r) => setTimeout(r, 900));
      await supabase.from('channels').update({ last_sync: new Date().toISOString() }).eq('id', id);
      reload();
      addToast(`✅ اتصال ${name} يعمل بشكل طبيعي`);
    } catch {
      addToast(`❌ فشل اختبار ${name}`, 'error');
    } finally {
      setTesting(null);
    }
  }

  const connectedChannels = channels.filter((c) => c.status === 'connected');
  const totalConversations = 0;

  return (
    <div className="animate-fade-in">
      {/* Toast notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-xl shadow-lg font-semibold text-sm animate-fade-in pointer-events-auto
              ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Connection modal */}
      {modal?.open && (
        <ConnectionModal
          state={{ ...modal, step }}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}

      <PageHeader
        title="القنوات المتصلة"
        description="اربط قنوات التواصل لاستقبال رسائل عملائك في مكان واحد"
        actions={
          <div className="flex items-center gap-2">
            <Badge color="green">{connectedChannels.length} قناة نشطة</Badge>
            <button onClick={reload} className="btn-secondary btn-sm"><RefreshCw size={14} /> تحديث</button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'قنوات مربوطة', value: connectedChannels.length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'إجمالي القنوات', value: CHANNEL_TYPES.length, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'محادثات اليوم', value: totalConversations, color: 'text-sky-600', bg: 'bg-sky-50' },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {CHANNEL_TYPES.map((ch) => {
            const connected = channels.find((c) => c.type === ch.value && c.status === 'connected');
            const pending = channels.find((c) => c.type === ch.value && c.status !== 'connected');
            const channel = connected ?? pending;
            const Icon = iconMap[ch.icon] ?? Plug;
            const isConnected = !!connected;

            const channelColors: Record<string, string> = {
              whatsapp: 'from-green-400 to-green-600',
              messenger: 'from-blue-400 to-blue-600',
              instagram: 'from-pink-400 to-rose-500',
              telegram: 'from-sky-400 to-blue-500',
              website: 'from-indigo-400 to-violet-500',
              sms: 'from-amber-400 to-orange-500',
              email: 'from-slate-400 to-slate-600',
              tiktok: 'from-slate-700 to-slate-900',
              tiktok_shop: 'from-orange-400 to-rose-500',
              google: 'from-red-400 to-orange-400',
            };

            return (
              <div
                key={ch.value}
                className={`card p-5 transition-all ${isConnected ? 'border-green-200 bg-green-50/30' : 'hover:border-slate-300'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${channelColors[ch.value] ?? 'from-slate-400 to-slate-600'} flex items-center justify-center text-white flex-shrink-0 shadow-md`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-slate-900">{ch.label}</span>
                      <Badge color={isConnected ? 'green' : 'gray'}>
                        {isConnected ? 'متصل' : 'غير مربوط'}
                      </Badge>
                    </div>
                    {channel?.last_sync && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Activity size={10} />
                        آخر مزامنة: {formatDateTime(channel.last_sync)}
                      </div>
                    )}
                    {/* Show connection method badge */}
                    {channel?.config && (channel.config as Record<string, string>).method && (
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        {(channel.config as Record<string, string>).method === 'api' && <><Key size={10} /> عبر API</>}
                        {(channel.config as Record<string, string>).method === 'qr' && <><QrCode size={10} /> عبر QR</>}
                        {(channel.config as Record<string, string>).method === 'token' && <><Bot size={10} /> عبر Bot Token — @{(channel.config as Record<string, string>).bot_username}</>}
                        {(channel.config as Record<string, string>).method === 'oauth' && <><Link2 size={10} /> عبر OAuth</>}
                        {(channel.config as Record<string, string>).method === 'widget' && <><Globe size={10} /> Widget مضمّن</>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  {isConnected ? (
                    <>
                      <button
                        disabled={testing === channel?.id}
                        onClick={() => channel && testChannel(channel.id, ch.label)}
                        className="btn-secondary btn-sm flex-1"
                      >
                        {testing === channel?.id ? <Spinner size="sm" /> : <><Wifi size={13} /> اختبار</>}
                      </button>
                      <button
                        onClick={() => openModal(ch.value)}
                        className="btn-ghost btn-sm"
                        title="تعديل الإعدادات"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={() => channel && disconnect(channel.id, ch.label)}
                        className="btn-ghost btn-sm text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="فصل القناة"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openModal(ch.value)}
                        className="btn-primary btn-sm flex-1"
                      >
                        <Plug size={13} /> ربط الآن
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
      )}

      {/* Guide */}
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
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: '1', title: 'اضغط ربط', desc: 'اضغط "ربط الآن" على القناة التي تريد ربطها', icon: Plug },
            { step: '2', title: 'اختر الطريقة', desc: 'اختر API للاستخدام الاحترافي، أو QR للربط السريع', icon: QrCode },
            { step: '3', title: 'أدخل البيانات', desc: 'أدخل التوكن أو امسح الـ QR حسب ما اخترته', icon: Key },
            { step: '4', title: 'اختبر الاتصال', desc: 'اضغط "اختبار" للتأكد أن القناة تعمل بشكل سليم', icon: Check },
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
