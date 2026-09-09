import { getNavItems, getLoginNavItem } from "./nav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { urlFor, type Locale, type Topic, TOPICS } from "@/lib/manifest";

export function Header({ topic, locale }: { topic: Topic; locale: Locale }) {
  const home = TOPICS.find((t) => t.type === "home")!;
  const navItems = getNavItems(locale);
  const login = getLoginNavItem(locale);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href={urlFor(home, locale)} className="text-lg font-bold tracking-tight text-black">
          Contador
        </a>
        <nav aria-label={locale === "ru" ? "Основная навигация" : "Asosiy navigatsiya"} className="hidden md:block">
          <ul className="flex items-center gap-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-sm font-medium text-gray-700 hover:text-black transition-colors">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher topic={topic} locale={locale} />
          <a href={login.href} className="text-sm font-medium text-gray-700 hover:text-black transition-colors">
            {login.label}
          </a>
        </div>
      </div>
      {/* Мобильное меню: те же пункты, видимые ниже md-брейкпоинта, без JS-тоггла —
          простая доступная раскладка для первой волны; полноценный бургер-компонент
          можно добавить в фазе 2, когда пунктов станет больше. */}
      <nav aria-label={locale === "ru" ? "Основная навигация (моб.)" : "Asosiy navigatsiya (mobil)"} className="md:hidden border-t border-gray-100 px-4 py-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="text-xs font-medium text-gray-600 hover:text-black transition-colors">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
