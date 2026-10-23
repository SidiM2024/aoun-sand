// Links that come from the database (notifications, receipts, invoices…) are only rendered
// when they are http(s), mailto, tel or site-relative. Anything else — javascript:, data:,
// vbscript: … — would run code in the visitor's browser, so it becomes undefined (no link).
export const safeUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const v = String(value).trim();
  if (!v) return undefined;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try {
    const u = new URL(v);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
};
