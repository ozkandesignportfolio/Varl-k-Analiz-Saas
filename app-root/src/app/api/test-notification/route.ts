import "server-only";

import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Not logged in', { status: 401 })
  }

  await supabase.from('automation_events').insert({
    user_id: user.id,
    asset_id: null,
    rule_id: null,
    service_log_id: null,
    trigger_type: 'manual_test',
    actions: [],
    payload: {
      title: 'Test bildirimi',
      message: 'Bu bir test bildirimidir',
      type: 'test',
      is_test_notification: true
    },
    dedupe_key: `test-notification:${user.id}:${randomUUID()}`,
    run_after: new Date().toISOString()
  })

  return new Response('OK')
}
