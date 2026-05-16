"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, Plus, CheckCircle2, Loader2, AlertCircle, Edit3 } from "lucide-react";
import { useUI } from "@/lib/ui-context";

interface TransactionItem {
  step?: number;
  step_label?: string;
  description: string;
  amount: number;
  date: string;
  period?: string;
  debit: { code: string; name: string; is_missing: boolean };
  credit: { code: string; name: string; is_missing: boolean };
}

interface Message {
  id: string;
  explanation?: string;
  text?: string;
  sender: "user" | "ai";
  action?: {
    type: 'CREATE_TRANSACTION' | 'CREATE_TRANSACTIONS';
    data?: TransactionItem;           // legacy single
    transactions?: TransactionItem[]; // new multi
  } | null;
  isExecuted?: boolean;
  isPendingConfirm?: boolean; // BUG-9: шаг подтверждения
  error?: string;
  executedTransactionIds?: string[]; // IDs created in DB
}

export default function AIChat() {
  const { isChatOpen, setIsChatOpen, toggleChat } = useUI();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1", 
      text: "Здравствуйте! Я ваш **финансовый ассистент**. Опишите операцию (например: «Заплатили налог с оборота 500 000»), и я создам все нужные проводки. Или задайте вопрос по бухгалтерии.", 
      sender: "ai" 
    },
  ]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // BUG-9: редактируемые суммы в карточках подтверждения
  const [editableAmounts, setEditableAmounts] = useState<Record<string, number[]>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user"
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // ── BUG-8: Обогащённая история чата ────────────────────────────
      const history = messages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.sender === "ai" && m.action && m.action.transactions
          ? `${m.explanation || ""}\n[Предложенные проводки: ${JSON.stringify(m.action.transactions)}]`
          : m.sender === "ai" && m.action && m.action.data
          ? `${m.explanation || ""}\n[Предложенная проводка: ${JSON.stringify(m.action.data)}]`
          : m.explanation || m.text || ""
      }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Ошибка связи с ИИ");
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        explanation: data.explanation,
        sender: "ai",
        action: data.action || null
      };

      // Инициализируем редактируемые суммы для карточки
      if (data.action?.transactions?.length) {
        setEditableAmounts(prev => ({
          ...prev,
          [aiMessage.id]: data.action.transactions.map((t: TransactionItem) => t.amount)
        }));
      }

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── BUG-9: Двухшаговое подтверждение ─────────────────────────────
  const requestConfirm = (messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isPendingConfirm: true } : m
    ));
  };

  const executeTransaction = async (messageId: string, msg: Message) => {
    try {
      const baseTxList: TransactionItem[] =
        msg.action?.transactions ||
        (msg.action?.data ? [msg.action.data] : []);

      // Применяем отредактированные суммы если есть
      const amounts = editableAmounts[messageId];
      const transactions = baseTxList.map((item, idx) => ({
        ...item,
        amount: amounts?.[idx] ?? item.amount
      }));

      const response = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка записи");
      }

      const result = await response.json();
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { 
          ...m, 
          isExecuted: true, 
          isPendingConfirm: false,
          executedTransactionIds: result.transactions?.map((tx: any) => tx.id) || []
        } : m
      ));

      showToast(`Записано ${result.count || 1} проводок!`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Ошибка записи";
      showToast(errMsg, 'error');
      // Сбрасываем pendingConfirm при ошибке чтобы пользователь мог попробовать снова
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isPendingConfirm: false } : m
      ));
    }
  };

  const undoTransaction = async (messageId: string, ids: string[]) => {
    if (!ids || ids.length === 0) return;
    
    if (!confirm(`Удалить записанны${ids.length > 1 ? 'е' : 'ю'} проводк${ids.length > 1 ? 'и' : 'у'}?`)) return;

    try {
      setIsLoading(true);
      for (const id of ids) {
        const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Ошибка удаления");
        }
      }
      
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isExecuted: false, executedTransactionIds: [] } : m
      ));
      
      showToast("Операция отменена");
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAmount = (messageId: string, idx: number, value: string) => {
    const num = parseFloat(value.replace(/\s/g, ''));
    if (!isNaN(num)) {
      setEditableAmounts(prev => {
        const cur = [...(prev[messageId] || [])];
        cur[idx] = num;
        return { ...prev, [messageId]: cur };
      });
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isChatOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 animate-bounce-subtle outline-none"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-400" /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Chat Panel */}
      <div
        className={`fixed top-0 right-0 h-screen bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-[60] flex flex-col transition-transform duration-300 ease-in-out sm:w-[450px] w-full ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="bg-black text-white px-5 py-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight leading-none mb-1 text-white">ИИ Помощник</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium italic">Powered by GPT-4o</p>
            </div>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </header>

        {/* Message Area */}
        <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#fbfbfb]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] space-y-3 ${
                  msg.sender === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-black text-white rounded-2xl rounded-tr-none shadow-md"
                      : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-none shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {(msg.explanation || msg.text || "").split("\n").map((line, i) => (
                      <p key={i} className={line.startsWith("*") ? "ml-4" : "mb-1"}>
                        {line.split("**").map((part, j) => 
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Transaction Cards (single or multi) */}
                {msg.action && (msg.action.type === 'CREATE_TRANSACTION' || msg.action.type === 'CREATE_TRANSACTIONS') && (() => {
                  const txList: TransactionItem[] =
                    msg.action.transactions ||
                    (msg.action.data ? [msg.action.data] : []);
                  const amounts = editableAmounts[msg.id] || txList.map(t => t.amount);
                  const isConfirming = msg.isPendingConfirm;

                  return (
                    <div className={`mt-2 rounded-2xl border transition-all duration-300 ${
                      msg.isExecuted
                        ? 'border-green-100 bg-green-50/40'
                        : isConfirming
                        ? 'border-black bg-white shadow-xl'
                        : 'border-gray-100 bg-white shadow-lg'
                    } p-4`}>
                      {/* Заголовок карточки */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                          {isConfirming
                            ? '⚠️ Подтвердите запись'
                            : txList.length > 1
                            ? `${txList.length} проводки`
                            : 'Новая проводка'}
                        </span>
                        {isConfirming && (
                          <span className="text-[9px] bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full uppercase">
                            Проверьте суммы
                          </span>
                        )}
                      </div>

                      {/* Карточки проводок */}
                      <div className="space-y-3 mb-4">
                        {txList.map((item, idx) => (
                          <div key={idx} className={`rounded-xl p-3 border ${isConfirming ? 'border-gray-200 bg-gray-50' : 'bg-gray-50 border-gray-100'}`}>
                            {item.step_label && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[9px] font-bold bg-black text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                  {item.step || idx + 1}
                                </span>
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">{item.step_label}</span>
                              </div>
                            )}
                            <p className="text-[10px] text-gray-500 italic mb-2">{item.description}</p>
                            <div className="flex gap-2 items-center">
                              {/* Дебет */}
                              <div className="flex-1 bg-white rounded-lg p-2 border border-gray-100 relative">
                                <span className="absolute -top-1.5 left-2 px-0.5 text-[7px] bg-white text-gray-400 font-bold uppercase">Дт</span>
                                <p className="font-mono text-xs font-bold">{item.debit.code}</p>
                                <p className="text-[9px] text-gray-400 truncate">{item.debit.name}</p>
                                {item.debit.is_missing && <Plus size={10} className="text-blue-400 absolute top-1 right-1" />}
                              </div>
                              {/* Кредит */}
                              <div className="flex-1 bg-white rounded-lg p-2 border border-gray-100 relative">
                                <span className="absolute -top-1.5 left-2 px-0.5 text-[7px] bg-white text-gray-400 font-bold uppercase">Кт</span>
                                <p className="font-mono text-xs font-bold">{item.credit.code}</p>
                                <p className="text-[9px] text-gray-400 truncate">{item.credit.name}</p>
                                {item.credit.is_missing && <Plus size={10} className="text-blue-400 absolute top-1 right-1" />}
                              </div>
                              {/* Сумма — редактируемая в режиме подтверждения */}
                              <div className="flex flex-col items-end justify-center pl-1 min-w-[80px]">
                                {isConfirming ? (
                                  <div className="relative">
                                    <Edit3 size={8} className="absolute -top-1 -left-1 text-gray-400" />
                                    <input
                                      type="number"
                                      value={amounts[idx]}
                                      onChange={e => updateAmount(msg.id, idx, e.target.value)}
                                      className="w-full text-xs font-mono font-bold bg-white border border-black rounded px-2 py-1 text-right outline-none"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs font-mono font-bold bg-black text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {Number(amounts[idx]).toLocaleString('ru-RU')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Кнопки действий */}
                      {!msg.isExecuted ? (
                        isConfirming ? (
                          <div className="space-y-2">
                            {/* Шаг 2: Финальное подтверждение */}
                            <button
                              onClick={() => executeTransaction(msg.id, msg)}
                              className="w-full py-3 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 shadow-xl"
                            >
                              <CheckCircle2 size={14} />
                              <span>Да, записать {txList.length > 1 ? `все ${txList.length} проводки` : 'операцию'}</span>
                            </button>
                            <button
                              onClick={() => setMessages(prev => prev.map(m =>
                                m.id === msg.id ? { ...m, isPendingConfirm: false } : m
                              ))}
                              className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                            >
                              Отменить
                            </button>
                          </div>
                        ) : (
                          /* Шаг 1: Запрос подтверждения */
                          <button
                            onClick={() => requestConfirm(msg.id)}
                            className="w-full py-3 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 shadow-xl"
                          >
                            <CheckCircle2 size={14} />
                            <span>{txList.length > 1 ? `Записать все ${txList.length} проводки` : 'Записать операцию'}</span>
                          </button>
                        )
                      ) : (
                        <div className="flex flex-col items-center space-y-2 py-2">
                          <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle2 size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Записано</span>
                          </div>
                          <button 
                            onClick={() => undoTransaction(msg.id, msg.executedTransactionIds || [])}
                            className="text-[10px] text-gray-400 hover:text-red-500 underline font-bold uppercase tracking-widest transition-colors"
                          >
                            Отменить запись
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2 shadow-sm">
                <Loader2 size={16} className="animate-spin text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">ИИ анализирует данные...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Footer Area */}
        <footer className="p-5 border-t border-gray-50 bg-white">
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:border-black transition-all group shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Опишите операцию (например: Продажа товара)..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-3 placeholder:text-gray-400 resize-none overflow-y-auto"
              disabled={isLoading}
              rows={1}
              style={{ minHeight: '44px' }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="ml-2 w-11 h-11 bg-black text-white rounded-xl flex items-center justify-center hover:bg-gray-800 transition-all disabled:opacity-20 active:scale-95 shadow-md flex-shrink-0"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center font-medium leading-tight">
            ИИ может ошибаться. Проверяйте счета и суммы перед записью.
          </p>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
