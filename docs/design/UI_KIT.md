# WABEK UI kit — "C · Lagoon"

Reference mocks: `docs/design/C-Landing.dc.html`, `docs/design/C-Dashboard.dc.html`.
Components live in `components/ui/` and are exported from `@/components/ui`:

```tsx
import { Button, Card, CardHeader, StatCard, PageHeader, Table, THead, TBody, TR, TH, TD } from '@/components/ui'
```

Rules for page authors

- Arabic is the default language and the UI is RTL. All Arabic copy is Modern Standard Arabic (فصحى).
- Use logical utilities only: `ms-* me-* ps-* pe-* start-* end-* text-start text-end`. Never `ml-/mr-/pl-/pr-/left-/right-/text-left`.
  Directional icons (arrows, chevrons) need `ltr:rotate-180` or `rtl:-scale-x-100`.
- Use semantic colour classes (below) instead of hex values or Tailwind palette colours, so pages work in dark mode.
- Icons: `@heroicons/react` (24/outline for UI, 20/solid for small inline marks). No emoji anywhere in the UI.
- The only logo is `/brand/logo-mark.png` (use `<Logo/>`). Never use a Cloudinary URL or a drawn placeholder.
- Numbers: wrap with `tabular` for aligned digits; LTR data (phone numbers, emails, code, API keys) gets `dir="ltr"`.

---

## 1. Tokens

All colours are CSS variables holding RGB channels (`styles/globals.css`), mapped in `tailwind.config.js`, so alpha works: `bg-surface/80`, `text-ink/70`.
Dark mode = `<html class="dark">` (toggle in the top bar, stored in `localStorage.wabek_theme`; light by default).

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-canvas` (`bg-bg`) | `#F3F7F6` | `#031B1E` | page background |
| `bg-surface` | `#FFFFFF` | `#062A2E` | cards, inputs, menus |
| `bg-surface-2` | `#F7FAF9` | `#093237` | table header, subtle fills |
| `bg-surface-3` | `#EEF3F2` | `#0D3C41` | hover fills, neutral chips |
| `border-line` | `#DDE8E6` | ≈ `rgba(234,247,245,.1)` | card borders |
| `border-line-soft` | `#EEF3F2` | | row dividers |
| `border-line-strong` | `#C9DAD7` | | input borders, hover |
| `text-ink` | `#062326` | `#EAF7F5` | headings, primary text |
| `text-body` | `#3A5A5D` | `#C8E1DE` | long-form body copy |
| `text-muted` (`text-ink-muted`) | `#4A6668` (5.7:1) | `#B5D3D0` (9.6:1) | labels, secondary text |
| `text-link` / `hover:text-link-hover` | `#097A81` / `#06666C` | `#5FD6D0` / `#8BE07A` | links (AA on canvas) |
| `text-brand-ink` | `#0B8A92` | `#5FD6D0` | icons and large text only (3.8:1 on canvas) |
| `bg-chip text-chip-ink` | `#DDF3EF` / `#0B6E74` | | brand chips, icon tiles |
| `bg-brand-teal` / `bg-brand-green` | `#12B5BE` / `#8BE07A` | same | accents, chart series |
| `bg-brand-gradient` | `linear-gradient(135deg,#12B5BE,#8BE07A)` | same | primary CTA (text `#04282C`) |
| `bg-brand-gradient-x` | 90° version | | progress fills |
| `bg-deep-hero` (component class) | radial `#0E6C72` on `#04282C`, text `#EAF7F5` | same | sidebar, deep panels |
| `bg-deep-landing` (component class) | landing hero (two radial glows on `#04282C`) | | public hero |
| `text-deep-ink` / `text-deep-muted` | `#EAF7F5` / `#B5D3D0` | | text on deep |
| `bg-success-bg text-success` | `#E3F5EA` / `#166534` | | completed |
| `bg-warning-bg text-warning` | `#FFF4E5` / `#9A3412` | | scheduled, pending |
| `bg-violet-bg text-violet` | `#EEE8FD` / `#5B3DB5` | | automated, AI |
| `bg-danger-bg text-danger` | `#FDE8EB` / `#A3293B` | | errors |
| `bg-track` | `#E6EFEE` | | progress / donut track |

