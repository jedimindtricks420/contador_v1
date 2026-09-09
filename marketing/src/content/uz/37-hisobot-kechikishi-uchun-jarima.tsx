import { Hero } from "@/components/marketing/Hero";
import { RelatedPages } from "@/components/marketing/RelatedPages";
import { CTA } from "@/components/marketing/CTA";
import { getTopicById, urlFor } from "@/lib/manifest";
import type { Topic } from "@/lib/manifest";

// Bu — mavzuning eng huquqiy nozik matni (TASK-0004 §4 «37» muhim cheklovi).
// Yagona tayanch — O’zbekiston Soliq kodeksining 220-moddasi: javobgarlik
// mavjudligi tasdiqlangan, lekin aniq summa/foiz kodeks matnida yo’q — shuning
// uchun bu yerda ham raqam ko’rsatilmaydi, faqat javobgarlik fakti va
// spetsifikatsiya talab qilgan xedjlangan iboralar.
export default function Body({ topic }: { topic: Topic }) {
  const calendarTopic = getTopicById("31");
  const profitTopic = getTopicById("33");
  const regimeGuide = getTopicById("36");

  return (
    <div className="space-y-12">
      <Hero
        h1={topic.locales.uz.h1}
        lead="O’zbekiston Soliq kodeksi soliq hisobotini o’z vaqtida topshirmaslik uchun javobgarlik borligini to’g’ridan-to’g’ri belgilaydi. Bu material jarimaning aniq summasi va tartibini keltirmaydi — ular alohida qonunchilik bilan belgilanadi va o’zgarishi mumkin, shuning uchun eskirib qolishi mumkin bo’lgan raqamlarni ataylab keltirmaymiz."
      />

      <section aria-labelledby="h2-principles">
        <h2 id="h2-principles" className="text-xl font-semibold text-black">
          Javobgarlikning umumiy tamoyillari
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          O’zbekiston Respublikasi Soliq kodeksining 220-moddasi «Soliq hisobotini taqdim etmaslik» quyidagini
          belgilaydi: «За несвоевременное представление налоговой отчетности должностное лицо
          налогоплательщика — юридического лица или налогоплательщик — физическое лицо привлекается к
          административной ответственности» (soliq hisobotini o’z vaqtida topshirmaganlik uchun yuridik shaxs
          soliq to’lovchisining mansabdor shaxsi yoki jismoniy shaxs soliq to’lovchisi ma’muriy javobgarlikka
          tortiladi). Kodeksning o’zi aniq summa yoki jarima foizini ko’rsatmaydi — javobgarlik chorasi alohida
          ma’muriy javobgarlik to’g’risidagi qonunchilik bilan belgilanadi.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Bu yerda ataylab aniq summa yoki foiz ko’rsatmaymiz: har qanday keltirilgan raqam sizning holatingiz
          uchun eskirgan yoki noaniq bo’lib chiqishi mumkin edi. Javobgarlik miqdori va tartibini amaldagi
          qonunchilik belgilaydi — xulosa chiqarishdan oldin uning joriy tahririni tekshiring.
        </p>
      </section>

      <section aria-labelledby="h2-avoid">
        <h2 id="h2-avoid" className="text-xl font-semibold text-black">
          Muddatni qanday o’tkazib yubormaslik
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Kechikish uchun javobgarlikka duch kelmaslikning eng yaxshi yo’li — topshirish muddatini o’tkazib
          yubormaslik. Contador soliq taqvimida o’z soliq va hisobotlaringiz bo’yicha shaxsiy eslatmalarni
          sozlang, foyda solig’i uchun esa ma’lumotlar topshirish vaqtida tayyor bo’lishi uchun choraklik hisobni
          oldindan tayyorlang.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {calendarTopic && (
            <a href={urlFor(calendarTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{calendarTopic.locales.uz.h1}</p>
            </a>
          )}
          {profitTopic && (
            <a href={urlFor(profitTopic, "uz")} className="block rounded border border-gray-200 p-4 hover:border-black transition-colors">
              <p className="font-medium text-black">{profitTopic.locales.uz.h1}</p>
            </a>
          )}
        </div>
      </section>

      <section aria-labelledby="h2-check">
        <h2 id="h2-check" className="text-xl font-semibold text-black">
          Amaldagi normalarni qayerdan tekshirish
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Soliq kodeksi va ma’muriy javobgarlik to’g’risidagi qonunchilikning amaldagi tahririni doim{" "}
          <span className="font-mono text-xs">lex.uz</span> saytida, aniq hisobotlar bo’yicha talablarni esa{" "}
          <span className="font-mono text-xs">soliq.uz</span> saytida tekshiring. Bu material tamoyilning umumiy
          ta’lim tushuntirishi, huquqiy maslahat emas va amaldagi qonunchilikni tekshirish o’rnini bosmaydi.
        </p>
        {regimeGuide && (
          <div className="mt-4 rounded border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Aloqador mavzu — soliq rejimini tanlash:</p>
            <a href={urlFor(regimeGuide, "uz")} className="mt-2 inline-block text-sm font-medium text-black underline">
              {regimeGuide.locales.uz.h1}
            </a>
          </div>
        )}
      </section>

      <RelatedPages topic={topic} locale="uz" />
      <CTA topicId={topic.id} locale="uz" location="bottom" />
    </div>
  );
}
