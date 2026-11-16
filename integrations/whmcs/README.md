# WABEK WhatsApp for WHMCS — v4.0.0

<div dir="rtl" lang="ar">

## العربية

وحدة إضافية (Addon) لنظام WHMCS ترسل إشعارات واتساب لعملائك وتنبيهات لفريق الإدارة عبر منصة [WABEK](https://waabek.com).

### المزايا

- **إشعارات العملاء:** الترحيب بالعميل الجديد، إصدار الفاتورة، تذكير WHMCS بالدفع، استلام الدفعة، إلغاء الفاتورة، تذكيرات قبل الاستحقاق وفي يومه وبعده، قبول الطلب، تفعيل الخدمة وتعليقها وإلغاء تعليقها وإنهاؤها، فتح التذاكر والرد عليها وتغيير حالتها، تذكير تجديد النطاقات، وتنبيه تغيير كلمة المرور.
- **تنبيهات الإدارة:** طلب جديد، تذكرة جديدة، دفعة جديدة — إلى أرقام الإدارة التي تحددها.
- **نصوص قابلة للتحرير** بالعربية والإنجليزية لكل حدث، مع حقول دمج مثل `{client_name}` و`{invoice_total}` و`{invoice_url}`، واسم قالب معتمد اختياري يُستخدم خارج نافذة واتساب البالغة 24 ساعة.
- **قائمة انتظار** تعالجها مهام WHMCS المجدولة، مع إعادة المحاولة بمهلة متزايدة عند أخطاء الخادم وانتهاء المهلة فقط، وإرسال فوري اختياري للرسائل الضرورية.
- **سجل إرسال** مع التصفية وإعادة الإرسال والإلغاء، و**أداة إرسال يدوي**، و**رسائل جماعية** حسب المنتج وحالة الخدمة وحالة العميل بمعدل محدود.
- **الموافقة وإلغاء الاشتراك:** صفحة في منطقة العملاء (الحساب ← إشعارات واتساب)، مع نمطَي «الإرسال ما لم يُلغَ الاشتراك» و«الإرسال بعد الموافقة»، وحقل مخصص اختياري.
- **رمز تحقق عبر واتساب (اختياري):** توثيق رقم العميل، أو طلب رمز بعد كل تسجيل دخول، مع حدود محلية لعدد الطلبات.
- **الأمان:** مفتاح API مشفّر بـ `encrypt()` ومُقنّع في الواجهة ومحذوف من السجلات، ويُرسَل في الترويسة `X-API-Key` فقط؛ رمز CSRF لكل طلب POST؛ ترميز جميع المخرجات؛ HTTPS مع التحقق من الشهادة ومهلة زمنية.

### المتطلبات

- WHMCS 8.x، وPHP من 7.4 إلى 8.3 مع امتدادات `curl` و`json` و`mbstring`.
- مهام WHMCS المجدولة (cron) تعمل كل 5 دقائق.
- حساب WABEK مع رقم واتساب متصل ومفتاح API (لوحة التحكم ← مفاتيح API).

### التثبيت

1. فك ضغط الملف `wabek-whmcs-addon.zip`.
2. ارفع مجلد `modules` إلى المجلد الجذري لـ WHMCS، ليصبح المسار `modules/addons/wabek/wabek.php`.
3. من لوحة الإدارة: **System Settings ← Addon Modules**، فعّل **WABEK WhatsApp**، ثم اضغط **Configure** وحدد مجموعات المشرفين المسموح لها بالوصول.
4. افتح **Addons ← WABEK WhatsApp ← الإعدادات**، والصق مفتاح API، ثم اضغط **اختبار الاتصال** وأرسل رسالة تجريبية.
5. راجع تبويب **الإشعارات** لتفعيل الأحداث وتعديل النصوص.

### الترقية

- **من 4.x:** ارفع الملفات الجديدة فوق القديمة، ثم افتح صفحة الوحدة في لوحة الإدارة؛ سيُشغّل WHMCS الترقية تلقائيًا.
- **من الإصدار القديم 3.x:**
  1. احذف المجلد القديم `modules/addons/wabek/` بالكامل (لا يُحذف شيء من قاعدة البيانات).
  2. **احذف الملف** `includes/hooks/wabek_notifications.php` إن وُجد، وإلا فقد تصل رسائل مكررة.
  3. ارفع المجلد الجديد وافتح صفحة الوحدة. ستُنقل تلقائيًا إعدادات الاتصال (ويُشفَّر مفتاح API ويُحذف النص الصريح من `tbladdonmodules`) وقائمة إلغاء الاشتراك.
  4. جداول الإصدار 3.x لا تُستخدم ولا تُحذف؛ يمكنك حذف الجداول `mod_wabek_*` القديمة يدويًا بعد التأكد.

### ملاحظات

- خارج نافذة الـ 24 ساعة لا يُسلّم واتساب النص الحر؛ أدخل اسم قالب معتمد لكل حدث لاستخدامه بديلًا.
- إلغاء التفعيل يحتفظ بالبيانات افتراضيًا. فعّل خيار «Delete data on deactivate» في إعدادات الوحدة لحذف جداولها.

</div>

## English

A WHMCS addon module that sends WhatsApp notifications to your clients and alerts to your staff through the [WABEK](https://waabek.com) platform.

### Features

- **Client notifications:** welcome, invoice created, WHMCS payment reminder, payment received, invoice cancelled, reminders before / on / after the due date, order accepted, service activated / suspended / unsuspended / terminated, ticket opened / staff reply / status change, domain renewal reminders and a password-change alert.
- **Admin alerts:** new order, new ticket, payment received — to the phones you configure.
- **Editable English and Arabic texts** per event with merge fields (`{client_name}`, `{invoice_total}`, `{invoice_url}`, `{service_name}`, `{ticket_url}`, `{system_name}`, …) and an optional approved-template name per event for delivery outside the 24-hour WhatsApp window.
- **Queue** processed by the WHMCS cron with exponential backoff on 5xx, 429 and timeouts (never on other 4xx), plus an immediate-send option for critical messages that falls back to the queue.
- **Send log** with filters, resend and cancel; a **manual send** tool; **bulk messages** filtered by product, service status and client status, rate-limited per cron run.
- **Consent / opt-out:** client area page (Account → WhatsApp notifications), opt-out or opt-in mode, optional tickbox custom field; critical events are configurable per event.
- **Optional WhatsApp OTP:** phone verification page, or a WhatsApp code after every client login, with local rate limits.
- **Security:** API key encrypted with WHMCS `encrypt()`, masked in the UI, redacted from the module log and sent only in the `X-API-Key` header; CSRF token on every POST; all state changes POST-only; output escaped; HTTPS with certificate verification and timeouts; no raw SQL.

### Requirements

- WHMCS 8.x, PHP 7.4 – 8.3 with `curl`, `json`, `mbstring`.
- The WHMCS cron running every 5 minutes.
- A WABEK account with a connected WhatsApp number and an API key (Dashboard → API Keys).

### Install

1. Unzip `wabek-whmcs-addon.zip`.
2. Upload the `modules` folder into your WHMCS root so that `modules/addons/wabek/wabek.php` exists.
3. Admin area → **System Settings → Addon Modules** → activate **WABEK WhatsApp** → **Configure** → grant access to the admin role groups that should use it.
4. Open **Addons → WABEK WhatsApp → Settings**, paste the API key, click **Test connection** and send a test message.
5. Review the **Notifications** tab: enable events and adjust the texts.

### Upgrade

- **From 4.x:** upload the new files over the old ones and open the module page; WHMCS runs the upgrade.
- **From the legacy 3.x addon:**
  1. Delete the old `modules/addons/wabek/` folder completely (the database is untouched).
  2. **Delete `includes/hooks/wabek_notifications.php`** if it exists — otherwise clients may get duplicate messages.
  3. Upload the new folder and open the module page. The connection settings (API key re-encrypted, plaintext copy removed from `tbladdonmodules`) and the opt-out list are imported.
  4. The 3.x tables are no longer used and are not dropped; remove the old `mod_wabek_*` tables manually once you are satisfied.

### Tables

`mod_wabek_config`, `mod_wabek_events`, `mod_wabek_outbox` (queue + send log), `mod_wabek_consent`, `mod_wabek_otp_requests`, `mod_wabek_bulk`.

### WABEK API used

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/send` | `{to, message, type: "notification", instance_id?, template?, template_language?, template_params?, customer_name?}` with `Idempotency-Key: whmcs-<install>-<outbox id>` |
| POST | `/api/v1/otp` | `{phone, purpose, instance_id?, brand_name}` → `{success, otpId}` or `{success:false, error, code}` |
| POST | `/api/v1/otp-verify` | `{otp_id, otp}` → `{valid, reason?}` |
| POST | `/api/v1/contacts-opt-out` | `{phone, opted_out}` — every client opt-in/opt-out is mirrored to WABEK |
| GET | `/api/v1/message-status?id=` | delivery status (sent / delivered / read / failed) from the send log |
| GET | `/api/v1/instances` | connection test and default-instance picker (older platforms answer `404 Unknown action`, which still proves the key is valid) |

All requests carry `X-API-Key`. Every message is rendered by the addon; the platform never needs to query your WHMCS. Template parameters are named (`name={field}` per line) or positional (one value per line for `{{1}}`, `{{2}}`, …). Retries of one queued message reuse its idempotency key, so a timeout can never cause a double send.

### Notes

- Outside the 24-hour window WhatsApp only delivers approved templates: set a template name per event to use as the fallback.
- Deactivating keeps the data by default. Tick **Delete data on deactivate** in the module configuration to drop the tables.
- The login OTP step guards client-area pages (`ClientAreaPage`); admin "login as client" sessions are not challenged.

### Build

```bash
integrations/whmcs/build.sh   # writes public/downloads/wabek-whmcs-addon.zip
```
