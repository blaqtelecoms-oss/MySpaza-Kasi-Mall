// Printed receipt for a completed sale.
//
// The receipt is rendered into a hidden iframe and printed from there, so the
// browser prints the receipt alone — not the POS screen or its open dialog.
// Business details, the logo and the footer come from the shop's saved
// settings (`src/lib/shopSettings.js`).

const PAPER_SIZES = {
  "58mm": { page: "58mm", width: "52mm", padding: "3mm", font: "10px" },
  "80mm": { page: "80mm", width: "72mm", padding: "4mm", font: "12px" },
  A4: { page: "A4", width: "170mm", padding: "15mm", font: "14px" },
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

const money = (amount) => `R ${Number(amount || 0).toFixed(2)}`;

function lineRow(label, value) {
  return `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

export function buildReceiptHtml(sale, settings) {
  const business = settings?.business || {};
  const receipt = settings?.receipt || {};
  const paper = PAPER_SIZES[receipt.paperSize] || PAPER_SIZES["80mm"];
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const printedAt = new Date();

  const logo =
    receipt.showLogo !== false && settings?.logoUrl
      ? `<img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="" />`
      : "";

  const itemRows = items
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price ?? 0);
      const total = Number(item.line_total ?? price * quantity);
      return `<div class="item">
        <div class="item-name">${escapeHtml(item.name || "Item")}</div>
        <div class="row"><span>${quantity} x ${money(price)}</span><span>${money(total)}</span></div>
      </div>`;
    })
    .join("");

  const subtotal = sale?.subtotal ?? sale?.total_amount;
  const discount = Number(sale?.discount_amount || 0);
  const vat = Number(sale?.vat_amount || 0);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(sale?.receipt_number || "")}</title>
<style>
  @page { size: ${paper.page} auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: ${paper.padding};
    width: ${paper.width};
    font-family: ui-monospace, "Courier New", monospace;
    font-size: ${paper.font};
    line-height: 1.35;
    color: #000;
  }
  .logo { display: block; max-width: 45mm; max-height: 20mm; margin: 0 auto 4px; object-fit: contain; }
  .center { text-align: center; }
  .shop { font-size: 1.15em; font-weight: 700; }
  .muted { font-size: 0.9em; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin-bottom: 4px; }
  .item-name { word-break: break-word; }
  .total { font-weight: 700; font-size: 1.1em; }
  @media print { body { width: auto; } }
</style>
</head>
<body>
  ${logo}
  <div class="center">
    <div class="shop">${escapeHtml(business.name || "My Spaza Shop")}</div>
    ${business.address ? `<div class="muted">${escapeHtml(business.address)}</div>` : ""}
    ${business.phone ? `<div class="muted">${escapeHtml(business.phone)}</div>` : ""}
    ${receipt.showVAT && business.vatNumber ? `<div class="muted">VAT No: ${escapeHtml(business.vatNumber)}</div>` : ""}
  </div>
  <div class="divider"></div>
  <div class="row"><span>Receipt</span><span>${escapeHtml(sale?.receipt_number || sale?.sale_number || "")}</span></div>
  <div class="row"><span>Date</span><span>${escapeHtml(printedAt.toLocaleString("en-ZA"))}</span></div>
  <div class="divider"></div>
  ${itemRows || '<div class="muted">No items</div>'}
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
  ${discount > 0 ? lineRow("Discount", `-${money(discount)}`) : ""}
  ${receipt.showVAT && vat > 0 ? lineRow("VAT", money(vat)) : ""}
  <div class="row total"><span>TOTAL</span><span>${money(sale?.total_amount)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Payment</span><span>${escapeHtml(String(sale?.payment_method || "").replace(/_/g, " ").toUpperCase())}</span></div>
  ${Number(sale?.change_given || 0) > 0 ? lineRow("Change", money(sale.change_given)) : ""}
  ${sale?.customer_name ? lineRow("Customer", sale.customer_name) : ""}
  ${receipt.footer ? `<div class="center muted" style="margin-top:8px">${escapeHtml(receipt.footer)}</div>` : ""}
</body>
</html>`;
}

/** Open the browser's print dialog for this sale's receipt. */
export function printReceipt(sale, settings) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const remove = () => setTimeout(() => frame.remove(), 0);
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return;
    }
    win.focus();
    win.print();
    // Give the dialog a moment on browsers where print() returns immediately.
    setTimeout(() => frame.remove(), 1500);
  };
  frame.onerror = remove;
  frame.srcdoc = buildReceiptHtml(sale, settings);
}
