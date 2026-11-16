// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import clsx from 'clsx'
import {
  RocketLaunchIcon, CodeBracketIcon, MegaphoneIcon, CpuChipIcon, SparklesIcon, ChatBubbleLeftRightIcon, LockClosedIcon,
  LinkIcon, SwatchIcon, BuildingStorefrontIcon, UserGroupIcon, CreditCardIcon, DocumentTextIcon, WrenchScrewdriverIcon,
  BellIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'

/** Section icons (heroicons, not emoji). */
const SECTION_ICONS: Record<string, React.ElementType> = {
  'getting-started': RocketLaunchIcon, api: CodeBracketIcon, campaigns: MegaphoneIcon, chatbot: CpuChipIcon,
  ai: SparklesIcon, inbox: ChatBubbleLeftRightIcon, otp: LockClosedIcon, integrations: LinkIcon,
  'white-label': SwatchIcon, reseller: BuildingStorefrontIcon, team: UserGroupIcon, billing: CreditCardIcon,
  templates: DocumentTextIcon, troubleshooting: WrenchScrewdriverIcon, webhooks: BellIcon,
}
function SectionIcon({ id, className }: { id: string; className?: string }) {
  const Icon = SECTION_ICONS[id] || BookOpenIcon
  return <Icon className={className} aria-hidden="true" />
}

const sections = [
  {
    id: 'getting-started', title: 'Getting Started',
    items: [
      {
        title: 'Connect WhatsApp',
        content: `Choose one of two methods to connect your WhatsApp:

## WhatsApp Web (QR Code)
Go to **Dashboard → WhatsApp → Add Instance → WhatsApp Web:**
1. Click "Connect via QR"
2. Open WhatsApp on your phone
3. Tap Menu → Linked Devices → Link a Device
4. Scan the QR code
5. Wait for "Connected" status

**Best for:** Testing, small businesses, quick setup. Free to use.

## Meta Cloud API (Official)
Go to **Dashboard → WhatsApp → Add Instance → Cloud API:**

| Field | Where to find it |
|---|---|
| Phone Number ID | Meta Business Suite → WhatsApp → API Setup |
| Business Account ID | Meta Business Suite → Settings |
| Access Token | Meta Developer Console → System User → Permanent Token |

**Meta Webhook configuration:**
\`\`\`
Webhook URL:    https://waabek.com/api/whatsapp/webhook
Verify Token:   wabek-secret123
Events to subscribe: messages, message_deliveries, message_reads
\`\`\`

**Best for:** Production, high volume, official API compliance.

> **Note:** Cloud API requires approved WhatsApp message templates for messaging users outside the 24-hour customer service window.`,
      },
      {
        title: 'Send Your First Message',
        content: `After connecting your WhatsApp instance, send a test message:

\`\`\`bash
curl -X POST https://waabek.com/api/v1/send \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "201234567890",
    "message": "Hello from WABEK! 👋"
  }'
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "messageId": "wamid.HBgNMjAxMjM0...",
  "method": "text",
  "inWindow": true
}
\`\`\`

**Phone format:** Always use international format without \`+\` (e.g., \`201234567890\` for Egypt, \`447878704062\` for UK).`,
      },
      {
        title: 'API Authentication',
        content: `Every API request requires your API key in the header:

\`\`\`bash
X-API-Key: wk_live_xxxxxxxxxxxxxxxx
\`\`\`

**Get your API key:**
1. Go to **Dashboard → API Keys**
2. Click **Generate New Key**
3. Copy and store it securely — it won't be shown again

**Example with Authorization header:**
\`\`\`bash
curl -H "X-API-Key: YOUR_KEY" https://waabek.com/api/v1/send
\`\`\`

> **Security:** Never expose your API key in client-side code. Use environment variables on your server.`,
      },
    ],
  },
  {
    id: 'api', title: 'REST API',
    items: [
      {
        title: 'Send Message',
        content: `Send text, image, or template messages via the API.

## Send Text Message
\`\`\`bash
POST /api/v1/send
\`\`\`
\`\`\`json
{
  "to": "201234567890",
  "message": "Your message here",
  "instance_id": "optional-instance-id"
}
\`\`\`

## Send Image
\`\`\`json
{
  "to": "201234567890",
  "message": "Check this out!",
  "media_url": "https://example.com/image.jpg",
  "media_type": "image"
}
\`\`\`

## Send Template Message
\`\`\`json
{
  "to": "201234567890",
  "template": "marketing_offer",
  "template_language": "en",
  "template_params": {
    "customer_name": "Ahmed"
  }
}
\`\`\`

## Response
\`\`\`json
{
  "success": true,
  "messageId": "wamid.xxx",
  "method": "text | template",
  "inWindow": true
}
\`\`\``,
      },
      {
        title: 'Contacts API',
        content: `Manage your contacts programmatically.

## List Contacts
\`\`\`bash
GET /api/contacts?page=1&limit=50&search=Ahmed
\`\`\`

## Create Contact
\`\`\`bash
POST /api/contacts
\`\`\`
\`\`\`json
{
  "name": "Ahmed Mohamed",
  "phone": "201234567890",
  "email": "ahmed@example.com",
  "tags": ["customer", "vip"],
  "variables": {
    "company": "ACME Corp",
    "city": "Cairo"
  }
}
\`\`\`

## Import Contacts (CSV)
Upload a CSV file at **Dashboard → Contacts → Import**. Required column: \`phone\`. Optional: \`name\`, \`email\`, \`tags\`.

## Delete Contact
\`\`\`bash
DELETE /api/contacts/:id
\`\`\``,
      },
      {
        title: 'Webhooks — Receive Messages',
        content: `Configure a webhook to receive incoming WhatsApp messages in real time.

## Setup
Go to **Dashboard → Settings → Webhooks** and set your endpoint URL.

## Payload Structure
\`\`\`json
{
  "event": "message_received",
  "instance_id": "abc123",
  "from": "201234567890",
  "name": "Ahmed",
  "message": "Hello!",
  "type": "text",
  "timestamp": "2025-06-01T10:00:00Z",
  "message_id": "wamid.xxx"
}
\`\`\`

## Verify Webhook (PHP)
\`\`\`php
<?php
$payload = json_decode(file_get_contents('php://input'), true);
$secret  = 'YOUR_WEBHOOK_SECRET';
$sig     = $_SERVER['HTTP_X_WABEK_SIGNATURE'] ?? '';

if (!hash_equals($sig, hash_hmac('sha256', file_get_contents('php://input'), $secret))) {
  http_response_code(401);
  exit('Unauthorized');
}

$from    = $payload['from'];
$message = $payload['message'];
// Handle message...
\`\`\`

## Status Events
\`\`\`json
{
  "event": "message_status",
  "message_id": "wamid.xxx",
  "status": "sent | delivered | read | failed",
  "phone": "201234567890",
  "campaign_id": "optional"
}
\`\`\``,
      },
      {
        title: 'Messages API',
        content: `Retrieve message history and status.

## Get Messages
\`\`\`bash
GET /api/messages?contact_id=xxx&limit=50&direction=inbound
\`\`\`

## Message Status
| Status | Meaning |
|---|---|
| \`pending\` | Queued, not yet sent |
| \`sent\` | Accepted by Meta |
| \`delivered\` | Delivered to device |
| \`read\` | Opened by recipient |
| \`failed\` | Failed to deliver |

## Get Campaign Messages
\`\`\`bash
GET /api/campaigns/:id/messages
\`\`\`
Returns per-recipient delivery status for a campaign.`,
      },
    ],
  },
  {
    id: 'campaigns', title: 'Campaigns',
    items: [
      {
        title: 'Create & Send Campaign',
        content: `Bulk campaigns send personalized WhatsApp messages to multiple contacts.

## Steps
1. Go to **Dashboard → Campaigns → New Campaign**
2. Fill in:
   - **Name** — internal reference
   - **Instance** — which WhatsApp number to send from
   - **Contacts/Segment** — who to send to
   - **Message** — text (supports \`{{name}}\`, \`{{phone}}\` variables)
   - **Template** — required for Cloud API instances
   - **Delay** — seconds between each message (recommended: 3-5s)
3. Click **Start Campaign**

## Template Variables
Use \`{{name}}\` and \`{{phone}}\` in your message — they get replaced with each contact's details automatically.

## Cloud API Note
Cloud API campaigns **always** use approved WhatsApp templates. If no template is selected, \`marketing_offer\` is used automatically.

The \`marketing_offer\` template sends:
\`\`\`
Hi {{customer_name}}, we have a special offer for you! 🎉
\`\`\`

## Campaign Details
Click **Details** on any campaign to see:
- Per-recipient delivery status (sent / delivered / read / failed)
- Message IDs
- Error reasons for failed messages`,
      },
      {
        title: 'Campaign Scheduler',
        content: `Schedule campaigns to send at a specific time.

## Setup
When creating a campaign, set a **Scheduled Time** instead of sending immediately.

## Cron Configuration
Add to your server cron (runs every minute):
\`\`\`bash
* * * * * curl -s -X POST https://waabek.com/api/campaigns/scheduler \\
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
\`\`\`

Or use Netlify Scheduled Functions (already configured).

## Campaign Statuses
| Status | Meaning |
|---|---|
| \`draft\` | Not started |
| \`scheduled\` | Waiting for scheduled time |
| \`running\` | Currently sending |
| \`completed\` | All messages sent |
| \`failed\` | Error during send |
| \`paused\` | Manually paused |`,
      },
    ],
  },
  {
    id: 'chatbot', title: 'Chatbot Builder',
    items: [
      {
        title: 'How the Chatbot Works',
        content: `The WABEK chatbot builder lets you create automated WhatsApp conversation flows without code.

## Concepts
- **Flow** — A set of connected nodes that form a conversation
- **Node** — A single step (send message, ask question, condition check)
- **Trigger** — What starts the flow (keyword, any message, etc.)

## Node Types
| Node | Description |
|---|---|
| **Send Message** | Send text, image, file, or buttons |
| **Ask Question** | Wait for user input and save the answer |
| **Condition** | Branch based on user input or contact field |
| **Set Variable** | Save a value to the contact record |
| **HTTP Request** | Call an external API |
| **Assign Agent** | Route to a team member |
| **End Flow** | Finish the conversation |

## Triggers
| Trigger | When it fires |
|---|---|
| Keyword | Message contains specific word |
| Any Message | Every incoming message |
| Specific Number | Only from a phone number |
| Button Click | User taps a button in a previous message |`,
      },
      {
        title: 'Build Your First Flow',
        content: `## Example: Welcome Flow

1. Go to **Dashboard → Chatbot → New Flow**
2. Set trigger: **Keyword = "hi" or "hello"**
3. Add **Send Message** node: *"Welcome to {{company_name}}! How can we help you?"*
4. Add **Button Message** with options: Sales | Support | Pricing
5. Add **Condition** node to branch based on button click
6. Connect each branch to the appropriate response

## Tips
- Set a **default flow** that catches unrecognized messages
- Use **Set Variable** to personalize future messages
- Connect flows together using **Jump to Flow** node
- Test your flow with the built-in simulator`,
      },
    ],
  },
  {
    id: 'ai', title: 'AI Auto-Reply',
    items: [
      {
        title: 'How AI Auto-Reply Works',
        content: `WABEK's AI assistant (powered by DeepSeek) automatically replies to incoming messages when no chatbot flow matches.

## Flow
1. Customer sends a message
2. WABEK checks if any chatbot flow matches → if yes, chatbot handles it
3. If no flow matches → AI Auto-Reply activates
4. AI checks if it's within business hours (configurable)
5. Outside hours → AI replies automatically
6. AI detects escalation keywords → routes to human agent

## 24-Hour Window & Templates
- **Inside 24h window** (customer messaged recently): AI can reply freely with text
- **Outside 24h window**: AI uses the \`ai_assistant_followup\` approved template

## Features
- Maintains conversation context (last 10 messages)
- Escalation detection (e.g., "talk to human", "agent", "support")
- Customizable system prompt per instance
- Configurable temperature, max tokens`,
      },
      {
        title: 'Enable AI for an Instance',
        content: `1. Go to **Dashboard → AI Auto-Reply**
2. Select your WhatsApp instance
3. Toggle **Enable AI**
4. Write your **System Prompt** — this defines how the AI behaves

## System Prompt Example
\`\`\`
You are a helpful customer support agent for ACME Store.
You help customers with orders, returns, and product questions.
Business hours: 9AM-6PM GMT+3.
Always be friendly, professional, and concise.
If you cannot answer, say "Let me connect you with our team."
\`\`\`

## Settings
| Setting | Recommendation |
|---|---|
| Temperature | 0.7 (balanced creativity) |
| Max tokens | 300 (keep replies concise) |
| Business hours | Set to avoid after-hours replies |

## Knowledge Base
Add FAQs and product info via the 🤖 button in the Support panel to give the AI accurate information to reference.`,
      },
      {
        title: 'Escalation & Human Takeover',
        content: `The AI automatically detects escalation intent and routes to a human agent.

## Built-in Escalation Keywords
- "talk to human", "speak to agent", "human please"
- "I need help", "this is urgent"
- "complaint", "manager"

## What Happens on Escalation
1. AI detects keyword
2. AI sends handoff message: *"Connecting you with our team..."*
3. Conversation appears in **Live Chat** inbox as unassigned
4. Agent gets notified and takes over

## Manual Takeover
In **Live Chat**, click **Take Over** on any conversation to pause AI and handle it yourself.`,
      },
    ],
  },
  {
    id: 'inbox', title: 'Live Chat',
    items: [
      {
        title: 'Shared Inbox',
        content: `The Live Chat inbox is a shared workspace for your team to manage WhatsApp conversations.

## Features
- All WhatsApp conversations in one view
- Assign conversations to team members
- Labels and tags for organization
- Internal notes (not sent to customer)
- Message delivery status (sent ✓, delivered ✓✓, read 🔵)
- Customer profile with contact history

## Keyboard Shortcuts
| Action | Shortcut |
|---|---|
| Send message | Enter |
| New line | Shift + Enter |
| Search conversations | Ctrl + K |

## Filters
Filter conversations by: **All / Unread / Assigned to me / Unassigned / Resolved**`,
      },
    ],
  },
  {
    id: 'otp', title: 'OTP System',
    items: [
      {
        title: 'Platform OTP Setup',
        content: `Use WABEK to send OTP (One-Time Password) verification codes via WhatsApp.

## Template
The OTP is sent using a **Meta-approved template** — not plain text. Plain text
messages only work within the 24-hour customer service window, so OTP codes must
always be sent via an approved template to reach users reliably. See the
**"Digits OTP Template Integration"** guide below for setup.

## API — Send OTP
\`\`\`bash
POST /api/otp/send
\`\`\`
\`\`\`json
{
  "phone": "201234567890",
  "code_length": 6
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "expires_in": 300
}
\`\`\`

## API — Verify OTP
\`\`\`bash
POST /api/otp/verify
\`\`\`
\`\`\`json
{
  "phone": "201234567890",
  "code": "123456"
}
\`\`\``,
      },
      {
        title: 'Digits OTP Template Integration',
        content: `By default, WABEK sends OTP codes using the **\`wabek_otp\`** Authentication
template (parameter: \`otp_code\`). If your Meta Business Account doesn't have this
template approved yet, you can configure any other approved Authentication template —
such as Meta's built-in **"digits"** template — via the **OTP Template Name** setting.

## Why "digits"?
WhatsApp **Authentication templates** (category: Authentication) are stricter than
Marketing/Utility templates — Meta requires a single \`{{1}}\` body variable containing
only the numeric code, plus an optional copy-code button. The \`digits\` template matches
this format exactly and is auto-approved by Meta for most Business Accounts.

## Built-in Presets
WABEK ships with **quick-select preset buttons** in Settings for the two most common
Authentication templates:

| Preset | Template Name | Parameter Style | When to use |
|---|---|---|---|
| **wabek_otp** (default) | \`wabek_otp\` | Named parameter \`otp_code\` | Use this if you've created a custom Authentication template named \`wabek_otp\` with a body parameter named \`otp_code\` |
| **digits** | \`digits\` | Positional \`{{1}}\` (and optional copy-code button) | Use this if your account has Meta's built-in \`digits\` Authentication template instead |

WABEK automatically tries multiple parameter formats (named \`otp_code\`, positional
body-only, body + URL button, body + copy-code button) and language codes (\`en\`,
\`en_US\`, \`en_GB\`) for whichever template name you select — so either preset works
without extra configuration in most cases.

## Configure the OTP Template
1. Go to **Admin → Settings → Security & OTP**
2. Click one of the **preset buttons** (\`wabek_otp\` or \`digits\`), or type a custom
   template name in the **OTP Template Name** field
3. Make sure the name matches exactly (case-sensitive) what's shown in **Meta Business
   Manager → WhatsApp Manager → Message Templates**, and that its status is **Approved**
4. Click **Save**
5. Use the **Send Test OTP** tool below to verify it works end-to-end

\`\`\`text
Settings → Security & OTP
+----------------------------------------+
| OTP Template Name   [ wabek_otp     ]   |
| Presets: [wabek_otp] [digits]           |
+----------------------------------------+
\`\`\`

## How It's Sent
When OTP is requested, WABEK calls Meta's template API with the code as the first
body parameter:

\`\`\`json
{
  "messaging_product": "whatsapp",
  "to": "201234567890",
  "type": "template",
  "template": {
    "name": "digits",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      }
    ]
  }
}
\`\`\`

## Creating Your Own "digits" Template
If \`digits\` doesn't exist on your WhatsApp Business Account yet:

1. Go to **Meta Business Manager → WhatsApp Manager → Message Templates → Create Template**
2. **Category:** Authentication
3. **Name:** \`digits\`
4. **Language:** English (or your preferred language)
5. Meta auto-generates the body: *"{{1}} is your verification code."*
6. (Optional) Enable **"Add security recommendation"** and **"Code expiration"**
7. Submit — Authentication templates are usually approved within minutes

## Troubleshooting
- **Wrong message received** (e.g. a broadcast/notification template instead of the
  OTP code): This means **OTP Template Name** is empty or set to a name that doesn't
  exist on your account. WABEK falls back to the smart-send system, which may pick a
  different approved template. Set the exact name (\`digits\`) in Settings to fix this.
- **"Template not found" error:** Double-check the template name matches *exactly*
  (case-sensitive) what's shown in Meta Business Manager, and that its status is
  **Approved** (not Pending or Rejected).
- **Wrong language sent:** If your template was approved in a language other than
  English, the language code WABEK sends must match (default \`en\`). Contact support
  if you need a non-English OTP template configured.`,
      },
      {
        title: 'WordPress OTP Integration',
        content: `Add WhatsApp OTP login to your WordPress site using the WABEK WordPress plugin.

## Installation
1. Download from **Dashboard → Integrations → WordPress Plugin**
2. Upload to WordPress: **Plugins → Add New → Upload Plugin**
3. Activate the plugin
4. Go to **Settings → WABEK** and enter:
   - Your **API Key**
   - Your **Instance ID**

## Features
- WhatsApp OTP on login page
- WooCommerce checkout verification
- Custom registration forms
- Compatible with Digits WhatsApp Gateway

## Shortcode
\`\`\`
[wabek_otp_login]
\`\`\``,
      },
    ],
  },
  {
    id: 'integrations', title: 'Integrations',
    items: [
      {
        title: 'WordPress Plugin',
        content: `The official WABEK WordPress plugin adds WhatsApp automation to any WordPress site.

## Download
Go to **Dashboard → Integrations → WordPress** to download the latest plugin version.

## Features
- Send WhatsApp notifications on WooCommerce order events
- OTP/2FA via WhatsApp on login & checkout
- Custom webhook triggers from WordPress forms
- Contact sync from WooCommerce customers
- Shortcodes for WhatsApp buttons and chat widgets

## WooCommerce Notifications
The plugin sends WhatsApp messages on:
| Event | Template Used |
|---|---|
| New order | \`service_notification\` |
| Order shipped | \`service_notification\` |
| Payment received | \`invoice_created\` |
| Payment reminder | \`payment_reminder\` |
| Invoice overdue | \`invoice_overdue\` |

## Configuration
After installing, go to **WooCommerce → Settings → WABEK** to configure event triggers.`,
      },
      {
        title: 'Wix Integration',
        content: `Connect WABEK to your Wix store in minutes — no manual webhook setup required.

## Setup (via Wix App Market)
1. Go to the Wix App Market and search for **WABEK WhatsApp** (or use the Install button in **Dashboard → Wix**)
2. Select your Wix site and approve the permissions
3. WABEK is automatically installed and connected to your store
4. Log in to **waabek.com** using the **WABEK app panel** inside your Wix Dashboard
5. Your store will appear under **Dashboard → Wix → Connected Stores**

## Automatic Webhooks
Once installed, Wix automatically sends order events to WABEK — no copying webhook URLs or manual configuration needed. The connection is handled entirely via the Wix App platform.

## Supported Events
- ✅ New order placed
- ✅ Order fulfilled / shipped (with tracking link when available)
- ✅ Order updated / cancelled
- ✅ Plan purchased / upgraded / cancelled (billing)

## Notification Templates
Customize the WhatsApp message sent for each event under **Dashboard → Wix → Notification Templates**.
You can use variables like {{customer_name}}, {{order_id}}, {{total}}, {{tracking_url}}.

## Managing Your Plan
Upgrade or change your plan directly from within Wix — go to **Wix Dashboard → WABEK App → Billing**.
All billing is processed by Wix. No external payment pages needed.

## Connected Stores
View all your connected Wix stores under **Dashboard → Wix → Connected Stores**.
Each new Wix site you install WABEK on appears here automatically.`,
      },
      {
        title: 'WHMCS Integration',
        content: `Automate WhatsApp notifications for your hosting/billing business using WHMCS.

## Setup
1. Go to **Dashboard → WHMCS**
2. Download the WHMCS module
3. Upload to \`/modules/addons/wabek/\` on your WHMCS server
4. Activate in **WHMCS → Setup → Addon Modules**
5. Enter your **WABEK API Key** and **Instance ID**

## Automated Notifications
| Event | Template |
|---|---|
| Invoice created | \`invoice_created\` |
| Invoice overdue | \`invoice_overdue\` |
| Payment received | \`service_notification\` |
| Payment reminder | \`payment_reminder\` |
| Service suspended | \`service_notification\` |
| Ticket reply | \`support_ticket_update\` |

## API — Send Custom WHMCS Notification
\`\`\`bash
POST /api/whmcs/send
\`\`\`
\`\`\`json
{
  "api_key": "YOUR_KEY",
  "to": "201234567890",
  "event": "invoice_created",
  "customer_name": "Ahmed",
  "invoice_id": "INV-001",
  "amount": "$99.00",
  "due_date": "2025-07-01"
}
\`\`\``,
      },
      {
        title: 'Zapier & Make (Integromat)',
        content: `Connect WABEK to 5,000+ apps using Zapier or Make.

## Zapier Setup
1. Search for **WABEK** in Zapier (or use Webhooks by Zapier)
2. Action: **POST** to \`https://waabek.com/api/v1/send\`
3. Headers: \`X-API-Key: YOUR_KEY\`

**Example Zap:**
*Google Sheets new row → Send WhatsApp message*

## Make (Integromat) Setup
1. Add **HTTP → Make a Request** module
2. URL: \`https://waabek.com/api/v1/send\`
3. Method: POST
4. Headers: \`X-API-Key: YOUR_KEY\`
5. Body:
\`\`\`json
{
  "to": "{{phone}}",
  "message": "Hello {{name}}, your order {{order_id}} is ready!"
}
\`\`\`

## Outgoing Webhooks (Receive Events)
Configure WABEK to push events to your apps:
**Dashboard → Settings → Webhooks → Add Endpoint**

Events: \`message_received\`, \`message_status\`, \`campaign_completed\``,
      },
    ],
  },
  {
    id: 'white-label', title: 'White Label',
    items: [
      {
        title: 'Branding & Custom Domain',
        content: `Replace all WABEK branding with your own brand identity.

## What You Can Customize
- **Logo** — Upload your logo or enter a URL
- **Brand Colors** — Primary and secondary colors
- **App Name** — Replaces "WABEK" throughout the dashboard
- **Favicon** — Browser tab icon
- **Custom Domain** — Use \`app.yourdomain.com\` instead of \`waabek.com\`
- **Footer text** — Custom "Powered by" text
- **Custom CSS** — Advanced styling

## Custom Domain Setup
1. Go to **Dashboard → White Label**
2. Enter your domain: \`app.yourdomain.com\`
3. Add a CNAME record in your DNS:
   \`\`\`
   CNAME app.yourdomain.com → waabek.netlify.app
   \`\`\`
4. Wait for DNS propagation (up to 48 hours)

## Hide "Powered by WABEK"
Enable **Hide Powered By** in White Label settings.`,
      },
    ],
  },
  {
    id: 'reseller', title: 'Reseller System',
    items: [
      {
        title: 'Become a Reseller',
        content: `Resell WABEK under your own brand and earn recurring revenue.

## How It Works
1. Apply for reseller access at **Dashboard → Reseller**
2. Get approved by WEBEK LTD
3. Set your own pricing for plans
4. Onboard clients — they see your brand, not WABEK
5. Earn the difference between wholesale and retail price

## Reseller Dashboard
- View all referred users
- Monitor their usage and billing
- Send bulk messages to all your clients
- Track earnings and request payouts

## Pricing Control
You set your own prices. Example:
| Plan | Wholesale | Your Price | Your Margin |
|---|---|---|---|
| Starter | $15/mo | $29/mo | $14/mo |
| Pro | $40/mo | $79/mo | $39/mo |

## Contact for Reseller Approval
Email: **resellers@waabek.com**`,
      },
      {
        title: 'Stripe Connect (Payouts)',
        content: `Connect your Stripe account to receive automatic monthly payouts.

## Setup
1. Go to **Dashboard → Reseller → Payouts**
2. Click **Connect Stripe Account**
3. Complete Stripe onboarding
4. Payouts are processed on the 1st of each month

## Payout Calculation
\`\`\`
Monthly Payout = Sum of (client_revenue × your_margin_percentage)
\`\`\`

## Requirements
- Minimum payout threshold: $50
- Verified identity on Stripe
- Active reseller agreement`,
      },
    ],
  },
  {
    id: 'team', title: 'Team & Permissions',
    items: [
      {
        title: 'Team Members',
        content: `Add team members to collaborate in the Live Chat inbox and manage campaigns.

## Add a Team Member
1. Go to **Dashboard → Team**
2. Click **Invite Member**
3. Enter their email
4. Select their role

## Roles
| Role | Permissions |
|---|---|
| **Admin** | Full access — settings, billing, all features |
| **Agent** | Live chat, contacts, campaigns (no billing/settings) |
| **Viewer** | Read-only access to analytics and messages |

## Assign Conversations
In Live Chat, click the **Assign** button and select a team member. They'll receive a notification.`,
      },
      {
        title: 'Sub-Accounts',
        content: `Create separate WABEK accounts for different departments or clients.

## Create Sub-Account
1. Go to **Dashboard → Sub-Accounts**
2. Click **New Sub-Account**
3. Enter name and email
4. Set message and feature limits

## Use Cases
- Separate departments (Sales, Support, Marketing)
- Agency managing multiple clients
- Franchise businesses with multiple locations

## Limits per Sub-Account
You can set:
- Monthly message quota
- Number of WhatsApp instances
- Feature access (campaigns, chatbot, AI)`,
      },
    ],
  },
  {
    id: 'billing', title: 'Billing',
    items: [
      {
        title: 'Plans & Upgrade',
        content: `WABEK offers flexible plans for businesses of all sizes.

## Current Plans
Visit **waabek.com/pricing** for the latest pricing.

## Upgrade Your Plan
1. Go to **Dashboard → Billing**
2. Click **Upgrade Plan**
3. Select your new plan
4. Enter payment details (Stripe)

## Payment Methods
- Visa, Mastercard, Amex
- PayPal
- Bank transfer (annual plans only)

## Billing Cycle
- Monthly or annual billing
- Annual plans save 20%
- 14-day free trial on all paid plans

## Cancel or Downgrade
Go to **Dashboard → Billing → Manage Subscription**. Your account stays active until the end of the billing period.`,
      },
    ],
  },
  {
    id: 'templates', title: 'WhatsApp Templates',
    items: [
      {
        title: 'Approved Templates',
        content: `WhatsApp templates are pre-approved message formats required for messaging users outside the 24-hour window.

## WABEK Built-in Templates
| Template | Use Case | Parameters |
|---|---|---|
| \`wabek_otp\` | OTP/verification codes | \`otp_code\` |
| \`welcome_message_v2\` | New customer welcome | \`customer_name\` |
| \`support_ticket_update\` | Support reply notification | none |
| \`marketing_offer\` | Marketing campaigns | \`customer_name\` |
| \`broadcast_notification\` | Announcements | \`customer_name\` |
| \`invoice_created\` | New invoice notification | \`customer_name\`, \`invoice_id\`, \`amount\`, \`due_date\` |
| \`invoice_overdue\` | Overdue invoice reminder | \`customer_name\`, \`invoice_id\`, \`amount\` |
| \`payment_reminder\` | Payment due reminder | \`customer_name\`, \`amount\`, \`due_date\` |
| \`service_notification\` | General service update | \`customer_name\`, \`message\` |
| \`password_reset\` | Password reset link | \`customer_name\`, \`reset_link\` |
| \`ai_assistant_followup\` | AI re-engagement | (body params) |

## Template Variables Format
Templates use named parameters:
\`\`\`json
{
  "type": "text",
  "parameter_name": "customer_name",
  "text": "Ahmed"
}
\`\`\`

## Manage Templates
Go to **Admin → WA Templates** to view and configure template settings.`,
      },
    ],
  },
  {
    id: 'troubleshooting', title: 'Troubleshooting',
    items: [
      {
        title: 'Common Issues & Fixes',
        content: `## Authentication Error (Code 190)
**Cause:** Access token expired or revoked.
**Fix:** Generate a new permanent System User token in Meta Developer Console.

## Re-engagement Error (Code 131047)
**Cause:** Trying to send a text message outside the 24-hour customer service window.
**Fix:** WABEK automatically switches to templates for Cloud API. Make sure your campaign has a template selected.

## Template Parameter Error (Code 132000)
**Cause:** Number of template parameters doesn't match the template definition.
**Fix:** Check that your template parameters match exactly. Named parameters (e.g. \`customer_name\`) must be used.

## QR Code Not Scanning
**Fix:**
1. Make sure your phone has WhatsApp updated to latest version
2. The QR code expires every 60 seconds — refresh if needed
3. Ensure no other browser tab has the QR code open

## Messages Not Delivering
Check:
1. Instance status is "Connected"
2. Phone number is in E.164 format (no +, just country code + number)
3. Recipient has WhatsApp installed
4. Check **Netlify logs** for \`[SEND]\` log entries

## Campaign Stuck on "Running"
The campaign is still processing. Click **Details** to see live progress. Large campaigns may take time due to message delays.`,
      },
      {
        title: 'Support & Contact',
        content: `## Get Help

**Documentation:** waabek.com/docs

**Email Support:**
- General: support@waabek.com
- Legal: legal@waabek.com
- Resellers: resellers@waabek.com

**Phone / WhatsApp:**
- 🇬🇧 UK / Europe / Americas: **+44 7878 704062**
- 🇹🇷 Middle East / Turkey / MENA: **+90 541 847 79 76**

**Company:**
WEBEK LTD · Company No. 16326894
71-75 Shelton Street, Covent Garden
London, WC2H 9JQ, United Kingdom

**Response times:**
| Channel | Response Time |
|---|---|
| WhatsApp | Within 1 hour (business hours) |
| Email | Within 24 hours |
| Phone | 9AM–6PM GMT |`,
      },
    ],
  },
  {
    id: 'webhooks', title: 'Webhooks',
    items: [
      {
        title: 'Overview & Setup',
        content: `Webhooks let your server receive real-time notifications whenever something happens in WABEK — a message arrives, a campaign is delivered, an OTP is sent, and more.

## How Webhooks Work
1. You provide a **Webhook URL** (your server endpoint)
2. WABEK sends an **HTTP POST** to your URL whenever an event occurs
3. Your server processes the payload and responds with **HTTP 200**
4. If your server does not respond with 200, WABEK retries up to **3 times** with exponential backoff (5s, 30s, 5min)

## Setting Up Your Webhook
Go to **Dashboard → Settings → Webhook** and enter your Webhook URL.

| Field | Description |
|---|---|
| Webhook URL | Your server endpoint (must be HTTPS in production) |
| Secret Key | Optional secret to verify the request came from WABEK |

## Where to Get Your Webhook URL

Depending on how you want to use WABEK webhooks, get your URL from one of these platforms:

| Platform | How to get the URL |
|---|---|
| **Zapier** | Create a Zap → Trigger: Webhooks by Zapier → Catch Hook → copy the URL |
| **Make (Integromat)** | Create a scenario → Add module: Webhooks → Custom webhook → copy the URL |
| **n8n** | Add node: Webhook → copy the Production URL |
| **Pabbly Connect** | Create workflow → Trigger: Webhook → copy the URL |
| **Your own server** | Create an HTTPS endpoint that accepts POST requests (see examples below) |
| **webhook.site** | Go to webhook.site → copy your unique URL (for testing only) |
| **Pipedream** | Create a workflow → Trigger: HTTP / Webhook → copy the URL |

> **Testing locally?** Use ngrok (ngrok.com) to expose your local server — run "ngrok http 3000" and use the HTTPS URL it gives you.

## Verifying Webhook Authenticity
Every webhook request includes a signature header:

\`\`\`
X-WABEK-Signature: sha256=<hmac_signature>
\`\`\`

Verify it on your server:

\`\`\`javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
\`\`\`

\`\`\`python
import hmac, hashlib, json

def verify_webhook(payload: dict, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
\`\`\`

## Webhook Request Format
All webhooks are sent as **HTTP POST** with:

\`\`\`
Content-Type: application/json
X-WABEK-Signature: sha256=...
X-WABEK-Event: message.inbound
\`\`\`

Every payload includes a common envelope:

\`\`\`json
{
  "event": "message.inbound",
  "timestamp": "2025-07-01T14:30:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": { ... }
}
\`\`\`

> **Tip:** Always respond with HTTP 200 immediately, then process the event asynchronously to avoid timeouts.`,
      },
      {
        title: 'message.inbound — Incoming Message',
        content: `Fired when a contact sends a message to your WhatsApp number.

## When It Fires
- Contact sends a text, image, video, audio, document, sticker, or location message
- Works for both **WhatsApp Web** and **Cloud API** instances

## Payload

\`\`\`json
{
  "event": "message.inbound",
  "timestamp": "2025-07-01T14:30:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "message_id": "wamid.HBgNMjAxMjM0NTY3ODkwFQIAERgSM...",
    "from": "201234567890",
    "from_name": "Ahmed Mohamed",
    "type": "text",
    "text": "Hello, I need help with my order",
    "timestamp": "2025-07-01T14:30:00.000Z",
    "instance_type": "wa_web",
    "phone_number": "447878704062",
    "media": null
  }
}
\`\`\`

## Media Message Example (type = image/video/audio/document)

\`\`\`json
{
  "event": "message.inbound",
  "data": {
    "message_id": "wamid.HBgN...",
    "from": "201234567890",
    "from_name": "Sara Ali",
    "type": "image",
    "text": "Check this out",
    "timestamp": "2025-07-01T14:31:00.000Z",
    "media": {
      "url": "https://cdn.waabek.com/media/abc123.jpg",
      "mime_type": "image/jpeg",
      "filename": null,
      "size": 204800
    }
  }
}
\`\`\`

## Message Types

| type | Description |
|---|---|
| text | Plain text message |
| image | Image (JPEG, PNG, WebP) |
| video | Video (MP4, 3GP) |
| audio | Audio / Voice note |
| document | File (PDF, DOCX, XLSX…) |
| sticker | WhatsApp sticker |
| location | GPS coordinates |
| reaction | Emoji reaction to a message |

## Example Handler

\`\`\`javascript
app.post('/webhook', (req, res) => {
  res.sendStatus(200) // respond immediately
  const { event, data } = req.body
  if (event === 'message.inbound') {
    console.log(\`New message from \${data.from_name}: \${data.text}\`)
    // save to DB, trigger chatbot, notify agent...
  }
})
\`\`\``,
      },
      {
        title: 'message.outbound — Sent Message',
        content: `Fired when a message is successfully sent from your WhatsApp number.

## When It Fires
- You send a message via the API (\`/api/v1/send\`)
- A team member sends a message from the Live Chat
- A campaign sends a message to a contact
- The chatbot auto-replies

## Payload

\`\`\`json
{
  "event": "message.outbound",
  "timestamp": "2025-07-01T14:31:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "message_id": "wamid.HBgNMjAxMjM0NTY3ODkwFQIAERgS...",
    "to": "201234567890",
    "type": "text",
    "text": "Hello! How can I help you today?",
    "timestamp": "2025-07-01T14:31:00.000Z",
    "source": "live_chat",
    "sent_by": "usr_agent123",
    "instance_type": "wa_web",
    "status": "sent"
  }
}
\`\`\`

## Source Values

| source | Description |
|---|---|
| api | Sent via REST API |
| live_chat | Sent from Live Chat inbox by a team member |
| campaign | Sent as part of a campaign |
| chatbot | Sent by chatbot auto-reply |
| otp | Sent as an OTP verification code |`,
      },
      {
        title: 'message.delivered — Message Delivered',
        content: `Fired when WhatsApp confirms the message was delivered to the recipient's device.

> Only available for **Cloud API** instances. WhatsApp Web does not provide delivery receipts.

## Payload

\`\`\`json
{
  "event": "message.delivered",
  "timestamp": "2025-07-01T14:31:05.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "message_id": "wamid.HBgNMjAxMjM0NTY3ODkwFQIAERgS...",
    "to": "201234567890",
    "delivered_at": "2025-07-01T14:31:05.000Z",
    "instance_type": "cloud_api"
  }
}
\`\`\``,
      },
      {
        title: 'message.read — Message Read',
        content: `Fired when the recipient opens and reads the message.

> Only available for **Cloud API** instances. Requires the recipient to have read receipts enabled.

## Payload

\`\`\`json
{
  "event": "message.read",
  "timestamp": "2025-07-01T14:32:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "message_id": "wamid.HBgNMjAxMjM0NTY3ODkwFQIAERgS...",
    "to": "201234567890",
    "read_at": "2025-07-01T14:32:00.000Z",
    "instance_type": "cloud_api"
  }
}
\`\`\``,
      },
      {
        title: 'message.failed — Message Failed',
        content: `Fired when a message fails to send.

## When It Fires
- Number does not exist on WhatsApp
- Template rejected or not approved
- Cloud API rate limit exceeded
- WhatsApp Web session disconnected during send

## Payload

\`\`\`json
{
  "event": "message.failed",
  "timestamp": "2025-07-01T14:31:02.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "message_id": null,
    "to": "201234567890",
    "error_code": "131026",
    "error_message": "Message undeliverable — number not on WhatsApp",
    "source": "api",
    "instance_type": "cloud_api"
  }
}
\`\`\`

## Common Error Codes

| error_code | Meaning |
|---|---|
| 131026 | Number not on WhatsApp |
| 131047 | Re-engagement message outside 24h window |
| 131051 | Template not approved |
| 131052 | Template parameters mismatch |
| wa_web_disconnected | WA Web session not connected |
| rate_limited | Too many messages in short period |`,
      },
      {
        title: 'instance.connected — WhatsApp Connected',
        content: `Fired when a WhatsApp instance successfully connects.

## When It Fires
- QR code scanned and WhatsApp Web session established
- Cloud API instance verified and active

## Payload

\`\`\`json
{
  "event": "instance.connected",
  "timestamp": "2025-07-01T12:00:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "instance_id": "inst_abc123",
    "instance_type": "wa_web",
    "phone_number": "201234567890",
    "display_name": "Ahmed Business",
    "connected_at": "2025-07-01T12:00:00.000Z"
  }
}
\`\`\``,
      },
      {
        title: 'instance.disconnected — WhatsApp Disconnected',
        content: `Fired when a WhatsApp instance loses connection.

## When It Fires
- Phone logs out of linked devices
- WhatsApp Web session expires
- Network interruption that could not be recovered

## Payload

\`\`\`json
{
  "event": "instance.disconnected",
  "timestamp": "2025-07-01T18:00:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "instance_id": "inst_abc123",
    "instance_type": "wa_web",
    "phone_number": "201234567890",
    "reason": "logged_out",
    "disconnected_at": "2025-07-01T18:00:00.000Z"
  }
}
\`\`\`

## Disconnect Reasons

| reason | Description |
|---|---|
| logged_out | User logged out from phone |
| session_expired | Session token expired |
| conflict | WhatsApp opened on another device |
| network_error | Unrecoverable network failure |`,
      },
      {
        title: 'campaign.sent — Campaign Message Sent',
        content: `Fired for each message sent as part of a campaign.

## Payload

\`\`\`json
{
  "event": "campaign.sent",
  "timestamp": "2025-07-01T10:05:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "campaign_id": "camp_xyz456",
    "campaign_name": "July Promotion",
    "message_id": "wamid.HBgN...",
    "to": "201234567890",
    "contact_name": "Ahmed",
    "template_key": "july_promo",
    "status": "sent",
    "sent_at": "2025-07-01T10:05:00.000Z"
  }
}
\`\`\``,
      },
      {
        title: 'campaign.completed — Campaign Finished',
        content: `Fired when all messages in a campaign have been processed.

## Payload

\`\`\`json
{
  "event": "campaign.completed",
  "timestamp": "2025-07-01T10:30:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "campaign_id": "camp_xyz456",
    "campaign_name": "July Promotion",
    "total": 500,
    "sent": 487,
    "failed": 13,
    "completed_at": "2025-07-01T10:30:00.000Z"
  }
}
\`\`\``,
      },
      {
        title: 'otp.sent — OTP Sent',
        content: `Fired when an OTP code is sent to a user for verification.

## When It Fires
- Your website triggers OTP login via the WABEK OTP API
- The WAABEK WordPress plugin sends an OTP

## Payload

\`\`\`json
{
  "event": "otp.sent",
  "timestamp": "2025-07-01T14:00:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "phone": "201234567890",
    "otp_length": 6,
    "expires_in": 300,
    "sent_at": "2025-07-01T14:00:00.000Z",
    "source": "wordpress_plugin"
  }
}
\`\`\`

> **Security:** The OTP code itself is **never** included in the webhook payload.`,
      },
      {
        title: 'otp.verified — OTP Verified',
        content: `Fired when a user successfully verifies their OTP code.

## Payload

\`\`\`json
{
  "event": "otp.verified",
  "timestamp": "2025-07-01T14:01:30.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "phone": "201234567890",
    "verified_at": "2025-07-01T14:01:30.000Z",
    "source": "wordpress_plugin",
    "attempts": 1
  }
}
\`\`\``,
      },
      {
        title: 'contact.created — New Contact',
        content: `Fired when a new contact is created — either automatically when an unknown number messages you, or manually via the API.

## Payload

\`\`\`json
{
  "event": "contact.created",
  "timestamp": "2025-07-01T14:30:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "contact_id": "cont_abc123",
    "phone": "201234567890",
    "name": "Ahmed Mohamed",
    "source": "inbound_message",
    "created_at": "2025-07-01T14:30:00.000Z"
  }
}
\`\`\`

## Source Values

| source | Description |
|---|---|
| inbound_message | Contact messaged you first |
| api | Created via REST API |
| import | Imported via CSV |
| manual | Created manually in dashboard |`,
      },
      {
        title: 'contact.opted_out — Contact Unsubscribed',
        content: `Fired when a contact sends a stop/unsubscribe keyword and is opted out of campaigns.

## Stop Keywords
By default: \`STOP\`, \`UNSUBSCRIBE\`, \`OPT OUT\`, \`إلغاء\`

## Payload

\`\`\`json
{
  "event": "contact.opted_out",
  "timestamp": "2025-07-01T15:00:00.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "contact_id": "cont_abc123",
    "phone": "201234567890",
    "name": "Ahmed Mohamed",
    "keyword": "STOP",
    "opted_out_at": "2025-07-01T15:00:00.000Z"
  }
}
\`\`\``,
      },
      {
        title: 'chatbot.triggered — Chatbot Activated',
        content: `Fired when the chatbot processes an inbound message and sends an auto-reply.

## Payload

\`\`\`json
{
  "event": "chatbot.triggered",
  "timestamp": "2025-07-01T14:30:05.000Z",
  "instance_id": "inst_abc123",
  "account_id": "usr_xyz789",
  "data": {
    "contact_id": "cont_abc123",
    "phone": "201234567890",
    "trigger_keyword": "price",
    "node_id": "node_pricing",
    "node_name": "Pricing Info",
    "reply_sent": true,
    "triggered_at": "2025-07-01T14:30:05.000Z"
  }
}
\`\`\``,
      },
      {
        title: 'All Events Reference',
        content: `Quick reference of all webhook events.

## Event List

| Event | Trigger |
|---|---|
| message.inbound | Contact sends you a message |
| message.outbound | You send a message (API/chat/campaign/bot) |
| message.delivered | Message delivered to device (Cloud API only) |
| message.read | Message read by recipient (Cloud API only) |
| message.failed | Message failed to send |
| instance.connected | WhatsApp instance connected |
| instance.disconnected | WhatsApp instance disconnected |
| campaign.sent | Single campaign message sent |
| campaign.completed | Entire campaign finished |
| otp.sent | OTP code sent to user |
| otp.verified | OTP successfully verified |
| contact.created | New contact added |
| contact.opted_out | Contact unsubscribed |
| chatbot.triggered | Chatbot auto-replied |

## Full Integration Example (Node.js / Express)

\`\`\`javascript
const express = require('express')
const crypto = require('crypto')
const app = express()
app.use(express.json())

const WEBHOOK_SECRET = process.env.WABEK_WEBHOOK_SECRET

function verify(req) {
  if (!WEBHOOK_SECRET) return true
  const sig = req.headers['x-wabek-signature'] || ''
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

app.post('/wabek-webhook', (req, res) => {
  if (!verify(req)) return res.status(401).json({ error: 'Invalid signature' })
  res.sendStatus(200) // always respond fast

  const { event, data, instance_id, timestamp } = req.body

  switch (event) {
    case 'message.inbound':
      handleInbound(data)
      break
    case 'message.delivered':
      markDelivered(data.message_id)
      break
    case 'message.read':
      markRead(data.message_id)
      break
    case 'message.failed':
      logFailure(data)
      break
    case 'instance.disconnected':
      alertAdmin(instance_id, data.reason)
      break
    case 'campaign.completed':
      saveCampaignReport(data)
      break
    case 'otp.verified':
      loginUser(data.phone)
      break
    case 'contact.opted_out':
      removeFromLists(data.phone)
      break
  }
})

async function handleInbound(data) {
  // Save message to your DB
  await db.messages.create({
    from: data.from,
    name: data.from_name,
    text: data.text,
    media: data.media,
    received_at: data.timestamp,
  })
  // Notify your team via Slack, email, etc.
}

app.listen(3000)
\`\`\`

## Full Integration Example (Python / FastAPI)

\`\`\`python
from fastapi import FastAPI, Request, HTTPException
import hmac, hashlib, json, os

app = FastAPI()
SECRET = os.getenv("WABEK_WEBHOOK_SECRET", "")

def verify(body: bytes, signature: str) -> bool:
    if not SECRET:
        return True
    expected = "sha256=" + hmac.new(
        SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.post("/wabek-webhook")
async def webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("x-wabek-signature", "")
    if not verify(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = json.loads(body)
    event = payload.get("event")
    data  = payload.get("data", {})

    if event == "message.inbound":
        print(f"New message from {data['from_name']}: {data['text']}")
    elif event == "instance.disconnected":
        print(f"Instance disconnected: {data['reason']}")
    elif event == "otp.verified":
        print(f"OTP verified for {data['phone']}")

    return {"ok": True}
\`\`\`

> **Retry Policy:** If your server returns non-200, WABEK retries 3 times: after 5 seconds, 30 seconds, and 5 minutes. After 3 failures the event is dropped and logged in your Dashboard → Logs.`,
      },
    ],
  },
]

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group my-3">
      <pre className="bg-[#F8FAFC] text-slate-800 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed border border-slate-200">
        <code>{code}</code>
      </pre>
      <button onClick={copy}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg p-1.5">
        {copied
          ? <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          : <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>}
      </button>
    </div>
  )
}