Radii: `rounded-card` 20px, `rounded-panel` 22px, `rounded-hero` 28px, `rounded-btn`/`rounded-field` 12px, pills `rounded-full`.
Shadows: `shadow-card`, `shadow-card-hover`, `shadow-dropdown`, `shadow-hero` (`0 30px 70px rgba(4,40,44,.18)`), `shadow-glow`, `shadow-ring` (focus ring).
Sizes: `w-sidebar` 266px, `h-topbar` 56px, `max-w-content` 1400px. Font: Readex Pro (`font-sans`), Fira Code (`font-mono`).
Focus: every focusable element gets a 2px brand-teal `:focus-visible` outline globally.

Helper classes: `.eyebrow`, `.section-title`, `.section-subtitle`, `.text-gradient`, `.tabular`, `.ltr-nums`, `.scrollbar-none`, `.skeleton`.
Legacy classes (`btn-primary`, `btn-secondary`, `btn-danger`, `card`, `stat-card`, `input`, `label`, `badge-*`, `table-*`, `modal-*`) are re-skinned on the tokens so older pages keep working; new code should use the components.

---

## 2. Layouts

### DashboardLayout

```tsx
import DashboardLayout from '@/components/layout/DashboardLayout'

<DashboardLayout title="Campaign Builder">…</DashboardLayout>
```

| Prop | Type | Notes |
|---|---|---|
| `title` | `string?` | Browser tab title on nested pages (e.g. `/dashboard/contacts/[id]`), where it is also appended to the breadcrumb. Top-level pages use the translated nav label. |
| `bleed` | `boolean?` | No max-width and `p-4 md:p-6` padding, for full-height tools. `/dashboard/chat` and `/dashboard/docs` are bleed automatically. |
| `hideSubnav` | `boolean?` | Hide the section tab bar. |

The layout provides: deep sidebar (8 sections), the section tab bar for the active section, the top bar (breadcrumb, ⌘K / Ctrl+K page search, language, theme, notifications, “+ حملة جديدة”), the plan-expiry banner, the account card (name, role, plan), the mobile drawer (< 1024px), and plan gating: if the current page's feature is off in the plan, `UpgradeWall` replaces the page.
Pages render their own heading with `PageHeader`.

Section → pages (`components/layout/nav.ts`):

| Section | Pages |
|---|---|
| الرئيسية | `/dashboard` |
| المحادثات | `/dashboard/chat` (badge: unread) |
| جهات الاتصال | `/dashboard/contacts` (+ `[id]`), `/dashboard/segments` |
| الحملات | `/dashboard/campaigns` (+ `[id]`), `/dashboard/otp` |
| الأتمتة والذكاء الاصطناعي | `/dashboard/chatbot`*, `/dashboard/automation`*, `/dashboard/ai`, `/dashboard/quick-replies` |
| التقارير | `/dashboard/analytics`* |
| التكاملات | `/dashboard/instances` (أرقام واتساب), `/dashboard/integrations`*, `/dashboard/wix`, `/dashboard/whmcs`, `/dashboard/api-keys`*, `/dashboard/links` |
| الإعدادات | `/dashboard/settings`, `/dashboard/team`, `/dashboard/sub-accounts`*, `/dashboard/billing` (hidden for Wix), `/dashboard/white-label`*, `/dashboard/reseller`*, `/dashboard/notifications`, `/dashboard/support`, التوثيق → `/docs` (legacy `/dashboard/docs` belongs here) |

`*` = plan feature (`allow_chatbot`, `allow_automation`, `allow_analytics`, `allow_api_access`, `allow_sub_accounts`, `allow_white_label`, `allow_reseller`). Locked items stay visible with a lock icon.

