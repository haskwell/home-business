/* eslint react-hooks/set-state-in-effect: off, react-hooks/exhaustive-deps: off */
import { useEffect, useState, type FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ApiResponse } from "./api/ApiResponse";
import {
  businessApi,
  menuApi,
  ordersApi,
  publicApi,
  uploadsApi,
  usersApi,
  type Business,
  type Category,
  type Item,
  type Order,
  type PublicBusiness,
  type TrackingOrder,
} from "./api/endpoints";
import { authClient } from "./lib/auth-client";

const money = (n: number) => `Rs ${(n / 100).toFixed(2)}`;
function ErrorBox({ result }: { result: ApiResponse<unknown> | null }) {
  const issues = result?.error?.issues;
  const unavailable =
    issues && typeof issues === "object" && "itemIds" in issues
      ? issues.itemIds
      : null;
  return result && !result.ok ? (
    <div className="my-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      {result.status} · {result.error?.code}: {result.error?.message}
      {Array.isArray(unavailable) && (
        <p>Remove unavailable item IDs: {unavailable.join(", ")}</p>
      )}
      {issues ? (
        <pre className="overflow-auto">{JSON.stringify(issues, null, 2)}</pre>
      ) : null}
    </div>
  ) : null;
}
function useResult<T>() {
  const [result, setResultState] = useState<ApiResponse<T> | null>(null);
  const setResult = (value: ApiResponse<unknown> | null) =>
    setResultState(
      value && !value.ok
        ? ApiResponse.failure<T>(
            value.status,
            value.error ?? {
              message: "Request failed",
              code: "REQUEST_FAILED",
            },
          )
        : null,
    );
  const run = async (p: Promise<ApiResponse<T>>) => {
    const r = await p;
    setResultState(r);
    if (r.isUnauthorized() && location.pathname.startsWith("/dashboard"))
      location.assign("/login");
    return r;
  };
  return { result, setResult, run };
}
function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const session = authClient.useSession();
  const user = session.data?.user as
    | { businessId?: number | null; name?: string }
    | undefined;
  useEffect(() => {
    if (
      !session.isPending &&
      !user &&
      location.pathname.startsWith("/dashboard")
    )
      nav("/login");
    else if (
      !session.isPending &&
      user &&
      !user.businessId &&
      location.pathname.startsWith("/dashboard")
    )
      nav("/onboarding");
  }, [session.isPending, user, nav]);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4">
        <Link to="/dashboard" className="font-bold">
          Home Business
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link to="/dashboard">Overview</Link>
          <Link to="/dashboard/menu">Menu</Link>
          <Link to="/dashboard/orders">Orders</Link>
          <Link to="/dashboard/business">Business</Link>
          <Link to="/dashboard/account">Account</Link>
          <Link to="/dashboard/users">Users</Link>
        </nav>
        <button
          className="rounded border px-3 py-1"
          onClick={async () => {
            await authClient.signOut();
            nav("/login");
          }}
        >
          Logout
        </button>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
