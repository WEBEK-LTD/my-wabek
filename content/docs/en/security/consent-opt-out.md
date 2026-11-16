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

## When a customer asks to stop

WABEK does not currently process stop keywords (such as `STOP`) automatically. To honor the request:

1. Open the contact's page in **Contacts**.
2. Click **Block Contact**. Any further send to them from the inbox, campaigns, API and integrations is refused.
3. (Optional) Create an [automation](/docs/guides/automation) rule with the keyword `STOP` that replies with a confirmation, so the customer knows the request was received.

> **Warning:** Ignoring stop requests raises block and report rates, lowers your number's quality rating with Meta, and can lead to sending restrictions or the number being disconnected.

## Turning off AI only

If the customer wants to talk to a person rather than the assistant, click **Disable AI** on the contact's page. Their messages still arrive and you can reply manually. See [AI assistant](/docs/guides/ai-assistant).

## Personal data

- WABEK stores messages and contact data to run the service.
- [Link tracking](/docs/guides/link-tracking) records the IP address and browser of each click.
- Mention your use of WhatsApp and measurement tools in your business's privacy policy, and follow the laws that apply in your country and your customers' countries.
- See the [Privacy Policy](/legal/privacy) and [Terms](/legal/terms).
