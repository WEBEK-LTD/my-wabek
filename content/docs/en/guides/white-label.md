---
title: "White label"
description: "Brand the dashboard with your own name, logo, colors and domain."
section: guides
order: 11
slug: guides/white-label
---

# White label

White label lets you offer the dashboard to your clients under your business name and visual identity, on your own domain.

> **Note:** This feature requires a plan that includes **White Label**.

## Brand identity

Open **White Label** and fill in **Brand Identity**:

| Field | Description |
|---|---|
| Brand Name | The name shown instead of WABEK |
| Logo URL | An `https://` link to your logo |
| Primary Color | Main color for buttons and accents |
| Background Color | Background color |
| Favicon URL | An `https://` link to the browser icon |

## Custom domain

1. Enter the domain in **Custom Domain**, for example `app.example.com`.
2. At your domain provider, add a DNS record:
   - Type: `CNAME`
   - Name: the subdomain (for example `app`)
   - Value: the value shown on the **White Label** page
3. Save, then click **Check** to verify DNS.

| Result | Meaning |
|---|---|
| ✅ | The record is correct. The domain goes live once propagation completes |
| ⏳ | The record has not propagated yet; this can take up to 48 hours |
| ❌ | Domain not found; check the spelling and DNS settings |

> **Warning:** On Cloudflare, set the record to **DNS only** (grey cloud), not **Proxied**, or the SSL certificate cannot be issued.

A domain already used by another account cannot be used.

## Support

Enter **Support Email** and **Support WhatsApp** so your clients see them instead of WABEK's support details.

## Advanced options

| Option | Description |
|---|---|
| Hide "Powered by WABEK" | Removes the WABEK mention from the footer |
| Custom CSS | Extra CSS rules to customize the look |
| Custom Footer Text | Footer text |

## The API on your domain

Once the domain is live, your clients can send API requests to your domain instead of `https://waabek.com`. Confirm the address on the **API Keys** page.
