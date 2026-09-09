import Link from "next/link";

// not-found.js не принимает props (см. next docs), поэтому текст здесь
// нейтрально двуязычный, а не подобран по локали — html lang всё равно
// берётся из обёртывающего app/[locale]/layout.tsx корректно для сегмента,
// по которому пришёл запрос. Next.js возвращает настоящий HTTP 404 для этого
// сегмента (TASK-0003 §8: "неизвестный slug — 404, не 200 с пустым шаблоном").
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-black">Страница не найдена / Sahifa topilmadi</h1>
      <p className="mt-3 text-sm text-gray-600">
        Такой страницы нет в разделе Contador. / Bunday sahifa Contador bo‘limida mavjud emas.
      </p>
      <div className="mt-6 flex gap-4">
        <Link href="/ru/" className="btn-outline">
          На главную (RU)
        </Link>
        <Link href="/uz/" className="btn-outline">
          Bosh sahifa (UZ)
        </Link>
      </div>
    </main>
  );
}
