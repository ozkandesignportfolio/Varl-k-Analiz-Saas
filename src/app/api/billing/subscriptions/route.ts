import { NextResponse } from "next/server";
import {
  createBillingSubscription,
  type CreateBillingSubscriptionPayload,
} from "@/lib/services/billing-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateBillingSubscriptionPayload | null;

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const payload = await readBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const result = await createBillingSubscription(auth.supabase, {
      userId: auth.user.id,
      payload,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Abonelik istegi islenemedi." }, { status: 500 });
  }
}
