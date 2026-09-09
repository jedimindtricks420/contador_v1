import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import type { Topic } from "@/lib/manifest";

export default function Body({ topic }: { topic: Topic }) {
  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="Aylanma solig’i va QQS turlicha mantiqqa ega: biri belgilangan diapazondagi qat’iy stavka bo’yicha tushumdan, ikkinchisi esa qo’shilgan qiymatdan kirish solig’ini chegirish imkoniyati bilan hisoblanadi. Material tanlov mezonlarini umumiy ko’rib chiqadi, buxgalter maslahatini almashtirmaydi."
      />

      <nav aria-label="Mundarija" className="text-sm">
        <p className="font-medium text-black">Mundarija</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
          <li><a href="#h2-criteria" className="underline hover:text-black">Asosiy tanlov mezonlari</a></li>
          <li><a href="#h2-scope" className="underline hover:text-black">Aylanma va rejim cheklovlari</a></li>
          <li><a href="#h2-specialist" className="underline hover:text-black">Qachon mutaxassisga murojaat qilish</a></li>
        </ul>
      </nav>

      <section aria-labelledby="h2-criteria">
        <h2 id="h2-criteria" className="text-xl font-semibold text-black">
          Asosiy tanlov mezonlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O’zbekiston Soliq kodeksiga ko’ra (461-modda), soliq davri uchun jami daromadi bir milliard so’mdan
          oshmaydigan yuridik shaxslar, shuningdek shu chegaradagi daromadga ega yakka tartibdagi
          tadbirkorlar/o’zini o’zi band qilgan shaxslar aylanma solig’i to’lovchisi hisoblanadi. Aylanma solig’i
          stavkasini tashkilotning o’zi belgilangan diapazonda — odatda 1–4% — tanlaydi. QQS boshqacha hisoblanadi:
          qo’shilgan qiymatning 12% miqdorida, olingan tovar va xizmatlar bo’yicha kirish solig’ini chegirish
          imkoniyati bilan.
        </p>
      </section>

      <section aria-labelledby="h2-scope">
        <h2 id="h2-scope" className="text-xl font-semibold text-black">
          Aylanma va rejim cheklovlari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Daromad chegaradan past bo’lsa ham, aylanma solig’i har qanday faoliyat turiga tegishli emas. Soliq
          kodeksining 461-moddasiga ko’ra, aylanma solig’i to’lovchilaridan, masalan, quyidagilar chiqarib
          tashlangan: tovar import qiluvchi tashkilotlar; aksiz tovarlari ishlab chiqaruvchilar va foydali
          qazilmalar qazib oluvchilar; benzin, dizel yoqilg’isi va gaz sotuvchilar. Bu to’liq ro’yxat emas —
          kodeks moddasida boshqa istisnolar ham bor, shuning uchun rejimning o’z faoliyatingizga
          qo’llanilishiga shubha bo’lsa, kodeksning amaldagi tahririni tekshiring yoki maslahat oling.
        </p>
      </section>

      <section aria-labelledby="h2-specialist">
        <h2 id="h2-specialist" className="text-xl font-semibold text-black">
          Qachon mutaxassisga murojaat qilish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Bu material mezonlarning umumiy ta’lim sharhi, huquqiy yoki soliq maslahati emas. Soliq rejimini
          o’zgartirish — hisobot va soliq yukiga ta’sir qiladigan qaror, shuning uchun rejimni o’zgartirishdan
          oldin buxgalter yoki soliq maslahatchisi bilan biznesingizning aniq raqamlarini bilgan holda
          muhokama qiling.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          O’z stavkangiz bo’yicha aylanma solig’i summasini taxminan bilish uchun bepul kalkulyatordan
          foydalaning — tanlangan rejim hisobotini topshirish muddatini o’tkazib yubormaslik uchun esa soliq
          taqvimida eslatma sozlang.
        </p>
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
