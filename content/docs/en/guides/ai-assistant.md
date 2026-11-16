---
title: "AI assistant"
description: "Turn on AI auto-replies per number, write instructions, and hand conversations over to a human."
section: guides
order: 6
slug: guides/ai-assistant
---

# AI assistant

The **AI Auto-Reply** page turns on an assistant that replies to customers automatically, based on your instructions and the conversation history.

> **Note:** The number of monthly AI replies depends on your plan. If your plan includes no replies (value 0), the assistant does not run.

## Turning it on

1. Open **AI Auto-Reply**.
2. Choose the number under **Select Instance**. Settings are separate for each number.
3. Enable the assistant and fill in the settings:

| Setting | Description |
|---|---|
| Company / Brand Name | Your business name, used in the default instructions |
| System Prompt | The instructions the assistant follows: who you are, what it answers, what it declines |
| Max Reply Length (tokens) | Maximum reply length |
| Temperature (0–1) | Lower values give more consistent replies, higher values more varied ones |
| Escalation Keywords | Words that stop the assistant and notify you (default: `agent,human,انسان,موظف,بشري`) |

4. Save.

If you write no instructions, the assistant acts as a polite general support assistant and replies in the customer's language.

## Writing good instructions

```
You are a customer service assistant for "Example Store". Reply briefly, in the customer's language.
Opening hours: Sunday to Thursday, 9 am to 5 pm.
Do not promise prices or discounts. If asked about a specific order, ask for the order number
and tell the customer that a member of staff will follow up.
```

## Handing over to a human

When the customer types one of the escalation keywords:

1. The assistant stops replying to that customer (the contact shows an **AI Off** badge).
2. You get a "Customer requested human agent" notification linking to the inbox.

To turn the assistant back on for that customer, open the contact's page and click **Enable AI**. The same button lets you switch the assistant off for a specific customer manually.

## Testing

Use **Test AI Response** to type a sample question and see the reply before going live.

## When does the assistant reply?

The assistant replies only if the [chatbot](/docs/guides/chatbot) did not handle the message. On Cloud API numbers it replies inside the 24-hour window because the customer just messaged you.

> **Warning:** The assistant generates replies automatically and can make mistakes. Review conversations regularly, and never put confidential information in its instructions.
