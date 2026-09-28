import { redirect } from "next/navigation";
import { stagingFullAccessEnabled } from "../../lib/platform/staging-access";
import { requireChatGPTUser } from "../chatgpt-auth";
import CheckoutForm from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: {
  searchParams: Promise<{ analysisId?: string | string[] }>;
}) {
  if (stagingFullAccessEnabled()) {
    const { analysisId } = await searchParams;
    const target = '/dashboard?view=report' + (typeof analysisId === 'string'
      ? '&analysisId=' + encodeURIComponent(analysisId) : '');
    await requireChatGPTUser(target);
    redirect(target);
  }
  return <CheckoutForm />;
}
