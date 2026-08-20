"use client";

import { useState, useEffect } from "react";
import { Users, Mail, Trash2, Shield, Plus, X, AlertTriangle } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export default function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("ACCOUNTANT");
  const [inviteError, setInviteError] = useState("");
  const [mockPassword, setMockPassword] = useState("");
  const [inviteConfirm, setInviteConfirm] = useState<{ email: string; role: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const [removeError, setRemoveError] = useState<string>("");
  const [removeLoading, setRemoveLoading] = useState(false);

  async function loadMembers() {
    try {
      const res = await fetch("/v2/api/org/members");
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    // Show confirm step instead of sending immediately
    setInviteConfirm({ email: inviteEmail, role: inviteRole });
  }

  async function handleInviteConfirmed() {
    if (!inviteConfirm) return;
    setInviteError("");
    setMockPassword("");
    try {
      const res = await fetch("/v2/api/org/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteConfirm.email, role: inviteConfirm.role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Ошибка приглашения");
      } else {
        setMembers((prev) => [...prev, data.member]);
        setInviteEmail("");
        setInviteConfirm(null);
        if (data.mockInvitePassword) {
          setMockPassword(data.mockInvitePassword);
        }
      }
    } catch {
      setInviteError("Network error");
    } finally {
      setInviteConfirm(null);
    }
  }

  async function handleRemoveConfirmed() {
    if (!removingMember) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      const res = await fetch(`/v2/api/org/members/${removingMember.user.id}`, { method: "DELETE" });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.user.id !== removingMember.user.id));
        setRemovingMember(null);
      } else {
        const data = await res.json();
        setRemoveError(data.error || "Ошибка удаления");
      }
    } catch {
      setRemoveError("Ошибка сети. Попробуйте снова.");
    } finally {
      setRemoveLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Загрузка...</div>;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Участники организации</h1>
            <p className="text-gray-500 mt-1">Управление доступом пользователей к данным организации</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  Список участников
                </h2>
                <span className="text-sm text-gray-500">{members.length} пользователей</span>
              </div>
              
              <div className="divide-y divide-gray-100">
                {members.map((m) => (
                  <div key={m.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-black font-bold">
                        {m.user.name?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{m.user.name || "Без имени"}</div>
                        <div className="text-sm text-gray-500">{m.user.email}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                        <Shield className="w-3.5 h-3.5" />
                        {m.role === "OWNER" ? "Владелец" : m.role === "ADMIN" ? "Админ" : "Бухгалтер"}
                      </div>
                      
                      <button
                        onClick={() => { setRemovingMember(m); setRemoveError(""); }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-gray-400" />
                Пригласить участника
              </h2>
              
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-black"
                    placeholder="user@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                  <SearchableSelect
                    options={[
                      { value: "ACCOUNTANT", label: "Бухгалтер" },
                      { value: "ADMIN", label: "Администратор" },
                    ]}
                    value={inviteRole}
                    onChange={setInviteRole}
                  />
                </div>

                {inviteError && (
                  <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">
                    {inviteError}
                  </div>
                )}

                {mockPassword && (
                  <div className="text-green-700 text-sm bg-green-50 p-3 rounded border border-green-100">
                    <p className="font-semibold mb-1">Пользователь создан!</p>
                    <p>Поскольку почта отключена, передайте пользователю этот временный пароль:</p>
                    <code className="block mt-2 px-2 py-1 bg-white border border-green-200 rounded font-mono text-lg text-center">
                      {mockPassword}
                    </code>
                  </div>
                )}

                {inviteConfirm ? (
                  <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded">
                    <p className="text-sm text-gray-700 font-medium">
                      Пригласить <strong>{inviteConfirm.email}</strong> как{" "}
                      <strong>{inviteConfirm.role === "ADMIN" ? "Администратор" : "Бухгалтер"}</strong>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteConfirm(null)}
                        className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-100 transition"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={handleInviteConfirmed}
                        className="flex-1 py-2 bg-black text-white text-sm rounded font-medium hover:opacity-80 transition flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Да, отправить
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="w-full py-2 bg-black text-white rounded font-medium hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Отправить приглашение
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Remove member confirm modal */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded border border-gray-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <h3 className="text-sm font-bold text-gray-900">Удалить участника?</h3>
              </div>
              <button onClick={() => setRemovingMember(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{removingMember.user.name || removingMember.user.email}</p>
              <p className="text-xs text-gray-500">{removingMember.user.email}</p>
            </div>
            <p className="text-xs text-gray-600">Пользователь потеряет доступ к данным организации. Это действие можно отменить, повторно пригласив пользователя.</p>
            {removeError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                {removeError}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setRemovingMember(null)}
                disabled={removeLoading}
                className="flex-1 text-xs border border-gray-200 text-gray-700 font-bold py-2.5 rounded hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleRemoveConfirmed}
                disabled={removeLoading}
                className="flex-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded transition disabled:opacity-50"
              >
                {removeLoading ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