To add a page: add an item to the section in `nav.ts` with an i18n `labelKey` (add the key to all four languages in `lib/i18n.ts`).

### AdminLayout

```tsx
import AdminLayout from '@/components/layout/AdminLayout'
<AdminLayout title="Users">…</AdminLayout>
```

Same frame with an “Admin” tag, `useAdminAuth()` guard and a "back to app" link. Sections: نظرة عامة (`/admin`, `/admin/analytics`), المستخدمون, الباقات, الموزّعون (`/admin/resellers`, `/admin/payouts`), الدعم, قوالب واتساب, الإعدادات (`/admin/settings`, `/admin/whatsapp`), الذكاء الاصطناعي (`/admin/ai-settings`), SEO, السجلات, حالة الخدمة (`/admin/service-status`), الإضافات (`/admin/addons`: إضافتا WordPress وWHMCS).

### PublicNav / PublicFooter

```tsx
// Light pages
<PublicNav active="/pricing" onLangChange={setLang} />
<PublicFooter lang={lang} onLangChange={setLang} />

// Landing hero: put the nav inside the deep hero wrapper
<div className="bg-deep-landing">
  <PublicNav variant="deep" active="/" onLangChange={setLang} />
  <section>…hero…</section>
</div>
```

`variant`: `'light'` (default) | `'deep'` (transparent over the hero, solid deep after scrolling). The nav shows “لوحة التحكم” instead of sign in / start free when a user is signed in. Footer `variant`: `'light'` | `'deep'`.

---

## 3. Components

### Button

```tsx
<Button icon={PlusIcon}>حملة جديدة</Button>                     // primary gradient
<Button variant="dark" href="/dashboard/campaigns">+ حملة جديدة</Button>
<Button variant="secondary" onClick={importContacts}>استيراد جهات اتصال</Button>
<Button variant="ghost" size="sm" iconEnd={ArrowLeftIcon}>التفاصيل</Button>
<Button variant="danger" loading={deleting}>حذف</Button>
<Button size="icon" variant="ghost" icon={XMarkIcon} aria-label="إغلاق" />
```

| Prop | Values |
|---|---|
| `variant` | `primary` (= `gradient`), `dark`, `secondary` (= `outline`), `ghost`, `danger`, `danger-soft`, `on-deep`, `on-deep-ghost` |
| `size` | `xs` 28px, `sm` 36px, `md` 44px (default), `lg` 48px, `xl` 56px, `icon` 40px, `icon-sm` 32px |
| `loading` | spinner + disabled + `aria-busy` |
| `icon` / `iconEnd` | Heroicon components (start / end side) |
| `href` | renders a Next `Link` (`external` or `https://` → new tab) |
| `fullWidth` | `w-full` |

`buttonClasses({ variant, size })` returns the class string for custom elements.

### Card, CardHeader, CardBody, CardFooter

```tsx
<Card padding="none">
  <CardHeader title="آخر الحملات" action={<Link href="/dashboard/campaigns">جميع الحملات</Link>} />
  <Table>…</Table>
</Card>

<Card variant="gradient">جهّز حسابك · 3 من 4</Card>
<Card variant="deep" padding="lg">…</Card>
```

`Card`: `padding` `none|sm|md|lg` (default `md`), `variant` `default|muted|outline|deep|gradient`, `interactive` (hover shadow), `as`.
`CardHeader`: `title`, `subtitle`, `icon`, `action`, `as` (`h2` default), `divider`.

### StatCard

```tsx
<div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
  <StatCard label="محادثات مفتوحة" value="128" sub="32 بانتظار الرد" subTone="warning" icon={InboxIcon} />
  <StatCard label="رسائل الشهر" value="48,210" sub="من 100,000 في باقتك" progress={48210} progressMax={100000} icon={PaperAirplaneIcon} />
  <StatCard label="نسبة القراءة" value="84%" trend={3} trendLabel="عن الشهر الماضي" sparkline={[60, 64, 70, 68, 75, 84]} icon={EyeIcon} />
</div>
```

