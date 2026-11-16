---
title: "FAQ"
description: "Short answers to the most common questions about WABEK."
section: faq
order: 2
slug: faq/faq
---

# FAQ

## Should I use the Cloud API or WhatsApp Web?

Use the **Cloud API** for any serious business use, especially campaigns and automated notifications. Use **WhatsApp Web** only for one-to-one chats if you cannot use the Cloud API, knowing the ban risk. See [Connect a WhatsApp number](/docs/getting-started/connect-number).

## Can I use the same number on my phone and on the Cloud API?

A number registered on the Cloud API usually cannot be used in the regular WhatsApp app on a phone at the same time. Check Meta's current options before moving a number that is in use. WhatsApp Web, on the other hand, works alongside your phone as a linked device.

## Why didn't my message arrive even though the request succeeded?

A `200` response means the message was accepted for sending, not that it was delivered. Meta may reject it later (for example, a number that is not on WhatsApp). Follow the message status in the inbox. See [Troubleshooting](/docs/faq/troubleshooting).

## Can I send images or files through the API?

The current public API endpoints send text only. Attachments (up to 16 MB) can be sent from the inbox.

## Are Arabic templates supported?

WABEK currently sends templates with English language codes only: `en` in campaigns, `en` then `en_US` in `POST /api/v1/send`, and `en`, `en_US` and `en_GB` for verification codes. A template approved in Meta only under the `ar` language code will not be found on these paths, and Meta returns error `132001`.

## How many messages can I send?

It depends on your plan (a monthly message limit) and on Meta's limits for your Cloud API number. See [Plans and limits](/docs/getting-started/plans-limits) and [Rate limits](/docs/api/rate-limits).

## What happens to my data if my subscription ends?

Nothing is deleted. The Free plan's limits apply until you renew.

## Can team members see the API key?

No. Only the account owner can manage and view keys.

## How do I stop the AI assistant for one customer?

On the contact's page, click **Disable AI**. The assistant also stops automatically if the customer types one of the escalation keywords. See [AI assistant](/docs/guides/ai-assistant).

## Does WABEK sign webhook notifications?

Not in this release. Secure your endpoint with a secret token in the URL. See [Outgoing webhooks](/docs/api/outgoing-webhooks).

## Where do I find the Instance ID?

On the **WhatsApp** page, on each number's card, with a copy button.
