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
- Contacts organized by tags or a [segment](/docs/guides/contacts) if you want to target a specific group.

## Create a campaign

1. Open **Campaigns** and click **New Campaign**.
2. Enter a **campaign name** and choose the sending **number**.
3. Write the message, start from a ready-made sample, or use the AI message generator.
4. For Cloud API numbers, choose the **approved template** from the list (each entry shows its language) and fill in its variables.
5. Set the **audience**: all contacts, a **segment**, or one or more comma-separated tags.
6. Set the **delay between messages** in seconds (1 to 60, default 3).
7. Pick a send time (in your browser's local time), or leave it empty to start manually.
8. Review the summary and create the campaign.

> **Note:** Blocked and opted-out contacts are always excluded, whatever audience you choose.

### Segments

When you pick a segment, the campaign targets the contacts matching the segment's rules (all rules, or any rule if the segment uses **OR**). The rules are copied into the campaign when it is created, so editing or deleting the segment later does not change who a scheduled campaign is sent to. The count is evaluated again when sending starts, so new contacts that match are included.

## Variables

### WhatsApp Web numbers

Your message is sent as text, with variables replaced:

| Variable | Value |
|---|---|
| `{{name}}` or `{name}` | The contact's name (or number if there is no name) |
| `{{phone}}` or `{phone}` | The contact's number |
| `{{any_key}}` or `{any_key}` | Any custom field in the contact's variables |

`{{…}}` variables with no value are removed from the text.

### Cloud API numbers

The campaign is **always sent as the template**, regardless of the 24-hour window. The customer receives the approved template's text with its variables filled in per contact.

**Template variables.** After choosing a template, one field appears per variable in its body — `{{1}}`, `{{2}}` … for positional templates, or the parameter names (for example `{{customer_name}}`) for named ones. Each field can contain fixed text and the per-contact placeholders `{name}`, `{phone}` or any contact variable such as `{city}`. The first field defaults to `{name}`.

**Template language.** The language shown next to the template (for example `ar` or `en_US`) is saved with the campaign and used exactly. Campaigns created without a saved language try `ar`, then `en`, then `en_US`.

> **Warning:** Fill in every variable of the template: Meta rejects a template sent with a different number of parameters, and the message counts as failed. If you choose no template, WABEK uses the default marketing template `marketing_offer` (with `customer_name` and your message as `offer_details`), which may not exist on your account.

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

Open the campaign to see total recipients, sent, failed, and the list of messages with the failure reason for each. You get an in-dashboard notification when the campaign completes, and the `campaign_completed` [outgoing webhook](/docs/api/outgoing-webhooks) fires.

## Creating campaigns through the API

`POST /api/campaigns` (dashboard session) accepts `segment_id` (or `contact_filter: {"segment_id": "..."}` / `{"tags": [...]}`), `template_name`, `template_language`, `template_variables` (array of values) and, for named-parameter templates, `template_param_names` (array of names in the same order). `scheduled_at` is an ISO 8601 date-time with an offset (`2026-11-20T06:00:00.000Z`); a value without an offset (`2026-11-20T09:00`) is read in the time zone of your profile, or UTC.

## Plan limits

- Each plan has a maximum number of campaigns per month.
- Every campaign message counts towards the monthly message limit.

See [Plans and limits](/docs/getting-started/plans-limits).
