import { getBreadcrumbChain, type Locale, type Topic } from "@/lib/manifest";

export function Breadcrumbs({ topic, locale }: { topic: Topic; locale: Locale }) {
  const chain = getBreadcrumbChain(topic, locale);
  if (chain.length === 0) return null;
  return (
    <nav aria-label={locale === "ru" ? "Хлебные крошки" : "Yo‘l xaritasi"} className="text-xs text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        {chain.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {i === chain.length - 1 ? (
              <span aria-current="page" className="text-gray-700">
                {crumb.label}
              </span>
            ) : (
              <a href={crumb.href} className="hover:text-black transition-colors">
                {crumb.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
