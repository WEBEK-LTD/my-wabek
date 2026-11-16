---
title: "Meta and WhatsApp policies"
description: "The key Meta rules for WhatsApp Business, and how to keep your number's quality high."
section: security
order: 3
slug: security/meta-policies
---

# Meta and WhatsApp policies

Your use of WhatsApp through WABEK is subject to Meta's and WhatsApp's policies, in addition to the [WABEK Terms](/legal/terms). This page is a practical summary; the binding reference is Meta's official text:

- [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy)
- [WhatsApp Commerce Policy](https://www.whatsapp.com/legal/commerce-policy)
- [WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)

## Core rules

1. **Consent first:** only send business-initiated messages to people who agreed. See [Consent and opt-out](/docs/security/consent-opt-out).
2. **24-hour window:** outside it, only approved templates are allowed. See [24-hour window](/docs/getting-started/messaging-window).
3. **The right template category:** offers and promotions = Marketing; order and account updates = Utility; sign-in codes = Authentication.
4. **Honor stop requests** immediately.
5. **Prohibited content:** the Commerce Policy bans selling certain products and services over WhatsApp. Review it before launching campaigns.
6. **Clear identity:** your display name must reflect your real business.

## Number quality

Meta rates each Cloud API number based on how recipients react to its messages (blocks, reports, read rates). The rating affects how many conversations the number can start per day.

| To keep quality high | Avoid |
|---|---|
| Messages the recipient expects and finds useful | Repetitive or generic messages to large lists |
| Personalizing with the customer's name and context | Sending the same campaign several times in a row |
| Spreading large campaigns over time | Sudden jumps in sending volume |
| Removing unengaged contacts from your lists | Messaging numbers that have not engaged for a long time |

Monitor the quality rating in Meta Business Manager → WhatsApp Manager.

## WhatsApp Web

Connecting a number by QR code uses WhatsApp Web, which WhatsApp's terms intend for personal use. Automated or bulk sending through it can get the number **permanently banned**, and neither WABEK nor Meta can restore it. Use the Cloud API for any large-scale sending. See [Connect a WhatsApp number](/docs/getting-started/connect-number).

## Meta fees

Meta charges for some Cloud API messages based on their category and the recipient's country. These fees are paid to Meta directly through your WhatsApp Business Account and are separate from your WABEK subscription. Check Meta's official pricing page for current rates.
