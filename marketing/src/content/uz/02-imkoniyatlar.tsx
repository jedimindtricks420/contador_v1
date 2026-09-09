import { Hero } from "@/components/marketing/Hero";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  const closing = getTopicById("06");

  return (
    <div className="space-y-12">
      <Hero h1={topic.locales.uz.h1} lead="Imkoniyatlar hisob bilan ishlash bosqichlari bo‘yicha guruhlangan — ma’lumot tayyorlashdan hisobotlargacha." />

      <section aria-labelledby="h2-prep">
        <h2 id="h2-prep" className="text-xl font-semibold text-black">
          Ma’lumotlarni tayyorlash
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Ko‘chirmalarni import qilish va AI-tasnif — bu guruh sahifalari keyingi yangilanishlarda qo‘shiladi.
        </p>
      </section>

      <section aria-labelledby="h2-accounting">
        <h2 id="h2-accounting" className="text-xl font-semibold text-black">
          Hisob va tekshiruvlar
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {closing && (
            <a
              href={urlFor(closing, "uz")}
              className="block rounded border border-gray-200 p-4 hover:border-black transition-colors"
            >
              <p className="font-medium text-black">{closing.locales.uz.h1}</p>
              <p className="mt-1 text-sm text-gray-600">{closing.locales.uz.description}</p>
            </a>
          )}
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-400">
            O‘tkazmalar va operatsiyalar jurnali — tez orada
          </div>
        </div>
      </section>

      <section aria-labelledby="h2-reports">
        <h2 id="h2-reports" className="text-xl font-semibold text-black">
          Hisobotlar
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          Balans, foyda va zarar hisoboti, pul oqimi va aylanma-saldo qaydnomasi — bu guruh sahifalari keyingi
          yangilanishlarda qo‘shiladi.
        </p>
      </section>

      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
