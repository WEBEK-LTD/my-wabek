---
title: "Team and roles"
description: "Invite teammates, set their roles, and restrict them to specific numbers."
section: guides
order: 9
slug: guides/team-roles
---

# Team and roles

Team members work inside your own account: they see its data and use its numbers according to their role, and they do not need a separate plan.

## Invite a member

1. Open **Team** and click invite.
2. Enter the name and email, and choose a role.
3. Click send. The member receives an invitation email, and you also see the invite link to copy and send manually if needed.
4. The member opens the link and sets a password; their status becomes **active**.

> **Note:** Invite links are valid for **7 days**. After that, invite the member again.

## Roles

| Role | Can do |
|---|---|
| **Admin** | Everything a member can do: all features, conversations and settings |
| **Agent** | View everything; reply in the inbox (text, media, assignments, notes), manage contacts and quick replies |
| **Viewer** | View only: conversations, contacts, campaigns and analytics. No changes |

You can change a member's role at any time from the menu next to their name.

## What is enforced

Roles are enforced by the server, not only hidden in the interface. A blocked change returns `403` with `code: "member_forbidden"`.

| Area | Admin | Agent | Viewer |
|---|---|---|---|
| Inbox: reply, send media, assign, notes | ✅ | ✅ | — |
| Contacts (create, edit, import, opt-out, block, delete) | ✅ | ✅ | — |
| Quick replies | ✅ | ✅ | — |
| Campaigns (create, start, pause, delete) | ✅ | — | — |
| Automations, chatbot flows, AI settings | ✅ | — | — |
| Segments, tracked links | ✅ | — | — |
| WhatsApp numbers (connect, edit, delete) | ✅ | — | — |
| White label, integrations, webhooks, Wix / WHMCS settings | ✅ | — | — |
| Viewing any of the above | ✅ | ✅ | ✅ |
| Own profile, password, devices, notifications | ✅ | ✅ | ✅ |

## Owner-only actions

These actions are available only to the account owner, whatever the member's role:

- Creating, viewing and revoking API keys.
- Managing sub-accounts.
- Reseller program and payout settings.

## Restricting access to numbers

If you have more than one number:

1. In **Team**, find the member's **Inbox Access** section.
2. Select the numbers they may access.

If you select none, the member can access **all** inboxes.

## Performance

**Team → Performance** shows how many messages each member has sent, so you can follow the workload.

## Removing a member

Delete the member from the list. They lose access to your account immediately.
