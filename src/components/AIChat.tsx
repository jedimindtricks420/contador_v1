"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, Plus, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useUI } from "@/lib/ui-context";

interface TransactionData {
  description: string;
  amount: number;
  date: string;
  debit: { code: string; name: string; is_missing: boolean };
  credit: { code: string; name: string; is_missing: boolean };
}

interface Message {
  id: string;
  explanation?: string;
  text?: string; // Fallback for simple messages
  sender: "user" | "ai";
  action?: {
    type: 'CREATE_TRANSACTION';
    data: TransactionData;
  };
  isExecuted?: boolean;
  error?: string;
}

export default function AIChat() {
  const { isChatOpen, setIsChatOpen, toggleChat } = useUI();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1", 
      text: "Здравствуйте! Я ваш **финансовый ассистент**. Чем могу помочь с анализом журнала операций или созданием проводок?", 
      sender: "ai" 
    },
  ]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
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
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: input,
          history: messages.map(m => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.explanation || m.text || ""
          }))
        })
      });

      if (!response.ok) throw new Error("Ошибка связи с ИИ");

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        explanation: data.explanation,
        sender: "ai",
        action: data.action
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const executeTransaction = async (messageId: string, actionData: TransactionData) => {
    try {
      const response = await fetch("/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: actionData })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка записи");
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, isExecuted: true } : m
      ));

      showToast("Транзакция создана, план счетов обновлен!");
    } catch (err: any) {
      showToast(err.message, 'error');
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
                className={`max-w-[90%] space-y-3 ${
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

                {/* Transaction Card */}
                {msg.action?.type === 'CREATE_TRANSACTION' && (
                  <div className={`mt-2 rounded-2xl border ${msg.isExecuted ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-white shadow-lg'} p-4 transition-all duration-500 overflow-hidden`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Новая транзакция</span>
                      <span className="text-xs font-mono font-bold bg-black text-white px-2 py-0.5 rounded-full">{msg.action.data.amount.toLocaleString()} UZS</span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-4 italic font-medium">"{msg.action.data.description}"</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Debit */}
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 relative group">
                        <span className="absolute -top-2 left-3 px-1 text-[8px] bg-white border border-gray-100 text-gray-400 font-bold uppercase rounded">Дебет</span>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-gray-900">{msg.action.data.debit.code}</p>
                            <p className="text-[10px] text-gray-500 truncate">{msg.action.data.debit.name}</p>
                          </div>
                          {msg.action.data.debit.is_missing && <Plus size={12} className="text-blue-500 flex-shrink-0 mt-1" />}
                        </div>
                      </div>
                      
                      {/* Credit */}
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 relative group">
                        <span className="absolute -top-2 left-3 px-1 text-[8px] bg-white border border-gray-100 text-gray-400 font-bold uppercase rounded">Кредит</span>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-gray-900">{msg.action.data.credit.code}</p>
                            <p className="text-[10px] text-gray-500 truncate">{msg.action.data.credit.name}</p>
                          </div>
                          {msg.action.data.credit.is_missing && <Plus size={12} className="text-blue-500 flex-shrink-0 mt-1" />}
                        </div>
                      </div>
                    </div>

                    {!msg.isExecuted ? (
                      <button
                        onClick={() => executeTransaction(msg.id, msg.action!.data)}
                        className="w-full py-3 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 shadow-xl"
                      >
                        <CheckCircle2 size={14} />
                        <span>Записать операцию</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-center py-2 space-x-2 text-green-600">
                        <CheckCircle2 size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Записано</span>
                      </div>
                    )}
                  </div>
                )}
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Введите запрос (например: 'Оплатил аренду 500к из кассы')..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-3 placeholder:text-gray-400"
              disabled={isLoading}
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
            ИИ может ошибаться. Пожалуйста, всегда проверяйте счета и суммы перед записью.
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
