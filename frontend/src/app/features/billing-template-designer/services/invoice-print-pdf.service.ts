import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import { InvoiceTemplate, InvoiceTotals } from '../models/billing-template.models';

@Injectable({
  providedIn: 'root',
})
export class InvoicePrintPdfService {

  printInvoice(invoiceElementId: string): void {
    const el = document.getElementById(invoiceElementId);
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      // Fallback to normal window print if popups blocked
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((s) => s.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice Print</title>
          <meta charset="utf-8">
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: inherit;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-sheet {
              box-shadow: none !important;
              border: 1px solid #d1d5db !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
            }
            .no-print, .row-actions, .table-action-btns, .btn {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${el.outerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  downloadPdf(template: InvoiceTemplate, totals: InvoiceTotals, invoiceElementId?: string): void {
    // If element is available, printWindow or jsPDF can be used
    const el = invoiceElementId ? document.getElementById(invoiceElementId) : null;

    if (el) {
      // Use jsPDF html renderer
      const doc = new jsPDF({
        orientation: template.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
        unit: 'pt',
        format: template.pageSize.toLowerCase() as any,
      });

      // Target invoice sheet
      doc.html(el, {
        callback: (pdf) => {
          const filename = `${template.businessInfo.name.replace(/\s+/g, '_')}_${template.invoiceDetails.invoiceNo.replace(/[\\/]/g, '-')}.pdf`;
          pdf.save(filename);
        },
        x: 10,
        y: 10,
        width: 575, // A4 width pt approx
        windowWidth: 800,
        autoPaging: 'text',
      });
      return;
    }

    // Direct jsPDF fallback builder
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    // Title / Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(template.businessInfo.name, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(template.businessInfo.tagline, margin, y);
    y += 5;
    doc.text(template.businessInfo.address, margin, y);
    y += 5;
    doc.text(`GSTIN: ${template.businessInfo.gstin} | PAN: ${template.businessInfo.pan}`, margin, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 196, y);
    y += 8;

    // Invoice Title Banner
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(template.invoiceDetails.invoiceTitle.replace('\n', ' '), margin, y);
    y += 7;

    // Bill To & Details
    doc.setFontSize(9);
    doc.text(`Bill To: ${template.customerInfo.name}`, margin, y);
    doc.text(`Invoice No: ${template.invoiceDetails.invoiceNo}`, 120, y);
    y += 5;
    doc.text(`Phone: ${template.customerInfo.phone}`, margin, y);
    doc.text(`Date: ${template.invoiceDetails.invoiceDate}`, 120, y);
    y += 5;
    doc.text(`Event: ${template.invoiceDetails.eventType}`, 120, y);
    y += 10;

    // Table Header
    doc.setFillColor(30, 64, 175);
    doc.rect(margin, y, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('S.No', margin + 2, y + 5);
    doc.text('Description', margin + 15, y + 5);
    doc.text('HSN/SAC', margin + 85, y + 5);
    doc.text('Qty', margin + 115, y + 5);
    doc.text('Rate', margin + 135, y + 5);
    doc.text('Amount (INR)', margin + 160, y + 5);
    y += 8;

    // Rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    template.items.forEach((item, idx) => {
      doc.text(String(idx + 1), margin + 2, y + 5);
      doc.text(item.description.substring(0, 36), margin + 15, y + 5);
      doc.text(item.hsnSac, margin + 85, y + 5);
      doc.text(String(item.qtyDuration), margin + 115, y + 5);
      doc.text(Number(item.rate).toLocaleString('en-IN'), margin + 135, y + 5);
      doc.text(Number(item.amount).toLocaleString('en-IN'), margin + 160, y + 5);
      y += 6;
    });

    y += 4;
    doc.line(margin, y, 196, y);
    y += 6;

    // Totals
    doc.setFont('helvetica', 'bold');
    doc.text(`Sub Total: Rs. ${totals.subTotal.toLocaleString('en-IN')}`, 130, y);
    y += 5;
    doc.text(`CGST (9%): Rs. ${totals.cgstAmount.toLocaleString('en-IN')}`, 130, y);
    y += 5;
    doc.text(`SGST (9%): Rs. ${totals.sgstAmount.toLocaleString('en-IN')}`, 130, y);
    y += 6;
    doc.setFontSize(11);
    doc.text(`Grand Total: Rs. ${totals.grandTotal.toLocaleString('en-IN')}`, 130, y);

    const filename = `${template.businessInfo.name.replace(/\s+/g, '_')}_${template.invoiceDetails.invoiceNo.replace(/[\\/]/g, '-')}.pdf`;
    doc.save(filename);
  }
}
