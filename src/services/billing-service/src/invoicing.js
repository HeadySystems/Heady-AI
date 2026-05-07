'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Heady™ Invoicing Service
 * Generates autonomous invoices for enterprise grants and subscriptions.
 */
class InvoicingService {
  /**
   * Create an invoice record.
   *
   * @param {object} params
   * @param {string} params.tenantId
   * @param {string} params.recipientName
   * @param {Array} params.items — { description, amountCents }
   * @param {string} [params.currency]
   * @returns {object} Invoice
   */
  async createInvoice({ tenantId, recipientName, items, currency = 'usd' }) {
    const totalAmount = items.reduce((sum, item) => sum + item.amountCents, 0);
    const invoice = {
      id: `INV-${uuidv4().slice(0, 8).toUpperCase()}`,
      tenantId,
      recipientName,
      items,
      totalAmount,
      currency,
      status: 'issued',
      issuedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Net 30
    };

    // Persist to data directory
    const invoicePath = path.join(process.cwd(), 'data', 'invoices', `${invoice.id}.json`);
    if (!fs.existsSync(path.dirname(invoicePath))) {
      fs.mkdirSync(path.dirname(invoicePath), { recursive: true });
    }
    fs.writeFileSync(invoicePath, JSON.stringify(invoice, null, 2));

    return invoice;
  }

  /**
   * Generate an HTML representation of the invoice.
   */
  generateHTML(invoice) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; color: #1a1a1a; padding: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #618033; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #618033; }
          .invoice-info { text-align: right; }
          .details { margin-top: 40px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; border-bottom: 1px solid #ddd; padding: 10px; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          .total { margin-top: 20px; text-align: right; font-size: 20px; font-weight: bold; }
          .footer { margin-top: 60px; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Heady™ Systems Inc.</div>
          <div class="invoice-info">
            <div>Invoice: ${invoice.id}</div>
            <div>Issued: ${new Date(invoice.issuedAt).toLocaleDateString()}</div>
            <div>Due: ${new Date(invoice.dueDate).toLocaleDateString()}</div>
          </div>
        </div>
        <div class="details">
          <h3>Bill To:</h3>
          <div>${invoice.recipientName}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>$${(item.amountCents / 100).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">
          Total: $${(invoice.totalAmount / 100).toFixed(2)} ${invoice.currency.toUpperCase()}
        </div>
        <div class="footer">
          Heady™ Sovereign Intelligence — Autonomously Generated.
          <br>© 2026 Heady™Systems Inc.
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new InvoicingService();