Props: `label`, `value`, `sub`, `subTone` (`muted|success|warning|danger|brand`), `icon`, `trend` (percent; `trendInverse` flips colours), `trendLabel`, `sparkline: number[]`, `sparklineColor`, `progress`, `progressMax`, `href`, `loading`.

### Badge, StatusPill

```tsx
<Badge tone="violet">أوتوماتيك</Badge>
<Badge tone="brand" dot pulse>قيد الإرسال · 74%</Badge>
<StatusPill status={campaign.status}>{labelFor(campaign.status)}</StatusPill>
```

`tone`: `neutral|brand|info|success|warning|violet|danger`; `size` `sm|md`; `dot`, `pulse`, `icon`.
`statusTone(status)` maps backend values (sending/running → brand, completed/sent → success, scheduled/pending → warning, automated → violet, failed/error → danger).

### Field + form controls

```tsx
<Field label="اسم الحملة" hint="يظهر لفريقك فقط" error={errors.name?.message} required>
  <Input {...register('name')} placeholder="تخفيضات الشتاء" />
</Field>

<Field label="رقم الهاتف"><Input icon={PhoneIcon} dir="ltr" startAdornment="+20" /></Field>
<Field label="الرسالة"><Textarea rows={5} maxLength={1024} showCount value={v} onChange={…} /></Field>
<Field label="اللغة"><Select options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} /></Field>
<Checkbox label="أوافق على الشروط" description="…" checked={ok} onChange={e => setOk(e.target.checked)} />
<Switch checked={enabled} onChange={setEnabled} label="تفعيل الرد الآلي" description="يرد المساعد خارج ساعات العمل" />
```

`Field`: `label`, `hint`, `error`, `required`, `id`, `labelAction`, `srOnlyLabel`. It generates the control id and wires `aria-describedby` / `aria-invalid` / `required` into `Input`, `Textarea`, `Select` and `SearchInput` automatically.
`Input`: `size` `sm|md|lg`, `invalid`, `icon`, `startAdornment`, `endAdornment`, `wrapperClassName` (+ all input props; forwards ref for react-hook-form).
`Textarea`: `invalid`, `showCount`. `Select` (native): `options`, `placeholder`, `size`, `invalid`.
`Checkbox`: `label`, `description` (+ input props). `Switch`: `checked`, `onChange(bool)`, `label`, `description`, `size` `sm|md`, `disabled`, `aria-label`.

### SearchInput

```tsx
<SearchInput value={q} onChange={setQ} placeholder="ابحث بالاسم أو الرقم" size="sm" />
```

Props: `value`, `onChange(value)`, `onClear`, `shortcut` (e.g. `"⌘K"`), `size` `sm|md`. Esc clears.

### Tabs, TabPanel

```tsx
const [tab, setTab] = useState('all')
<Tabs idPrefix="camp" value={tab} onChange={setTab}
  tabs={[{ id: 'all', label: 'الكل', count: 24 }, { id: 'scheduled', label: 'مجدولة' }, { id: 'done', label: 'مكتملة' }]} />
<TabPanel idPrefix="camp" id="all" active={tab}>…</TabPanel>

<Tabs variant="segmented" size="sm" value={range} onChange={setRange}
  tabs={[{ id: '7d', label: '7 أيام' }, { id: '30d', label: '30 يومًا' }]} />
```

`variant`: `underline` (default) | `pills` | `segmented`; `size` `sm|md`; items: `id`, `label`, `icon`, `count`, `href` (link tabs), `disabled`, `locked`. Arrow keys follow the reading direction.

### Table primitives, DataTable

