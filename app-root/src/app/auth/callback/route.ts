import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bootstrapUserRecords } from '@/lib/auth/user-bootstrap'
import { createNotification } from '@/lib/notifications/notification-service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  console.log('AUTH_CALLBACK_START', { hasCode: !!code })

  if (!code) {
    console.log('AUTH_CALLBACK_NO_CODE')
    return NextResponse.redirect('/login')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.log('AUTH_CALLBACK_EXCHANGE_ERROR', { error: error?.message })
    return NextResponse.redirect('/login')
  }

  const user = data.user
  const session = data.session

  console.log('AUTH_CALLBACK_SESSION', {
    userId: user.id,
    emailConfirmed: !!user.email_confirmed_at,
    hasSession: !!session,
  })

  // If we have a session, bootstrap user records and redirect to dashboard
  if (session && user.email_confirmed_at) {
    console.log('AUTH_CALLBACK_BOOTSTRAP_START', { userId: user.id })
    console.log('NOTIFICATION_TRIGGERED', user.id)

    // Create welcome notification directly in callback (SERVICE ROLE)
    await createNotification({
      userId: user.id,
      title: "Hoş geldiniz",
      message: "Hesabınız başarıyla oluşturuldu.",
      type: "info"
    })

    // Bootstrap user records (profile, notification settings, welcome notification)
    const bootstrapResult = await bootstrapUserRecords({
      userId: user.id,
      email: user.email ?? '',
      acceptedTerms: true,
    })

    console.log('AUTH_CALLBACK_BOOTSTRAP_RESULT', {
      userId: user.id,
      ok: bootstrapResult.ok,
      created: bootstrapResult.ok ? bootstrapResult.created : false,
      error: !bootstrapResult.ok ? bootstrapResult.error : null,
    })

    // Redirect to dashboard after successful email confirmation
    console.log('AUTH_CALLBACK_REDIRECT', { to: '/dashboard', userId: user.id })
    return NextResponse.redirect('/dashboard')
  }

  // Email not confirmed - sign out and redirect to verify page
  if (!user.email_confirmed_at) {
    console.log('AUTH_CALLBACK_EMAIL_NOT_CONFIRMED', { userId: user.id })
    await supabase.auth.signOut()
    return NextResponse.redirect('/verify-email')
  }

  // Fallback - should not reach here
  console.log('AUTH_CALLBACK_FALLBACK_REDIRECT', { userId: user.id })
  return NextResponse.redirect('/login?verified=1')
}
