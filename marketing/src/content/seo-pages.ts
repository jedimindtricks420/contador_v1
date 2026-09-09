// Единый канонический реестр SEO-страниц (TASK-0003 §4, §5). Каждая запись —
// одна тема (topicId) с обеими языковыми версиями. Роуты, sitemap, hreflang,
// breadcrumbs и перелинковка строятся ТОЛЬКО из этого файла — никаких путей,
// заголовков или description в компонентах не дублируется руками.
//
// Фаза 1 (эта задача): 7 тем из 30 будущих — 01, 02, 06, 17, 21, 26, 27.
// Остальные 23 темы будут добавлены в фазе 2+ по той же схеме: одна запись
// в TOPICS + тексты в src/content/{ru,uz}/<id>-<slug>.tsx + запись в registry.tsx.
//
// relatedIds и parentId ссылаются ТОЛЬКО на темы, реально построенные в этой
// фазе (проверяется validateManifest ниже) — так UI никогда не создаёт ссылку
// на ещё не существующую страницу. Полная матрица связей по всем 30 темам
// зафиксирована в TASK-0003 §5/§6 и будет раскрываться по мере добавления тем.

export type Locale = "ru" | "uz";

export const LOCALES: Locale[] = ["ru", "uz"];

export type TopicType =
  | "home"
  | "hub"
  | "feature"
  | "audience"
  | "pricing"
  | "guide"
  | "tool"
  | "checklist";

export type ContentStatus = "draft" | "published";

export interface FaqItem {
  q: string;
  a: string;
}

export interface LocaleContent {
  /** Сегменты пути без языкового префикса, без ведущего/конечного слэша; "" — главная. */
  path: string;
  title: string;
  description: string;
  h1: string;
  /** Заголовки H2 в порядке появления на странице (для справки/аудита порядка блоков). */
  h2: string[];
  faq: FaqItem[];
}

export interface Topic {
  id: string;
  type: TopicType;
  /** Родитель для хлебных крошек — только id уже опубликованной темы того же реестра. */
  parentId?: string;
  /** Связанные темы (перелинковка) — только id уже опубликованных тем этого реестра. */
  relatedIds: string[];
  contentStatus: ContentStatus;
  /** Дата содержательного обновления (ISO), используется в sitemap lastmod. */
  updatedAt: string;
  /** Внутренняя ссылка на evidence (код/документ), не рендерится пользователю. */
  featureEvidence: string;
  /** Единая цель основного CTA во всём разделе — см. TASK-0003 §6 "CTA и доверие". */
  primaryCta: "register";
  locales: Record<Locale, LocaleContent>;
}

