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

// "" -> undefined (JSON.stringify drops it), otherwise a number
const toNumber = (v: string) => (v.trim() === "" ? undefined : Number(v));

export default function MenuTest() {
  // Create item form state
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createImage, setCreateImage] = useState("");
  const [createPriority, setCreatePriority] = useState("");
  const [createInStock, setCreateInStock] = useState("");

  // Edit item form state
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editClearCategory, setEditClearCategory] = useState(false);
  const [editImage, setEditImage] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editInStock, setEditInStock] = useState("");

  // Unlist form state
  const [unlistId, setUnlistId] = useState("");

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
    executeRequest("Create Item", "/api/menu/items", {
      method: "POST",
      body: JSON.stringify({
        name: createName,
        description: createDescription === "" ? undefined : createDescription,
        price: toNumber(createPrice),
        categoryId: toNumber(createCategoryId),
        image: createImage === "" ? undefined : createImage,
        priority: toNumber(createPriority),
        inStock: createInStock === "" ? undefined : createInStock === "true",
      }),
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only send fields that were filled in, like a real PATCH
    const body: Record<string, unknown> = {};
    if (editName !== "") body.name = editName;
    if (editDescription !== "") body.description = editDescription;
    if (editPrice !== "") body.price = Number(editPrice);
    if (editClearCategory) body.categoryId = null;
    else if (editCategoryId !== "") body.categoryId = Number(editCategoryId);
    if (editImage !== "") body.image = editImage;
    if (editPriority !== "") body.priority = Number(editPriority);
    if (editInStock !== "") body.inStock = editInStock === "true";

    executeRequest(
      `Edit Item #${editId}`,
      `/api/menu/items/${encodeURIComponent(editId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
  };

  const handleUnlist = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest(
      `Unlist Item #${unlistId}`,
      `/api/menu/items/${encodeURIComponent(unlistId)}/unlist`,
      { method: "PATCH" },
    );
  };

  const handleListItems = () => {
    executeRequest("List My Items", "/api/menu/items", { method: "GET" });
  };

  const handleGetUser = () => {
    executeRequest("Get User (Me)", "/api/users/me", { method: "GET" });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">Menu Items Testing Console</h1>
          <p className="text-sm text-gray-500">
            Minimal dev bench to test item create, edit and unlist. Log in on
            the Auth tab first. Fields are not validated here on purpose, so
            you can send bad data and see how the server answers.
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
                  onClick={handleListItems}
                  className={grayButtonClass}
                >
                  List My Items
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGetUser}
                  className={grayButtonClass}
                >
                  Get User (Me)
                </button>
              </div>
            </div>

            {/* Create Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Create Item</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Chocolate Cake"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <input
                    type="text"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Price (smallest unit)</label>
                    <input
                      type="number"
                      value={createPrice}
                      onChange={(e) => setCreatePrice(e.target.value)}
                      placeholder="2500"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Category ID</label>
                    <input
                      type="number"
                      value={createCategoryId}
                      onChange={(e) => setCreateCategoryId(e.target.value)}
                      placeholder="Optional"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Image</label>
                  <input
                    type="text"
                    value={createImage}
                    onChange={(e) => setCreateImage(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Priority</label>
                    <input
                      type="number"
                      value={createPriority}
                      onChange={(e) => setCreatePriority(e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>In Stock</label>
                    <select
                      value={createInStock}
                      onChange={(e) => setCreateInStock(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Default (true)</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Create Item
                </button>
              </form>
            </div>

            {/* Edit Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-1">Edit Item</h2>
              <p className="text-xs text-gray-500 mb-3">
                Only the fields you fill in are sent.
              </p>
              <form onSubmit={handleEdit} className="space-y-3">
                <div>
                  <label className={labelClass}>Item ID</label>
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
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Price (smallest unit)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Category ID</label>
                    <input
                      type="number"
                      value={editCategoryId}
                      disabled={editClearCategory}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className={`${inputClass} disabled:opacity-50`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={editClearCategory}
                    onChange={(e) => setEditClearCategory(e.target.checked)}
                  />
                  Clear category (sends categoryId: null)
                </label>
                <div>
                  <label className={labelClass}>Image</label>
                  <input
                    type="text"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Priority</label>
                    <input
                      type="number"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>In Stock</label>
                    <select
                      value={editInStock}
                      onChange={(e) => setEditInStock(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Unchanged</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-emerald-600 text-white font-medium text-sm rounded hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Edit Item
                </button>
              </form>
            </div>

            {/* Unlist Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Unlist Item</h2>
              <form onSubmit={handleUnlist} className="space-y-3">
                <div>
                  <label className={labelClass}>Item ID</label>
                  <input
                    type="text"
                    required
                    value={unlistId}
                    onChange={(e) => setUnlistId(e.target.value)}
                    placeholder="1"
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded border border-red-200 disabled:opacity-50 transition"
                >
                  Unlist Item
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