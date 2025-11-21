// src/bot/helpers.js
// Pure UI helpers (no DB here)

export function getCartTotal(cart = []) {
  return cart.reduce(
    (sum, it) => sum + (it.product?.price || 0) * (it.qty || 0),
    0
  );
}

export function renderSummary(total, hasItems) {
  const text = hasItems
    ? `💰 جمع کل: ${total.toLocaleString()} تومان`
    : "🛒 سبد خرید خالی است.";
  const reply_markup = hasItems
    ? {
        inline_keyboard: [
          [{ text: "🧹 پاک کردن سبد", callback_data: "cartclear" }],
        ],
      }
    : undefined;
  return { text, reply_markup };
}

export function renderItemCaption(item) {
  const p = item.product || {};
  const unit = p.price || 0;
  const qty = item.qty || 0;
  const subtotal = unit * qty;
  const lines = [
    `${p.brand || ""} ${p.model || "محصول"}`.trim(),
    [p.material, p.color].filter(Boolean).join(" | ") || undefined,
    `💰 ${unit.toLocaleString()} × ${qty} = ${subtotal.toLocaleString()} تومان`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function renderItemKeyboard(item) {
  return {
    inline_keyboard: [
      [
        { text: "➖", callback_data: `cartdec_${item.id}` },
        { text: `${item.qty}`, callback_data: "noop" },
        { text: "➕", callback_data: `cartinc_${item.id}` },
        { text: "🗑 حذف", callback_data: `cartdel_${item.id}` },
      ],
    ],
  };
}
