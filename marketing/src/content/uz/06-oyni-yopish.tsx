import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

// Real 7 real steps, translated from v2/src/app/closing/ClosingWizard.tsx:154-176
// terminology per TASK-0003 §4 glossary (oyni yopish, buxgalteriya o‘tkazmasi, ...).
const STEPS = [
  { num: 1, title: "Ko‘chirmani import qilish", desc: "Import qilingan tranzaksiyalarni tekshirish." },
  { num: 2, title: "Toifalarni aniqlashtirish", desc: "Aniqlanmagan operatsiyalarni tasniflash." },
  { num: 3, title: "Reyestrni tekshirish", desc: "Taqsimlanmagan to‘lovlarni nazorat qilish." },
  { num: 4, title: "Davr chegirmalari", desc: "Ish haqi fondi, amortizatsiya, ijara." },
  { num: 5, title: "Kurs farqlari", desc: "Valyuta hisobvaraqlarini qayta baholash." },
  { num: 6, title: "Soliq bilan solishtirish", desc: "ЭСФ va avanslarni solishtirish." },
  { num: 7, title: "Yakunlash", desc: "Bloklash va soliqlarni hisoblash." },
];

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Oyni yopish ustasi davrni belgilangan bosqichlar bo‘yicha o‘tkazadi — ko‘chirma importidan yakunlash va operatsiyalarni bloklashgacha."
      />

      <section aria-labelledby="h2-stages">
        <h2 id="h2-stages" className="text-xl font-semibold text-black">
          Davrni yopish bosqichlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Boshlash uchun davr uchun import qilingan va o‘tkazmalarga taqsimlangan bank operatsiyalari kerak. Usta
          odatda yettita bosqichdan iborat; tashkilotda elektron hisob-fakturalar bo‘lsa, Soliq bilan solishtirish
          va yakunlash orasida ЭСФни tasdiqlash bosqichi qo‘shiladi.
        </p>
        <div className="mt-4">
          <FeatureSteps steps={STEPS} />
        </div>
      </section>

      <ProductScreenshot alt="Oyni yopish ustasi: bosqichlar holati ko‘rsatilgan yon navigatsiya" />

      <section aria-labelledby="h2-pending">
        <h2 id="h2-pending" className="text-xl font-semibold text-black">
          Tugallanmagan operatsiyalar
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Har bir bosqich o‘z holati va keyingi bosqichga o‘tishga xalaqit beruvchi sababni ko‘rsatadi — masalan,
          «Toifalarni aniqlashtirish» bosqichi davrda toifasi tasdiqlanmagan operatsiyalar bo‘lguncha
          tugallanmagan bo‘lib qoladi.
        </p>
      </section>

      <section aria-labelledby="h2-final-check">
        <h2 id="h2-final-check" className="text-xl font-semibold text-black">
          Yakunlashdan oldingi tekshiruv
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          «Soliq bilan solishtirish» bosqichi hisob-fakturalar va avanslar ma’lumotlarini solishtiradi, lekin
          farqlarni avtomatik bartaraf etmaydi — bu foydalanuvchi zimmasida qoladi. Yakunlash davr operatsiyalarini
          o‘zgartirishdan bloklaydi va oy uchun hisobotlarni mavjud qiladi.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Ustadan oldin mustaqil ravishda bepul oyni yopish tekshiruv ro‘yxati bilan tekshirib olishingiz mumkin —
          u ustaga bog‘liq emas va ro‘yxatdan o‘tmasdan mavjud.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
