---
title: "Chatbot"
description: "Build an automated conversation flow with drag and drop: questions, buttons, conditions, tags and assignment."
section: guides
order: 4
slug: guides/chatbot
---

# Chatbot

The chatbot builder lets you draw a conversation flow from connected nodes. When a customer matches the flow's trigger, the chatbot walks them through it node by node.

> **Note:** This feature requires a plan that includes **Chatbot**, and the number of flows depends on your plan.

## Create a flow

1. Open **Chatbot** and create a new flow.
2. Enter a flow name.
3. Choose the **trigger**:

| Trigger | When the flow starts |
|---|---|
| 🔑 Keyword | When the customer's message contains one of the keywords (comma-separated, case-insensitive) |
| 💬 Any Message | On any message that does not match a keyword flow |
| 👋 First Message | Only the contact's first ever message to that number (later messages do not start it) |

4. Choose the **number**, or leave **All instances** to run the flow on all your numbers.
5. Add nodes, connect them, then save and activate the flow.

> **Note:** If more than one flow matches, keyword flows take priority over Any Message flows.

## Node types

| Node | What it does |
|---|---|
| **Start** | The entry point. |
| **Send Message** | Sends text, then moves straight to the next node. |
| **Ask Question** | Sends a question, waits for the customer's reply, and saves it in a variable. |
| **Quick Replies** | Shows options and waits for the customer's choice. |
| **Condition** | Branches on a variable's value: `equals`, `contains`, `starts with`, `is not empty`. Connect both the `true` and `false` branches. |
| **Delay** | Waits a number of seconds (up to 10 seconds per node). |
| **Add Tag** | Adds one or more tags to the contact. |
| **Assign** | Assigns the conversation to a teammate. |
| **End Flow** | Ends the session. |

## Execution limits

To protect your number from endless loops:

- At most 25 nodes run per inbound message, and the same node never runs twice in one run.
- Total delay in one run does not exceed 15 seconds.

## Testing

Use the test tool on the page to simulate customer messages and see the flow's path before activating it.

## Order with other features

When a new message arrives:

1. Matching [automation](/docs/guides/automation) rules run.
2. The chatbot handles the message if there is an active session or a matching flow.
3. If the chatbot does not reply, the [AI assistant](/docs/guides/ai-assistant) replies, if enabled.

> **Warning:** On Cloud API numbers the chatbot sends free text, which is allowed because the customer just messaged you (inside the 24-hour window). Do not design flows that wait days for an answer and then send free text.
