import React from "react";
import { BarChart3, Boxes, Wallet } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Boxes,
    title: "Stock and sales in one place",
    text: "Ring up a sale and your inventory updates itself.",
  },
  {
    icon: Wallet,
    title: "Cash-up without the guesswork",
    text: "Daily totals, expenses and banking reconciled.",
  },
  {
    icon: BarChart3,
    title: "Know exactly where you stand",
    text: "Margins, debtors and reports you can act on.",
  },
];

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="relative min-h-screen bg-[#F5F6F8] text-slate-900 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* The panel below is desktop-only, so small screens get the same shop
          photo as a washed-out page background instead of an empty canvas. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
        <img
          src="/brand/auth-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-40 [filter:grayscale(0.35)_saturate(0.95)]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(158deg,rgba(248,250,252,0.88)_0%,rgba(241,245,249,0.5)_34%,rgba(204,251,241,0.26)_64%,rgba(13,148,136,0.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(245,246,248,0.45)_0%,rgba(245,246,248,0.24)_34%,rgba(245,246,248,0.72)_72%,#F5F6F8_96%)]" />
      </div>

      <aside className="relative hidden overflow-hidden border-r border-slate-200/80 bg-[#F7F9FA] px-14 py-12 lg:flex lg:flex-col lg:justify-between">
        {/* Shop photo, faded into the panel by a cool gradient wash */}
        <img
          src="/brand/auth-bg.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-20 [filter:grayscale(0.45)_saturate(0.9)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.86)_32%,rgba(204,251,241,0.45)_60%,rgba(13,148,136,0.34)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#F7F9FA_0%,rgba(247,249,250,0.6)_32%,rgba(247,249,250,0)_64%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-gradient-to-br from-teal-100/80 to-transparent blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr from-slate-100 to-transparent blur-2xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <img
              src="/brand/logo.png"
              alt=""
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
            />
            <span className="text-base font-semibold tracking-tight">My Spaza</span>
          </div>
          <h2 className="mt-14 max-w-md text-[2.5rem] font-semibold leading-[1.12] tracking-tight text-slate-900">
            Run your shop like a business, not a notebook.
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-500">
            Point of sale, stock, cash-up and debtors for spaza shops — in one calm
            workspace that keeps your numbers straight.
          </p>
        </div>

        <ul className="relative mt-12 space-y-6">
          {HIGHLIGHTS.map(({ icon: Icon, title: itemTitle, text }) => (
            <li key={itemTitle} className="flex gap-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-800">{itemTitle}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ul>

      </aside>

      <main className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <img
              src="/brand/logo.png"
              alt=""
              className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200"
            />
            <span className="text-sm font-semibold tracking-tight text-slate-700">
              My Spaza
            </span>
          </div>

          {/* The panel copy is desktop-only, so small screens get the same
              headline above the form instead of losing it entirely. */}
          <div className="mb-6 lg:hidden">
            <h2 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-slate-900">
              Run your shop like a business, not a notebook.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Point of sale, stock, cash-up and debtors for spaza shops in one calm
              workspace that keeps your numbers straight.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-9">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>

          {footer && (
            <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
          )}
        </div>
      </main>
    </div>
  );
}
