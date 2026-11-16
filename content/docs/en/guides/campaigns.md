---
title: "Campaigns"
description: "Create a bulk message campaign, choose the template and audience, schedule it, and track results."
section: guides
order: 3
slug: guides/campaigns
---

# Campaigns

A campaign is one message sent to a group of contacts, immediately or at a set time.

> **Warning:** Only send campaigns to customers who agreed to receive your messages. Bulk sending without consent raises block and report rates and can get your number restricted. See [Consent and opt-out](/docs/security/consent-opt-out).

## Before you start

- A connected number (status **connected**).
- For **Cloud API** numbers: an approved template (`APPROVED`) in Meta Business Manager.
- Contacts organized by tags if you want to target a specific group.

## Create a campaign

1. Open **Campaigns** and click **New Campaign**.
2. Enter a **campaign name** and choose the sending **number**.
3. Write the message, start from a ready-made sample, or use the AI message generator.
4. For Cloud API numbers, choose the **approved template** from the list.
5. Set the **audience**: leave the tags field empty for all contacts, or enter one or more comma-separated tags.
6. Set the **delay between messages** in seconds (1 to 60, default 3).
7. Pick a send time, or leave it empty to start manually.
8. Review the summary and create the campaign.

> **Note:** Blocked and opted-out contacts are always excluded, whatever audience you choose.

## Variables

### WhatsApp Web numbers

Your message is sent as text, with variables replaced:

| Variable | Value |
|---|---|
| `{{name}}` | The contact's name (or number if there is no name) |
| `{{phone}}` | The contact's number |
| `{{any_key}}` | Any custom field in the contact's variables |

Variables with no value are removed from the text.

### Cloud API numbers

The campaign is **always sent as the template**, regardless of the 24-hour window. The customer receives the approved template's text, and WABEK passes the contact's name in the named parameter `customer_name`.

> **Warning:** Design campaign templates so the body has exactly one named variable, `{{customer_name}}`, in language `en`. A template with a different number of variables, other variable names, or another language is rejected by Meta and the message counts as failed. If you choose no template, WABEK uses the default marketing template `marketing_offer`, which may not exist on your account.

## Running and stopping

| Action | Available when | Effect |
|---|---|---|
| **Start** | `draft`, `scheduled` or `paused` | Starts sending, or resumes where it stopped |
| **Pause** | `running` | Pauses sending and saves progress |
| **Cancel** | `running` | Stops the campaign for good (status becomes `failed`) |
| **Delete** | Any status except `running` | Deletes the campaign |

## Statuses

| Status | Meaning |
|---|---|
| `draft` | Created, not started |
| `scheduled` | Waiting for its send time |
| `running` | Sending |
| `paused` | Paused |
| `completed` | Finished |
| `failed` | Cancelled, or stopped because of an error |

## Large campaigns

Large campaigns are sent in consecutive batches. After each batch the campaign reschedules itself to continue automatically within a minute, and progress is saved after every message, so no contact gets the message twice. You do not need to keep the page open.

## Tracking results

Open the campaign to see total recipients, sent, failed, and the list of messages with the failure reason for each. You get an in-dashboard notification when the campaign completes.

## Plan limits

- Each plan has a maximum number of campaigns per month.
- Every campaign message counts towards the monthly message limit.

See [Plans and limits](/docs/getting-started/plans-limits).
