import { Hero } from "@/components/marketing/Hero";
import { ProductScreenshot } from "@/components/marketing/ProductScreenshot";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Фаза 3: o‘tkazmalar jurnali (tema 11) qurildi — quyidagi matn uni endi
// "ishlab chiqilmoqda" deb ta’riflamaydi (fazadagi holat fazaga mos yangilandi).
export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  const journalTopic = getTopicById("11");
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="O‘tkazma hujjat asosida avtomatik shakllanadi — siz hujjat bilan ishlaysiz, Contador uni hisobvaraqlar bo‘yicha taqsimlaydi."
      />

      <section aria-labelledby="h2-flow">
        <h2 id="h2-flow" className="text-xl font-semibold text-black">
          Operatsiyadan o‘tkazmagacha
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Kabinetning hujjatlar bo‘limida operatsiyalar ma’lum turdagi hujjat sifatida aks etadi — masalan, bank
          tushumi yoki chiqimi. Har bir hujjat turi uchun tayyor o‘tkazma shabloni bor: debet va kreditni noldan
          qo‘lda kiritish shart emas, Contador o‘tkazmani hujjat asosida avtomatik shakllantiradi. Hujjatlar
          ro‘yxatini davr (oy, yil) va hujjat turi bo‘yicha filtrlash mumkin.
        </p>
      </section>

      <ProductScreenshot alt="Davr va tur bo‘yicha filtrlanadigan hujjatlar ro‘yxati, holat ustuni" />

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Debet va kreditni tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Har bir hujjat holat oladi: «Proveden» — hujjat o‘tkazmalarga taqsimlangan va hisobotlarda hisobga
          olingan; «Annulirovan» — hujjat bekor qilingan va o‘tkazmalarda ishtirok etmaydi. Bular hujjatlar
          ro‘yxatida ko‘rinadigan haqiqiy holatlar. Ikki tomonlama yozuv o‘tkazma shabloni ichida nazorat qilinadi:
          hujjat provodka qilinishidan oldin debet va kredit summalari mos kelishi kerak.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Demo ma’lumotlar asosidagi misol: xaridordan bank hisobvarag‘iga tushgan pul mablag‘lari pul mablag‘lari
          hisobi va xaridorlar bilan hisob-kitob hisobi bo‘yicha aks etadi; aniq hisobvaraq kodlari hujjat turi va
          tashkilotning hisobvaraqlar rejasi sozlamalariga bog‘liq.
        </p>
      </section>

      <section aria-labelledby="h2-journal">
        <h2 id="h2-journal" className="text-xl font-semibold text-black">
          Jurnalda ko‘rish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O‘tkazmalarni ularni yaratgan hujjatlar bilan birga — davr va tur bo‘yicha filtrlanadigan hujjatlar
          ro‘yxatida ko‘rish mumkin. Barcha o‘tkazmalarni hujjat turidan qat’i nazar bitta joyda ko‘rish uchun
          alohida o‘tkazmalar jurnali bor.
        </p>
        {journalTopic && (
          <a
            href={urlFor(journalTopic, "uz")}
            className="mt-3 inline-block rounded border border-gray-200 p-4 font-medium text-black hover:border-black transition-colors"
          >
            {journalTopic.locales.uz.h1}
          </a>
        )}
        <p className="mt-3 text-sm text-gray-600">
          Contador tizimda allaqachon hujjat turi va shabloni mavjud bo‘lgan operatsiyalar uchun o‘tkazmalarni
          qo‘llab-quvvatlaydi — bu istalgan xo‘jalik operatsiyasi uchun universal o‘tkazma muharriri emas.
        </p>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
