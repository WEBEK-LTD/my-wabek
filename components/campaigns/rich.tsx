import React from 'react'

/**
 * Render a translated string whose `{token}` placeholders are React nodes
 * (links, <code>, <strong>…), so sentences stay whole in every language:
 *
 *   rich(t('vars_help'), { c1: <code>{'{{name}}'}</code>, c2: <code>…</code> })
 *
 * Call t() *without* vars for such strings; unknown tokens are left as text.
 */
export function rich(text: string, nodes: Record<string, React.ReactNode>): React.ReactNode {
  const parts = text.split(/(\{\w+\})/g)
  return parts.map((p, i) => {
    const m = p.match(/^\{(\w+)\}$/)
    if (m && m[1] in nodes) return <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment>
    return <React.Fragment key={i}>{p}</React.Fragment>
  })
}
