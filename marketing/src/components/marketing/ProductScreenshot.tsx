interface ProductScreenshotProps {
  /** Краткое описание того, что должно быть на реальном скриншоте — на языке страницы. */
  alt: string;
  /** true только для самого первого крупного изображения на странице (без lazy load). */
  priority?: boolean;
  aspect?: "16/9" | "4/3";
}

// Заглушка вместо реального скриншота продукта. TASK-0003 явно запрещает
// рисовать несуществующий интерфейс — компонент подписан как заглушка и
// использует явные размеры (aspect-ratio), чтобы не создавать layout shift,
// когда её заменят на реальный <Image>. Реальные скриншоты на демо-данных —
// открытый пункт фазы 1, см. отчёт задачи.
export function ProductScreenshot({ alt, priority, aspect = "16/9" }: ProductScreenshotProps) {
  // priority зарезервирован для замены на настоящий next/image (первая крупная
  // картинка на странице без lazy load, остальные — с ним, TASK-0003 §6).
  // Заглушка — обычный div без сетевого запроса, поэтому lazy/eager здесь не
  // применяется; проп сохранён в сигнатуре, чтобы вызовы не пришлось менять.
  void priority;
  return (
    <div
      role="img"
      aria-label={alt}
      className="flex w-full items-center justify-center border border-dashed border-gray-300 bg-[var(--muted-bg)] text-center"
      style={{ aspectRatio: aspect }}
    >
      <div className="px-6">
        <p className="text-sm font-medium text-gray-500">{alt}</p>
        <p className="mt-1 text-xs text-gray-400">
          Заглушка — реальный скриншот интерфейса будет добавлен на демо-данных
        </p>
      </div>
    </div>
  );
}