function renderContent(content: string) {
  const lines = content.split('\n')
  const elements: any[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(<CodeBlock key={i} code={codeLines.join('\n')} />)
      i++
      continue
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-base font-bold text-slate-900 mt-5 mb-2">{line.slice(3)}</h3>)
      i++; continue
    }

    // Table
    if (line.includes('|') && lines[i+1]?.includes('|---')) {
      const headers = line.split('|').map(h => h.trim()).filter(Boolean)
      i += 2 // skip separator
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
        i++
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {headers.map((h,hi) => <th key={hi} className="text-left py-2 px-3 text-slate-400 font-semibold text-xs uppercase tracking-wide">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri) => (
                <tr key={ri} className="border-b border-slate-200/50 hover:bg-slate-500">
                  {row.map((cell,ci) => <td key={ci} className="py-2 px-3 text-slate-700 text-xs">{cell.replace(/`([^`]+)`/g, '$1')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Bullet
    if (line.startsWith('- ')) {
      const bullets: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        bullets.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={i} className="space-y-1 my-2">
          {bullets.map((b,bi) => (
            <li key={bi} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-blue-600 mt-1 flex-shrink-0">›</span>
              <span dangerouslySetInnerHTML={{__html: b.replace(/\*\*([^*]+)\*\*/g,'<strong class="text-slate-900">$1</strong>').replace(/`([^`]+)`/g,'<code class="bg-slate-100 text-green-400 px-1 rounded text-xs">$1</code>')}} />
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="border-l-2 border-brand-500 pl-3 my-3 text-sm text-slate-400 italic">
          {line.slice(2)}
        </div>
      )
      i++; continue
    }

    // Empty line
    if (line.trim() === '') { i++; continue }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-sm text-slate-700 leading-relaxed my-1.5"
        dangerouslySetInnerHTML={{__html: line
          .replace(/\*\*([^*]+)\*\*/g,'<strong class="text-slate-900 font-semibold">$1</strong>')
          .replace(/`([^`]+)`/g,'<code class="bg-slate-100 text-green-400 px-1.5 py-0.5 rounded text-xs">$1</code>')
        }} />
    )
    i++
  }
  return elements
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started')
  const [openItems, setOpenItems] = useState<Record<string,boolean>>({'Connect WhatsApp': true})
  const [docsSidebarOpen, setDocsSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredSections = search
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(item =>
          item.title.toLowerCase().includes(search.toLowerCase()) ||
          item.content.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(s => s.items.length > 0)
    : sections

  const currentSection = filteredSections.find(s => s.id === activeSection) || filteredSections[0]

  return (
    <DashboardLayout title="Documentation">
      <div className="flex gap-0 -m-6 h-[calc(100vh-56px)] relative">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setDocsSidebarOpen(o => !o)}
          className="md:hidden absolute top-3 left-3 z-30 bg-white border border-slate-200 rounded-lg p-2 text-slate-400">
          {docsSidebarOpen
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
        {/* Sidebar */}
        <div className={clsx("flex-shrink-0 border-r border-slate-200 flex flex-col bg-[#F8FAFC]/50 transition-all duration-300",
          "fixed md:static inset-y-0 left-0 z-20 w-64",
          docsSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          <div className="p-4 border-b border-slate-200">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="input w-full text-sm py-2"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {filteredSections.map(s => (
              <button key={s.id} onClick={() => { setActiveSection(s.id); setSearch('') }}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-sm font-medium transition-colors',
                  activeSection === s.id
                    ? 'bg-brand-500/10 text-blue-600 border-r-2 border-brand-500'
                    : 'text-slate-400 hover:text-slate-900 hover:bg-white'
                )}>
                <span className="inline-flex items-center gap-2"><SectionIcon id={s.id} className="h-4 w-4 shrink-0" />{s.title}</span>
                <span className="ml-2 text-xs text-slate-600">({s.items.length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile overlay */}
        {docsSidebarOpen && <div className="fixed inset-0 bg-slate-50/40 z-10 md:hidden" onClick={() => setDocsSidebarOpen(false)} />}
        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-12 md:pt-0">
          <div className="max-w-3xl mx-auto p-8">
            {currentSection ? <>
              <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-bold text-slate-900"><SectionIcon id={currentSection.id} className="h-6 w-6 shrink-0" />{currentSection.title}</h1>
              <div className="space-y-3">
                {currentSection.items.map(item => (
                  <div key={item.title} className="card overflow-hidden">
                    <button
                      onClick={() => setOpenItems(o => ({...o, [item.title]: !o[item.title]}))}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-500 transition-colors">
                      <span className="font-semibold text-slate-900 text-sm">{item.title}</span>
                      {openItems[item.title]
                        ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>}
                    </button>
                    {openItems[item.title] && (
                      <div className="px-4 pb-5 border-t border-slate-200">
                        <div className="pt-4">{renderContent(item.content)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </> : (
              <div className="text-center py-20 text-slate-500">No results for "{search}"</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
