import { Hero } from "@/components/marketing/Hero";
import { FeatureSteps } from "@/components/marketing/FeatureSteps";
import { FAQ } from "@/components/marketing/FAQ";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const faq = topic.locales.uz.faq;
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Bank ko‘chirmalarini yuklang, operatsiyalarni tekshiring va bitta servisda buxgalteriya hisobotlarini oling."
      >
        <div className="mt-6">
          <CTA topicId={topic.id} locale="uz" location="hero" />
        </div>
      </Hero>

      <section aria-labelledby="h2-flow">
        <h2 id="h2-flow" className="text-xl font-semibold text-black">
          Ko‘chirmadan hisobotgacha
        </h2>
        <div className="mt-4">
          <FeatureSteps
            steps={[
              { num: 1, title: "Import", desc: "Qo‘llab-quvvatlanadigan formatdagi bank ko‘chirmasini yuklang." },
              { num: 2, title: "Tekshirish", desc: "Tavsiya etilgan operatsiya toifalarini tekshiring, noaniqlarini aniqlashtiring." },
              { num: 3, title: "Hisobot", desc: "Hisob ma’lumotlari asosida balans, foyda-zarar yoki boshqa hisobotni shakllantiring." },
            ]}
          />
        </div>
      </section>


      <section aria-labelledby="h2-features">
        <h2 id="h2-features" className="text-xl font-semibold text-black">
          Ishingiz uchun imkoniyatlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Ko‘chirmalarni import qilish</p>
            <p className="mt-1 text-sm text-gray-600">Excel va 1CClientBankExchange, takroriy importni tekshirish bilan.</p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">O‘tkazmalar va oyni yopish</p>
            <p className="mt-1 text-sm text-gray-600">Tekshirilgan o‘tkazma shablonlari va davrni yopish uchun bosqichma-bosqich usta.</p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Hisobotlar</p>
            <p className="mt-1 text-sm text-gray-600">Balans, foyda va zarar hisoboti, pul oqimi, aylanma-saldo qaydnomasi.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-start">
        <h2 id="h2-start" className="text-xl font-semibold text-black">
          Ishni qanday boshlash mumkin
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Qo‘llab-quvvatlanadigan formatdagi bank ko‘chirmalari va hisobni boshlash sanasidagi boshlang‘ich
          qoldiqlar kerak bo‘ladi. Shaxsiy kabinet interfeysi hozircha rus tilida.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Buxgalter uchun</p>
            <p className="mt-1 text-sm text-gray-600">
              Ko‘chirmalarni import qilish, tasnif va o‘tkazmalarni tekshirish, davr uchun hisobotlarni tayyorlash.
            </p>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <p className="font-medium text-black">Rahbar uchun</p>
            <p className="mt-1 text-sm text-gray-600">
              Biznes natijalarini tushunish uchun foyda, pul harakati va buxgalteriya hisobotlari.
            </p>
          </div>
        </div>
      </section>

      <FAQ items={faq} locale="uz" />
      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" withLogin />
    </div>
  );
}
