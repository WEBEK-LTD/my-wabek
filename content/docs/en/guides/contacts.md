---
title: "Contacts, segments and import"
description: "Add contacts, import them from a CSV file, organize them with tags, and build segments."
section: guides
order: 2
slug: guides/contacts
---

# Contacts, segments and import

## Add a contact

1. Open **Contacts** and click **Add Contact**.
2. Enter the phone number in international format (for example `966500000000`), and optionally a name, email and tags.
3. Save.

> **Note:** The same number cannot appear twice in an account. If the number already exists you see "Contact with this phone already exists".

Contacts are also created automatically when new messages arrive, or through the [API](/docs/api/create-contact).

## Import from CSV

1. Prepare a CSV file with a header row containing these columns:

| Column | Required | Notes |
|---|---|---|
| `phone` | Yes | Non-digit characters are removed automatically |
| `name` | No | Up to 200 characters |
| `email` | No | |
| `tags` | No | Separate tags with a semicolon `;` |

```csv
phone,name,email,tags
966500000001,سارة,sara@example.com,vip;riyadh
971500000002,Omar,,new
```

2. In **Contacts**, click **Import CSV** and choose the file.
3. A message shows how many records were imported.

| Limit | Value |
|---|---|
| Maximum file size | 5 MB |
| Maximum rows per file | 20,000 |
| Rows without `phone` | Skipped |

> **Warning:** If a number already exists, the import **updates** its record with the file's values. Empty columns in the file may clear current values (such as name and tags). Review your file before importing.

## Export

Click **Export CSV** on the **Contacts** page to download the listed contacts.

## Tags

Tags are the main way to target campaigns. Add them when creating a contact or on its page, in the `tags` column when importing, or with the **Add Tag** node in the [chatbot](/docs/guides/chatbot).

> **Note:** Tags are case-sensitive. Use one consistent spelling (for example always `vip`, never `VIP` sometimes).

## Segments

A segment is a saved set of conditions that updates automatically.

1. Open **Segments** and click **New Segment**.
2. Add one or more conditions:

| Field | Operator | Example |
|---|---|---|
| Has Tag | contains | `vip` |
| Name | contains | `Ahmed` |
| Phone | starts with | `966` |
| Opted Out | is | Yes / No |
| Is Blocked | is | Yes / No |

3. Click **Preview** to see how many contacts match, then save.

## Special states

| State | Effect |
|---|---|
| **Blocked** | Sends to this contact from the inbox, campaigns, API and integrations are refused. |
| **Opted out** | The customer unsubscribed; sends are refused the same way. See [Consent and opt-out](/docs/security/consent-opt-out). |
| **AI Off** | The AI assistant does not reply to this contact, but you can reply manually. |
