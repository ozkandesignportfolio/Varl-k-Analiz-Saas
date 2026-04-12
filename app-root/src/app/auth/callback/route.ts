import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect('/login')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect('/login')
  }

  const user = data.user

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut()
    return NextResponse.redirect('/verify-email')
  }

  return NextResponse.redirect('/dashboard')
}