```tsx
<Card padding="none">
  <CardHeader title="آخر الحملات" />
  <Table minWidth={600} caption="آخر الحملات">
    <THead><TR><TH>الحملة</TH><TH>الحالة</TH><TH align="end">أُرسلت</TH><TH>القراءة</TH></TR></THead>
    <TBody>
      <TR interactive onClick={…}>
        <TD sub="اليوم">تخفيضات الشتاء</TD>
        <TD><StatusPill status="sending">قيد الإرسال</StatusPill></TD>
        <TD align="end" className="tabular">8,240</TD>
        <TD><ProgressBar value={84} showValue className="w-32" aria-label="نسبة القراءة" /></TD>
      </TR>
    </TBody>
  </Table>
</Card>

<DataTable
  rows={data?.contacts} loading={isLoading} rowKey={c => c.id}
  columns={[
    { key: 'name', header: 'الاسم', cell: c => <div className="flex items-center gap-2.5"><Avatar name={c.name} size="sm" />{c.name}</div> },
    { key: 'phone', header: 'الرقم', cell: c => <span dir="ltr">{c.phone}</span>, hideBelow: 'sm' },
  ]}
  empty={<EmptyState size="sm" icon={UserGroupIcon} title="لا توجد جهات اتصال" />}
  onRowClick={c => router.push(`/dashboard/contacts/${c.id}`)}
/>
```

`Table`: `minWidth` (horizontal scroll below it), `caption` (sr-only), `dense`, `wrapperClassName`. `TH`/`TD`: `align` `start|center|end`; `TD sub` adds a muted second line. `TR`: `interactive`, `selected`.

### EmptyState

```tsx
<EmptyState icon={MegaphoneIcon} title="لا توجد حملات بعد" description="أنشئ حملتك الأولى…"
  action={<Button icon={PlusIcon} href="/dashboard/campaigns">حملة جديدة</Button>} variant="card" />
```

Props: `icon`, `title`, `description`, `action`, `variant` `plain|card`, `size` `sm|md`.

### Modal, ConfirmDialog

```tsx
<Modal open={open} onClose={() => setOpen(false)} title="حملة جديدة" description="…" icon={MegaphoneIcon} size="lg"
  footer={<><Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button loading={saving}>إنشاء</Button></>}>
  …
</Modal>

<ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove}
  title="حذف جهة الاتصال؟" description="لا يمكن التراجع عن هذا الإجراء." confirmLabel="حذف" loading={deleting} />
```

`Modal`: `open`, `onClose`, `title`, `description`, `icon`, `size` `sm|md|lg|xl|full`, `footer`, `hideClose`, `initialFocus`, `sheetOnMobile` (default true: bottom sheet on phones). Focus trap, Esc and scroll lock come from headlessui.

### Dropdown

```tsx
<Dropdown label="خيارات" triggerClassName="h-9 w-9 justify-center hover:bg-surface-3"
  trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
  items={[
    { label: 'تعديل', icon: PencilSquareIcon, onClick: edit },
    { label: 'تكرار', icon: DocumentDuplicateIcon, onClick: duplicate },
    { label: 'حذف', icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(row) },
  ]} />
```

Props: `trigger`, `label` (aria), `items` (`label`, `icon`, `onClick`, `href`, `hint`, `danger`, `disabled`, `divider`, `selected`), `header`, `children`, `align` `start|end`, `placement` `bottom|top`, `width`.

### Tooltip

```tsx
<Tooltip content="نسخ المفتاح"><Button size="icon" variant="ghost" icon={ClipboardIcon} aria-label="نسخ" /></Tooltip>
```

Props: `content`, `children` (one focusable element), `side` `top|bottom|start|end`, `disabled`. Shows on hover and focus, Esc hides.

### Avatar, AvatarGroup

```tsx
<Avatar name="سارة محمود" />                       // "س" on a stable pastel colour
<Avatar name={m.name} src={m.avatar_url} size="sm" status="online" />
<AvatarGroup people={team} max={4} />
```

`size` `xs|sm|md|lg|xl`, `color`, `status` `online|away|offline`, `square`. Helpers: `initials(name)`, `avatarColor(seed)`.

### Skeleton

```tsx
<Skeleton className="h-9 w-28" />   <Skeleton lines={3} />   <Skeleton circle className="h-10 w-10" />
```

### ProgressBar

