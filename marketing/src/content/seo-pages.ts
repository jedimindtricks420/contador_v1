// Единый канонический реестр SEO-страниц (TASK-0003 §4, §5). Каждая запись —
// одна тема (topicId) с обеими языковыми версиями. Роуты, sitemap, hreflang,
// breadcrumbs и перелинковка строятся ТОЛЬКО из этого файла — никаких путей,
// заголовков или description в компонентах не дублируется руками.
//
// Фаза 1: 7 тем из 30 будущих — 01, 02, 06, 17, 21, 26, 27.
// Фаза 2: +7 тем — 03, 04, 05, 07, 08, 14, 15. Итого 14 тем / 28 URL.
// Фаза 3: +6 тем — 09, 10, 11, 12, 13, 16. Итого 20 тем / 40 URL.
// Фаза 4 (эта задача): +8 тем — хаб 18 и все 7 его дочерних руководств
// (19, 20, 22, 23, 24, 25, 30). Итого 28 тем / 56 URL. Хаб 18 публикуется
// сразу полным, т.к. все его дочерние темы построены в этой же фазе (в
// отличие от хабов 02/26, которым пришлось ждать своих детей по фазам).
// Оставшиеся 2 темы (28, 29 — калькуляторы безубыточности и запаса денег)
// добавляются в фазе 5 по той же схеме: одна запись в TOPICS + тексты в
// src/content/{ru,uz}/<id>-<slug>.tsx + запись в registry.tsx.
//
// relatedIds и parentId ссылаются ТОЛЬКО на темы, реально построенные к этой
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
    relatedIds: ["02", "14", "15", "17"],
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
    relatedIds: ["03", "04", "06", "07"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Каталог-агрегатор; в фазе 3 карточками показаны все реально построенные темы группы 03–13 (полный набор возможностей).",
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
    id: "03",
    type: "feature",
    parentId: "02",
    // Фаза 4: добавлена пара 19 — §6 "03 продаёт импорт / 19 учит подготовить файл".
    relatedIds: ["04", "06", "19"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/closing/steps/Step1Import.tsx:137,145,158 — реальные поддерживаемые форматы .txt/.xls/.xlsx, AUTO-определение парсера (.txt соответствует 1CClientBankExchange); v2/src/app/api/import/bank/route.ts и api/import/bank/rollback/route.ts — импорт и откат. Импорт доступен ТОЛЬКО как шаг 1 мастера закрытия месяца, отдельного самостоятельного экрана импорта в кабинете нет.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/import-bankovskih-vypisok",
        title: "Импорт банковских выписок в бухгалтерию | Contador",
        description:
          "Импортируйте поддерживаемые выписки Excel и 1CClientBankExchange в Contador. Проверьте операции после загрузки и подготовьте данные для дальнейшего учёта.",
        h1: "Загружайте банковские выписки в Contador",
        h2: ["Какие файлы поддерживаются", "Загрузка и проверка операций", "Что делать с повторным импортом"],
        faq: [
          {
            q: "Где в личном кабинете находится импорт выписки?",
            a: "Импорт — это первый шаг мастера закрытия месяца в разделе «Закрытие». Отдельного самостоятельного экрана импорта вне мастера нет.",
          },
          {
            q: "Какие форматы файлов поддерживаются?",
            a: ".txt (1CClientBankExchange), .xls и .xlsx. Формат определяется автоматически при загрузке файла.",
          },
          {
            q: "Что происходит с операциями сразу после загрузки?",
            a: "Загруженные строки показываются для проверки, прежде чем перейти к следующему шагу мастера — уточнению категорий.",
          },
          {
            q: "Что делать, если выписка загружена по ошибке или дважды?",
            a: "Используйте откат импорта: он убирает операции именно этой загрузки, не затрагивая остальные данные периода.",
          },
          {
            q: "Можно ли подключить банк напрямую, без загрузки файла?",
            a: "Нет, прямого API-подключения к банкам сейчас нет — данные попадают в Contador через файл выписки.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/bank-kochirmalarini-import-qilish",
        title: "Bank ko‘chirmalarini import qilish | Contador",
        description:
          "Qo‘llab-quvvatlanadigan Excel va 1CClientBankExchange ko‘chirmalarini Contador’ga yuklang. Operatsiyalarni tekshirib, keyingi hisob bosqichiga tayyorlang.",
        h1: "Bank ko‘chirmalarini Contador’ga yuklang",
        h2: ["Qaysi fayllar qo‘llab-quvvatlanadi", "Yuklash va tekshirish", "Takroriy import bilan ishlash"],
        faq: [
          {
            q: "Shaxsiy kabinetda ko‘chirma importi qayerda joylashgan?",
            a: "Import — «Yopish» bo‘limidagi oyni yopish ustasining birinchi bosqichi. Usta tashqarisida alohida import ekrani yo‘q.",
          },
          {
            q: "Qaysi fayl formatlari qo‘llab-quvvatlanadi?",
            a: ".txt (1CClientBankExchange), .xls va .xlsx. Format fayl yuklanganda avtomatik aniqlanadi.",
          },
          {
            q: "Yuklashdan keyin operatsiyalarga nima bo‘ladi?",
            a: "Yuklangan qatorlar ustaning keyingi bosqichi — toifalarni aniqlashtirishga o‘tishdan oldin tekshirish uchun ko‘rsatiladi.",
          },
          {
            q: "Ko‘chirma xato yoki ikki marta yuklansa nima qilish kerak?",
            a: "Importni bekor qilish (rollback) funksiyasidan foydalaning — u faqat shu yuklashdagi operatsiyalarni olib tashlaydi, davrning boshqa ma’lumotlariga ta’sir qilmaydi.",
          },
          {
            q: "Bankka faylsiz, to‘g‘ridan-to‘g‘ri ulanish mumkinmi?",
            a: "Yo‘q, hozircha banklarga to‘g‘ridan-to‘g‘ri API ulanish yo‘q — ma’lumotlar Contador’ga ko‘chirma fayli orqali kiritiladi.",
          },
        ],
      },
    },
  },
  {
    id: "04",
    type: "feature",
    parentId: "02",
    // Фаза 4: добавлена пара 20 — спец. §5 topic 04 relatedIds включают 20.
    relatedIds: ["05", "03", "20"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/closing/ClosingWizard.tsx (шаг 2 «Уточнение категорий») → ClarificationQueue.tsx; v2/src/lib/constants.ts AI.CONFIDENCE_THRESHOLD=70, AI.MODEL=gpt-4o-mini; rulesEngine.ts + aiClassifier.ts — правила и AI вместе классифицируют операции. Доступно ТОЛЬКО как шаг 2 мастера закрытия месяца, отдельного всегда доступного экрана нет. Нет чат-интерфейса.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/ai-klassifikaciya-operacij",
        title: "AI-классификация банковских операций | Contador",
        description:
          "Используйте правила и AI-классификацию Contador для обработки банковских операций. Проверяйте предложенные категории и уточняйте неоднозначные назначения.",
        h1: "Проверяйте операции с помощью правил и AI",
        h2: ["Как работают правила и AI", "Как проверить результат", "Когда нужно уточнение"],
        faq: [
          {
            q: "Где происходит классификация операций?",
            a: "На шаге 2 мастера закрытия месяца — «Уточнение категорий». Отдельного самостоятельного экрана классификации вне мастера нет.",
          },
          {
            q: "Классификация полностью выполняется AI?",
            a: "Нет. Сначала операции проверяются по правилам, и только то, что правила не распознали, дополнительно обрабатывает AI-классификатор.",
          },
          {
            q: "Как понять, что категория предложена, а не подтверждена?",
            a: "Предложенная AI категория остаётся черновой до вашего подтверждения — интерфейс отделяет предположение от финального выбора пользователя.",
          },
          {
            q: "Когда операция требует ручного уточнения?",
            a: "Когда уверенность классификации ниже порога — такие операции попадают в очередь уточнения, и категорию нужно выбрать вручную.",
          },
          {
            q: "Это чат-бот, с которым можно переписываться?",
            a: "Нет. Это очередь проверки предложенных категорий, а не диалоговый интерфейс.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/ai-operatsiyalar-tasnifi",
        title: "AI yordamida operatsiyalar tasnifi | Contador",
        description:
          "Contador’da bank operatsiyalarini qoidalar va AI yordamida tasniflang. Tavsiya etilgan toifalarni tekshiring va noaniq operatsiyalarni aniqlashtiring.",
        h1: "Operatsiyalarni qoidalar va AI yordamida tasniflang",
        h2: ["Qoidalar va AI qanday ishlaydi", "Natijani tekshirish", "Qachon aniqlashtirish kerak"],
        faq: [
          {
            q: "Operatsiyalar tasnifi qayerda amalga oshiriladi?",
            a: "Oyni yopish ustasining 2-bosqichida — «Toifalarni aniqlashtirish». Usta tashqarisida alohida tasnif ekrani yo‘q.",
          },
          {
            q: "Tasnif to‘liq AI tomonidan amalga oshiriladimi?",
            a: "Yo‘q. Avval operatsiyalar qoidalar bo‘yicha tekshiriladi, qoidalar aniqlamagan qismini esa AI-tasniflagich qo‘shimcha qayta ishlaydi.",
          },
          {
            q: "Toifa taklif qilinganini tasdiqlanganidan qanday farqlash mumkin?",
            a: "AI tomonidan taklif qilingan toifa siz tasdiqlaguningizcha qoralama holatda qoladi — interfeys taxminni foydalanuvchining yakuniy tanlovidan ajratib ko‘rsatadi.",
          },
          {
            q: "Operatsiya qachon qo‘lda aniqlashtirishni talab qiladi?",
            a: "Tasnif ishonchliligi belgilangan chegaradan past bo‘lganda — bunday operatsiyalar aniqlashtirish navbatiga tushadi va toifani qo‘lda tanlash kerak bo‘ladi.",
          },
          {
            q: "Bu yozishmalash mumkin bo‘lgan chat-botmi?",
            a: "Yo‘q. Bu taklif qilingan toifalarni tekshirish navbati, dialog interfeysi emas.",
          },
        ],
      },
    },
  },
  {
    id: "05",
    type: "feature",
    parentId: "02",
    relatedIds: ["04", "10", "11"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/documents/DocumentsClient.tsx — список документов с фильтрами по периоду (месяц/год) и типу документа; статусы POSTED «Проведён» и VOIDED «Аннулирован». Проводки формируются по документам; фаза 3 добавила отдельную сквозную страницу-журнал всех проводок (тема 11, v2/src/app/reports/journal), текст ниже обновлён — журнал больше не описывается как «в разработке».",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/buhgalterskie-provodki",
        title: "Бухгалтерские проводки по операциям | Contador",
        description:
          "Работайте с проводками в Contador: используйте доступные типы документов, проверяйте дебет и кредит и переходите к журналу операций для контроля учёта.",
        h1: "Формируйте и проверяйте бухгалтерские проводки",
        h2: ["От операции к проводке", "Проверка дебета и кредита", "Просмотр в журнале"],
        faq: [
          {
            q: "Где посмотреть проводки по операциям?",
            a: "В разделе документов кабинета — там показан список документов с фильтрами по периоду и типу.",
          },
          {
            q: "Что означают статусы документов?",
            a: "«Проведён» — документ разнесён проводками; «Аннулирован» — документ отменён и в проводках не учитывается.",
          },
          {
            q: "Проводки создаются вручную?",
            a: "Проводки формируются по документу автоматически на основе его типа; пользователь работает с документом, а не набирает проводку с нуля.",
          },
          {
            q: "Поддерживаются ли любые хозяйственные операции?",
            a: "Нет, только операции, для которых в Contador есть тип документа и шаблон проводки.",
          },
          {
            q: "Есть ли отдельный сквозной журнал всех проводок?",
            a: "Да, журнал проводок показывает записи по всем документам сразу, независимо от того, где создан документ — это отдельная страница помимо списка документов.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/buxgalteriya-otkazmalari",
        title: "Buxgalteriya o‘tkazmalarini yuritish | Contador",
        description:
          "Contador’da mavjud hujjat turlari asosida o‘tkazmalar bilan ishlang. Debet va kreditni tekshirib, hisobni nazorat qilish uchun jurnalga o‘ting.",
        h1: "Buxgalteriya o‘tkazmalarini yarating va tekshiring",
        h2: ["Operatsiyadan o‘tkazmagacha", "Debet va kreditni tekshirish", "Jurnalda ko‘rish"],
        faq: [
          {
            q: "Operatsiyalar bo‘yicha o‘tkazmalarni qayerdan ko‘rish mumkin?",
            a: "Kabinetning hujjatlar bo‘limida — u yerda davr va tur bo‘yicha filtrlanadigan hujjatlar ro‘yxati ko‘rsatiladi.",
          },
          {
            q: "Hujjat holatlari nimani anglatadi?",
            a: "«Proveden» — hujjat o‘tkazmalarga taqsimlangan; «Annulirovan» — hujjat bekor qilingan va o‘tkazmalarda hisobga olinmaydi.",
          },
          {
            q: "O‘tkazmalar qo‘lda yaratiladimi?",
            a: "O‘tkazma hujjat turi asosida avtomatik shakllanadi; foydalanuvchi noldan o‘tkazma yozish o‘rniga hujjat bilan ishlaydi.",
          },
          {
            q: "Har qanday xo‘jalik operatsiyasi qo‘llab-quvvatlanadimi?",
            a: "Yo‘q, faqat Contador’da hujjat turi va o‘tkazma shabloni mavjud bo‘lgan operatsiyalar.",
          },
          {
            q: "Barcha o‘tkazmalar uchun alohida umumiy jurnal bormi?",
            a: "Ha, o‘tkazmalar jurnali hujjat qayerda yaratilganidan qat’i nazar, barcha hujjatlar bo‘yicha yozuvlarni ko‘rsatadi — bu hujjatlar ro‘yxatidan alohida sahifa.",
          },
        ],
      },
    },
  },
  {
    id: "06",
    type: "feature",
    parentId: "02",
    relatedIds: ["21", "03", "10"],
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
    id: "07",
    type: "feature",
    parentId: "02",
    relatedIds: ["08", "10"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/balance — раздел баланса в личном кабинете (директория подтверждена).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/buhgalterskiy-balans",
        title: "Бухгалтерский баланс онлайн | Contador",
        description:
          "Получайте бухгалтерский баланс по данным учёта в Contador. Выбирайте дату отчёта, проверяйте показатели и используйте результат для анализа состояния бизнеса.",
        h1: "Формируйте бухгалтерский баланс в Contador",
        h2: ["Что показывает баланс", "Как выбрать дату", "Как проверить исходные данные"],
        faq: [
          {
            q: "Что показывает бухгалтерский баланс в Contador?",
            a: "Активы и обязательства организации на выбранную дату, рассчитанные по введённым в учёт операциям и остаткам.",
          },
          {
            q: "Как выбрать дату баланса?",
            a: "На странице баланса указывается отчётная дата — показатели формируются по данным учёта на этот момент.",
          },
          {
            q: "От чего зависит полнота баланса?",
            a: "От того, насколько полно введены операции и начальные остатки по счетам на дату начала учёта — баланс не восполняет недостающие данные сам.",
          },
          {
            q: "Можно ли получить баланс без ввода начальных остатков?",
            a: "Баланс сформируется, но без начальных остатков показатели будут отражать только операции, введённые после начала учёта в Contador.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/buxgalteriya-balansi",
        title: "Buxgalteriya balansini shakllantirish | Contador",
        description:
          "Contador’dagi hisob ma’lumotlari asosida buxgalteriya balansini oling. Hisobot sanasini tanlang, ko‘rsatkichlarni tekshiring va biznes holatini tahlil qiling.",
        h1: "Contador’da buxgalteriya balansini shakllantiring",
        h2: ["Balans nimani ko‘rsatadi", "Sanani tanlash", "Boshlang‘ich ma’lumotlarni tekshirish"],
        faq: [
          {
            q: "Contador’dagi buxgalteriya balansi nimani ko‘rsatadi?",
            a: "Tashkilotning tanlangan sanadagi aktivlari va majburiyatlarini — hisobga kiritilgan operatsiyalar va qoldiqlar asosida hisoblangan.",
          },
          {
            q: "Balans sanasini qanday tanlash mumkin?",
            a: "Balans sahifasida hisobot sanasi ko‘rsatiladi — ko‘rsatkichlar shu sanadagi hisob ma’lumotlari bo‘yicha shakllanadi.",
          },
          {
            q: "Balansning to‘liqligi nimaga bog‘liq?",
            a: "Operatsiyalar va hisob boshlanish sanasidagi boshlang‘ich qoldiqlar qanchalik to‘liq kiritilganiga — balans yetishmayotgan ma’lumotni o‘zi to‘ldirmaydi.",
          },
          {
            q: "Boshlang‘ich qoldiqlarsiz balans olish mumkinmi?",
            a: "Balans shakllanadi, lekin boshlang‘ich qoldiqlarsiz ko‘rsatkichlar faqat Contador’da hisob boshlangandan keyingi operatsiyalarni aks ettiradi.",
          },
        ],
      },
    },
  },
  {
    id: "08",
    type: "feature",
    parentId: "02",
    // Фаза 4: добавлена пара 22 — §6 "08 показывает отчёт / 22 объясняет разницу с потоком денег".
    relatedIds: ["15", "09", "22"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/pnl — раздел отчёта о прибылях и убытках в личном кабинете (директория подтверждена).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/otchet-o-pribylyah-i-ubytkah",
        title: "Отчёт о прибылях и убытках онлайн | Contador",
        description:
          "Формируйте отчёт о прибылях и убытках в Contador за выбранный период. Изучайте доходы, расходы и финансовый результат на основе ваших учётных данных.",
        h1: "Анализируйте прибыль и убытки бизнеса",
        h2: ["Доходы и расходы за период", "Финансовый результат", "Почему прибыль не равна деньгам"],
        faq: [
          {
            q: "За какой период формируется отчёт о прибылях и убытках?",
            a: "За период, который вы выбираете в фильтре отчёта — доходы и расходы показываются по данным учёта за этот период.",
          },
          {
            q: "Что показывает финансовый результат в отчёте?",
            a: "Разницу между доходами и расходами периода по данным учёта — прибыль или убыток.",
          },
          {
            q: "Прибыль в отчёте — это остаток денег на счетах?",
            a: "Нет. Прибыль — учётный показатель за период, а остаток на счетах — это фактические деньги в моменте; они могут заметно различаться.",
          },
          {
            q: "Что делать, если нужно сравнить прибыль с движением денег?",
            a: "Смотреть отчёт о прибылях и убытках вместе с данными по банковским счетам за тот же период — это разные срезы одного бизнеса.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/foyda-va-zarar-hisoboti",
        title: "Foyda va zarar hisoboti onlayn | Contador",
        description:
          "Contador’da tanlangan davr uchun foyda va zarar hisobotini shakllantiring. Hisob ma’lumotlari asosida daromad, xarajat va moliyaviy natijani ko‘ring.",
        h1: "Biznes foydasi va zararini tahlil qiling",
        h2: ["Davr daromadlari va xarajatlari", "Moliyaviy natija", "Nega foyda pul qoldig‘iga teng emas"],
        faq: [
          {
            q: "Foyda va zarar hisoboti qaysi davr uchun shakllanadi?",
            a: "Hisobot filtrida siz tanlagan davr uchun — daromad va xarajatlar shu davrdagi hisob ma’lumotlari bo‘yicha ko‘rsatiladi.",
          },
          {
            q: "Hisobotdagi moliyaviy natija nimani ko‘rsatadi?",
            a: "Hisob ma’lumotlari bo‘yicha davr daromadlari va xarajatlari o‘rtasidagi farqni — foyda yoki zararni.",
          },
          {
            q: "Hisobotdagi foyda hisobvaraqdagi pul qoldig‘imi?",
            a: "Yo‘q. Foyda — davr uchun hisob ko‘rsatkichi, hisobvaraqdagi qoldiq esa shu paytdagi haqiqiy pul; ular sezilarli farq qilishi mumkin.",
          },
          {
            q: "Foydani pul harakati bilan solishtirish kerak bo‘lsa nima qilish kerak?",
            a: "Foyda va zarar hisobotini shu davrdagi bank hisobvaraqlari ma’lumotlari bilan birga ko‘rish kerak — bular bir biznesning turli qirralari.",
          },
        ],
      },
    },
  },
  {
    id: "09",
    type: "feature",
    parentId: "02",
    relatedIds: ["08"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Маршрут /v2/cashflow (phase3-evidence.md, подтверждён вместе с темой 08 в фазе 2). Отчёт отражает только уже проведённые операции; функции прогнозирования денежного потока не найдено ни в одном доступном аудите — не заявляется.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/dvizhenie-denezhnyh-sredstv",
        title: "Движение денежных средств бизнеса | Contador",
        description:
          "Изучайте движение денежных средств в Contador: поступления, выплаты и данные выбранного периода. Сопоставляйте денежный поток с финансовыми результатами.",
        h1: "Следите за поступлениями и выплатами",
        h2: ["Поступления и выплаты", "Период и банковские счета", "Связь с прибылью"],
        faq: [
          {
            q: "За какой период показывается движение денежных средств?",
            a: "За период, который вы выбираете в фильтре отчёта — поступления и выплаты рассчитываются по банковским операциям за это время.",
          },
          {
            q: "Отчёт показывает будущие поступления и выплаты?",
            a: "Нет. Отчёт отражает только уже проведённые операции за прошедший период; функции прогнозирования денежного потока в сервисе нет.",
          },
          {
            q: "Чем движение денег отличается от отчёта о прибылях и убытках?",
            a: "ДДС показывает фактические поступления и выплаты по банковским счетам, а отчёт о прибылях и убытках — учётный финансовый результат периода; эти показатели не обязаны совпадать.",
          },
          {
            q: "По каким банковским счетам можно посмотреть движение денег?",
            a: "По счетам организации, операции которых загружены и разнесены в Contador за выбранный период.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/pul-oqimi",
        title: "Biznes pul oqimini kuzatish | Contador",
        description:
          "Contador’da tanlangan davrdagi pul tushumlari va chiqimlarini ko‘ring. Pul oqimini moliyaviy natijalar bilan solishtirib, biznes hisobini tahlil qiling.",
        h1: "Pul tushumlari va chiqimlarini kuzating",
        h2: ["Pul tushumlari va chiqimlari", "Davr va bank hisobvaraqlari", "Foyda bilan bog‘liqlik"],
        faq: [
          {
            q: "Pul oqimi hisoboti qaysi davr uchun ko‘rsatiladi?",
            a: "Hisobot filtrida siz tanlagan davr uchun — pul tushumlari va chiqimlari shu davrdagi bank operatsiyalari asosida hisoblanadi.",
          },
          {
            q: "Hisobot kelajakdagi tushum va chiqimlarni ko‘rsatadimi?",
            a: "Yo‘q. Hisobot faqat o‘tgan davrda amalga oshirilgan operatsiyalarni aks ettiradi, pul oqimini prognoz qilish funksiyasi servisda yo‘q.",
          },
          {
            q: "Pul oqimi foyda va zarar hisobotidan nimasi bilan farq qiladi?",
            a: "Pul oqimi bank hisobvaraqlaridagi haqiqiy tushum va chiqimlarni ko‘rsatadi, foyda va zarar hisoboti esa davrning hisob natijasini; bu ko‘rsatkichlar mos kelishi shart emas.",
          },
          {
            q: "Qaysi bank hisobvaraqlari bo‘yicha pul oqimini ko‘rish mumkin?",
            a: "Tanlangan davrda operatsiyalari Contador’ga yuklangan va taqsimlangan tashkilot hisobvaraqlari bo‘yicha.",
          },
        ],
      },
    },
  },
  {
    id: "10",
    type: "feature",
    parentId: "02",
    // Фаза 4: добавлена пара 23 — §6 "10 показывает ОСВ в продукте / 23 учит читать её".
    relatedIds: ["12", "07", "23"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/reports/osv/OSVClient.tsx + page.tsx — отчёт ОСВ в кабинете (phase3-evidence.md).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/oborotno-saldovaya-vedomost",
        title: "Оборотно-сальдовая ведомость онлайн | Contador",
        description:
          "Формируйте оборотно-сальдовую ведомость в Contador. Просматривайте начальные остатки, обороты и итоговое сальдо для проверки данных бухгалтерского учёта.",
        h1: "Проверяйте остатки и обороты по счетам",
        h2: ["Остатки на начало периода", "Дебетовые и кредитовые обороты", "Сальдо на конец периода"],
        faq: [
          {
            q: "Что показывает начальный остаток по счёту в ОСВ?",
            a: "Остаток по счёту на начало выбранного периода — по данным, введённым как начальные остатки или перенесённым из предыдущих периодов.",
          },
          {
            q: "Что такое дебетовый и кредитовый обороты?",
            a: "Суммы всех проводок по счёту за период отдельно по дебету и по кредиту — они показывают движение, а не остаток.",
          },
          {
            q: "Как получается сальдо на конец периода?",
            a: "Начальный остаток плюс обороты за период, с учётом правил активных и пассивных счетов.",
          },
          {
            q: "Если итоги по дебету и кредиту совпадают, значит ли это, что весь учёт верный?",
            a: "Нет. Равенство итогов подтверждает баланс двойной записи, но не проверяет полноту и корректность каждой операции — например, если начальные остатки по счёту не введены, ОСВ покажет заниженные значения, хотя итоговое равенство сохранится.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/aylanma-saldo-qaydnomasi",
        title: "Aylanma-saldo qaydnomasi onlayn | Contador",
        description:
          "Contador’da aylanma-saldo qaydnomasini shakllantiring. Hisobni tekshirish uchun boshlang‘ich qoldiqlar, aylanmalar va yakuniy saldoni ko‘rib chiqing.",
        h1: "Hisobvaraqlar qoldiqlari va aylanmalarini tekshiring",
        h2: ["Davr boshidagi qoldiqlar", "Debet va kredit aylanmalari", "Davr oxiridagi saldo"],
        faq: [
          {
            q: "ASQda hisobvaraqning boshlang‘ich qoldig‘i nimani ko‘rsatadi?",
            a: "Tanlangan davr boshidagi hisobvaraq qoldig‘ini — boshlang‘ich qoldiq sifatida kiritilgan yoki oldingi davrdan ko‘chirilgan ma’lumotlar bo‘yicha.",
          },
          {
            q: "Debet va kredit aylanmalari nima?",
            a: "Davr davomida hisobvaraq bo‘yicha barcha o‘tkazmalarning debet va kredit summalari alohida — ular qoldiqni emas, harakatni ko‘rsatadi.",
          },
          {
            q: "Davr oxiridagi saldo qanday hisoblanadi?",
            a: "Boshlang‘ich qoldiq va davr aylanmalari asosida, faol va passiv hisobvaraqlar qoidalariga ko‘ra.",
          },
          {
            q: "Debet va kredit itog‘lari teng bo‘lsa, butun hisob to‘g‘ri degani-mi?",
            a: "Yo‘q. Itog‘lar tengligi ikki tomonlama yozuv balansini tasdiqlaydi, lekin har bir operatsiyaning to‘liqligi va to‘g‘riligini tekshirmaydi — masalan, hisobvaraq uchun boshlang‘ich qoldiq kiritilmagan bo‘lsa, ASQ pasaytirilgan qiymatlarni ko‘rsatadi, biroq itog‘lar tengligi saqlanadi.",
          },
        ],
      },
    },
  },
  {
    id: "11",
    type: "feature",
    parentId: "02",
    relatedIds: ["05", "12", "10"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/reports/journal/JournalClient.tsx — журнал проводок в кабинете (phase3-evidence.md).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/zhurnal-provodok",
        title: "Журнал бухгалтерских проводок | Contador",
        description:
          "Проверяйте бухгалтерские записи в журнале проводок Contador. Изучайте даты, суммы и счета, чтобы разбирать операции и контролировать отражение документов.",
        h1: "Просматривайте проводки в едином журнале",
        h2: ["Какие записи видны в журнале", "Как проверить операцию", "Переход к отчётам"],
        faq: [
          {
            q: "Что показывает журнал проводок?",
            a: "Список бухгалтерских записей за период: дату, документ, счета и суммы по дебету и кредиту.",
          },
          {
            q: "Можно ли фильтровать журнал?",
            a: "Да, по периоду и другим доступным фильтрам — так же, как в списке документов.",
          },
          {
            q: "Это неизменяемый юридический аудиторский журнал?",
            a: "Нет. Это журнал учётных проводок, отражающий текущее состояние документов, а не отдельный неизменяемый юридический реестр.",
          },
          {
            q: "Как проверить конкретную операцию в журнале?",
            a: "Найти нужную запись по дате, счёту или сумме и открыть связанный документ, чтобы увидеть детали операции.",
          },
          {
            q: "Куда перейти из журнала для более широкой картины?",
            a: "К отчётам — например, к оборотно-сальдовой ведомости или карточке счёта: они построены на тех же проводках.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/otkazmalar-jurnali",
        title: "Buxgalteriya o‘tkazmalari jurnali | Contador",
        description:
          "Contador o‘tkazmalar jurnalida buxgalteriya yozuvlarini tekshiring. Operatsiyalarni tushunish uchun sana, summa va hisobvaraqlarni ko‘rib chiqing.",
        h1: "O‘tkazmalarni yagona jurnalda ko‘ring",
        h2: ["Jurnalda qanday yozuvlar ko‘rinadi", "Operatsiyani tekshirish", "Hisobotlarga o‘tish"],
        faq: [
          {
            q: "O‘tkazmalar jurnali nimani ko‘rsatadi?",
            a: "Davr uchun buxgalteriya yozuvlari ro‘yxatini: sana, hujjat, debet va kredit hisobvaraqlari hamda summalarni.",
          },
          {
            q: "Jurnalni filtrlash mumkinmi?",
            a: "Ha, davr va boshqa mavjud filtrlar bo‘yicha — xuddi hujjatlar ro‘yxatidagidek.",
          },
          {
            q: "Bu o‘zgarmas huquqiy audit jurnalimi?",
            a: "Yo‘q. Bu hujjatlarning joriy holatini aks ettiruvchi o‘tkazmalar jurnali, alohida o‘zgarmas huquqiy reestr emas.",
          },
          {
            q: "Jurnalda muayyan operatsiyani qanday tekshirish mumkin?",
            a: "Kerakli yozuvni sana, hisobvaraq yoki summa bo‘yicha topib, operatsiya tafsilotlarini ko‘rish uchun bog‘liq hujjatni ochish kerak.",
          },
          {
            q: "Jurnaldan keyin qayerga o‘tish mumkin?",
            a: "Hisobotlarga — masalan, aylanma-saldo qaydnomasi yoki hisobvaraq kartochkasiga: ular xuddi shu o‘tkazmalar asosida shakllanadi.",
          },
        ],
      },
    },
  },
  {
    id: "12",
    type: "feature",
    parentId: "02",
    relatedIds: ["10", "11"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/src/app/reports/account-card/AccountCardClient.tsx — карточка счёта в кабинете (phase3-evidence.md).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/kartochka-scheta",
        title: "Карточка бухгалтерского счёта онлайн | Contador",
        description:
          "Открывайте карточку счёта в Contador для проверки движений за период. Изучайте записи и суммы, чтобы понимать, как сформировались показатели учёта.",
        h1: "Разбирайте операции по отдельному счёту",
        h2: ["Выбор счёта и периода", "Движения по счёту", "Проверка итогов"],
        faq: [
          {
            q: "Чем карточка счёта отличается от банковского счёта?",
            a: "Карточка счёта показывает движения по счёту плана счетов (бухгалтерский учётный счёт), а не выписку конкретного банковского расчётного счёта организации — термин «счёт» совпадает, но это разные понятия.",
          },
          {
            q: "Что показывает карточка счёта?",
            a: "Начальный остаток, все проводки по выбранному счёту за период и итоговые суммы по дебету и кредиту.",
          },
          {
            q: "Как выбрать счёт и период?",
            a: "На странице карточки счёта указываются счёт плана счетов и период — движения формируются по этим параметрам.",
          },
          {
            q: "Можно ли выгрузить карточку счёта в файл?",
            a: "Отдельная функция экспорта карточки счёта сейчас не подтверждена — карточка доступна для просмотра в кабинете.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/hisobvaraq-kartochkasi",
        title: "Buxgalteriya hisobvarag‘i kartochkasi | Contador",
        description:
          "Contador’da hisobvaraq kartochkasini ochib, davr harakatlarini tekshiring. Hisob ko‘rsatkichlari qanday shakllanganini yozuvlar va summalar orqali ko‘ring.",
        h1: "Alohida hisobvaraq operatsiyalarini ko‘rib chiqing",
        h2: ["Hisobvaraq va davrni tanlash", "Hisobvaraq harakatlari", "Natijalarni tekshirish"],
        faq: [
          {
            q: "Hisobvaraq kartochkasi bank hisobvarag‘idan nimasi bilan farq qiladi?",
            a: "Hisobvaraq kartochkasi hisobvaraqlar rejasidagi buxgalteriya hisobvarag‘i bo‘yicha harakatlarni ko‘rsatadi, tashkilotning aniq bank hisob-raqami ko‘chirmasi emas — atama bir xil bo‘lsa-da, bular turli tushunchalar.",
          },
          {
            q: "Hisobvaraq kartochkasi nimani ko‘rsatadi?",
            a: "Tanlangan hisobvaraq bo‘yicha boshlang‘ich qoldiqni, davr uchun barcha o‘tkazmalarni va debet-kredit bo‘yicha yakuniy summalarni.",
          },
          {
            q: "Hisobvaraq va davrni qanday tanlash mumkin?",
            a: "Hisobvaraq kartochkasi sahifasida hisobvaraqlar rejasidagi hisobvaraq va davr ko‘rsatiladi — harakatlar shu parametrlar bo‘yicha shakllanadi.",
          },
          {
            q: "Hisobvaraq kartochkasini faylga eksport qilish mumkinmi?",
            a: "Alohida eksport funksiyasi hozircha tasdiqlanmagan — kartochka kabinetda ko‘rish uchun mavjud.",
          },
        ],
      },
    },
  },
  {
    id: "13",
    type: "feature",
    parentId: "02",
    relatedIds: ["06", "21", "15"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "v2/open-positions — раздел открытых позиций (авансы, подотчётные суммы) в кабинете (подтверждено в phase-1 evidence, повторно сверено в phase3-evidence.md). Автоматических напоминаний/уведомлений не найдено ни в одном доступном аудите — не заявляется.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "vozmozhnosti/avansy-i-podotchet",
        title: "Учёт авансов и подотчётных сумм | Contador",
        description:
          "Просматривайте открытые позиции в Contador: авансы, подотчётные суммы и сроки. Проверяйте незакрытые операции и следите за их состоянием в учёте.",
        h1: "Контролируйте авансы и подотчётные суммы",
        h2: ["Какие позиции остаются открытыми", "Сроки и статусы", "Проверка перед закрытием"],
        faq: [
          {
            q: "Что считается открытой позицией?",
            a: "Аванс, подотчётная сумма или другая операция, которая ещё не закрыта встречной операцией — например, авансовым отчётом или возвратом.",
          },
          {
            q: "Как открытая позиция закрывается?",
            a: "Встречной операцией на ту же сумму (или её часть) — после этого позиция перестаёт считаться открытой.",
          },
          {
            q: "Отправляет ли сервис автоматические напоминания о просроченных позициях?",
            a: "Нет, автоматических напоминаний нет — проверка сроков и статусов сейчас выполняется вручную в разделе открытых позиций.",
          },
          {
            q: "Что нужно проверить перед закрытием месяца?",
            a: "Список открытых позиций за период — не осталось ли авансов или подотчётных сумм без движения, которые нужно закрыть или перенести.",
          },
        ],
      },
      uz: {
        path: "imkoniyatlar/avanslar-va-hisobdor-summalar",
        title: "Avanslar va hisobdor summalar hisobi | Contador",
        description:
          "Contador’da ochiq pozitsiyalar, avanslar, hisobdor summalar va muddatlarni ko‘ring. Yopilmagan operatsiyalarni tekshirib, hisobdagi holatini kuzating.",
        h1: "Avanslar va hisobdor summalarni nazorat qiling",
        h2: ["Qaysi pozitsiyalar ochiq qoladi", "Muddatlar va holatlar", "Yopishdan oldin tekshirish"],
        faq: [
          {
            q: "Ochiq pozitsiya deb nima hisoblanadi?",
            a: "Hali qarshi operatsiya bilan yopilmagan avans, hisobdor summa yoki boshqa operatsiya — masalan, avans hisoboti yoki qaytarish bilan yopiladi.",
          },
          {
            q: "Ochiq pozitsiya qanday yopiladi?",
            a: "Xuddi shu summaga (yoki uning bir qismiga) qarshi operatsiya bilan — shundan keyin pozitsiya ochiq hisoblanmaydi.",
          },
          {
            q: "Servis muddati o‘tgan pozitsiyalar haqida avtomatik eslatma yuboradimi?",
            a: "Yo‘q, avtomatik eslatmalar yo‘q — muddat va holatlarni tekshirish hozircha ochiq pozitsiyalar bo‘limi orqali qo‘lda amalga oshiriladi.",
          },
          {
            q: "Oyni yopishdan oldin nimani tekshirish kerak?",
            a: "Davr uchun ochiq pozitsiyalar ro‘yxatini — harakatsiz qolgan avans yoki hisobdor summalar yopilishi yoki keyingi davrga o‘tkazilishi kerakmi.",
          },
        ],
      },
    },
  },
  {
    id: "14",
    type: "audience",
    relatedIds: ["03", "04", "06", "21"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Сценарная страница аудитории; ссылается только на реально построенные функции 03 (импорт), 04 (AI-классификация), 06 (закрытие месяца) и чек-лист 21.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "dlya-buhgalterov",
        title: "Программа для бухгалтеров Узбекистана | Contador",
        description:
          "Импортируйте выписки, проверяйте классификацию и проводки, готовьте отчёты в Contador. Изучите последовательность работы бухгалтера с данными организации.",
        h1: "Рабочие инструменты бухгалтера в одном сервисе",
        h2: ["Подготовьте данные", "Проверьте операции", "Сформируйте отчёты"],
        faq: [
          {
            q: "С чего бухгалтер обычно начинает работу в Contador?",
            a: "С загрузки банковской выписки на первом шаге мастера закрытия месяца — это отправная точка учёта за период.",
          },
          {
            q: "Нужно ли вручную разбирать каждую операцию?",
            a: "Часть операций классифицируется правилами и AI автоматически; вручную нужно уточнить только те, где классификация не уверена.",
          },
          {
            q: "Можно ли вести несколько организаций из одного аккаунта?",
            a: "Да, с учётом ограничений выбранного тарифа — подробности на странице тарифов.",
          },
          {
            q: "Как проверить, что период готов к закрытию?",
            a: "Использовать бесплатный чек-лист закрытия месяца как самопроверку до или во время прохождения мастера закрытия.",
          },
        ],
      },
      uz: {
        path: "buxgalterlar-uchun",
        title: "O‘zbekiston buxgalterlari uchun dastur | Contador",
        description:
          "Contador’da ko‘chirmalarni yuklang, tasnif va o‘tkazmalarni tekshiring, hisobotlarni tayyorlang. Tashkilot ma’lumotlari bilan ishlash bosqichlarini ko‘ring.",
        h1: "Buxgalter uchun ish vositalari bitta servisda",
        h2: ["Ma’lumotlarni tayyorlang", "Operatsiyalarni tekshiring", "Hisobotlarni shakllantiring"],
        faq: [
          {
            q: "Buxgalter Contador’da odatda ishni nimadan boshlaydi?",
            a: "Oyni yopish ustasining birinchi bosqichida bank ko‘chirmasini yuklashdan — bu davr uchun hisobning boshlang‘ich nuqtasi.",
          },
          {
            q: "Har bir operatsiyani qo‘lda ko‘rib chiqish kerakmi?",
            a: "Operatsiyalarning bir qismi qoidalar va AI yordamida avtomatik tasniflanadi; qo‘lda faqat tasnifi noaniq bo‘lganlarini aniqlashtirish kerak.",
          },
          {
            q: "Bitta hisobdan bir nechta tashkilotni yuritish mumkinmi?",
            a: "Ha, tanlangan tarif cheklovlariga qarab — batafsil ma’lumot tariflar sahifasida.",
          },
          {
            q: "Davrning yopishga tayyorligini qanday tekshirish mumkin?",
            a: "Oyni yopish ustasidan oldin yoki davomida bepul tekshiruv ro‘yxatidan o‘z-o‘zini tekshirish uchun foydalaning.",
          },
        ],
      },
    },
  },
  {
    id: "15",
    type: "audience",
    relatedIds: ["08", "09"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Сценарная страница аудитории; ссылается только на реально построенный отчёт 08 (P&L). Темы 09/22/29 из спеки для этой страницы в этой фазе не построены и не упоминаются как готовые.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "dlya-rukovoditeley",
        title: "Учёт и финансовые отчёты для руководителя | Contador",
        description:
          "Смотрите прибыль, денежные потоки и бухгалтерские отчёты в Contador. Разбирайте результаты компании вместе с бухгалтером на основе данных учёта.",
        h1: "Понимайте финансовые результаты своего бизнеса",
        h2: ["Прибыль и деньги на счёте", "Вопросы бухгалтеру", "Какие отчёты открыть"],
        faq: [
          {
            q: "Почему прибыль в отчёте и деньги на счёте — разные числа?",
            a: "Прибыль — учётный показатель за период по отчёту о прибылях и убытках, а остаток на счёте — фактические деньги в моменте; они не обязаны совпадать.",
          },
          {
            q: "Какой отчёт показывает результат бизнеса за месяц?",
            a: "Отчёт о прибылях и убытках — он показывает доходы, расходы и финансовый результат за выбранный период.",
          },
          {
            q: "Нужно ли руководителю самому вести учёт?",
            a: "Нет, операционную работу с выписками и проводками ведёт бухгалтер; руководитель смотрит уже сформированные отчёты.",
          },
          {
            q: "Даёт ли Contador прогноз бюджета или консолидированную отчётность по нескольким компаниям?",
            a: "Нет, это не входит в текущие возможности сервиса.",
          },
        ],
      },
      uz: {
        path: "rahbarlar-uchun",
        title: "Rahbar uchun hisob va moliyaviy hisobotlar | Contador",
        description:
          "Contador’da foyda, pul oqimi va buxgalteriya hisobotlarini ko‘ring. Kompaniya natijalarini buxgalter bilan birga hisob ma’lumotlari asosida tahlil qiling.",
        h1: "Biznesingiz moliyaviy natijalarini tushuning",
        h2: ["Foyda va hisobdagi pul", "Buxgalterga savollar", "Qaysi hisobotlarni ko‘rish kerak"],
        faq: [
          {
            q: "Nega hisobotdagi foyda va hisobvaraqdagi pul turli sonlar?",
            a: "Foyda — foyda va zarar hisoboti bo‘yicha davr ko‘rsatkichi, hisobvaraqdagi qoldiq esa shu paytdagi haqiqiy pul; ular mos kelishi shart emas.",
          },
          {
            q: "Qaysi hisobot oy uchun biznes natijasini ko‘rsatadi?",
            a: "Foyda va zarar hisoboti — u tanlangan davr uchun daromad, xarajat va moliyaviy natijani ko‘rsatadi.",
          },
          {
            q: "Rahbar hisobni o‘zi yuritishi kerakmi?",
            a: "Yo‘q, ko‘chirmalar va o‘tkazmalar bilan operatsion ishni buxgalter olib boradi; rahbar tayyor hisobotlarni ko‘radi.",
          },
          {
            q: "Contador byudjet prognozi yoki bir nechta kompaniya bo‘yicha konsolidatsiyalangan hisobot beradimi?",
            a: "Yo‘q, bu servisning hozirgi imkoniyatlariga kirmaydi.",
          },
        ],
      },
    },
  },
  {
    id: "16",
    type: "audience",
    relatedIds: ["13", "08", "06"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Сценарная страница аудитории; ссылается только на реально построенные темы 13 (открытые позиции), 08 (P&L) и 06 (закрытие месяца).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "dlya-kompaniy-uslug",
        title: "Учёт для компаний сферы услуг | Contador",
        description:
          "Работайте с банковскими операциями, доходами, расходами и авансами сервисной компании. Изучите подходящий сценарий учёта и отчётности в Contador.",
        h1: "Ведите учёт сервисной компании в Contador",
        h2: ["Оплата услуг и расходы", "Работа с авансами", "Проверка результата за месяц"],
        faq: [
          {
            q: "Чем учёт сервисной компании отличается от учёта товарного бизнеса?",
            a: "Меньше операций со складом и товарными остатками, больше внимания к оплате услуг, расходам и авансам от заказчиков и подрядчикам.",
          },
          {
            q: "Можно ли отслеживать полученные и выданные авансы?",
            a: "Да, через раздел открытых позиций — авансы и подотчётные суммы видны как незакрытые операции, пока встречная операция не закроет их.",
          },
          {
            q: "Какой отчёт покажет результат месяца?",
            a: "Отчёт о прибылях и убытках — доходы, расходы и финансовый результат за выбранный период.",
          },
          {
            q: "Есть ли отраслевые функции для сервисных компаний — CRM, тайм-трекинг, склад?",
            a: "Нет, это не входит в текущие возможности Contador — сервис охватывает банковские операции, проводки, закрытие месяца и отчёты.",
          },
        ],
      },
      uz: {
        path: "xizmat-korsatish-korxonalari-uchun",
        title: "Xizmat ko‘rsatish korxonalari hisobi | Contador",
        description:
          "Contador’da xizmat ko‘rsatish korxonasining bank operatsiyalari, daromad, xarajat va avanslari bilan ishlash hamda hisobot imkoniyatlarini ko‘ring.",
        h1: "Xizmat ko‘rsatish korxonasi hisobini yuriting",
        h2: ["Xizmat to‘lovlari va xarajatlar", "Avanslar bilan ishlash", "Oy natijasini tekshirish"],
        faq: [
          {
            q: "Xizmat ko‘rsatish korxonasi hisobi tovar biznesi hisobidan nimasi bilan farq qiladi?",
            a: "Ombor va tovar qoldiqlari bilan ishlash kamroq, xizmat to‘lovlari, xarajatlar hamda buyurtmachilar va pudratchilar bilan avanslarga ko‘proq e’tibor beriladi.",
          },
          {
            q: "Olingan va berilgan avanslarni kuzatish mumkinmi?",
            a: "Ha, ochiq pozitsiyalar bo‘limi orqali — avanslar va hisobdor summalar qarshi operatsiya ularni yopmaguncha yopilmagan operatsiya sifatida ko‘rinadi.",
          },
          {
            q: "Qaysi hisobot oy natijasini ko‘rsatadi?",
            a: "Foyda va zarar hisoboti — tanlangan davr uchun daromad, xarajat va moliyaviy natija.",
          },
          {
            q: "Xizmat ko‘rsatish korxonalari uchun alohida CRM, vaqt hisobi yoki ombor funksiyalari bormi?",
            a: "Yo‘q, bu Contador’ning hozirgi imkoniyatlariga kirmaydi — servis bank operatsiyalari, o‘tkazmalar, oyni yopish va hisobotlarni qamrab oladi.",
          },
        ],
      },
    },
  },
  {
    id: "17",
    type: "pricing",
    relatedIds: ["02", "14", "01"],
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
    id: "18",
    type: "hub",
    relatedIds: ["19", "21", "22", "30"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Каталог-агрегатор; фаза 4 строит все 7 руководств (19,20,22,23,24,25,30) в этой же фазе, поэтому хаб публикуется сразу полным — карточками показаны 19–25 и 30, включая уже существующий чек-лист 21.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva",
        title: "Инструкции по учёту и отчётам | Contador",
        description:
          "Разберитесь с банковскими выписками, закрытием месяца, ОСВ и финансовыми отчётами. Пошаговые материалы Contador с примерами для работы с учётом.",
        h1: "Практические руководства по работе с учётом",
        h2: ["Начало работы", "Проверки и закрытие", "Понимание отчётов"],
        faq: [],
      },
      uz: {
        path: "qollanmalar",
        title: "Hisob va hisobotlar bo‘yicha qo‘llanmalar | Contador",
        description:
          "Bank ko‘chirmalari, oyni yopish, aylanma-saldo qaydnomasi va moliyaviy hisobotlarni o‘rganing. Contador qo‘llanmalaridagi amaliy misollar bilan tanishing.",
        h1: "Hisob bilan ishlash bo‘yicha amaliy qo‘llanmalar",
        h2: ["Ishni boshlash", "Tekshiruvlar va yopish", "Hisobotlarni tushunish"],
        faq: [],
      },
    },
  },
  {
    id: "19",
    type: "guide",
    parentId: "18",
    relatedIds: ["03", "20", "21"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Повторно использует evidence темы 03: v2/src/app/closing/steps/Step1Import.tsx:137,145,158 — форматы .txt/.xls/.xlsx, AUTO-определение; импорт доступен только на шаге 1 мастера закрытия — этот факт не переиначивается в обучающем тексте.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/podgotovka-bankovskoy-vypiski",
        title: "Как подготовить банковскую выписку к импорту",
        description:
          "Узнайте, что проверить в банковской выписке перед импортом: формат, период, суммы и повторные операции. Практическая инструкция для загрузки в Contador.",
        h1: "Подготовка банковской выписки: пошаговая инструкция",
        h2: ["Проверьте формат и период", "Сопоставьте суммы", "Разберите ошибку загрузки"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/bank-kochirmasini-tayyorlash",
        title: "Bank ko‘chirmasini importga qanday tayyorlash kerak",
        description:
          "Importdan oldin bank ko‘chirmasining formati, davri, summalari va takroriy operatsiyalarini tekshirishni o‘rganing. Contador uchun amaliy yo‘riqnoma.",
        h1: "Bank ko‘chirmasini importga tayyorlash qo‘llanmasi",
        h2: ["Format va davrni tekshiring", "Summalarni solishtiring", "Yuklash xatosini aniqlang"],
        faq: [],
      },
    },
  },
  {
    id: "20",
    type: "guide",
    parentId: "18",
    relatedIds: ["04", "05", "19"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Повторно использует evidence темы 04: v2/src/lib/constants.ts AI.CONFIDENCE_THRESHOLD=70, ClarificationQueue.tsx, rulesEngine.ts+aiClassifier.ts. Конкретное число порога не публикуется в тексте (как и на теме 04) — в UI пользователь видит очередь уточнения, а не цифру уверенности; нет чат-интерфейса.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/proverka-ai-klassifikacii",
        title: "Как проверять AI-классификацию операций | Contador",
        description:
          "Разберите, как проверять категории операций, уточнять назначение платежа и исправлять неоднозначные результаты AI-классификации в Contador.",
        h1: "Проверка операций после AI-классификации",
        h2: ["Какие данные сверять", "Разбор неоднозначного платежа", "Подтверждение результата"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/ai-tasnifini-tekshirish",
        title: "AI operatsiyalar tasnifini tekshirish | Contador",
        description:
          "Operatsiya toifalarini tekshirish, to‘lov maqsadini aniqlashtirish va AI tasnifidagi noaniq natijalarni tuzatishni Contador misolida o‘rganing.",
        h1: "AI tasnifidan keyin operatsiyalarni tekshiring",
        h2: ["Qaysi ma’lumotlarni solishtirish", "Noaniq to‘lovni tahlil qilish", "Natijani tasdiqlash"],
        faq: [],
      },
    },
  },
  {
    id: "21",
    type: "checklist",
    relatedIds: ["06", "13", "10"],
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
    id: "22",
    type: "guide",
    parentId: "18",
    relatedIds: ["08", "09", "15"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Концептуальное объяснение с собственным примером; повторно использует evidence тем 08 (P&L, /v2/pnl) и 09 (ДДС, /v2/cashflow), уже построенных ранее. Числа в примере вымышленные, налоговый расчёт не выполняется и не заявляется.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/pribyl-i-denezhnyy-potok",
        title: "Прибыль и денежный поток: в чём разница | Contador",
        description:
          "Разберите разницу между прибылью и денежным потоком на простом примере. Узнайте, зачем смотреть P&L и движение денег вместе при анализе бизнеса.",
        h1: "Почему прибыль не равна деньгам на счёте",
        h2: ["Два разных показателя", "Пример с отсрочкой оплаты", "Какие отчёты смотреть вместе"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/foyda-va-pul-oqimi-farqi",
        title: "Foyda va pul oqimi: qanday farq bor | Contador",
        description:
          "Oddiy misolda foyda va pul oqimi o‘rtasidagi farqni o‘rganing. Biznesni tahlil qilishda foyda-zarar hisoboti va pul harakatini birga ko‘rish sabablarini biling.",
        h1: "Nega foyda hisobdagi pulga teng emas",
        h2: ["Ikki xil ko‘rsatkich", "Kechiktirilgan to‘lov misoli", "Qaysi hisobotlarni birga ko‘rish kerak"],
        faq: [],
      },
    },
  },
  {
    id: "23",
    type: "guide",
    parentId: "18",
    relatedIds: ["10", "12", "24"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Аннотированная собственная таблица (не реальные данные), сверенная со структурой отчёта на теме 10: v2/src/app/reports/osv/OSVClient.tsx + page.tsx. Правила активных/пассивных счетов изложены так же, как в FAQ темы 10, без противоречий.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/kak-chitat-osv",
        title: "Как читать оборотно-сальдовую ведомость | Contador",
        description:
          "Изучите колонки ОСВ на понятном примере: начальное сальдо, дебет, кредит и остаток на конец периода. Разберитесь, какие данные нужно проверить.",
        h1: "Как разобраться в оборотно-сальдовой ведомости",
        h2: ["Что означает каждая колонка", "Пример движения по счёту", "Почему равенства итогов недостаточно"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/aylanma-saldo-qaydnomasini-oqish",
        title: "Aylanma-saldo qaydnomasini qanday o‘qish kerak",
        description:
          "Boshlang‘ich saldo, debet, kredit va davr oxiridagi qoldiqni oddiy misolda o‘rganing. Aylanma-saldo qaydnomasida nimalarni tekshirish kerakligini biling.",
        h1: "Aylanma-saldo qaydnomasini tushunish qo‘llanmasi",
        h2: ["Har bir ustun nimani anglatadi", "Hisobvaraq harakati misoli", "Nega jami tengligi yetarli emas"],
        faq: [],
      },
    },
  },
  {
    id: "24",
    type: "guide",
    parentId: "18",
    relatedIds: ["07", "23", "30"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Реальный маршрут /v2/settings/opening-balance (подтверждён в phase-1 evidence). Автоматический перенос всей базы 1С не обещается — только разовый ручной ввод исходных остатков.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/nachalnye-ostatki",
        title: "Начальные остатки: подготовка данных | Contador",
        description:
          "Узнайте, какие данные собрать для ввода начальных остатков в Contador. Проверьте дату начала учёта, счета и суммы перед дальнейшей работой с отчётами.",
        h1: "Подготовьте начальные остатки для начала учёта",
        h2: ["Выберите дату начала", "Соберите данные по счетам", "Проверьте введённые остатки"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/boshlangich-qoldiqlar",
        title: "Boshlang‘ich qoldiqlarni tayyorlash | Contador",
        description:
          "Contador’da boshlang‘ich qoldiqlarni kiritish uchun kerakli ma’lumotlarni o‘rganing. Hisobotlar bilan ishlashdan oldin sana, hisobvaraqlar va summalarni tekshiring.",
        h1: "Hisobni boshlash uchun qoldiqlarni tayyorlang",
        h2: ["Boshlanish sanasini tanlang", "Hisobvaraqlar ma’lumotlarini yig‘ing", "Kiritilgan qoldiqlarni tekshiring"],
        faq: [],
      },
    },
  },
  {
    id: "25",
    type: "guide",
    parentId: "18",
    relatedIds: ["02", "17", "19"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Редакционная таблица критериев с пустой колонкой для самооценки читателя; явное авторство Contador, без вымышленного рейтинга и неподтверждённого сравнения конкурентов (спека прямо это запрещает).",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/kak-vybrat-buhgalterskuyu-programmu",
        title: "Как выбрать бухгалтерскую программу в Узбекистане",
        description:
          "Используйте список критериев для выбора бухгалтерской программы в Узбекистане: импорт, отчёты, проверка операций, доступы и стоимость обслуживания.",
        h1: "Проверьте программу на задачах вашего бизнеса",
        h2: ["Составьте список задач", "Проверьте сценарий на примере", "Сравните условия и ограничения"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/buxgalteriya-dasturini-tanlash",
        title: "O‘zbekistonda buxgalteriya dasturini tanlash",
        description:
          "O‘zbekistonda buxgalteriya dasturini tanlash mezonlarini ko‘ring: import, hisobotlar, operatsiyalarni tekshirish, kirish huquqlari va xizmat narxi.",
        h1: "Dasturni biznesingiz vazifalarida tekshiring",
        h2: ["Vazifalar ro‘yxatini tuzing", "Jarayonni misolda tekshiring", "Shartlar va cheklovlarni solishtiring"],
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
    relatedIds: ["26", "08"],
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
  {
    id: "30",
    type: "guide",
    parentId: "18",
    relatedIds: ["24", "19", "25"],
    contentStatus: "published",
    updatedAt: "2026-09-09",
    featureEvidence:
      "Повторно использует реальные форматы импорта темы 03 и маршрут начальных остатков темы 24. Не обещает конвертацию произвольной Excel-бухгалтерии одним кликом — только план подготовки данных.",
    primaryCta: "register",
    locales: {
      ru: {
        path: "rukovodstva/perehod-iz-excel",
        title: "Как перейти от Excel к учёту в программе | Contador",
        description:
          "Составьте план перехода от таблиц к учёту в Contador: выберите дату, соберите остатки, подготовьте поддерживаемые выписки и проверьте первые отчёты.",
        h1: "Подготовьте переход от таблиц к Contador",
        h2: ["Определите границы переноса", "Подготовьте остатки и выписки", "Сверьте первый период"],
        faq: [],
      },
      uz: {
        path: "qollanmalar/exceldan-otish",
        title: "Excel’dan hisob dasturiga o‘tish | Contador",
        description:
          "Contador’ga o‘tish rejasini tuzing: sanani tanlang, qoldiqlarni yig‘ing, mos bank ko‘chirmalarini tayyorlang va dastlabki hisobotlarni tekshiring.",
        h1: "Jadvallardan Contador’ga o‘tishni tayyorlang",
        h2: ["Ko‘chirish chegaralarini belgilang", "Qoldiqlar va ko‘chirmalarni tayyorlang", "Birinchi davrni tekshiring"],
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
