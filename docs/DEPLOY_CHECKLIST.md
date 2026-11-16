# قائمة النشر — Security Redesign (`overhaul/security-redesign`)

هذه القائمة لنشر فرع التحصين الأمني على الإنتاج (Netlify + Railway/Baileys + Supabase)
**بدون** أن يحتاج أي عميل لإعادة ربط رقم Meta Cloud API أو إعادة مسح QR.

---

## ١. ترتيب النشر (مختصر)

1. **متغيرات البيئة** على Netlify و Railway (القسم ٢) — قبل أي شيء آخر.
2. **Migrations** في Supabase بالترتيب `026 → 027 → 028 → 029 → 030` (القسم ٣).
3. **Railway (wabek-baileys)** — إعادة نشر/تشغيل خادم Baileys.
4. **Netlify** — نشر الواجهة و API.
5. **Smoke test** (القسم ٥) + **تحقق اتصالات واتساب** (القسم ٦).

> الكود الجديد متسامح مع غياب الـ migrations (fallbacks)، والـ migrations إضافية فقط،
> لذلك الترتيب أعلاه آمن. لا تنشر Netlify قبل ضبط `JWT_SECRET` و `CRON_SECRET`.

---

## ٢. متغيرات البيئة

### ٢.١ Netlify — مطلوبة (Required)

| Variable | ملاحظات |
|---|---|
| `JWT_SECRET` | **حرج.** لا يوجد أي fallback الآن (الكود القديم كان يقبل `SUPABASE_JWT_SECRET` ثم `SUPABASE_JWT_SECRET_KEY` ثم `'fallback-secret-change-in-production'`). ضع **نفس القيمة المستخدمة حالياً في الإنتاج**: إن كان `JWT_SECRET` مضبوطاً اتركه؛ وإلا إن كان الإنتاج يعتمد على `SUPABASE_JWT_SECRET` فاضبط `JWT_SECRET` على نفس قيمته. غير ذلك → كل المستخدمين يُسجَّل خروجهم (مرة واحدة فقط). إن كان الإنتاج يعمل فعلاً على `fallback-secret…` فيجب توليد سر جديد قوي (٣٢+ حرفاً) وقبول تسجيل خروج الجميع. |
| `NEXT_PUBLIC_APP_URL` | رابط الموقع (يُستخدم في روابط Stripe/OAuth/Webhooks). |
| `NEXT_PUBLIC_SUPABASE_URL` (أو `NEXT_PUBLIC_SUPABASE_DATABASE_URL` / `SUPABASE_DATABASE_URL`) | رابط مشروع Supabase. OAuth يستخدم `NEXT_PUBLIC_SUPABASE_DATABASE_URL`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | يُستخدم فقط لتدفق OAuth؛ بعد 026 لا يملك أي صلاحية على جداول `public`. |
| `SUPABASE_SERVICE_ROLE_KEY` | كل وصول الخادم لقاعدة البيانات. |
| `CRON_SECRET` | **نفس القيمة على Netlify و Railway.** تحميه `/api/cron/expire-plans` و `/api/campaigns/scheduler` و `/api/ai/review-scheduler` (Netlify scheduled functions ترسله تلقائياً). مقارنة constant-time، ويفشل مغلقاً إن غاب. |
| `WA_WEB_SERVER_URL` | رابط خادم Baileys على Railway. |
| `WA_WEB_SERVER_SECRET` | **يساوي `SERVER_SECRET` على Railway.** |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | توكن التحقق لـ Meta webhook (نفس القيمة المسجلة في Meta App — لا تغيّرها). |
| `META_APP_SECRET` | للتحقق من توقيع `X-Hub-Signature-256` على Meta webhook. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe المنصة (`/api/billing/webhook`). |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | **جديد ومستقل** لـ `/api/reseller/stripe-connect/webhook` (endpoint من نوع *Connected accounts* في Stripe). بدونه يرجع 500. |
| `WIX_APP_ID`, `WIX_APP_SECRET` (**rotated** — ضع القيمة الجديدة), `WIX_PUBLIC_KEY` | تكامل Wix. `WIX_PUBLIC_KEY` بصيغة PEM (يُقبل `\n` حرفياً). |

### ٢.٢ Netlify — اختيارية (Optional)