```tsx
<ProgressBar value={84} showValue aria-label="نسبة القراءة" />
<ProgressBar label="رسائل الشهر" value={48210} max={100000} valueText="48,210 / 100,000" size="md" />
<ProgressBar tone="on-gradient" value={75} size="md" aria-label="إعداد الحساب" />   // inside a gradient card
```

Props: `value`, `max`, `size` `xs|sm|md|lg`, `tone` `gradient|dark|brand|success|warning|danger|on-gradient`, `label`, `showValue`, `valueText`.

### Donut

```tsx
<Donut legend size={120} centerLabel="64%" centerSub="آلي"
  segments={[{ label: 'المساعد الذكي', value: 64, color: '#12B5BE' }, { label: 'الفريق', value: 36, color: '#8BE07A' }]} />
```

Props: `segments` (`label`, `value`, `color?`), `size`, `thickness`, `centerLabel`, `centerSub`, `legend` (`true|'side'|'bottom'`), `formatValue`, `ariaLabel` (generated by default).

### AreaChart, Sparkline

```tsx
<AreaChart height={220} labels={days}
  series={[{ name: 'أُرسلت', data: sent }, { name: 'قُرئت', data: read, color: '#8BE07A' }]} />
<Sparkline data={[4, 6, 5, 9, 12]} height={34} />
```

`AreaChart`: `series` (`name`, `data`, `color?`, `fill?` — first series filled by default), `labels`, `height`, `gridLines`, `showYAxis`, `showLegend`, `interactive` (crosshair + tooltip, arrow keys), `smooth`, `formatValue`, `ariaLabel`. Plain SVG, no dependency; time runs left→right in every language; a hidden data table is rendered for screen readers.
`Sparkline`: `data`, `color`, `fill`, `height`, `width`, `strokeWidth`, `smooth`, `ariaLabel`.
Chart palette: `CHART_COLORS` (`#12B5BE`, `#8BE07A`, `#F5C26B`, `#B59CF5`, `#5FD6D0`, `#F28B9B`).

### PageHeader

```tsx
<PageHeader eyebrow="نظرة عامة" title="الرئيسية"
  description="…"
  back={{ href: '/dashboard/campaigns', label: 'الحملات' }}
  actions={<><Button variant="secondary" href="/dashboard/contacts">استيراد جهات اتصال</Button><Button variant="dark" icon={PlusIcon}>حملة جديدة</Button></>}>
  <Tabs … />
</PageHeader>
```

### Toasts

`AppToaster` is mounted in `_app.tsx`; call `toast.success('تم حفظ الإعدادات')` / `toast.error(…)` from `react-hot-toast` as usual. Styling comes from tokens (`toastOptions`).

### Logo

```tsx
<Logo href="/" />                                     // mark + "WABEK"
<Logo tone="light" size={42} />                       // on deep backgrounds
<Logo size={110} wordmark={false} hiRes glow />       // landing hero mark
const { customLogo, brandName } = useWhiteLabel()
<Logo src={customLogo} name={brandName} />            // white-label tenants
```

Props: `size`, `wordmark`, `tone` `light|dark|auto`, `src`, `name`, `imageOnly`, `href`, `hiRes`, `glow`, `decorative`.
`useWhiteLabel()` returns `customLogo` (tenant override or `null`) and `brandLogo` (override or `/brand/logo-mark.png`); the legacy Cloudinary logo URL stored in old settings is treated as "no override". `BRAND_ASSETS` holds all `/brand` paths.

---

## 4. Hooks

- `useTranslation()` → `{ t, lang, isRTL, dir }`. Language = profile language, then device choice (`localStorage.wabek_lang`), then Arabic. Shell strings use the `nav_*`, `sub_*`, `shell_*`, `admin_*`, `pub_*`, `ui_*`, `upgrade_*` keys in `lib/i18n.ts`.
- `useTheme()` → `{ theme, isDark, toggle, setTheme }`.
- `usePlanFeature(feature)` → `{ allowed, features, plan }` (the layout already gates pages listed in `nav.ts`).
