---
title: "Overview"
description: "What WABEK is, and the core concepts you need before you start."
section: getting-started
order: 1
slug: getting-started/overview
---

# Overview

WABEK is a platform for running WhatsApp Business messaging. You connect one or more WhatsApp numbers, then receive and answer conversations with your team, send campaigns, build chatbots and automations, and connect your store or system through the API.

## Core concepts

| Concept | Meaning |
|---|---|
| **Number (instance)** | A WhatsApp number connected to your account. Each one has an `instance_id`, shown on the **WhatsApp** page of the dashboard. |
| **Connection type** | Either the official **Meta Cloud API**, or **WhatsApp Web** via a QR code. The type decides how messages are sent and which rules apply. See [Connect a WhatsApp number](/docs/getting-started/connect-number). |
| **Contact** | A customer saved by phone number, with an optional name, email and tags. |
| **Conversation** | The thread of messages between you and a contact on a given number, shown in the inbox. |
| **24-hour window** | A period that starts with the last message the customer sent to your number. Inside it you can send free text; outside it a Meta-approved template is required (Cloud API numbers). See [24-hour window and templates](/docs/getting-started/messaging-window). |
| **Template** | A message registered and approved in advance in Meta Business Manager, used to start conversations or send campaigns. |
| **API key** | A secret that connects your external systems to your account, sent in a request header. See [Authentication](/docs/api/authentication). |

## What can you do?

- **Day-to-day support:** a shared team inbox with assignment and conversation statuses. See [Inbox and team](/docs/guides/inbox).
- **Bulk messaging:** immediate or scheduled campaigns to contacts selected by tag. See [Campaigns](/docs/guides/campaigns).
- **Automated replies:** a visual chatbot, keyword automations and an AI assistant. See [Chatbot](/docs/guides/chatbot).
- **Integrations:** WordPress/WooCommerce, WHMCS, Wix and Zapier, or the API directly. See [Integrations](/docs/integrations/wordpress).
- **Reselling:** white label, sub-accounts and a reseller program.

## Base URL

All API requests go to:

```
https://waabek.com
```

> **Note:** If you use a custom domain through [white label](/docs/guides/white-label), check your account's actual base URL on the **API Keys** page of the dashboard; the command examples there are built from the domain you opened the dashboard on.

## Next steps

1. [Create an account](/docs/getting-started/create-account).
2. [Connect a WhatsApp number](/docs/getting-started/connect-number).
3. Read [24-hour window and templates](/docs/getting-started/messaging-window) before you send anything.
