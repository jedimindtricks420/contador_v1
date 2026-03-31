"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";
import { useUI } from "@/lib/ui-context";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
}

export default function AIChat() {
  const { isChatOpen, setIsChatOpen, toggleChat } = useUI();
  const [messages] = useState<Message[]>([
    { id: 1, text: "Здравствуйте! Я ваш **финансовый ассистент**. Чем могу помочь с анализом журнала операций?", sender: "ai" },
    { id: 2, text: "Как обстоят дела с вводом остатков?", sender: "user" },
    { id: 3, text: "Согласно текущим данным:\n\n* Дебет: 15 000 000\n* Кредит: 15 000 000\n* Разница: **0.00**\n\nБаланс по счету 0000 полностью сошелся. Вы можете фиксировать остатки.", sender: "ai" },
  ]);

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

      {/* Chat Panel */}
      <div
        className={`fixed top-0 right-0 h-screen bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-[60] flex flex-col transition-transform duration-300 ease-in-out sm:w-[400px] w-full ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="bg-black text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight leading-none mb-1 text-white">ИИ Помощник</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Финансовый эксперт</p>
            </div>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </header>

        {/* Message Area remains identical */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fbfbfb]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 text-sm ${
                  msg.sender === "user"
                    ? "bg-black text-white rounded-2xl rounded-tr-none shadow-md"
                    : "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none shadow-sm"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.text.split("\n").map((line, i) => (
                    <p key={i} className={line.startsWith("*") ? "ml-4" : ""}>
                      {line.split("**").map((part, j) => 
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                      )}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </main>

        {/* Footer Area remains identical */}
        <footer className="p-4 border-t border-gray-100 bg-white">
          <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus-within:border-black transition-colors">
            <input
              type="text"
              placeholder="Задайте вопрос..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-2"
            />
            <button className="ml-2 w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity">
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center leading-tight">
            ИИ может ошибаться. Пожалуйста, всегда проверяйте критические финансовые данные.
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
