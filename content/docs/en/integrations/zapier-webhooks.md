---
title: "Zapier, Make and webhooks"
description: "Send WhatsApp messages from Zapier, Make or any automation tool, and receive webhook notifications from WABEK."
section: integrations
order: 4
slug: integrations/zapier-webhooks
---

# Zapier, Make and webhooks

## Send a message from any automation tool

The send endpoint for automation tools is:

```
POST https://waabek.com/api/webhooks/trigger
```

Request headers:

```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

Request body (`instance_id` is optional):

```json
{
  "to": "966500000000",
  "message": "Hello, we have received your order.",
  "instance_id": "3f1c2a7e-0000-4000-8000-000000000000"
}
```

> **Note:** This endpoint only accepts the key in the `X-API-Key` header. Details are in the [Trigger reference](/docs/api/trigger).

### Zapier

1. In Zapier, click **Create Zap** and choose the trigger app (for example Google Forms or Shopify).
2. Add a **Webhooks by Zapier** action and choose **POST**.
3. Configure the action:
   - **URL:** `https://waabek.com/api/webhooks/trigger`
   - **Payload Type:** `json`
   - **Data Pass-Through:** `No`
4. Under **Data**, add `to` (the customer phone field) and `message` (your message text).
5. Under **Headers**, add `X-API-Key` with your key as the value.
6. Test the step and turn the Zap on.

### Make (Integromat)

1. Create a scenario and add the trigger module.
2. Add an **HTTP → Make a request** module.
3. Set **URL** as above, **Method** `POST`, **Body type** `Raw`, **Content type** `JSON (application/json)`.
4. Add a header named `X-API-Key` with your key as its value.
5. In the body:

```json
{"to": "{{phone}}", "message": "{{message}}"}
```

## Receiving events (outgoing webhooks)

You can register an HTTPS URL of yours to receive a notification from WABEK when an event happens.

1. Open **Integrations**, then the **Webhooks** tab, and go to **Outgoing Webhooks**.
2. Enter the **Webhook URL** (it must be a public `https://` URL).
3. Choose the event, add an optional label, and save.

> **Warning:** Currently only the **`message_sent`** event is delivered, when a message is sent successfully through `POST /api/webhooks/trigger`. The other events in the list can be registered but are not delivered in this release.

The payload format and how to verify it are in the [outgoing webhooks reference](/docs/api/outgoing-webhooks).
