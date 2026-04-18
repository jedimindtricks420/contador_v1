"use client";

import Link from "next/link";
import { 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Cpu, 
  BarChart3, 
  MessageSquareText, 
  ChevronRight,
  Globe
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-white text-black min-h-screen font-sans selection:bg-black selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <img src="/contador text logo.svg" alt="Contador" className="h-7 w-auto" />
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
              <a href="#features" className="hover:text-black transition-colors">Функции</a>
              <a href="#pricing" className="hover:text-black transition-colors">Тарифы</a>
              <a href="#about" className="hover:text-black transition-colors">О сервисе</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-gray-500 hover:text-black transition-colors px-4 py-2">
              Войти
            </Link>
            <Link href="/register" className="bg-black text-white text-sm font-bold px-6 py-2.5 rounded hover:bg-gray-800 transition-all shadow-sm flex items-center gap-2">
              Начать работу <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-100 mb-8">
            <ShieldCheck size={14} className="text-black" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Соответствует НСБУ №21 (Узбекистан)</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 text-black leading-[1.05]">
            Умная бухгалтерия для <br /> <span className="text-gray-300">IT-сервисных компаний.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            Автоматизируйте финансовый учет, формируйте отчетность и управляйте налогами с помощью ИИ-ассистента, знающего специфику вашего бизнеса.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-black text-white px-10 py-4 rounded font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/5">
              Попробовать бесплатно
            </Link>
            <Link href="#features" className="bg-white border border-gray-200 text-black px-10 py-4 rounded font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
              Возможности системы
            </Link>
          </div>
          
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-[#F9FAFB] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 bg-white border border-gray-200 rounded-lg hover:shadow-xl hover:shadow-black/5 transition-all">
              <MessageSquareText className="mb-6 text-black" size={32} />
              <h3 className="text-lg font-bold mb-3 uppercase tracking-tight">AI Ассистент</h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">Умный помощник, который разбирается в проводках и помогает правильно оформлять операции согласно НСБУ.</p>
            </div>
            <div className="p-8 bg-white border border-gray-200 rounded-lg hover:shadow-xl hover:shadow-black/5 transition-all">
              <BarChart3 className="mb-6 text-black" size={32} />
              <h3 className="text-lg font-bold mb-3 uppercase tracking-tight">Отчетность (ОСВ)</h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">Оборотно-сальдовая ведомость, баланс и отчет о финансовых результатах формируются автоматически.</p>
            </div>
            <div className="p-8 bg-white border border-gray-200 rounded-lg hover:shadow-xl hover:shadow-black/5 transition-all">
              <Cpu className="mb-6 text-black" size={32} />
              <h3 className="text-lg font-bold mb-3 uppercase tracking-tight">IT Специфика</h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">Специализированные шаблоны для IT-компаний: ПВТ, учет лицензий, роялти и экспортных услуг.</p>
            </div>
            <div className="p-8 bg-white border border-gray-200 rounded-lg hover:shadow-xl hover:shadow-black/5 transition-all">
              <ShieldCheck className="mb-6 text-black" size={32} />
              <h3 className="text-lg font-bold mb-3 uppercase tracking-tight">Безопасность</h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium">Шифрование данных банковского уровня и полное соответствие законодательству Республики Узбекистан.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold tracking-tight mb-4">Гибкие тарифы</h2>
            <p className="text-gray-400 font-medium">Выберите план, который подходит для вашего масштаба</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-12 border border-gray-100 rounded-2xl flex flex-col bg-gray-50/50">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Старт</h3>
              <div className="text-4xl font-bold mb-8">0 <span className="text-lg font-medium text-gray-400">сум</span></div>
              <ul className="space-y-4 mb-12 flex-grow">
                {["1 организация", "Все базовые проводки", "Аналитика за месяц", "Сообщество в Telegram"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-gray-600">
                    <CheckCircle2 size={16} className="text-gray-300" /> {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="w-full py-4 rounded border border-black font-bold text-black hover:bg-black hover:text-white transition-all text-center">
                Выбрать базовый
              </Link>
            </div>

            <div className="p-12 border-2 border-black rounded-2xl flex flex-col relative overflow-hidden shadow-2xl shadow-black/10">
              <div className="absolute top-6 right-6">
                 <span className="bg-black text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Популярный</span>
              </div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Профессиональный</h3>
              <div className="text-4xl font-bold mb-8">299 000 <span className="text-lg font-medium text-gray-400">сум / год</span></div>
              <ul className="space-y-4 mb-12 flex-grow">
                {["Безлимитные организации", "AI бухгалтерский помощник", "Полный аудит операций", "Премиум поддержка 24/7", "Доступ к API", "Налоговые консультации"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium text-gray-900">
                    <CheckCircle2 size={16} className="text-black" /> {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="w-full py-4 rounded bg-black text-white font-bold hover:bg-gray-800 transition-all text-center">
                Подключить PRO
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 bg-black text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Готовы навести порядок в финансах?</h2>
          <p className="text-gray-400 text-lg mb-12 font-medium">Присоединяйтесь к IT-компаниям, которые уже выбрали Contador.</p>
          <Link href="/register" className="inline-flex bg-white text-black px-12 py-5 rounded font-bold text-xl hover:bg-gray-100 transition-all items-center gap-3">
             Создать аккаунт <ChevronRight size={24} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-col items-center md:items-start">
             <img src="/contador text logo.svg" alt="Contador" className="h-6 w-auto mb-4" />
             <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">© 2026 Contador. Все права защищены.</p>
          </div>
          <div className="flex gap-8 text-sm font-bold text-gray-300 uppercase tracking-widest">
            <Link href="/" className="hover:text-black transition-colors">Безопасность</Link>
            <Link href="/" className="hover:text-black transition-colors">Политика</Link>
            <Link href="/" className="hover:text-black transition-colors">Договор оферты</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
