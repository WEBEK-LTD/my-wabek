---
title: "Consent and opt-out"
description: "When you may message a customer, and how WABEK prevents sending to contacts who opted out or are blocked."
section: security
order: 2
slug: security/consent-opt-out
---

# Consent and opt-out

## Getting consent

Before you send a business-initiated message (a campaign, notification or reminder), the customer must have agreed to receive WhatsApp messages from you.

- Ask for consent clearly, naming your business and the kind of messages they will receive.
- Keep a record of consent: when, where and how.
- Never buy number lists or reuse numbers collected for another purpose.
- Include a clear way to stop marketing messages, for example: "Reply STOP to unsubscribe".

## What WABEK enforces

Before messages sent from the inbox, campaigns, API send endpoints and integrations, WABEK checks the recipient's state in your contacts:

| Contact state | Result |
|---|---|
| `opted_out` | Sending is refused: `403` with code `opted_out` |
| `is_blocked` | Sending is refused: `403` with code `blocked` |

Campaigns also exclude these contacts from the audience automatically.

## Stop keywords (automatic)

When a contact sends a message that is **exactly** one of these words (spaces around it and letter case do not matter), WABEK records the choice on both Cloud API and WhatsApp Web numbers:

| Keywords | Result |
|---|---|
| `STOP`, `UNSUBSCRIBE`, `إلغاء`, `الغاء`, `توقف`, `إيقاف` | The contact is marked `opted_out` |
| `START`, `اشتراك` | The contact is subscribed again (`opted_out` cleared) |

- The contact receives **one** short confirmation, in Arabic or English to match the keyword — only when their state actually changed. This confirmation is the only message sent to a contact who has just opted out.
- The message is not answered by the chatbot, automations or the AI assistant.
- The `opt_out` / `opt_in` [outgoing webhooks](/docs/api/outgoing-webhooks) fire, and re-subscribing runs your **opt-in** [automations](/docs/guides/automation).
- A longer message that only contains the word (for example "please stop the offers") is a normal message; handle it from the inbox.

## Opting a contact out or in manually

On the contact's page in **Contacts**, click **Mark as opted out** (or **Re-subscribe**). Integrations can do the same through [`POST /api/v1/contacts-opt-out`](/docs/api/create-contact) with `{"phone": "...", "opted_out": true|false}`; recording `opted_out: false` counts as an opt-in (webhook and opt-in automations).

**Block Contact** remains available for numbers you never want to message or hear from.

> **Warning:** Ignoring stop requests raises block and report rates, lowers your number's quality rating with Meta, and can lead to sending restrictions or the number being disconnected.

## Turning off AI only

If the customer wants to talk to a person rather than the assistant, click **Disable AI** on the contact's page. Their messages still arrive and you can reply manually. See [AI assistant](/docs/guides/ai-assistant).

## Personal data

- WABEK stores messages and contact data to run the service.
- [Link tracking](/docs/guides/link-tracking) records the IP address and browser of each click.
- Mention your use of WhatsApp and measurement tools in your business's privacy policy, and follow the laws that apply in your country and your customers' countries.
- See the [Privacy Policy](/legal/privacy) and [Terms](/legal/terms).
