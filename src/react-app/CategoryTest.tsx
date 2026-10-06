import { useState } from "react";

interface ResponseLog {
  action: string;
  status: string;
  timestamp: string;
  data: unknown;
}

const labelClass = "block text-xs font-medium text-gray-700 mb-1";
const inputClass = "w-full px-3 py-2 border rounded text-sm bg-white";
const grayButtonClass =
  "py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded border border-gray-300 disabled:opacity-50 transition";

export default function CategoryTest() {
  // Create category form state
  const [createName, setCreateName] = useState("");

  // Rename category form state
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

  // Remove category form state
  const [removeId, setRemoveId] = useState("");

  // Response display state
  const [loading, setLoading] = useState(false);
  const [responseLog, setResponseLog] = useState<ResponseLog | null>(null);

  const executeRequest = async (
    label: string,
    url: string,
    options?: RequestInit,
  ) => {
    setLoading(true);
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
        ...options,
      });

      let responseData: unknown;
      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }

      setResponseLog({
        action: label,
        status: `${res.status} ${res.statusText || ""}`.trim(),
        timestamp: new Date().toLocaleTimeString(),
        data: responseData,
      });
    } catch (err: unknown) {
      setResponseLog({
        action: label,
        status: "Error",
        timestamp: new Date().toLocaleTimeString(),
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest("Create Category", "/api/menu/categories", {
      method: "POST",
      body: JSON.stringify({ name: createName }),
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest(
      `Edit Category #${editId}`,
      `/api/menu/categories/${encodeURIComponent(editId)}`,
      { method: "PATCH", body: JSON.stringify({ name: editName }) },
    );
  };

  const handleRemove = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest(
      `Remove Category #${removeId}`,
      `/api/menu/categories/${encodeURIComponent(removeId)}`,
      { method: "DELETE" },
    );
  };

  const handleListCategories = () => {
    executeRequest("List My Categories", "/api/menu/categories", {
      method: "GET",
    });
  };

  // Handy for checking what happened to items after a category is removed
  const handleListItems = () => {
    executeRequest("List My Items", "/api/menu/items", { method: "GET" });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">Categories Testing Console</h1>
          <p className="text-sm text-gray-500">
            Minimal dev bench to test category add, rename, remove and list.
            Log in on the Auth tab first. Fields are not validated here on
            purpose, so you can send bad data and see how the server answers.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Controls Column */}
          <div className="space-y-6">
            {/* Actions Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h2 className="text-lg font-semibold">API Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleListCategories}
                  className={grayButtonClass}
                >
                  List My Categories
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleListItems}
                  className={grayButtonClass}
                >
                  List My Items
                </button>
              </div>
            </div>

            {/* Create Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Add Category</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Desserts"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Add Category
                </button>
              </form>
            </div>

            {/* Edit Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Edit Category</h2>
              <form onSubmit={handleEdit} className="space-y-3">
                <div>
                  <label className={labelClass}>Category ID</label>
                  <input
                    type="text"
                    required
                    value={editId}
                    onChange={(e) => setEditId(e.target.value)}
                    placeholder="1"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>New Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Sweet Treats"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-emerald-600 text-white font-medium text-sm rounded hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Edit Category
                </button>
              </form>
            </div>

            {/* Remove Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-1">Remove Category</h2>
              <p className="text-xs text-gray-500 mb-3">
                Items in the category are kept and become uncategorized.
              </p>
              <form onSubmit={handleRemove} className="space-y-3">
                <div>
                  <label className={labelClass}>Category ID</label>
                  <input
                    type="text"
                    required
                    value={removeId}
                    onChange={(e) => setRemoveId(e.target.value)}
                    placeholder="1"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded border border-red-200 disabled:opacity-50 transition"
                >
                  Remove Category
                </button>
              </form>
            </div>
          </div>

          {/* Response Box Column */}
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Server Response</h2>
                {loading && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                    Loading...
                  </span>
                )}
              </div>
              {responseLog && (
                <button
                  type="button"
                  onClick={() => setResponseLog(null)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Clear
                </button>
              )}
            </div>

            {responseLog ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700">
                    Action: {responseLog.action}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded ${
                      responseLog.status.startsWith("2")
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {responseLog.status}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{responseLog.timestamp}</span>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
                  {JSON.stringify(responseLog.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-400 border border-dashed rounded bg-gray-50">
                No requests made yet. Submit a form or click an action button to
                see raw server response.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}