| Variable | الافتراضي / ملاحظات |
|---|---|
| `META_APP_SECRETS` | قائمة مفصولة بفواصل لأسرار تطبيقات Meta الخاصة ببعض المستأجرين (tenants لهم Meta App خاص). **إن وُجد مستأجر بتطبيق خاص ولم تُضف سرّه هنا ستُرفض webhooks الخاصة به.** |
| `META_APP_ID`, `META_CONFIG_ID` | Embedded Signup. |
| `WHATSAPP_API_VERSION` | `v21.0` افتراضياً (Graph API لكل الإرسال والتحقق، بما فيه `admin/validate-wa-token`). |
| `WHATSAPP_SUBSCRIBE_API_VERSION` | `v25.0` افتراضياً (subscribed_apps فقط). |
| `MESSAGE_LIMIT_MODE` | ضع `log` في البداية: تجاوز حد الرسائل الشهري يُسجَّل فقط ولا يُحجب. احذفه لاحقاً لتفعيل الحجب. (opt-out / blocked يُحجب دائماً.) |
| `AI_USER_DAILY_LIMIT` | حد يومي لكل مستخدم لطلبات AI التفاعلية (يتطلب 026). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limiting موزّع؛ بدونه يُستخدم `rate_limit_hit()` (027) ثم ذاكرة محلية. |
| `WABEK_EVENTS_SECRET` | سر إضافي مقبول على `/api/whatsapp/wa-web-events` (بجانب `WA_WEB_SERVER_SECRET`). |
| `OAUTH_STATE_SECRET` | يوقّع OAuth state؛ الافتراضي `JWT_SECRET`. |
| `ALLOW_QUERY_API_KEY` | `0` لرفض API key في query/body (`?api_key=`). الافتراضي: مقبول مع تحذير (إضافات WHMCS/WordPress القديمة). |
| `WHMCS_URL`, `WHMCS_API_IDENTIFIER`, `WHMCS_API_SECRET`, `WHMCS_OWNER_USER_ID` | تكامل WHMCS الخاص بالمنصة؛ يعمل فقط لحساب `WHMCS_OWNER_USER_ID`. |
| `WIX_INSTANCE_MAX_AGE_HOURS` | `48` افتراضياً. |
| `WIX_CLOSE_WINDOW_WITH_TOKEN` | `1` للسلوك القديم في نافذة Wix OAuth (غير مستحسن). |
| `STRIPE_CONNECT_CLIENT_ID` | ربط حسابات الموزعين بـ Stripe Connect. |
| `DEEPSEEK_API_KEY` | ردود AI. `ANTHROPIC_API_KEY` لأداة SEO. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME` | البريد (OTP fallback). |
| `OTP_EXPIRY_MINUTES`, `NEXT_PUBLIC_OTP_EXPIRY` | `10` افتراضياً. |
| `ADMIN_EMAIL` | استقبال تذاكر الدعم / نموذج التواصل. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push. |
| `NETLIFY_API_TOKEN`, `NETLIFY_SITE_ID`, `NEXT_PUBLIC_NETLIFY_URL` | نطاقات white-label. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Search Console (admin). |
| `NEXT_PUBLIC_APP_NAME` | اسم التطبيق. |

> متغيرات لم تعد مستخدمة ويمكن حذفها بعد التأكد: `SUPABASE_JWT_SECRET_KEY`, `ADMIN_SECRET_KEY`.
> (`SUPABASE_JWT_SECRET` لم يعد يقرأه الكود — انقل قيمته إلى `JWT_SECRET` كما سبق.)

### ٢.٣ Railway (wabek-baileys)

| Variable | ملاحظات |
|---|---|
| `SERVER_SECRET` | **مطلوب.** الخادم يتوقف (FATAL) إن كان فارغاً أو `'change-this-secret'`. سر عشوائي طويل، **ونفس القيمة** في `WA_WEB_SERVER_SECRET` على Netlify. تغييره لا يمس جلسات Baileys (لا يُستخدم للتشفير). |
| `CRON_SECRET` | **نفس قيمة Netlify.** يُرسل في `x-cron-secret` إلى `/api/ai/review-scheduler`. إن غاب يُرسل `SERVER_SECRET` (مقبول مؤقتاً على Netlify فقط إن كان ≥16 حرفاً) — اضبطه لإنهاء هذا الـ fallback. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | لتخزين جلسات `wa_sessions` ورفع الوسائط — **لا تغيّرها**. |
| `WABEK_EVENTS_URL` | `https://<site>/api/whatsapp/wa-web-events` — لا تغيّره. |
| `WABEK_EVENTS_SECRET` | اختياري؛ الافتراضي `SERVER_SECRET`. |
| `NETLIFY_URL` | اختياري؛ يُشتق من `WABEK_EVENTS_URL`. |
| `CORS_ALLOWED_ORIGINS` | اختياري، قائمة origins مفصولة بفواصل. |
| `UPLOAD_INBOUND_MEDIA` | `0` لتعطيل رفع الوسائط الواردة. |
| `PORT` | يضبطه Railway. |

