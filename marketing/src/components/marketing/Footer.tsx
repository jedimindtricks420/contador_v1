import { getNavItems, getLoginNavItem } from "./nav";
import type { Locale } from "@/lib/manifest";

// TODO(фаза 1, известный пробел — см. отчёт задачи): TASK-0003 §6 требует
// включить в footer действующие политики/контакты сервиса и явно отметить
// проверку их актуальности. В доступной evidence этой фазы подтверждённых
// публичных юридических страниц/контактов не найдено — вместо того чтобы
// придумать юрлицо, адрес или телефон, footer сейчас ограничен навигацией и
// нейтральной подписью. Реальные реквизиты добавить, когда владелец их
// предоставит (не генерировать вместо фактов — прямое требование спеки).
export function Footer({ locale }: { locale: Locale }) {
  const navItems = getNavItems(locale);
  const login = getLoginNavItem(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-[var(--muted-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="text-base font-bold text-black">Contador</p>
            <p className="mt-2 max-w-xs text-sm text-gray-600">
              {locale === "ru"
                ? "Бухгалтерский учёт для бизнеса в Узбекистане."
                : "O‘zbekistondagi biznes uchun buxgalteriya hisobi."}
            </p>
          </div>
          <nav aria-label={locale === "ru" ? "Ссылки в подвале" : "Pastki havolalar"}>
            <ul className="flex flex-col gap-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-gray-600 hover:text-black transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={login.href} className="text-sm text-gray-600 hover:text-black transition-colors">
                  {login.label}
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="divider" />
        <p className="text-xs text-gray-500">
          © {year} Contador.{" "}
          {locale === "ru"
            ? "Реквизиты и правовые страницы сервиса уточняются перед публикацией."
            : "Servisning rekvizitlari va huquqiy sahifalari nashrdan oldin aniqlashtiriladi."}
        </p>
      </div>
    </footer>
  );
}
