import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'POST') {
    const { instance_id, to, catalog_id, product_ids, header_text, body_text, footer_text } = req.body

    if (!instance_id || !to) return res.status(400).json({ error: 'instance_id and to required' })

    const { data: instance } = await db.from('whatsapp_instances')
      .select('type, phone_number_id, access_token')
      .eq('id', instance_id).eq('user_id', user.userId).eq('type', 'cloud_api').single()

    if (!instance) return res.status(404).json({ error: 'Cloud API instance not found (catalog requires Cloud API)' })

    // Send interactive catalog message via Meta API
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: header_text || 'Our Products' },
        body: { text: body_text || 'Check out our latest products' },
        footer: { text: footer_text || '' },
        action: {
          catalog_id,
          sections: [{
            title: 'Products',
            product_items: (product_ids || []).map((id: string) => ({ product_retailer_id: id }))
          }]
        }
      }
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${instance.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instance.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!response.ok) return res.status(400).json({ error: data.error?.message || 'Meta API error' })

    return res.status(200).json({ success: true, message_id: data.messages?.[0]?.id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
