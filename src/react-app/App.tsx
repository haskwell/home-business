import { useState } from "react";
import "./App.css";
import Test from "./Test";
import MenuTest from "./MenuTest";
import CategoryTest from "./CategoryTest";

function App() {
  const [page, setPage] = useState<"auth" | "menu" | "categories">("auth");

  const tabClass = (active: boolean) =>
    `py-1.5 px-4 text-sm font-medium rounded border transition ${
      active
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
    }`;

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPage("auth")}
          className={tabClass(page === "auth")}
        >
          Auth
        </button>
        <button
          type="button"
          onClick={() => setPage("menu")}
          className={tabClass(page === "menu")}
        >
          Menu Items
        </button>
        <button
          type="button"
          onClick={() => setPage("categories")}
          className={tabClass(page === "categories")}
        >
          Categories
        </button>
      </nav>

      {/* Both stay mounted so each tab keeps its forms and last response */}
      <div className={page === "auth" ? "" : "hidden"}>
        <Test />
      </div>
      <div className={page === "menu" ? "" : "hidden"}>
        <MenuTest />
      </div>
      <div className={page === "categories" ? "" : "hidden"}>
        <CategoryTest />
      </div>
    </>
  );
}

export default App;