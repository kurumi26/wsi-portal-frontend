import { describe, expect, it } from 'vitest';
import {
  canApproveOrderProvisioning,
  getInvoiceApprovalBlockReason,
  getInvoiceDocumentUrl,
  getInvoiceStatusHelperText,
  getInvoiceStatusKey,
  getInvoiceStatusLabel,
  hasInvoiceRecord,
  isInvoicePaid,
} from './invoices';

describe('invoice helpers', () => {
  it('treats missing invoice data as pending sync and blocks approval', () => {
    const order = {
      id: 91,
      serviceName: 'CodeGuard',
      status: 'Pending Review',
    };

    expect(hasInvoiceRecord(order)).toBe(false);
    expect(getInvoiceStatusKey(order)).toBe('missing');
    expect(getInvoiceStatusLabel(order)).toBe('Pending Sync');
    expect(getInvoiceStatusHelperText(order)).toBe('Invoice data is still pending backend sync.');
    expect(getInvoiceApprovalBlockReason(order)).toBe('Linked invoice is not yet available from the billing API.');
    expect(canApproveOrderProvisioning(order)).toBe(false);
  });

  it('allows approval only when invoice status is explicitly paid', () => {
    const order = {
      id: 92,
      invoice: {
        number: 'INV-2026-0001',
        status: 'Paid',
        due_date: '2026-05-15',
      },
    };

    expect(hasInvoiceRecord(order)).toBe(true);
    expect(getInvoiceStatusKey(order)).toBe('paid');
    expect(getInvoiceStatusLabel(order)).toBe('Paid');
    expect(isInvoicePaid(order)).toBe(true);
    expect(getInvoiceApprovalBlockReason(order)).toBe('');
    expect(canApproveOrderProvisioning(order)).toBe(true);
  });

  it('treats successful customer payment proof as pending review until admin confirmation', () => {
    const order = {
      id: 93,
      invoice_number: 'INV-2026-0002',
      payments: [
        { status: 'success' },
      ],
    };

    expect(getInvoiceStatusKey(order)).toBe('pending_review');
    expect(getInvoiceStatusLabel(order)).toBe('Pending Review');
    expect(getInvoiceStatusHelperText(order)).toBe('Customer payment was submitted and is awaiting admin review.');
    expect(getInvoiceApprovalBlockReason(order)).toBe('Submitted payment is awaiting admin review.');
    expect(canApproveOrderProvisioning(order)).toBe(false);
  });

  it('keeps completed customer payment submissions pending review until an admin marks them paid', () => {
    const order = {
      id: 95,
      invoice_number: 'INV-2026-0004',
      payment_status: 'completed',
    };

    expect(getInvoiceStatusKey(order)).toBe('pending_review');
    expect(getInvoiceStatusLabel(order)).toBe('Pending Review');
    expect(getInvoiceStatusHelperText(order)).toBe('Customer payment was submitted and is awaiting admin review.');
    expect(getInvoiceApprovalBlockReason(order)).toBe('Submitted payment is awaiting admin review.');
    expect(isInvoicePaid(order)).toBe(false);
    expect(canApproveOrderProvisioning(order)).toBe(false);
  });

  it('does not trust invoice paid status while customer payment is still only submitted', () => {
    const order = {
      id: 96,
      invoice_number: 'INV-2026-0005',
      invoice_status: 'paid',
      payments: [
        { status: 'success' },
      ],
    };

    expect(getInvoiceStatusKey(order)).toBe('pending_review');
    expect(getInvoiceStatusLabel(order)).toBe('Pending Review');
    expect(getInvoiceStatusHelperText(order)).toBe('Customer payment was submitted and is awaiting admin review.');
    expect(getInvoiceApprovalBlockReason(order)).toBe('Submitted payment is awaiting admin review.');
    expect(isInvoicePaid(order)).toBe(false);
    expect(canApproveOrderProvisioning(order)).toBe(false);
  });

  it('accepts admin-paid confirmation when paid_at is present', () => {
    const order = {
      id: 97,
      invoice_number: 'INV-2026-0006',
      invoice_status: 'paid',
      paid_at: '2026-05-04T08:15:00Z',
      payments: [
        { status: 'success' },
      ],
    };

    expect(getInvoiceStatusKey(order)).toBe('paid');
    expect(getInvoiceStatusLabel(order)).toBe('Paid');
    expect(getInvoiceStatusHelperText(order)).toBe('An admin confirmed this invoice as paid.');
    expect(getInvoiceApprovalBlockReason(order)).toBe('');
    expect(isInvoicePaid(order)).toBe(true);
    expect(canApproveOrderProvisioning(order)).toBe(true);
  });

  it('does not infer paid from generic purchase status when invoice payment was not explicitly confirmed', () => {
    const order = {
      id: 94,
      invoice_number: 'INV-2026-0003',
      status: 'Paid',
      due_date: '2999-12-31',
    };

    expect(getInvoiceStatusKey(order)).toBe('unpaid');
    expect(getInvoiceStatusLabel(order)).toBe('Unpaid');
    expect(isInvoicePaid(order)).toBe(false);
    expect(getInvoiceApprovalBlockReason(order)).toBe('Linked invoice is not yet marked paid.');
  });

  it('normalizes relative invoice document paths against the backend origin', () => {
    const order = {
      invoice_path: 'invoice_files/inv-2026-0003.pdf',
    };

    expect(getInvoiceDocumentUrl(order, 'http://localhost:8000')).toBe('http://localhost:8000/storage/invoice_files/inv-2026-0003.pdf');
    expect(getInvoiceDocumentUrl({ invoice_url: 'https://cdn.example.com/invoice.pdf' }, 'http://localhost:8000')).toBe('https://cdn.example.com/invoice.pdf');
  });
});
