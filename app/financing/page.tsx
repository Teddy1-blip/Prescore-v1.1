import ReferralPage from "../ref/[code]/page";

export const metadata = {
  title: "Финансирование бизнеса — Прескор",
  description: "Оставьте контакт компании и запрос на финансирование. Представитель Прескор уточнит задачу и возможные варианты.",
};

export default function FinancingPage() {
  // The referral intake component uses the reserved owner code when no route code is present.
  return <ReferralPage />;
}