function Login() {
  const nav = useNavigate();
  const err = useResult<unknown>();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const r = await authClient.signIn.email({
      email: String(d.get("email")),
      password: String(d.get("password")),
    });
    const a = ApiResponse.adapted(
      r.data,
      r.error as { message?: string; status?: number; code?: string } | null,
    );
    err.setResult(a);
    if (a.ok) {
      const me = await usersApi.me();
      nav(
        (me.data?.user as { businessId?: number } | undefined)?.businessId
          ? "/dashboard"
          : "/onboarding",
      );
    }
  };
  return (
    <AuthFrame title="Sign in">
      <form onSubmit={submit} className="grid gap-3">
        <input
          className="field"
          name="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          className="field"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <ErrorBox result={err.result} />
        <button className="button">Sign in</button>
        <Link to="/register">Create an account</Link>
      </form>
    </AuthFrame>
  );
}
function Register() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const err = useResult<unknown>();
  const check = async (value: string) => {
    setSlug(value);
    if (value) {
      const r = await businessApi.slug(value);
      setAvailable(r.data?.available ?? null);
    }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (step === 1) {
      const image = f.get("picture") as File;
      const input: Parameters<typeof authClient.signUp.email>[0] & {
        number: string;
      } = {
        name: String(f.get("name")),
        email: String(f.get("email")),
        password: String(f.get("password")),
        number: String(f.get("phone")),
      };
      const r = await authClient.signUp.email(input);
      const a = ApiResponse.adapted(
        r.data,
        r.error as { message?: string; status?: number; code?: string } | null,
      );
      err.setResult(a);
      if (a.ok) {
        if (image.size) await uploadsApi.post("user/image", image);
        setStep(2);
      }
      return;
    }
    const r = await businessApi.create({
      name,
      businessLink: slug,
      description: String(f.get("description") || ""),
    });
    if (!r.ok) {
      err.setResult(r);
      nav("/onboarding");
      return;
    }
    for (const [field, path] of [
      ["logo", "business/logo"],
      ["banner", "business/banner"],
    ] as const) {
      const file = f.get(field) as File;
      if (file?.size) {
        const up = await uploadsApi.post(path, file);
        if (!up.ok) {
          nav("/onboarding");
          return;
        }
      }
    }
    nav("/dashboard");
  };
  return (
    <AuthFrame title={step === 1 ? "Create account" : "Set up your business"}>
      <form onSubmit={submit} className="grid gap-3">
        {step === 1 ? (
          <>
            <input
              className="field"
              name="name"
              placeholder="Your name"
              required
            />
            <input
              className="field"
              name="email"
              type="email"
              placeholder="Email"
              required
            />
            <input
              className="field"
              name="phone"
              placeholder="Phone number"
              required
            />
            <input
              className="field"
              name="password"
              type="password"
              minLength={8}
              placeholder="Password"
              required
            />
            <label>
              Profile picture{" "}
              <input name="picture" type="file" accept="image/*" />
            </label>
          </>
        ) : (
          <>
            <input
              className="field"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug)
                  void check(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
              name="businessName"
              placeholder="Business name"
              required
            />
            <input
              className="field"
              value={slug}
              onChange={(e) => void check(e.target.value)}
              placeholder="business-link"
              required
            />
            <small>
              {available === null
                ? "Check slug availability"
                : available
                  ? "Available"
                  : "Unavailable or invalid"}
            </small>
            <textarea
              className="field"
              name="description"
              placeholder="Description"
            />
            <label>
              Logo <input name="logo" type="file" accept="image/*" />
            </label>
            <label>
              Banner <input name="banner" type="file" accept="image/*" />
            </label>
          </>
        )}
        <ErrorBox result={err.result} />
        <button className="button">
          {step === 1 ? "Continue" : "Create business"}
        </button>
        {step === 1 ? (
          <Link to="/login">Already registered? Sign in</Link>
        ) : (
          <button type="button" onClick={() => setStep(1)}>
            Back
          </button>
        )}
      </form>
    </AuthFrame>
  );
}
function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto mt-12 max-w-md rounded border bg-white p-6">
      <h1 className="mb-5 text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
