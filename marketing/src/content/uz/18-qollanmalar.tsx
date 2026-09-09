import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// hub turi, bloklar tartibi — TASK-0003 §6. 02/26 xablaridan farqli o‘laroq
// (ular bolalarini fazalar bo‘yicha kutishga majbur bo‘lgan), 18-xab darhol
// to‘liq nashr etiladi: barcha 7 qo‘llanma (19,20,22,23,24,25,30) shu 4-fazada
// qurilgan.
function Card({ topic, locale }: { topic: Topic; locale: "uz" }) {
  return (
    <a
      href={urlFor(topic, locale)}
      className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
    >
      <p className="font-medium text-black">{topic.locales[locale].h1}</p>
      <p className="mt-1 text-sm text-gray-600">{topic.locales[locale].description}</p>
    </a>
  );
}

export default function Body({ topic }: { topic: Topic }) {
  const prepStatement = getTopicById("19");
  const openingBalance = getTopicById("24");
  const chooseProgram = getTopicById("25");
  const fromExcel = getTopicById("30");
  const checkAi = getTopicById("20");
  const checklist = getTopicById("21");
  const profitCash = getTopicById("22");
  const readOsv = getTopicById("23");
  const regimeChoice = getTopicById("36");
  const latePenalty = getTopicById("37");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Hisob uchun ma’lumot tayyorlaydigan, AI-tasnif natijasini tekshiradigan va Contador hisobotlarini tushunmoqchi bo‘lganlar uchun amaliy qo‘llanmalar."
      />
      <p className="text-xs text-gray-500">Yangilangan: 2026-yil 9-sentabr</p>

      <section aria-labelledby="h2-start">
        <h2 id="h2-start" className="text-xl font-semibold text-black">
          Ishni boshlash
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {prepStatement && <Card topic={prepStatement} locale="uz" />}
          {openingBalance && <Card topic={openingBalance} locale="uz" />}
          {chooseProgram && <Card topic={chooseProgram} locale="uz" />}
          {fromExcel && <Card topic={fromExcel} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-checks">
        <h2 id="h2-checks" className="text-xl font-semibold text-black">
          Tekshiruvlar va yopish
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {checkAi && <Card topic={checkAi} locale="uz" />}
          {checklist && <Card topic={checklist} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlarni tushunish
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profitCash && <Card topic={profitCash} locale="uz" />}
          {readOsv && <Card topic={readOsv} locale="uz" />}
        </div>
      </section>

      <section aria-labelledby="h2-taxes">
        <h2 id="h2-taxes" className="text-xl font-semibold text-black">
          Soliqlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {regimeChoice && <Card topic={regimeChoice} locale="uz" />}
          {latePenalty && <Card topic={latePenalty} locale="uz" />}
        </div>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
