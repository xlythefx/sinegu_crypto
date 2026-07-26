import { apiFetch } from './api'
import { mapApiInvoice, type ApiInvoice, type Invoice } from '../lib/billing'

/** GET /invoices — the authenticated user's invoices, newest first. */
export async function getInvoices(): Promise<Invoice[]> {
  const res = await apiFetch<{ success: boolean; invoices: ApiInvoice[] }>(
    '/invoices',
    { auth: true },
  )
  return res.invoices.map(mapApiInvoice)
}

/** GET /invoices/{id} — one invoice the user owns. */
export async function getInvoice(id: string): Promise<Invoice> {
  const res = await apiFetch<{ success: boolean; invoice: ApiInvoice }>(
    `/invoices/${id}`,
    { auth: true },
  )
  return mapApiInvoice(res.invoice)
}
