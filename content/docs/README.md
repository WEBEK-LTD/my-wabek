# WABEK documentation content

This folder holds the source content for the public documentation at `/docs`. It is content only: the rendering pages are built separately and read these files.

```
content/docs/
├── manifest.json          # Sidebar order: sections → pages, with Arabic and English titles
├── ar/                    # Arabic (primary language, Modern Standard Arabic)
│   ├── getting-started/
│   ├── guides/
│   ├── integrations/
│   ├── api/
│   ├── security/
│   ├── faq/
│   └── changelog/
└── en/                    # English, same structure and file names as ar/
```

## Page format

Each page is one Markdown file with YAML front matter:

```markdown
---
title: "إرسال رسالة"
description: "POST /api/v1/send — one sentence used for SEO and page summaries."
section: api
order: 4
slug: api/send-message
---

# إرسال رسالة

...
```

| Field | Rules |
|---|---|
| `title` | Page title in the file's language. Quoted string. |
| `description` | One sentence. Quoted string. |
| `section` | Section id; must equal the folder name. |
| `order` | Position inside the section (integer, starting at 1). Same value in `ar` and `en`. |
| `slug` | `<section>/<file name without .md>`. Same value in `ar` and `en`. The page URL is `/docs/<slug>` (the renderer adds the language). |

The page body starts with a single `#` heading that matches `title`.

## Conventions

- **Links between pages** use `/docs/<slug>`, for example `[المصادقة](/docs/api/authentication)`. The renderer resolves them to the reader's current language. Do not link to `.md` files.
- **Callouts** are blockquotes that start with a bold label:
  - Arabic: `> **ملاحظة:** …` and `> **تحذير:** …`
  - English: `> **Note:** …` and `> **Warning:** …`
- **Code samples** (`bash`, `javascript`, `php`, `python`, `json`, `csv` blocks) must be byte-for-byte identical in `ar` and `en`. Keep comments and sample strings in English inside code. Untagged blocks (diagrams, example message texts, URLs) may be localized.
- **Tables** for parameters: `Field | Type | Required | Description`.
- **Endpoint pages** follow the same order: method and path, headers, request body, behavior, response, errors, then curl / JavaScript (fetch) / PHP / Python examples.
- **Numbers and prices:** never write plan prices or plan limit values; say "depends on your plan" (`حسب باقتك`). Only document limits that are fixed in code (for example the 100 requests/minute API limit).
- **Base URL:** `https://waabek.com`.
- **Unverified UI labels:** for the WordPress plugin and WHMCS addon, setting names that still need to be checked against the released plugin are marked with `<!-- verify against plugin -->` at the end of the line. Remove the comment once verified. Renderers must strip HTML comments.
- **Source of truth is the code**, not the old `pages/dashboard/docs.tsx`. When behavior changes in `pages/api/**` or `lib/**`, update the matching page in both languages.

## Adding a page

1. Create `ar/<section>/<name>.md` and `en/<section>/<name>.md` with matching `section`, `order` and `slug`.
2. Add the page to `manifest.json` under its section, with `slug`, `title_ar`, `title_en`, `file_ar` and `file_en`.
3. Check that every `/docs/...` link points to an existing slug.

## manifest.json

```json
{
  "version": 1,
  "base_path": "/docs",
  "languages": ["ar", "en"],
  "default_language": "ar",
  "sections": [
    {
      "id": "getting-started",
      "order": 1,
      "title_ar": "البدء",
      "title_en": "Getting started",
      "pages": [
        {
          "slug": "getting-started/overview",
          "title_ar": "نظرة عامة",
          "title_en": "Overview",
          "file_ar": "ar/getting-started/overview.md",
          "file_en": "en/getting-started/overview.md"
        }
      ]
    }
  ]
}
```

Sections and pages are listed in display order. `title_ar` / `title_en` in the manifest must match each page's front-matter `title`.

## Right-to-left

Arabic pages are rendered right-to-left (`dir="rtl"`, `lang="ar"`). Code blocks and inline code should stay left-to-right (`dir="ltr"`) inside RTL pages.