### ٢.٤ Supabase Storage

- bucket **`wa-media`** (public): ارفع **File size limit إلى 50MB** (المستندات حتى 50MB — `MAX_DOCUMENT_BYTES`). الكود ينشئه بـ 50MB فقط إن لم يكن موجوداً؛ bucket موجود بحد أقل يجب تعديله يدوياً من لوحة Supabase.
- bucket **`brand-assets`** (public): تنشئه 028 أو أول رفع شعار.

---

## ٣. Migrations

الترتيب: **`026_enable_rls_lockdown` → `027_auth_hardening` → `028_billing_hardening` → `029_messaging_hardening` → `030_lockdown_reassert`**

- كلها إضافية وidempotent (يمكن إعادة تشغيلها)، لا تحذف بيانات، ولا تغيّر `whatsapp_instances` أو `wa_sessions`.
- **026**: يفعّل RLS على كل جداول `public`، يحذف policies الخاصة بـ anon/authenticated/PUBLIC، ويسحب كل الصلاحيات منهم (جداول/sequences/functions + default privileges). `service_role` (Netlify + Baileys) يحتفظ بكل الصلاحيات ويتجاوز RLS. ⚠️ أي كود يستخدم anon key مباشرة على الجداول (مثلاً Realtime من المتصفح) لن يستقبل شيئاً بعده.
- **027**: `users.token_version`، `attempts` على `otp_codes`/`otp_pending`، `team_members.invite_expires_at`، `rate_limits` + `rate_limit_hit()`، `processed_stripe_events`، `bump_token_version()`، فهرس unique لـ custom_domain (فقط إن لم توجد تكرارات).
- **028**: `processed_stripe_events` (نفس التعريف)، CHECK على `subscriptions.status`، unique `subscriptions.user_id` (إن أمكن)، `reseller_add_earning(p_user, p_amount, p_referred)` (توقيع وحيد؛ يحذف overload قديم إن وُجد)، `reseller_record_payout(...)`، فهارس idempotency، bucket `brand-assets`.
- **029**: unique لـ inbound `(instance_id, wa_message_id)` و `wix_user_links(wix_instance_id)` — **فقط** إن لم توجد تكرارات؛ وإلا يطبع NOTICE مع استعلام المراجعة. راجع الـ NOTICEs بعد التشغيل.
- **030**: يعيد تطبيق حلقات القفل من 026 على الكائنات التي أنشأتها 027–029 (EXECUTE لـ PUBLIC على الدوال افتراضي عام في Postgres ولا يُسحب على مستوى schema).

بعد التشغيل: تحقق من الـ NOTICEs (تكرارات custom_domain / subscriptions / inbound / Wix).

---

## ٤. ملاحظات Rollback

- **الكود**: الرجوع إلى نشر Netlify السابق (Deploys → Publish previous deploy) آمن؛ الـ migrations إضافية والكود القديم لا يتأثر بالأعمدة الجديدة.
- **استثناء مهم (026)**: بعد 026 يفشل أي وصول بمفتاح `anon` إلى جداول `public` (الكود يستخدم `service_role` فقط، لكن أي سكربت/لوحة خارجية تعتمد على anon ستتوقف). إن ظهر عطل من هذا النوع، أصلح المستهلك ليستخدم API الخادم؛ وكحل مؤقت فقط يمكن `GRANT SELECT` على جدول غير حساس محدد — **لا** تعطّل RLS ولا تمنح أي صلاحية على `users` / `whatsapp_instances` / `wa_sessions` / `system_settings` / `reseller_profiles`.
- **JWT_SECRET**: لا تغيّره أثناء الـ rollback (وإلا تسجيل خروج الجميع).
- **token_version**: الرجوع للكود القديم يتجاهل `tv` (الجلسات الملغاة تصبح صالحة مجدداً حتى انتهاء ٧ أيام) — مقبول مؤقتاً.
- **Railway**: الرجوع إلى deploy سابق ممكن؛ إن رجعت لنسخة تقبل `change-this-secret` لا تُرجع قيمة السر القديمة.
- **Stripe Connect**: إن رجعت، أوقف إرسال `invoice.*` و `customer.subscription.*` لـ endpoint الـ Connect أو تقبّل أنها ستُتجاهل.
- الـ migrations لا تحتاج rollback؛ لا تحذف الأعمدة/الجداول الجديدة.

---

## ٥. Smoke test بعد النشر

