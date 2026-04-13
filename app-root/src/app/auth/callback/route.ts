import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code!)

  console.log("CALLBACK_RUNNING")

  if (data?.user) {
    console.log("USER_ID", data.user.id)

    const { error: insertError } = await supabase
      .from("notifications")
      .insert({
        user_id: data.user.id,
        title: "Hoş geldiniz",
        message: "Bildirim sistemi aktif",
        type: "info",
        is_read: false
      })

    console.log("INSERT_RESULT", insertError)
  }

  return Response.redirect("http://localhost:3000/dashboard")
}
