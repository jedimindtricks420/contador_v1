"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";

interface AccountNode {
  id: string;
  code: string;
  name: string;
  type: string;
  isHidden: boolean;
  usageCount: number;
  children: AccountNode[];
}

interface DocumentType {
  id: string;
  code: string;
  name: string;
  postingTemplate: any;
}

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "DOC_TYPES">("ACCOUNTS");
  
  // Accounts State
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  // Document Types State
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [docTypesLoading, setDocTypesLoading] = useState(true);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);

  useEffect(() => {
    if (activeTab === "ACCOUNTS") {
      loadAccounts();
    } else {
      loadDocTypes();
    }
  }, [activeTab, search, showHidden]);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await fetch(`/v2/api/accounts?search=${encodeURIComponent(search)}&showHidden=${showHidden}`);
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadDocTypes = async () => {
    if (docTypes.length > 0) return;
    setDocTypesLoading(true);
    try {
      const res = await fetch("/v2/api/document-types");
      const data = await res.json();
      setDocTypes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDocTypesLoading(false);
    }
  };

  const toggleVisibility = async (id: string, currentlyHidden: boolean) => {
    try {
      await fetch(`/v2/api/accounts/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !currentlyHidden }),
      });
      loadAccounts();
    } catch (err) {
      console.error(err);
    }
  };

  // Recursive component to render account tree
  const AccountTree = ({ nodes, depth = 0 }: { nodes: AccountNode[], depth?: number }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string) => {
      setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
      <div className="space-y-1">
        {nodes.map(node => {
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expanded[node.id] || search.length > 0; // Auto-expand on search

          return (
            <div key={node.id}>
              <div 
                className={`flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded group ${node.isHidden ? 'opacity-50' : ''}`}
                style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
              >
                <div className="flex items-center gap-2 flex-1">
                  {hasChildren ? (
                    <button onClick={() => toggleExpand(node.id)} className="p-0.5 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <div className="w-5" /> // Spacer for alignment
                  )}
                  <span className="font-mono text-sm font-semibold text-gray-700 w-12">{node.code}</span>
                  <span className="text-sm text-gray-900 truncate">{node.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  {node.usageCount > 0 && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {node.usageCount} опер.
                    </span>
                  )}
                  <button 
                    onClick={() => toggleVisibility(node.id, node.isHidden)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title={node.isHidden ? "Показать" : "Скрыть"}
                  >
                    {node.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {hasChildren && isExpanded && (
                <AccountTree nodes={node.children} depth={depth + 1} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Справочники счетов и операций</h1>
        <p className="text-gray-500 mt-1">Просмотр плана счетов и каталога алгоритмов проводок</p>
      </div>

      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          <button
            onClick={() => setActiveTab("ACCOUNTS")}
            className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "ACCOUNTS" 
                ? "border-gray-300 text-black" 
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            План счетов
          </button>
          <button
            onClick={() => setActiveTab("DOC_TYPES")}
            className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "DOC_TYPES" 
                ? "border-gray-300 text-black" 
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Типы операций (Каталог)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "ACCOUNTS" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по коду или названию..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-black focus:bg-white transition-colors"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHidden}
                    onChange={(e) => setShowHidden(e.target.checked)}
                    className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black"
                  />
                  <span className="text-sm text-gray-600">Показывать скрытые</span>
                </label>
              </div>

              {accountsLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
              ) : accounts.length === 0 ? (
                <div className="py-12 text-center text-gray-400">Ничего не найдено</div>
              ) : (
                <div className="bg-white border border-gray-100 rounded p-2 max-h-[600px] overflow-y-auto">
                  <AccountTree nodes={accounts} />
                </div>
              )}
            </div>
          )}

          {activeTab === "DOC_TYPES" && (
            <div className="space-y-4">
              {docTypesLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Код</th>
                        <th className="py-3 px-4">Название</th>
                        <th className="py-3 px-4 text-right">Шаблон проводок</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {docTypes.map(doc => (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-gray-600">{doc.code}</td>
                          <td className="py-3 px-4 font-medium text-gray-900">{doc.name}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedDocType(doc)}
                              className="text-black hover:text-black font-medium"
                            >
                              Просмотреть
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posting Template Modal */}
      {selectedDocType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">
                Шаблон проводок: {selectedDocType.name}
              </h3>
              <button 
                onClick={() => setSelectedDocType(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-900 rounded p-4 overflow-auto max-h-[400px]">
                <pre className="text-sm font-mono text-green-400">
                  {JSON.stringify(selectedDocType.postingTemplate, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
