import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  console.log("CALLBACK_RUNNING")

  const baseUrl = new URL(req.url).origin
  const url = new URL(req.url)
  const code = url.searchParams.get("code")

  if (!code) {
    console.log("CALLBACK_ERROR", { error: "missing_code" })
    return Response.redirect(`${baseUrl}/verify-email?error=missing_code`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.user) {
    console.log("CALLBACK_ERROR", { error: error?.message || "invalid" })
    return Response.redirect(`${baseUrl}/verify-email?error=invalid`)
  }

  console.log("USER_ID", data.user.id)

  const { data: insertData, error: insertError } = await supabase
    .from("notifications")
    .insert({
      user_id: data.user.id,
      title: "Hoş geldiniz",
      message: "Bildirim sistemi aktif",
      type: "Sistem",
      is_read: false
    })
    .select("id")
    .single()

  console.log("INSERT_RESULT", { insertData, insertError })

  return Response.redirect(`${baseUrl}/dashboard`)
}
