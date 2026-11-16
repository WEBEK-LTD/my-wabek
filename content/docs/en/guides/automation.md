---
title: "Automation"
description: "Set up simple automatic replies by keyword or for every inbound message, with protection against reply loops."
section: guides
order: 5
slug: guides/automation
---

# Automation

The **Flows** page is for simple automatic replies: "if a message containing X arrives, send Y". For multi-step conversations, use the [chatbot](/docs/guides/chatbot).

> **Note:** This feature requires a plan that includes **Automation**.

## Create a rule

1. Open **Flows** and click create.
2. Enter a **rule name** and choose the **number**.
3. Choose the **trigger**:

| Trigger | When it runs |
|---|---|
| Keyword Match | When the message contains one of the keywords (for example `hello, hi, start, help`) |
| Any Message Received | On every inbound message |
| Opt-in | Runs when a contact subscribes again: the `START` / `اشتراك` keyword, **Re-subscribe** on the contact page, or `opted_out: false` sent through the API or a plugin. It does not run on other messages |

4. Write the **auto-reply message**.
5. Save. You can turn the rule on or off at any time with the toggle next to it.

Each row shows how many times the rule has run.

## Rule steps

Internally a rule is made of steps (up to 50): send a message, delay, condition, tag contact, or end. The dashboard creates a single send step by default.

## Loop protection

If your number exchanges messages with another auto-responder, each could reply to the other forever. Therefore:

- Automations send at most **5 replies** to the same contact within **10 minutes**.
- Total delay in one run does not exceed 15 seconds.

## Tips

- Make keywords specific. A short keyword like `hi` matches any message containing those two letters in a row.
- Avoid enabling **Any Message Received** alongside a chatbot with the same trigger, so customers do not get two replies.
