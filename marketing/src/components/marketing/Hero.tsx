import type { ReactNode } from "react";

interface HeroProps {
  h1: string;
  lead?: string;
  children?: ReactNode;
}

// Один H1 на страницу — обязательное требование проекта (TASK-0003 §5).
// Hero — единственное место, где рендерится <h1>; остальные заголовки блоков
// на странице всегда <h2>.
export function Hero({ h1, lead, children }: HeroProps) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{h1}</h1>
      {lead && <p className="mt-4 text-lg text-gray-600">{lead}</p>}
      {children}
    </div>
  );
}