- [ ] **Login** بكلمة مرور (و OTP إن كان مفعلاً) — تحقق من وجود cookie `wabek_token` (HttpOnly; Secure; SameSite=Lax; Path=/; 7d).
- [ ] تسجيل جديد، magic link، OAuth (Google) — كلها تضع الـ cookie.
- [ ] تعليق مستخدم من لوحة الأدمن → جلسته تنتهي فوراً (401).
- [ ] **إرسال رسالة Meta Cloud API** من صندوق الوارد.
- [ ] **استقبال رسالة Meta** (webhook `/api/whatsapp/webhook` بتوقيع صحيح) تظهر في الوارد مرة واحدة.
- [ ] **QR instance (Baileys)**: استقبال رسالة + إرسال رد.
- [ ] **Campaign run** (Cloud API و WA Web) — الرسائل تحمل `campaign_id`، والإحصاءات تتحدث.
- [ ] Chatbot / automation / AI reply يرسل (ويُحجب لجهة opted-out).
- [ ] OTP عبر `/api/v1/otp` + `/api/v1/otp-verify` (٥ محاولات خاطئة → قفل).
- [ ] **Stripe test webhook** (منصة): `stripe trigger checkout.session.completed` و `invoice.payment_succeeded` → 200، وإعادة إرسال نفس الحدث → `duplicate`.
- [ ] **Stripe Connect**: حدث test من حساب متصل إلى `/api/reseller/stripe-connect/webhook` (checkout + invoice renewal + subscription.deleted). سجّل في Stripe الأحداث: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`.
- [ ] **Wix install** على متجر تجريبي (OAuth callback + webhook موقّع بـ `WIX_PUBLIC_KEY`).
- [ ] إضافة WHMCS/WordPress: `GET /api/whatsapp/instances` بـ `X-API-Key` يرجع الحقول الآمنة فقط.
- [ ] Cron: Netlify scheduled functions ترجع 200 (وليس 401/500) في سجلات Functions.
- [ ] Billing: عضو فريق لا يستطيع checkout/portal/gift (403)؛ مشترك حالي يحصل على 409 مع خيار Manage billing.

---

## ٦. التحقق من أن اتصالات واتساب لم تتأثر (WhatsApp connections unaffected)

لم يتغيّر: مسار webhook (`/api/whatsapp/webhook`, `/api/whatsapp/wa-web-events`)، `WHATSAPP_WEBHOOK_VERIFY_TOKEN`، بنية/دلالات `whatsapp_instances` و `wa_sessions`، أو تخزين جلسات Baileys.

- [ ] قبل النشر: سجّل عدد `whatsapp_instances` حسب `status` وعدد صفوف `wa_sessions`:
      `SELECT instance_type, status, count(*) FROM whatsapp_instances GROUP BY 1,2;`
      `SELECT count(*) FROM wa_sessions;`
- [ ] بعد النشر وإعادة تشغيل Railway: نفس الأرقام، وسجل Railway يطبع `[startup] Done. N session(s) loaded.` بنفس N.
- [ ] لا توجد instance انتقلت إلى `qr_pending`/`disconnected` بسبب النشر.
- [ ] Meta App Dashboard → Webhooks: آخر delivery ناجحة (200) بعد النشر. إن ظهر 401 لمستأجر بتطبيق Meta خاص → أضف سرّه في `META_APP_SECRETS`.
- [ ] `/api/whatsapp/wa-web-events` يرجع 200 لأحداث Baileys (وليس 401) — أي أن `WA_WEB_SERVER_SECRET` (Netlify) = `SERVER_SECRET` (Railway).
- [ ] رسالة واردة + صادرة على رقم Cloud API واحد ورقم QR واحد على الأقل لمستأجر حقيقي.
- [ ] `MESSAGE_LIMIT_MODE=log`: راقب سجلات `[send-guard] ... not blocking` لمعرفة من سيتأثر قبل تفعيل الحجب.

---

## ٧. ملاحظات إضافية

- **Stripe Connect earnings**: تُسجَّل الآن من `invoice.payment_succeeded` (مرة لكل invoice، `payment_ref = invoice.id`) بدلاً من `checkout.session.completed` (`payment_ref = session.id`). اشتراك تم شراؤه قبل النشر بدقائق قد يُسجَّل له ربح مرتين (session + أول invoice) — راجع `reseller_earnings` لليوم الأول.
- جلسات JWT قديمة بدون `tv` تُعامل كـ `tv=0` وتبقى صالحة (لا تسجيل خروج جماعي) طالما `JWT_SECRET` لم يتغيّر.
- رموز OTP لا تُخزَّن في جدول `messages` ولا تظهر في صندوق الوارد.
