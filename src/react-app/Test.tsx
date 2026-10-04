import { useState } from "react";

interface ResponseLog {
  action: string;
  status: string;
  timestamp: string;
  data: unknown;
}

export default function Test() {
  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerNumber, setRegisterNumber] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Response display state
  const [loading, setLoading] = useState(false);
  const [responseLog, setResponseLog] = useState<ResponseLog | null>(null);

  const executeRequest = async (label: string, url: string, options?: RequestInit) => {
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest("Register", "/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        number: registerNumber,
      }),
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    executeRequest("Login", "/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
    });
  };

  const handleLogout = () => {
    executeRequest("Logout", "/api/auth/sign-out", {
      method: "POST",
      body: JSON.stringify({}),
    });
  };

  const handleGetAllUsers = () => {
    executeRequest("Get All Users", "/api/users", {
      method: "GET",
    });
  };

  const handleGetUser = () => {
    executeRequest("Get User (Me)", "/api/users/me", {
      method: "GET",
    });
  };

  const handleGetSession = () => {
    executeRequest("Get Auth Session", "/api/auth/get-session", {
      method: "GET",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">API & Auth Testing Console</h1>
          <p className="text-sm text-gray-500">
            Minimal dev bench to test Better Auth and user endpoints.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Controls Column */}
          <div className="space-y-6">
            {/* Register Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Register</h2>
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={registerNumber}
                    onChange={(e) => setRegisterNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Register
                </button>
              </form>
            </div>

            {/* Login Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
              <h2 className="text-lg font-semibold mb-3">Login</h2>
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded text-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-emerald-600 text-white font-medium text-sm rounded hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  Login
                </button>
              </form>
            </div>

            {/* Actions Section */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs space-y-3">
              <h2 className="text-lg font-semibold">API Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGetUser}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded border border-gray-300 disabled:opacity-50 transition"
                >
                  Get User (Me)
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGetAllUsers}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded border border-gray-300 disabled:opacity-50 transition"
                >
                  Get All Users
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGetSession}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded border border-gray-300 disabled:opacity-50 transition"
                >
                  Get Auth Session
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogout}
                  className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded border border-red-200 disabled:opacity-50 transition"
                >
                  Logout
                </button>
              </div>
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
                No requests made yet. Submit a form or click an action button to see raw server response.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