export const TOPICS: Topic[] = [
  {
    id: "01",
    type: "home",
    relatedIds: ["02", "17"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/page.tsx, v2/src/app/dashboard — обзор шагов импорт/проверка/отчёт; README.md",
    primaryCta: "register",
    locales: {
      ru: {
        path: "",
        title: "Онлайн-бухгалтерия в Узбекистане | Contador",
        description:
          "Ведите учёт в Contador: загружайте банковские выписки, проверяйте операции и формируйте отчёты. Познакомьтесь с возможностями сервиса для вашего бизнеса.",
        h1: "Бухгалтерский учёт для бизнеса в Узбекистане",
        h2: ["От выписки к отчёту", "Возможности для вашей работы", "Как начать"],
        faq: [
          {
            q: "Нужно ли устанавливать программу?",
            a: "Нет. Contador работает в браузере — доступ через личный кабинет по логину и паролю.",
          },
          {
            q: "Какие данные нужны, чтобы начать работу?",
            a: "Банковские выписки в поддерживаемых форматах (Excel, 1CClientBankExchange) и начальные остатки по счетам на дату начала учёта.",
          },
          {
            q: "Можно ли начать без оплаты?",
            a: "Да, доступен тариф FREE с ограничениями (одна организация, без AI-классификации). Подробности — на странице тарифов.",
          },
          {
            q: "На каком языке сейчас доступен личный кабинет?",
            a: "Интерфейс личного кабинета сейчас на русском языке.",
          },
        ],
      },
      uz: {
        path: "",
        title: "O‘zbekistonda onlayn buxgalteriya | Contador",
        description:
          "Contador bilan bank ko‘chirmalarini yuklang, operatsiyalarni tekshiring va hisobotlarni shakllantiring. Biznesingiz uchun hisob yuritish imkoniyatlarini ko‘ring.",
        h1: "O‘zbekistondagi biznes uchun buxgalteriya hisobi",
        h2: ["Ko‘chirmadan hisobotgacha", "Ishingiz uchun imkoniyatlar", "Ishni qanday boshlash mumkin"],
        faq: [
          {
            q: "Dastur o‘rnatish kerakmi?",
            a: "Yo‘q. Contador brauzerda ishlaydi — shaxsiy kabinetga login va parol orqali kirasiz.",
          },
          {
            q: "Ishni boshlash uchun qanday ma’lumotlar kerak?",
            a: "Qo‘llab-quvvatlanadigan formatdagi bank ko‘chirmalari (Excel, 1CClientBankExchange) va hisobni boshlash sanasidagi boshlang‘ich qoldiqlar.",
          },
          {
            q: "To‘lovsiz boshlash mumkinmi?",
            a: "Ha, cheklovlar bilan FREE tarifi mavjud (bitta tashkilot, AI-tasnifsiz). Batafsil — tariflar sahifasida.",
          },
          {
            q: "Shaxsiy kabinet hozircha qaysi tilda ishlaydi?",
            a: "Shaxsiy kabinet interfeysi hozircha rus tilida.",
          },
        ],
      },
    },
  },
  {
    id: "02",
    type: "hub",
    relatedIds: ["06"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Каталог-агрегатор; в фазе 1 карточка ведёт только на реально построенную тему 06. Остальные карточки (03–05, 07–13) добавляются в фазе 2.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti",
        title: "Возможности бухгалтерской программы | Contador",
        description:
          "Изучите возможности Contador: импорт выписок, классификация операций, проводки, закрытие месяца и отчёты. Выберите инструмент для своей задачи.",
        h1: "Возможности Contador для бухгалтерского учёта",
        h2: ["Подготовка данных", "Учёт и проверки", "Отчёты"],
        faq: [],
      },
      uz: {
        path: "imkoniyatlar",
        title: "Buxgalteriya dasturi imkoniyatlari | Contador",
        description:
          "Bank ko‘chirmalari importi, operatsiyalar tasnifi, o‘tkazmalar, oyni yopish va hisobotlar bilan tanishing. Vazifangizga mos Contador imkoniyatini tanlang.",
        h1: "Contador buxgalteriya imkoniyatlari",
        h2: ["Ma’lumotlarni tayyorlash", "Hisob va tekshiruvlar", "Hisobotlar"],
        faq: [],
      },
    },
  },
  {
    id: "06",
    type: "feature",
    parentId: "02",
    relatedIds: ["21"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/closing/ClosingWizard.tsx:154-176 — реальные 7 шагов мастера закрытия (8-й условный шаг «Подтверждение ЭСФ» появляется только при наличии счетов-фактур у организации)",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/zakrytie-mesyaca",
        title: "Закрытие месяца в бухгалтерии онлайн | Contador",
        description:
          "Используйте мастер закрытия месяца в Contador: подготовьте операции, пройдите доступные проверки и проверьте результат перед финализацией периода.",
        h1: "Проходите закрытие месяца по шагам",
        h2: ["Этапы закрытия периода", "Незавершённые операции", "Проверка перед финализацией"],
        faq: [
          {
            q: "Какие данные нужны для начала закрытия месяца?",
            a: "Импортированные и разнесённые банковские операции за период и доступ к разделу «Закрытие» в кабинете.",
          },
          {
            q: "Что делает пользователь на каждом шаге мастера?",
            a: "Проверяет статус шага и устраняет то, что мешает перейти дальше — например, неразнесённые операции или неуточнённые категории.",
          },
          {
            q: "Что получается после прохождения всех шагов?",
            a: "Финализированный период: операции блокируются от изменений, доступны отчёты за месяц.",
          },
          {
            q: "Сколько шагов в мастере закрытия?",
            a: "Обычно семь. Если у организации есть электронные счета-фактуры, между сверкой с Soliq и финализацией добавляется отдельный шаг подтверждения ЭСФ.",
          },
          {
            q: "Устраняет ли мастер расхождения с Soliq автоматически?",
            a: "Нет. Шаг «Сверка с Soliq» сравнивает данные счетов-фактур и авансов; устранение расхождений остаётся за пользователем.",
          },
          {
            q: "Нужен ли отдельно чек-лист закрытия?",
            a: "Чек-лист — самостоятельный бесплатный инструмент для самопроверки до или во время прохождения мастера; доступен без регистрации.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/oyni-yopish",
        title: "Buxgalteriyada oyni yopish | Contador",
        description:
          "Contador’da oyni yopish ustasi bilan operatsiyalarni tayyorlang, mavjud tekshiruvlardan o‘ting va davrni yakunlashdan oldin natijalarni tekshiring.",
        h1: "Oyni yopish bosqichlarini izchil bajaring",
        h2: ["Davrni yopish bosqichlari", "Tugallanmagan operatsiyalar", "Yakunlashdan oldingi tekshiruv"],
        faq: [
          {
            q: "Oyni yopishni boshlash uchun qanday ma’lumotlar kerak?",
            a: "Davr uchun import qilingan va o‘tkazmalarga taqsimlangan bank operatsiyalari va kabinetdagi «Yopish» bo‘limiga kirish huquqi.",
          },
          {
            q: "Foydalanuvchi ustaning har bir bosqichida nima qiladi?",
            a: "Bosqich holatini tekshiradi va keyingi bosqichga o‘tishga xalaqit beradigan narsani (masalan, taqsimlanmagan operatsiyalarni) bartaraf etadi.",
          },
          {
            q: "Barcha bosqichlar bajarilgach nima bo‘ladi?",
            a: "Davr yakunlanadi: operatsiyalar o‘zgartirishdan bloklanadi, oy uchun hisobotlar mavjud bo‘ladi.",
          },
          {
            q: "Oyni yopish ustasida nechta bosqich bor?",
            a: "Odatda yettita. Tashkilotda elektron hisob-fakturalar bo‘lsa, Soliq bilan solishtirish va yakunlash orasida ЭСФни tasdiqlash bosqichi qo‘shiladi.",
          },
          {
            q: "Usta Soliq bilan farqlarni avtomatik bartaraf etadimi?",
            a: "Yo‘q. «Soliq bilan solishtirish» bosqichi hisob-fakturalar va avanslar ma’lumotlarini solishtiradi; farqlarni bartaraf etish foydalanuvchi zimmasida qoladi.",
          },
          {
            q: "Alohida tekshiruv ro‘yxati kerakmi?",
            a: "Tekshiruv ro‘yxati — ustadan oldin yoki davomida o‘z-o‘zini tekshirish uchun mustaqil bepul vosita; ro‘yxatdan o‘tmasdan ham mavjud.",
          },
        ],
      },
    },
  },
  {
    id: "17",
    type: "pricing",
    relatedIds: ["02", "01"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/lib/constants.ts BILLING (DEFAULT_PRO_PRICE_YEARLY=299000, DEFAULT_PRO_DURATION_DAYS=365); admin/server.ts:276 GET /admin/api/payment-info; v2/src/app/api/orgs/route.ts:37, api/classification/run-ai/route.ts:16, api/classification/ai-reconcile/route.ts:18 — ограничения FREE",
    primaryCta: "register",
    locales: {
      ru: {
        path: "tarify",
        title: "Тарифы и стоимость Contador для бизнеса",
        description:
          "Изучите актуальную стоимость Contador, доступные возможности и ограничения тарифов. Сравните условия использования сервиса перед созданием аккаунта.",
        h1: "Выберите подходящий тариф Contador",
        h2: ["Стоимость и период оплаты", "Что входит в тариф", "Вопросы об оплате"],
        faq: [
          {
            q: "Что входит в тариф FREE?",
            a: "Одна организация, ручная классификация операций без AI, базовые возможности учёта и отчётов.",
          },
          {
            q: "Что добавляет тариф PRO?",
            a: "Дополнительные организации, AI-классификацию и AI-сверку операций. Доступ действует 365 дней с момента оплаты.",
          },
          {
            q: "Какие способы оплаты доступны?",
            a: "Payme, Click и Alifpay.",
          },
          {
            q: "Может ли цена измениться?",
            a: "Да. На этой странице показана актуальная цена на момент обновления; итоговая сумма всегда подтверждается перед оплатой.",
          },
        ],
      },
      uz: {
        path: "tariflar",
        title: "Contador tariflari va biznes uchun narxlar",
        description:
          "Contador’ning amaldagi narxlari, tarif imkoniyatlari va cheklovlari bilan tanishing. Hisob yaratishdan oldin servisdan foydalanish shartlarini solishtiring.",
        h1: "O‘zingizga mos Contador tarifini tanlang",
        h2: ["Narx va to‘lov davri", "Tarifga nimalar kiradi", "To‘lov bo‘yicha savollar"],
        faq: [
          {
            q: "FREE tarifiga nimalar kiradi?",
            a: "Bitta tashkilot, AI’siz qo‘lda operatsiya tasnifi, hisob va hisobotlarning asosiy imkoniyatlari.",
          },
          {
            q: "PRO tarifi nimani qo‘shadi?",
            a: "Qo‘shimcha tashkilotlar, AI-tasnif va AI-solishtirish. Kirish huquqi to‘lovdan keyin 365 kun amal qiladi.",
          },
          {
            q: "Qanday to‘lov usullari mavjud?",
            a: "Payme, Click va Alifpay.",
          },
          {
            q: "Narx o‘zgarishi mumkinmi?",
            a: "Ha. Bu sahifada yangilangan vaqtdagi amaldagi narx ko‘rsatilgan; yakuniy summa to‘lovdan oldin har doim tasdiqlanadi.",
          },
        ],
      },
    },
  },
  {
    id: "21",
    type: "checklist",
    relatedIds: ["06"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Самостоятельный инструмент; 10 пунктов и правила хранения — TASK-0003 §7 «21. Чек-лист» (не зависит от кода продукта)",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/chek-list-zakrytiya-mesyaca",
        title: "Чек-лист закрытия месяца в бухгалтерии | Contador",
        description:
          "Пройдите интерактивный чек-лист закрытия месяца: выписки, операции, открытые позиции и отчёты. Отмечайте проверки и распечатайте список для работы.",
        h1: "Проверьте готовность учёта к закрытию месяца",
        h2: ["Подготовьте данные", "Проверьте незавершённые операции", "Сверьте отчёты"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/oyni-yopish-tekshiruv-royxati",
        title: "Oyni yopish uchun tekshiruv ro‘yxati | Contador",
        description:
          "Ko‘chirmalar, operatsiyalar, ochiq pozitsiyalar va hisobotlarni interaktiv ro‘yxat bilan tekshiring. Bajarilgan bandlarni belgilang va ro‘yxatni chop eting.",
        h1: "Hisobning oyni yopishga tayyorligini tekshiring",
        h2: ["Ma’lumotlarni tayyorlang", "Tugallanmagan operatsiyalarni tekshiring", "Hisobotlarni solishtiring"],
        faq: [],
      },
    },
  },
  {
    id: "26",
    type: "hub",
    relatedIds: ["27", "21"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Каталог-агрегатор; карточки ведут только на реально построенные инструменты (27) и чек-лист (21). Темы 28–29 добавляются в фазе 2.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "instrumenty",
        title: "Бесплатные калькуляторы для бизнеса | Contador",
        description:
          "Рассчитайте маржу, наценку, точку безубыточности и запас денежных средств. Бесплатные инструменты Contador с формулами и примерами без регистрации.",
        h1: "Полезные инструменты для расчётов бизнеса",
        h2: ["Маржа и наценка", "Безубыточность", "Запас денежных средств"],
        faq: [],
      },
      uz: {
        path: "vositalar",
        title: "Biznes uchun bepul kalkulyatorlar | Contador",
        description:
          "Marja, ustama, zararsizlik nuqtasi va pul zaxirasining yetish muddatini hisoblang. Formulalar va misollar bilan bepul vositalar, ro‘yxatdan o‘tish shart emas.",
        h1: "Biznes hisob-kitoblari uchun foydali vositalar",
        h2: ["Marja va ustama", "Zararsizlik nuqtasi", "Pul zaxirasi"],
        faq: [],
      },
    },
  },
  {
    id: "27",
    type: "tool",
    parentId: "26",
    relatedIds: ["26"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Самостоятельный калькулятор; формулы — TASK-0003 §7 «27. Маржа и наценка» (не зависит от кода продукта); реализация — src/lib/margin.ts",
    primaryCta: "register",
    locales: {
      ru: {
        path: "instrumenty/kalkulyator-marzhi-i-nacenki",
        title: "Калькулятор маржи и наценки онлайн | Contador",
        description:
          "Введите себестоимость и цену продажи, чтобы рассчитать маржу и наценку. Бесплатный калькулятор Contador с формулами, пояснениями и примером расчёта.",
        h1: "Рассчитайте маржу и наценку по цене и себестоимости",
        h2: ["Введите цену и себестоимость", "Чем отличаются проценты", "Формулы и пример"],
        faq: [],
      },
      uz: {
        path: "vositalar/marja-va-ustama-kalkulyatori",
        title: "Marja va ustama kalkulyatori onlayn | Contador",
        description:
          "Marja va ustamani hisoblash uchun tannarx va sotuv narxini kiriting. Contador’ning bepul kalkulyatori, formulalar, izohlar va hisoblash misoli.",
        h1: "Narx va tannarx asosida marja va ustamani hisoblang",
        h2: ["Narx va tannarxni kiriting", "Foizlar o‘rtasidagi farq", "Formulalar va misol"],
        faq: [],
      },
    },
  },
];

// ─── Валидация манифеста ────────────────────────────────────────────────────
// Запускается сразу при импорте модуля (build/test/dev) — рассинхронизация
// манифеста должна падать сборкой, а не тихо давать 404/дубли в проде.

function validateManifest(topics: Topic[]): void {
  const ids = new Set<string>();
  const urlKeys = new Set<string>();

  for (const topic of topics) {
    if (ids.has(topic.id)) {
      throw new Error(`seo-pages manifest: duplicate topicId "${topic.id}"`);
    }
    ids.add(topic.id);

    for (const locale of LOCALES) {
      const entry = topic.locales[locale];
      if (!entry) {
        throw new Error(`seo-pages manifest: topic "${topic.id}" missing locale "${locale}"`);
      }
      const required: (keyof LocaleContent)[] = ["title", "description", "h1"];
      for (const field of required) {
        if (!entry[field] || String(entry[field]).trim() === "") {
          throw new Error(`seo-pages manifest: topic "${topic.id}" locale "${locale}" missing "${field}"`);
        }
      }
      if (topic.type !== "home" && entry.path.trim() === "") {
        throw new Error(`seo-pages manifest: topic "${topic.id}" locale "${locale}" has empty path for non-home type`);
      }
      const key = `${locale}:${entry.path}`;
      if (urlKeys.has(key)) {
        throw new Error(`seo-pages manifest: duplicate URL "${key}"`);
      }
      urlKeys.add(key);
    }
  }

  for (const topic of topics) {
    if (topic.parentId && !ids.has(topic.parentId)) {
      throw new Error(`seo-pages manifest: topic "${topic.id}" parentId "${topic.parentId}" does not exist`);
    }
    for (const relatedId of topic.relatedIds) {
      if (!ids.has(relatedId)) {
        throw new Error(`seo-pages manifest: topic "${topic.id}" relatedId "${relatedId}" does not exist`);
      }
      if (relatedId === topic.id) {
        throw new Error(`seo-pages manifest: topic "${topic.id}" lists itself as relatedId`);
      }
    }
  }
}

validateManifest(TOPICS);
