---
title: "Plans and limits"
description: "The kinds of limits in WABEK plans, how they are counted, and what happens when you reach them or your plan expires."
section: getting-started
order: 5
slug: getting-started/plans-limits
---

# Plans and limits

Prices and limits vary by plan; your current plan's details are on the **Billing** page. This page explains **how** limits work, not their values.

## Usage limits

| Limit | How it is counted | When reached |
|---|---|---|
| Monthly messages | Every outbound message from your account since the start of the calendar month (inbox, campaigns, API, automations) | Sending is refused with code `plan_limit` |
| Monthly campaigns | Campaigns created since the start of the month | Creating a new campaign is refused with an upgrade message |
| WhatsApp numbers | Number of connected numbers | Connecting a new number is blocked; existing numbers are not affected |
| AI replies | AI assistant replies this month | Automatic replies stop until next month |
| Team members, chatbot flows, quick replies, segments, links, sub-accounts | Per plan | Per plan |

> **Note:** A value of `-1` in a plan means unlimited. For AI replies specifically, `0` means the feature is not included in the plan.

## Features by plan

Some pages only appear if your plan includes them:

| Feature | Controls |
|---|---|
| API Access | The **API Keys** and **Integrations** pages |
| Chatbot | The chatbot builder |
| Automation | The **Flows** page |
| Analytics | The analytics page |
| White Label | White label |
| Sub-Accounts | Sub-accounts |
| Reseller | The reseller program |

If you open a page your plan does not include, an **Upgrade** screen is shown.

## When a plan or trial ends

When a subscription or trial ends, **the account is not closed**. The Free plan's limits and features apply automatically until you renew.

## Upgrading

1. Open **Billing**.
2. Choose the cycle: monthly or yearly (when available).
3. Click the plan you want and complete payment.

See [Billing](/docs/guides/billing) to manage your subscription and gift codes.

## API response when a limit is reached

```json
{
  "error": "Monthly message limit reached for your plan",
  "code": "plan_limit"
}
```

HTTP status: `403`. See [Errors](/docs/api/errors).