function Onboarding() {
  const nav = useNavigate();
  const e = useResult<{ business: Business }>();
  return (
    <AuthFrame title="Finish business setup">
      <form
        className="grid gap-3"
        onSubmit={async (ev) => {
          ev.preventDefault();
          const d = new FormData(ev.currentTarget);
          const name = String(d.get("name"));
          const slug = String(d.get("slug"));
          const r = await e.run(
            businessApi.create({
              name,
              businessLink: slug,
              description: d.get("description"),
            }),
          );
          if (r.ok) nav("/dashboard");
        }}
      >
        <input
          className="field"
          name="name"
          placeholder="Business name"
          required
        />
        <input
          className="field"
          name="slug"
          placeholder="business-link"
          required
        />
        <textarea
          className="field"
          name="description"
          placeholder="Description"
        />
        <ErrorBox result={e.result} />
        <button className="button">Create business</button>
      </form>
    </AuthFrame>
  );
}
function Overview() {
  const b = useResult<{ business: Business }>();
  const o = useResult<{ orders: Order[] }>();
  useEffect(() => {
    void b.run(businessApi.get());
    void o.run(ordersApi.list("status=pending"));
  }, []);
  const business = b.result?.data?.business;
  return (
    <>
      <h1 className="title">Overview</h1>
      <ErrorBox result={b.result} />
      <ErrorBox result={o.result} />
      {business && (
        <section className="card">
          <h2 className="text-xl font-semibold">{business.name}</h2>
          <a
            className="text-blue-700 underline"
            href={`/${business.businessLink}`}
            target="_blank"
          >
            Open storefront
          </a>
          <button
            className="button ml-3"
            onClick={() =>
              void navigator.clipboard.writeText(
                `${location.origin}/${business.businessLink}`,
              )
            }
          >
            Copy link
          </button>
          <label className="mt-4 flex gap-2">
            <input
              type="checkbox"
              checked={business.isAcceptingOrders}
              onChange={async (e) => {
                await b.run(
                  businessApi.patch({ isAcceptingOrders: e.target.checked }),
                );
              }}
            />
            Accepting orders
          </label>
          <p>Pending orders: {o.result?.data?.orders.length ?? 0}</p>
        </section>
      )}
    </>
  );
}
function MenuPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const r = useResult<unknown>();
  const refresh = async () => {
    const [i, c] = await Promise.all([menuApi.items(), menuApi.categories()]);
    setItems(i.data?.items ?? []);
    setCats(c.data?.categories ?? []);
    r.setResult(!i.ok ? i : !c.ok ? c : null);
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <h1 className="title">Menu</h1>
      <ErrorBox result={r.result} />
      <section className="card">
        <h2 className="subtitle">Categories</h2>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            await r.run(menuApi.createCategory(String(d.get("name"))));
            e.currentTarget.reset();
            await refresh();
          }}
        >
          <input className="field" name="name" placeholder="Category name" />
          <button className="button">Add</button>
        </form>
        {cats.map((c) => (
          <div key={c.id} className="flex gap-2 py-2">
            {c.name}
            <button
              className="link"
              onClick={async () => {
                const name = prompt("New category name", c.name);
                if (name) {
                  await r.run(menuApi.renameCategory(c.id, name));
                  await refresh();
                }
              }}
            >
              Rename
            </button>
            <button
              className="link text-red-700"
              onClick={async () => {
                const d = await menuApi.deleteCategory(c.id);
                r.setResult(d);
                if (d.ok)
                  alert(
                    `${d.data?.itemsUncategorized ?? 0} items became uncategorized`,
                  );
                await refresh();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="subtitle">New item</h2>
        <ItemForm
          categories={cats}
          onSave={async (body) => {
            const a = await r.run(menuApi.createItem(body));
            if (a.ok) await refresh();
          }}
        />
      </section>
      <div className="grid gap-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            categories={cats}
            onRefresh={refresh}
            setResult={r.setResult}
          />
        ))}
      </div>
    </>
  );
}
function ItemForm({
  categories,
  onSave,
  initial,
}: {
  categories: Category[];
  onSave: (body: unknown) => void;
  initial?: Item;
}) {
  return (
    <form
      className="grid gap-2 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        onSave({
          name: d.get("name"),
          description: d.get("description") || undefined,
          price: Math.round(Number(d.get("price")) * 100),
          categoryId: d.get("categoryId")
            ? Number(d.get("categoryId"))
            : undefined,
          inStock: d.get("inStock") === "on",
          priority: Number(d.get("priority") || 0),
        });
      }}
    >
      <input
        className="field"
        name="name"
        defaultValue={initial?.name}
        placeholder="Name"
        required
      />
      <input
        className="field"
        name="price"
        type="number"
        step="0.01"
        defaultValue={initial ? initial.price / 100 : ""}
        placeholder="Price"
        required
      />
      <textarea
        className="field"
        name="description"
        defaultValue={initial?.description ?? ""}
        placeholder="Description"
      />
      <select
        className="field"
        name="categoryId"
        defaultValue={initial?.categoryId ?? ""}
      >
        <option value="">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label>
        <input
          name="inStock"
          type="checkbox"
          defaultChecked={initial?.inStock ?? true}
        />{" "}
        In stock
      </label>
      <input
        className="field"
        name="priority"
        type="number"
        defaultValue={initial?.priority ?? 0}
        placeholder="Priority"
      />
      <button className="button">Save item</button>
    </form>
  );
}
function ItemCard({
  item,
  categories,
  onRefresh,
  setResult,
}: {
  item: Item;
  categories: Category[];
  onRefresh: () => Promise<void>;
  setResult: (v: ApiResponse<unknown> | null) => void;
}) {
  return (
    <article className="card">
      <div className="flex items-start justify-between">
        <div>
          <b>{item.name}</b> · {money(item.price)}{" "}
          <span className="text-sm">
            {item.isListed ? "Listed" : "Unlisted"} ·{" "}
            {item.inStock ? "In stock" : "Out of stock"}
          </span>
          <p>{item.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="link"
            onClick={() => {
              const name = prompt("Edit item name", item.name);
              if (name)
                void menuApi.patchItem(item.id, { name }).then((r) => {
                  setResult(r);
                  void onRefresh();
                });
            }}
          >
            Edit
          </button>
          {item.isListed && (
            <button
              className="link"
              onClick={() =>
                void menuApi.unlist(item.id).then((r) => {
                  setResult(r);
                  void onRefresh();
                })
              }
            >
              Unlist
            </button>
          )}
        </div>
      </div>
      <ItemForm
        initial={item}
        categories={categories}
        onSave={(body) =>
          void menuApi.patchItem(item.id, body).then((r) => {
            setResult(r);
            void onRefresh();
          })
        }
      />
      <div className="mt-2 flex gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
              void uploadsApi.post(`items/${item.id}/image`, f).then(setResult);
          }}
        />
        {item.image && (
          <>
            <img src={item.image} className="h-10 w-10 object-cover" />
            <button
              className="link"
              onClick={() =>
                void uploadsApi.remove(`items/${item.id}/image`).then(setResult)
              }
            >
              Remove image
            </button>
          </>
        )}
      </div>
    </article>
  );
}
function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");
  const [count, setCount] = useState(0);
  const r = useResult<{ orders: Order[] }>();
  const load = async () => {
    const x = await r.run(ordersApi.list(filter));
    const list = x.data?.orders ?? [];
    if (rows.length) setCount(Math.max(0, list.length - rows.length));
    setRows(list);
  };
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [filter]);
  return (
    <>
      <h1 className="title">Orders</h1>
      <div className="flex gap-2">
        <select
          className="field"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="status=pending">Pending</option>
          <option value="status=delivered">Delivered</option>
          <option value="status=cancelled">Cancelled</option>
          <option value="paymentStatus=unpaid">Unpaid</option>
          <option value="paymentStatus=paid">Paid</option>
        </select>
        <button className="button" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {count > 0 && (
        <p className="my-3 rounded bg-green-100 p-2">
          {count} new since last refresh
        </p>
      )}
      <ErrorBox result={r.result} />
      <div className="grid gap-3">
        {rows.map((o) => (
          <Link
            className="card block"
            key={o.id}
            to={`/dashboard/orders/${o.id}`}
          >
            <b>
              #{o.id} · {o.customerName}
            </b>
            <p>
              {o.status} · {o.paymentStatus} · {money(o.price)}
            </p>
            <small>{o.address}</small>
          </Link>
        ))}
      </div>
    </>
  );
}
function OrderDetail() {
  const { id } = useParams();
  const n = Number(id);
  const r = useResult<{ order: Order }>();
  useEffect(() => {
    void r.run(ordersApi.get(n));
  }, [n]);
  const order = r.result?.data?.order;
  if (!order)
    return (
      <>
        <ErrorBox result={r.result} />
      </>
    );
  const update = (body: unknown) => void r.run(ordersApi.patch(n, body));
  return (
    <>
      <h1 className="title">Order #{n}</h1>
      <ErrorBox result={r.result} />
      <section className="card">
        <p>
          <b>{order.customerName}</b> · {order.customerPhone}
        </p>
        <p>{order.address}</p>
        <p>Note: {order.customerNote || "None"}</p>
        {order.items?.map((i, k) => (
          <p key={k}>
            {i.name} × {i.quantity} · {money(i.totalPrice)} {i.extraNote}
          </p>
        ))}
        <p className="font-bold">Total {money(order.price)}</p>
        <div className="flex flex-wrap gap-2">
          <select
            className="field"
            defaultValue={order.status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option>pending</option>
            <option>delivered</option>
            <option>cancelled</option>
          </select>
          <select
            className="field"
            defaultValue={order.paymentStatus}
            onChange={(e) => update({ paymentStatus: e.target.value })}
          >
            <option>unpaid</option>
            <option>paid</option>
          </select>
          <input
            className="field"
            placeholder="Payment method"
            onBlur={(e) =>
              e.target.value && update({ paymentMethod: e.target.value })
            }
          />
          <input
            className="field"
            defaultValue={order.address}
            onBlur={(e) =>
              e.target.value !== order.address &&
              update({ address: e.target.value })
            }
          />
          <input
            className="field"
            type="datetime-local"
            onChange={(e) =>
              e.target.value &&
              update({
                expectedDeliveryTime: new Date(e.target.value).toISOString(),
              })
            }
          />
        </div>
        <Tracking order={order} id={n} />
      </section>
    </>
  );
}
function Tracking({ order, id }: { order: Order; id: number }) {
  const [url, setUrl] = useState(order.trackingUrl ?? "");
  const r = useResult<{ trackingUrl: string }>();
  return (
    <section className="mt-4 border-t pt-3">
      <h2 className="subtitle">Tracking link</h2>
      {url ? (
        <>
          <a className="link" href={url}>
            {url}
          </a>
          <button
            className="button ml-2"
            onClick={() =>
              void navigator.clipboard.writeText(
                new URL(url, location.origin).toString(),
              )
            }
          >
            Copy
          </button>
        </>
      ) : (
        <button
          className="button"
          onClick={async () => {
            const x = await r.run(ordersApi.tracking(id));
            if (x.data) setUrl(x.data.trackingUrl);
          }}
        >
          Create tracking link
        </button>
      )}
      <ErrorBox result={r.result} />
    </section>
  );
}
function BusinessPage() {
  const r = useResult<{ business: Business }>();
  useEffect(() => {
    void r.run(businessApi.get());
  }, []);
  const b = r.result?.data?.business;
  return (
    <>
      <h1 className="title">Business</h1>
      <ErrorBox result={r.result} />
      {b && (
        <>
          <form
            className="card grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const patch = {
                name: d.get("name"),
                description: d.get("description"),
                businessLink: d.get("businessLink"),
                instagram: d.get("instagram"),
                tiktok: d.get("tiktok"),
                facebook: d.get("facebook"),
                ownerContact: d.get("ownerContact"),
                contacts: String(d.get("contacts"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              await r.run(businessApi.patch(patch));
            }}
          >
            {[
              ["name", b.name],
              ["businessLink", b.businessLink],
              ["description", b.description ?? ""],
              ["instagram", b.instagram ?? ""],
              ["tiktok", b.tiktok ?? ""],
              ["facebook", b.facebook ?? ""],
              ["ownerContact", b.ownerContact ?? ""],
              ["contacts", b.contacts?.join(", ") ?? ""],
            ].map(([name, value]) => (
              <input
                className="field"
                key={name}
                name={name}
                defaultValue={value}
                placeholder={name}
              />
            ))}
            <button className="button">Save business</button>
          </form>
          {(
            [
              ["logo", b.logo],
              ["banner", b.banner],
            ] as const
          ).map(([kind, url]) => (
            <div key={kind} className="card">
              {kind}
              {url && <img className="my-2 h-20 object-cover" src={url} />}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void uploadsApi
                      .post(`business/${kind}`, f)
                      .then(r.setResult);
                }}
              />
              <button
                className="link ml-3"
                onClick={() =>
                  void uploadsApi.remove(`business/${kind}`).then(r.setResult)
                }
              >
                Remove
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
function Account() {
  const session = authClient.useSession();
  const me = useResult<{ user: Record<string, unknown> }>();
  useEffect(() => {
    void me.run(usersApi.me());
  }, []);
  const image = String(me.result?.data?.user.image ?? "");
  return (
    <>
      <h1 className="title">Account</h1>
      <ErrorBox result={me.result} />
      <section className="card">
        {JSON.stringify(me.result?.data?.user ?? session.data?.user)}
        {image && (
          <img
            className="my-3 h-20 w-20 rounded-full object-cover"
            src={image}
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadsApi.post("user/image", f).then(me.setResult);
          }}
        />
        <button
          className="link ml-3"
          onClick={() =>
            void uploadsApi.remove("user/image").then(me.setResult)
          }
        >
          Remove profile picture
        </button>
        <button
          className="button ml-3"
          onClick={() => void authClient.signOut()}
        >
          Logout
        </button>
      </section>
    </>
  );
}
function Users() {
  const r = useResult<{ users: Record<string, unknown>[] }>();
  useEffect(() => {
    void r.run(usersApi.all());
  }, []);
  return (
    <>
      <h1 className="title">Users (debug)</h1>
      <ErrorBox result={r.result} />
      <pre className="card overflow-auto">
        {JSON.stringify(r.result?.data?.users ?? [], null, 2)}
      </pre>
    </>
  );
}
type CartLine = { item: Item; quantity: number; note: string };
function Storefront() {
  const { businessLink = "" } = useParams();
  return <StorefrontView key={businessLink} businessLink={businessLink} />;
}
function StorefrontView({ businessLink }: { businessLink: string }) {
  const nav = useNavigate();
  const b = useResult<{ business: PublicBusiness }>();
  const m = useResult<{
    menu: { categories: Array<Category & { items: Item[] }> };
  }>();
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("cart:" + businessLink) ?? "[]",
      ) as CartLine[];
    } catch {
      return [];
    }
  });
  const key = `cart:${businessLink}`;
  useEffect(() => {
    void b.run(publicApi.business(businessLink));
    void m.run(publicApi.menu(businessLink));
  }, [businessLink]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(cart));
  }, [cart, key]);
  const business = b.result?.data?.business;
  const groups = m.result?.data?.menu.categories ?? [];
  const total = cart.reduce((n, l) => n + l.item.price * l.quantity, 0);
  const change = (item: Item, delta: number) =>
    setCart((cur) => {
      const line = cur.find((l) => l.item.id === item.id);
      if (!line && delta > 0) return [...cur, { item, quantity: 1, note: "" }];
      return cur
        .map((l) =>
          l.item.id === item.id
            ? { ...l, quantity: Math.max(0, Math.min(99, l.quantity + delta)) }
            : l,
        )
        .filter((l) => l.quantity > 0);
    });
  const recent = JSON.parse(
    localStorage.getItem("recent-tracking") ?? "[]",
  ) as string[];
  return (
    <main className="mx-auto max-w-5xl p-4">
      <ErrorBox result={b.result} />
      <ErrorBox result={m.result} />
      {!business ? (
        <h1>Business not found</h1>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg bg-white">
            {business.banner && (
              <img src={business.banner} className="h-44 w-full object-cover" />
            )}
            <div className="p-5">
              {business.logo && (
                <img
                  src={business.logo}
                  className="h-16 w-16 rounded object-cover"
                />
              )}
              <h1 className="text-3xl font-bold">{business.name}</h1>
              <p>{business.description}</p>
              <p>
                {[
                  business.instagram,
                  business.tiktok,
                  business.facebook,
                  ...(business.contacts ?? []),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {!business.isAcceptingOrders && (
            <p className="my-4 bg-amber-100 p-3">
              This business is not accepting orders right now.
            </p>
          )}
          <div className="my-4 grid gap-3 md:grid-cols-[1fr_320px]">
            <div>
              {groups.map((c) => (
                <section key={c.id ?? c.name}>
                  <h2 className="subtitle">{c.name}</h2>
                  {c.items.map((i) => (
                    <StoreItem
                      key={i.id}
                      item={i}
                      disabled={!business.isAcceptingOrders}
                      quantity={
                        cart.find((l) => l.item.id === i.id)?.quantity ?? 0
                      }
                      change={change}
                    />
                  ))}
                </section>
              ))}
            </div>
            <aside className="card h-fit">
              <h2 className="subtitle">Cart · {money(total)}</h2>
              {cart.map((l) => (
                <div className="border-b py-2" key={l.item.id}>
                  {l.item.name} × {l.quantity}
                  <div>
                    <button className="link" onClick={() => change(l.item, -1)}>
                      −
                    </button>
                    <button
                      className="link ml-3"
                      onClick={() => change(l.item, 1)}
                    >
                      +
                    </button>
                    <input
                      className="field mt-1"
                      placeholder="Note for this item"
                      value={l.note}
                      onChange={(e) =>
                        setCart((cur) =>
                          cur.map((x) =>
                            x.item.id === l.item.id
                              ? { ...x, note: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <form
                className="mt-3 grid gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  const x = await publicApi.placeOrder(businessLink, {
                    customerName: d.get("name"),
                    customerPhone: d.get("phone"),
                    address: d.get("address"),
                    customerNote: d.get("note"),
                    items: cart.map((l) => ({
                      itemId: l.item.id,
                      quantity: l.quantity,
                      extraNote: l.note || undefined,
                    })),
                  });
                  if (x.ok && x.data) {
                    const u = x.data.trackingUrl;
                    const links = [u, ...recent].slice(0, 5);
                    localStorage.setItem(
                      "recent-tracking",
                      JSON.stringify(links),
                    );
                    setCart([]);
                    nav(u);
                  } else m.setResult(x);
                }}
              >
                <input
                  className="field"
                  name="name"
                  placeholder="Name"
                  required
                />
                <input
                  className="field"
                  name="phone"
                  placeholder="Phone"
                  required
                />
                <input
                  className="field"
                  name="address"
                  placeholder="Delivery address"
                  required
                />
                <textarea
                  className="field"
                  name="note"
                  placeholder="Order note"
                />
                <button
                  className="button"
                  disabled={!cart.length || !business.isAcceptingOrders}
                >
                  Place order · {money(total)}
                </button>
              </form>
              <ErrorBox result={m.result} />
              <h3 className="mt-4 font-semibold">Recent tracking links</h3>
              {recent.map((u) => (
                <p key={u}>
                  <Link className="link" to={u}>
                    {u}
                  </Link>
                </p>
              ))}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function StoreItem({
  item,
  disabled,
  quantity,
  change,
}: {
  item: Item;
  disabled: boolean;
  quantity: number;
  change: (item: Item, delta: number) => void;
}) {
  return (
    <article className="card flex items-center justify-between gap-3">
      {item.image && (
        <img src={item.image} className="h-16 w-16 rounded object-cover" />
      )}
      <div className="flex-1">
        <b>{item.name}</b> · {money(item.price)}
        <p>{item.description}</p>
        {!item.inStock && <small className="text-red-700">Unavailable</small>}
      </div>
      <div>
        {quantity > 0 && (
          <button className="link" onClick={() => change(item, -1)}>
            −
          </button>
        )}
        <button
          disabled={!item.inStock || disabled}
          className="button"
          onClick={() => change(item, 1)}
        >
          {quantity ? quantity : "Add"}
        </button>
        {quantity > 0 && (
          <button className="link" onClick={() => change(item, 1)}>
            +
          </button>
        )}
      </div>
    </article>
  );
}
function Track() {
  const { token = "" } = useParams();
  const r = useResult<{ order: TrackingOrder }>();
  useEffect(() => {
    const load = () => void r.run(publicApi.track(token));
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [token]);
  const o = r.result?.data?.order;
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="title">Order tracking</h1>
      {r.result?.isNotFound() ? (
        <p>Tracking link not found.</p>
      ) : (
        <ErrorBox result={r.result} />
      )}
      {o && (
        <section className="card">
          <p className="mb-3">
            Order placed. Save this tracking link:{" "}
            <a className="link" href={location.href}>
              {location.href}
            </a>
          </p>
          {o.businessLogo && (
            <img className="h-14 w-14 object-cover" src={o.businessLogo} />
          )}
          <h2 className="subtitle">{o.businessName}</h2>
          <p>Status: {o.status}</p>
          <p>Payment: {o.paymentStatus}</p>
          <p>Expected: {o.expectedDeliveryTime ?? "Not set"}</p>
          {o.items?.map((i, k) => (
            <p key={k}>
              {i.name} × {i.quantity}
            </p>
          ))}
          <b>Total: {money(o.price)}</b>
        </section>
      )}
    </main>
  );
}
function Dashboard() {
  return (
    <Shell>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="business" element={<BusinessPage />} />
        <Route path="account" element={<Account />} />
        <Route path="users" element={<Users />} />
      </Routes>
    </Shell>
  );
}
function AuthRoute({
  children,
  requireSession = false,
}: {
  children: React.ReactNode;
  requireSession?: boolean;
}) {
  const nav = useNavigate();
  const session = authClient.useSession();
  const user = session.data?.user as { businessId?: number | null } | undefined;
  useEffect(() => {
    if (session.isPending) return;
    if (requireSession && !user) nav("/login");
    else if (!requireSession && user)
      nav(user.businessId ? "/dashboard" : "/onboarding");
  }, [session.isPending, user, requireSession, nav]);
  if (
    session.isPending ||
    (requireSession && !user) ||
    (!requireSession && user)
  )
    return null;
  return <>{children}</>;
}
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <AuthRoute>
              <Register />
            </AuthRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <AuthRoute requireSession>
              <Onboarding />
            </AuthRoute>
          }
        />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/track/:token" element={<Track />} />
        <Route path="/:businessLink" element={<Storefront />} />
        <Route
          path="*"
          element={
            <AuthFrame title="Page not found">
              <Link to="/">Go home</Link>
            </AuthFrame>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
