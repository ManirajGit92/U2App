import { Injectable } from '@angular/core';
import { Invoice } from '../models/billing.models';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ReceiptPdfService {

  generateReceipt(invoice: Invoice) {
    const doc = new jsPDF() as any;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('INVOICE / RECEIPT', 14, 20);

    // Business info (Placeholder)
    doc.setFontSize(10);
    doc.text('Your Company Name', 14, 30);
    doc.text('123 Billing Street, City, State', 14, 35);
    doc.text('Phone: 123-456-7890', 14, 40);

    // Invoice details right aligned
    doc.text(`Invoice ID: ${invoice.id}`, 140, 30);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, 140, 35);
    doc.text(`Payment: ${invoice.paymentMethod}`, 140, 40);

    // Customer
    doc.setFontSize(12);
    doc.text('Bill To:', 14, 55);
    doc.setFontSize(10);
    doc.text(`Name: ${invoice.customerName}`, 14, 62);
    doc.text(`ID: ${invoice.customerId}`, 14, 67);

    // Items table
    const tableData = invoice.items.map((item, index) => [
      index + 1,
      item.productName,
      `${item.quantity}`,
      `Rs. ${item.unitPrice.toFixed(2)}`,
      `Rs. ${item.discountValue.toFixed(2)}`,
      `${item.taxRate}%`,
      `Rs. ${item.total.toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 75,
      head: [['#', 'Item', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }, // Indigo 500
      styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Totals Right Aligned
    doc.text(`Sub Total:`, 140, finalY);
    doc.text(`Rs. ${invoice.subTotal.toFixed(2)}`, 180, finalY, { align: 'right' });

    doc.text(`Tax Total:`, 140, finalY + 7);
    doc.text(`Rs. ${invoice.taxTotal.toFixed(2)}`, 180, finalY + 7, { align: 'right' });

    doc.text(`Discount:`, 140, finalY + 14);
    doc.text(`- Rs. ${invoice.discountTotal.toFixed(2)}`, 180, finalY + 14, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total:`, 140, finalY + 25);
    doc.text(`Rs. ${invoice.grandTotal.toFixed(2)}`, 180, finalY + 25, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(invoice.notes || 'Thank you for your business!', 14, finalY + 40);

    // Save
    doc.save(`Invoice_${invoice.id}.pdf`);
  }
}
