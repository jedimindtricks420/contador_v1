import { AccountType, AccountLayer, PrismaClient } from "@prisma/client";

export interface CoaEntry {
  code: string;
  name: string;
  type: AccountType;
  group: string;
  layer: AccountLayer;
  isDeprecated: boolean;
}

// Источник: NSBU21_COA_2025.md (НСБУ №21, рег. №3593-2 от 16.03.2026, 214 счетов)
export const MASTER_COA: CoaEntry[] = [
  // СИСТЕМНЫЕ
  { code: "0000", name: "Вспомогательный (ввод начальных остатков)", type: "ACTIVE_PASSIVE", group: "Системные", layer: "CORE", isDeprecated: false },

  // ОСНОВНЫЕ СРЕДСТВА
  { code: "0100", name: "Основные средства (сводный счёт)", type: "ASSET", group: "Основные средства", layer: "CORE", isDeprecated: false },
  { code: "0110", name: "Земля", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0111", name: "Благоустройство земли", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0112", name: "Благоустройство ОС по финансовой аренде", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0120", name: "Здания, сооружения и передаточные устройства", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0130", name: "Машины и оборудование", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0140", name: "Мебель и офисное оборудование", type: "ASSET", group: "Основные средства", layer: "CORE", isDeprecated: false },
  { code: "0150", name: "Компьютерное оборудование и вычислительная техника", type: "ASSET", group: "Основные средства", layer: "CORE", isDeprecated: false },
  { code: "0160", name: "Транспортные средства", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0170", name: "Рабочий и продуктивный скот", type: "ASSET", group: "Основные средства", layer: "INDUSTRY", isDeprecated: false },
  { code: "0180", name: "Многолетние насаждения", type: "ASSET", group: "Основные средства", layer: "INDUSTRY", isDeprecated: false },
  { code: "0190", name: "Прочие основные средства", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "0199", name: "Законсервированные основные средства", type: "ASSET", group: "Основные средства", layer: "EXTENSION", isDeprecated: false },

  // ИЗНОС ОС
  { code: "0200", name: "Износ основных средств", type: "CONTRA_ASSET", group: "Износ ОС", layer: "CORE", isDeprecated: false },
  { code: "0211", name: "Износ благоустройства земли", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0212", name: "Износ благоустройства ОС по финансовой аренде", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0220", name: "Износ зданий, сооружений и передаточных устройств", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0230", name: "Износ машин и оборудования", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0240", name: "Износ мебели и офисного оборудования", type: "CONTRA_ASSET", group: "Износ ОС", layer: "CORE", isDeprecated: false },
  { code: "0250", name: "Износ компьютерного оборудования", type: "CONTRA_ASSET", group: "Износ ОС", layer: "CORE", isDeprecated: false },
  { code: "0260", name: "Износ транспортных средств", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0270", name: "Износ рабочего скота", type: "CONTRA_ASSET", group: "Износ ОС", layer: "INDUSTRY", isDeprecated: false },
  { code: "0280", name: "Износ многолетних насаждений", type: "CONTRA_ASSET", group: "Износ ОС", layer: "INDUSTRY", isDeprecated: false },
  { code: "0290", name: "Износ прочих основных средств", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },
  { code: "0299", name: "Износ ОС по финансовой аренде", type: "CONTRA_ASSET", group: "Износ ОС", layer: "EXTENSION", isDeprecated: false },

  // ОС ПО АРЕНДЕ
  { code: "0310", name: "ОС, полученные по договору финансовой аренды", type: "ASSET", group: "ОС по аренде", layer: "EXTENSION", isDeprecated: false },

  // НМА
  { code: "0410", name: "Патенты, лицензии и ноу-хау", type: "ASSET", group: "Нематериальные активы", layer: "EXTENSION", isDeprecated: false },
  { code: "0420", name: "Торговые марки, товарные знаки и промышленные образцы", type: "ASSET", group: "Нематериальные активы", layer: "EXTENSION", isDeprecated: false },
  { code: "0430", name: "Программное обеспечение", type: "ASSET", group: "Нематериальные активы", layer: "CORE", isDeprecated: false },
  { code: "0440", name: "Права пользования землей и природными ресурсами", type: "ASSET", group: "Нематериальные активы", layer: "EXTENSION", isDeprecated: false },
  { code: "0460", name: "Франчайзинг", type: "ASSET", group: "Нематериальные активы", layer: "INDUSTRY", isDeprecated: false },
  { code: "0470", name: "Авторские права", type: "ASSET", group: "Нематериальные активы", layer: "INDUSTRY", isDeprecated: false },
  { code: "0480", name: "Гудвилл", type: "ASSET", group: "Нематериальные активы", layer: "EXTENSION", isDeprecated: false },
  { code: "0490", name: "Прочие нематериальные активы", type: "ASSET", group: "Нематериальные активы", layer: "EXTENSION", isDeprecated: false },

  // АМОРТИЗАЦИЯ НМА
  { code: "0510", name: "Амортизация патентов, лицензий и ноу-хау", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "EXTENSION", isDeprecated: false },
  { code: "0520", name: "Амортизация торговых марок и пром. образцов", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "EXTENSION", isDeprecated: false },
  { code: "0530", name: "Амортизация программного обеспечения", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "CORE", isDeprecated: false },
  { code: "0540", name: "Амортизация прав пользования землей", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "EXTENSION", isDeprecated: false },
  { code: "0550", name: "Амортизация организационных расходов", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "EXTENSION", isDeprecated: true },
  { code: "0560", name: "Амортизация франчайзинга", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "INDUSTRY", isDeprecated: false },
  { code: "0570", name: "Амортизация авторских прав", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "INDUSTRY", isDeprecated: false },
  { code: "0590", name: "Амортизация прочих НМА", type: "CONTRA_ASSET", group: "Амортизация НМА", layer: "EXTENSION", isDeprecated: false },

  // ДОЛГОСРОЧНЫЕ ИНВЕСТИЦИИ
  { code: "0610", name: "Ценные бумаги (долгосрочные)", type: "ASSET", group: "Долгосрочные инвестиции", layer: "EXTENSION", isDeprecated: false },
  { code: "0620", name: "Инвестиции в дочерние общества", type: "ASSET", group: "Долгосрочные инвестиции", layer: "EXTENSION", isDeprecated: false },
  { code: "0630", name: "Инвестиции в зависимые общества", type: "ASSET", group: "Долгосрочные инвестиции", layer: "EXTENSION", isDeprecated: false },
  { code: "0640", name: "Инвестиции в предприятия с иностранным капиталом", type: "ASSET", group: "Долгосрочные инвестиции", layer: "EXTENSION", isDeprecated: false },
  { code: "0690", name: "Прочие долгосрочные инвестиции", type: "ASSET", group: "Долгосрочные инвестиции", layer: "EXTENSION", isDeprecated: false },

  // КАПИТАЛЬНЫЕ ВЛОЖЕНИЯ
  { code: "0710", name: "Оборудование к установке — отечественное", type: "ASSET", group: "Капитальные вложения", layer: "INDUSTRY", isDeprecated: false },
  { code: "0720", name: "Оборудование к установке — импортное", type: "ASSET", group: "Капитальные вложения", layer: "INDUSTRY", isDeprecated: false },
  { code: "0810", name: "Незавершённое строительство", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0820", name: "Приобретение основных средств", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0830", name: "Приобретение нематериальных активов", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0840", name: "Формирование основного стада", type: "ASSET", group: "Капитальные вложения", layer: "INDUSTRY", isDeprecated: false },
  { code: "0850", name: "Капитальные вложения в благоустройство земли", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0860", name: "Капитальные вложения в ОС по финансовой аренде", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0870", name: "Капитальные вложения в ОС по оперативной аренде", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },
  { code: "0890", name: "Прочие капитальные вложения", type: "ASSET", group: "Капитальные вложения", layer: "EXTENSION", isDeprecated: false },

  // ДОЛГОСРОЧНАЯ ДЕБИТОРКА
  { code: "0910", name: "Векселя полученные (долгосрочные)", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0920", name: "Платежи к получению по финансовой аренде", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0930", name: "Долгосрочная задолженность персонала", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0940", name: "Прочая долгосрочная дебиторская задолженность", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0950", name: "Отсроченный налог на прибыль (долгосрочный)", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0960", name: "Долгосрочные отсроченные расходы по дисконтам", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },
  { code: "0990", name: "Прочие долгосрочные отсроченные расходы", type: "ASSET", group: "Долгосрочная дебиторка", layer: "EXTENSION", isDeprecated: false },

  // МАТЕРИАЛЫ
  { code: "1010", name: "Сырьё и материалы", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1020", name: "Покупные полуфабрикаты и комплектующие изделия", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1030", name: "Топливо", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1040", name: "Запасные части", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1050", name: "Строительные материалы", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1060", name: "Тара и тарные материалы", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1070", name: "Материалы, переданные в переработку на сторону", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1080", name: "Инвентарь и хозяйственные принадлежности", type: "ASSET", group: "Производственные запасы", layer: "EXTENSION", isDeprecated: false },
  { code: "1090", name: "Прочие материалы", type: "ASSET", group: "Производственные запасы", layer: "EXTENSION", isDeprecated: false },
  { code: "1110", name: "Животные на выращивании", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1120", name: "Животные на откорме", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1510", name: "Заготовление и приобретение материалов", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },
  { code: "1610", name: "Отклонения в стоимости материалов", type: "ASSET", group: "Производственные запасы", layer: "INDUSTRY", isDeprecated: false },

  // ПРОИЗВОДСТВО И ТМЗ
  { code: "2010", name: "Основное производство", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2110", name: "Полуфабрикаты собственного производства", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2310", name: "Вспомогательное производство", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2510", name: "Общепроизводственные расходы", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2610", name: "Брак в производстве", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2710", name: "Обслуживающие хозяйства", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2810", name: "Готовая продукция на складе", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2820", name: "Готовая продукция на выставке", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2830", name: "Готовая продукция, переданная на комиссию", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2910", name: "Товары на складах", type: "ASSET", group: "Производство и ТМЗ", layer: "EXTENSION", isDeprecated: false },
  { code: "2920", name: "Товары в розничной торговле", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2930", name: "Товары на выставке", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2940", name: "Предметы проката", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2950", name: "Тара под товаром и порожняя", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2960", name: "Товары, переданные на комиссию", type: "ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2970", name: "Товары в пути", type: "ASSET", group: "Производство и ТМЗ", layer: "EXTENSION", isDeprecated: false },
  { code: "2980", name: "Торговая наценка", type: "CONTRA_ASSET", group: "Производство и ТМЗ", layer: "INDUSTRY", isDeprecated: false },
  { code: "2990", name: "Прочие товары", type: "ASSET", group: "Производство и ТМЗ", layer: "EXTENSION", isDeprecated: false },

  // ПРЕДОПЛАТЫ И РБП
  { code: "3110", name: "Предоплаченная оперативная аренда", type: "ASSET", group: "Предоплаты и РБП", layer: "CORE", isDeprecated: false },
  { code: "3120", name: "Предоплаченные услуги", type: "ASSET", group: "Предоплаты и РБП", layer: "CORE", isDeprecated: false },
  { code: "3190", name: "Прочие расходы будущих периодов", type: "ASSET", group: "Предоплаты и РБП", layer: "CORE", isDeprecated: false },
  { code: "3210", name: "Отсроченный налог на прибыль (текущий)", type: "ASSET", group: "Предоплаты и РБП", layer: "EXTENSION", isDeprecated: false },
  { code: "3220", name: "Отсроченные расходы по дисконтам", type: "ASSET", group: "Предоплаты и РБП", layer: "EXTENSION", isDeprecated: false },
  { code: "3290", name: "Прочие отсроченные расходы", type: "ASSET", group: "Предоплаты и РБП", layer: "EXTENSION", isDeprecated: false },

  // ДЕБИТОРСКАЯ ЗАДОЛЖЕННОСТЬ
  { code: "4010", name: "Счета к получению от покупателей и заказчиков", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4020", name: "Векселя полученные (текущие)", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4110", name: "Счета к получению от обособленных подразделений", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4120", name: "Счета к получению от дочерних и зависимых обществ", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4210", name: "Авансы, выданные по оплате труда", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4220", name: "Авансы, выданные на служебные командировки", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4230", name: "Авансы, выданные на общехозяйственные расходы", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4290", name: "Прочие авансы, выданные персоналу", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4310", name: "Авансы поставщикам под ТМЦ", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4320", name: "Авансы поставщикам под долгосрочные активы", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4330", name: "Прочие авансы выданные", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4410", name: "Авансовые платежи по налогам и сборам в бюджет", type: "ASSET", group: "Дебиторская задолженность", layer: "CORE", isDeprecated: false },
  { code: "4510", name: "Авансовые платежи по страхованию", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4520", name: "Авансовые платежи в государственные целевые фонды", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4610", name: "Задолженность учредителей по вкладам в уставный капитал", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4710", name: "Задолженность персонала по товарам в кредит", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4720", name: "Задолженность персонала по предоставленным займам", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4730", name: "Задолженность персонала по возмещению ущерба", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4790", name: "Прочая задолженность персонала", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4810", name: "Платежи к получению по финансовой аренде (тек.)", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4820", name: "Платежи к получению по оперативной аренде", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4830", name: "Проценты к получению", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4840", name: "Дивиденды к получению", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4850", name: "Роялти к получению", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4860", name: "Счета к получению по претензиям", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4890", name: "Задолженность прочих дебиторов", type: "ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },
  { code: "4910", name: "Резерв по сомнительным долгам", type: "CONTRA_ASSET", group: "Дебиторская задолженность", layer: "EXTENSION", isDeprecated: false },

  // ДЕНЕЖНЫЕ СРЕДСТВА
  { code: "5010", name: "Касса (национальная валюта)", type: "ASSET", group: "Денежные средства", layer: "CORE", isDeprecated: false },
  { code: "5020", name: "Касса (иностранная валюта)", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5110", name: "Расчётный счёт", type: "ASSET", group: "Денежные средства", layer: "CORE", isDeprecated: false },
  { code: "5210", name: "Валютные счета внутри страны", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5220", name: "Валютные счета за рубежом", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5510", name: "Аккредитивы", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5520", name: "Чековые книжки", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5530", name: "Прочие специальные счета", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5610", name: "Денежные эквиваленты (по видам)", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5710", name: "Денежные средства (переводы) в пути", type: "ASSET", group: "Денежные средства", layer: "CORE", isDeprecated: false },
  { code: "5810", name: "Ценные бумаги (краткосрочные)", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5830", name: "Краткосрочные займы выданные", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5890", name: "Прочие текущие инвестиции", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5910", name: "Недостачи и потери от порчи ценностей", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },
  { code: "5920", name: "Прочие текущие активы", type: "ASSET", group: "Денежные средства", layer: "EXTENSION", isDeprecated: false },

  // КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА
  { code: "6010", name: "Счета к оплате поставщикам и подрядчикам", type: "ACTIVE_PASSIVE", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6020", name: "Векселя выданные (краткосрочные)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6110", name: "Счета к оплате обособленным подразделениям", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6120", name: "Счета к оплате дочерним и зависимым обществам", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6210", name: "Отсроченные доходы в виде дисконта (скидки)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6220", name: "Отсроченные доходы в виде премии (надбавки)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6230", name: "Прочие отсроченные доходы", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6240", name: "Отсроченные обязательства по налогам и сборам", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6250", name: "Обязательства по отсроченному налогу на прибыль", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6290", name: "Прочие отсроченные обязательства", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6310", name: "Авансы, полученные от покупателей и заказчиков", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6320", name: "Авансы, полученные от подписчиков на акции", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6390", name: "Прочие полученные авансы", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6410", name: "Задолженность по платежам в бюджетную систему", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6510", name: "Платежи по страхованию", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6520", name: "Платежи в государственные целевые фонды", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6530", name: "Задолженность по ИНПС (накопительная пенсия)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6610", name: "Дивиденды к оплате", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6620", name: "Задолженность выбывающим учредителям по их доле", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6630", name: "Вклады учредителей по увеличению уставного капитала", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6710", name: "Расчёты с персоналом по оплате труда", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6720", name: "Депонированная заработная плата", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6810", name: "Краткосрочные банковские кредиты", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6820", name: "Краткосрочные займы", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6830", name: "Облигации к оплате (краткосрочные)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6840", name: "Векселя к оплате (краткосрочные)", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6910", name: "Оперативная аренда к оплате", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6920", name: "Начисленные проценты", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6930", name: "Задолженность по роялти", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6940", name: "Задолженность по гарантиям", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6950", name: "Долгосрочные обязательства — текущая часть", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6960", name: "Счета к оплате по претензиям", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "6970", name: "Задолженность подотчётным лицам", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },
  { code: "6990", name: "Прочие обязательства", type: "LIABILITY", group: "Краткосрочные обязательства", layer: "CORE", isDeprecated: false },

  // ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА
  { code: "7010", name: "Долгосрочные счета к оплате поставщикам", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7020", name: "Долгосрочные векселя выданные", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7110", name: "Долгосрочная задолженность обособленным подразделениям", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7120", name: "Долгосрочная задолженность дочерним обществам", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7210", name: "Долгосрочные отсроченные доходы (дисконт)", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7220", name: "Долгосрочные отсроченные доходы (премия)", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7230", name: "Прочие долгосрочные отсроченные доходы", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7240", name: "Долгосрочные отсроченные обязательства по налогам", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7250", name: "Долгосрочные обязательства по отсроченному налогу", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7290", name: "Прочие долгосрочные отсроченные обязательства", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7310", name: "Авансы от покупателей — долгосрочная часть", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7810", name: "Долгосрочные банковские кредиты", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7820", name: "Долгосрочные займы", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7830", name: "Долгосрочные облигации к оплате", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7840", name: "Долгосрочные векселя к оплате", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7910", name: "Финансовая аренда к оплате", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },
  { code: "7920", name: "Прочие долгосрочные задолженности кредиторам", type: "LIABILITY", group: "Долгосрочные обязательства", layer: "EXTENSION", isDeprecated: false },

  // КАПИТАЛ
  { code: "8310", name: "Простые акции", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8320", name: "Привилегированные акции", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8330", name: "Паи и вклады", type: "LIABILITY", group: "Капитал", layer: "CORE", isDeprecated: false },
  { code: "8410", name: "Эмиссионный доход", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8420", name: "Курсовая разница при формировании уставного капитала", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8510", name: "Корректировки по переоценке долгосрочных активов", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8520", name: "Резервный капитал (фонд)", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8530", name: "Безвозмездно полученное имущество", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8610", name: "Выкупленные собственные акции — простые", type: "CONTRA_LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8620", name: "Выкупленные собственные акции — привилегированные", type: "CONTRA_LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8710", name: "Нераспределённая прибыль (убыток) отчётного периода", type: "LIABILITY", group: "Капитал", layer: "CORE", isDeprecated: false },
  { code: "8720", name: "Накопленная прибыль (непокрытый убыток)", type: "LIABILITY", group: "Капитал", layer: "CORE", isDeprecated: false },
  { code: "8810", name: "Гранты", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8820", name: "Субсидии", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8830", name: "Членские взносы", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8840", name: "Налоговые льготы с целевым использованием", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8890", name: "Прочие целевые поступления", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },
  { code: "8910", name: "Резервы предстоящих расходов и платежей", type: "LIABILITY", group: "Капитал", layer: "EXTENSION", isDeprecated: false },

  // ДОХОДЫ И РАСХОДЫ (тип TRANSIT — нет остатка на конец периода)
  { code: "9010", name: "Доходы от реализации готовой продукции", type: "TRANSIT", group: "Доходы от осн. деятельности", layer: "INDUSTRY", isDeprecated: false },
  { code: "9020", name: "Доходы от реализации товаров", type: "TRANSIT", group: "Доходы от осн. деятельности", layer: "EXTENSION", isDeprecated: false },
  { code: "9030", name: "Доходы от выполнения работ и оказания услуг", type: "TRANSIT", group: "Доходы от осн. деятельности", layer: "CORE", isDeprecated: false },
  { code: "9040", name: "Возврат проданных товаров (продукции)", type: "TRANSIT", group: "Доходы от осн. деятельности", layer: "EXTENSION", isDeprecated: false },
  { code: "9050", name: "Скидки, предоставленные покупателям", type: "TRANSIT", group: "Доходы от осн. деятельности", layer: "EXTENSION", isDeprecated: false },
  { code: "9110", name: "Себестоимость реализованной готовой продукции", type: "TRANSIT", group: "Себестоимость", layer: "INDUSTRY", isDeprecated: false },
  { code: "9120", name: "Себестоимость реализованных товаров", type: "TRANSIT", group: "Себестоимость", layer: "EXTENSION", isDeprecated: false },
  { code: "9130", name: "Себестоимость выполненных работ и услуг", type: "TRANSIT", group: "Себестоимость", layer: "CORE", isDeprecated: false },
  { code: "9140", name: "Приобретение/покупка ТМЗ при периодическом учёте", type: "TRANSIT", group: "Себестоимость", layer: "INDUSTRY", isDeprecated: false },
  { code: "9150", name: "Корректировки по ТМЗ при периодическом учёте", type: "TRANSIT", group: "Себестоимость", layer: "INDUSTRY", isDeprecated: false },
  { code: "9210", name: "Выбытие основных средств", type: "TRANSIT", group: "Выбытие активов", layer: "EXTENSION", isDeprecated: false },
  { code: "9220", name: "Выбытие прочих активов", type: "TRANSIT", group: "Выбытие активов", layer: "EXTENSION", isDeprecated: false },
  { code: "9310", name: "Прибыль от выбытия основных средств", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9320", name: "Убыток от выбытия основных средств", type: "TRANSIT", group: "Расходы периода", layer: "EXTENSION", isDeprecated: false },
  { code: "9330", name: "Взысканные пени, штрафы, неустойки", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9340", name: "Прибыли прошлых лет", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9350", name: "Доходы от оперативной аренды", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9360", name: "Доходы от списания кредиторской задолженности", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9370", name: "Доходы обслуживающих хозяйств", type: "TRANSIT", group: "Прочие операц. доходы", layer: "INDUSTRY", isDeprecated: false },
  { code: "9380", name: "Безвозмездная финансовая помощь", type: "TRANSIT", group: "Прочие операц. доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9390", name: "Прочие операционные доходы", type: "TRANSIT", group: "Прочие операц. доходы", layer: "CORE", isDeprecated: false },
  { code: "9410", name: "Расходы по реализации", type: "TRANSIT", group: "Расходы периода", layer: "EXTENSION", isDeprecated: false },
  { code: "9420", name: "Административные расходы", type: "TRANSIT", group: "Расходы периода", layer: "CORE", isDeprecated: false },
  { code: "9430", name: "Прочие операционные расходы", type: "TRANSIT", group: "Расходы периода", layer: "CORE", isDeprecated: false },
  { code: "9510", name: "Доходы в виде роялти", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9520", name: "Доходы в виде дивидендов", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9530", name: "Доходы в виде процентов", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9540", name: "Доходы от валютных курсовых разниц", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9550", name: "Доходы от финансовой аренды", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9560", name: "Доходы от переоценки ценных бумаг", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9590", name: "Прочие доходы от финансовой деятельности", type: "TRANSIT", group: "Финансовые доходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9610", name: "Расходы в виде процентов", type: "TRANSIT", group: "Финансовые расходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9620", name: "Убытки от валютных курсовых разниц", type: "TRANSIT", group: "Финансовые расходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9630", name: "Расходы по выпуску и распространению ценных бумаг", type: "TRANSIT", group: "Финансовые расходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9690", name: "Прочие расходы по финансовой деятельности", type: "TRANSIT", group: "Финансовые расходы", layer: "EXTENSION", isDeprecated: false },
  { code: "9710", name: "Чрезвычайные прибыли", type: "TRANSIT", group: "Чрезвычайные", layer: "EXTENSION", isDeprecated: false },
  { code: "9720", name: "Чрезвычайные убытки", type: "TRANSIT", group: "Чрезвычайные", layer: "EXTENSION", isDeprecated: false },
  { code: "9810", name: "Расходы по налогу на прибыль", type: "TRANSIT", group: "Налоги с прибыли", layer: "CORE", isDeprecated: false },
  { code: "9820", name: "Расходы по прочим налогам от прибыли", type: "TRANSIT", group: "Налоги с прибыли", layer: "EXTENSION", isDeprecated: false },
  { code: "9910", name: "Конечный финансовый результат (прибыль или убыток)", type: "TRANSIT", group: "Финансовый результат", layer: "CORE", isDeprecated: false },

  // ЗАБАЛАНСОВЫЕ
  { code: "001", name: "Основные средства, полученные по оперативной аренде", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "002", name: "ТМЦ, принятые на ответственное хранение", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "003", name: "Материалы, принятые в переработку", type: "OFF_BALANCE", group: "Забалансовые", layer: "INDUSTRY", isDeprecated: false },
  { code: "004", name: "Товары, принятые на комиссию", type: "OFF_BALANCE", group: "Забалансовые", layer: "INDUSTRY", isDeprecated: false },
  { code: "005", name: "Оборудование, принятое для монтажа", type: "OFF_BALANCE", group: "Забалансовые", layer: "INDUSTRY", isDeprecated: false },
  { code: "006", name: "Бланки строгой отчётности", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "007", name: "Списанная в убыток задолженность неплатёжеспособных дебиторов", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "008", name: "Обеспечения обязательств и платежей — полученные", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "009", name: "Обеспечения обязательств и платежей — выданные", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "010", name: "Основные средства, сданные по договору финансовой аренды", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "011", name: "Имущество, полученное по договору ссуды", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "012", name: "Расходы, исключаемые из налогооблагаемой базы следующих периодов", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "013", name: "Временные налоговые и таможенные льготы (по видам)", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "014", name: "Инвентарь и хозяйственные принадлежности в эксплуатации", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "015", name: "Имущество, полученное по договору простого товарищества", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
  { code: "016", name: "Нематериальные активы, полученные по праву пользования", type: "OFF_BALANCE", group: "Забалансовые", layer: "EXTENSION", isDeprecated: false },
];

// Итого: 214 счетов (включая 0550 deprecated)
// Источник: NSBU21_COA_2025.md, НСБУ №21, рег. №3593-2 от 16.03.2026

export async function upsertAllAccounts(prisma: PrismaClient): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;

  for (const acc of MASTER_COA) {
    const existing = await prisma.account.findUnique({ where: { code: acc.code } });
    if (existing) {
      await prisma.account.update({
        where: { code: acc.code },
        data: {
          name: acc.name,
          type: acc.type,
          group: acc.group,
          layer: acc.layer,
          isDeprecated: acc.isDeprecated,
        },
      });
      updated++;
    } else {
      await prisma.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          group: acc.group,
          layer: acc.layer,
          isDeprecated: acc.isDeprecated,
          isSystem: true,
        },
      });
      created++;
    }
  }

  return { created, updated, total: MASTER_COA.length };
}
