import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { X, FileText, AlertTriangle, CheckCircle } from "lucide-react";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function SalarySlip({ salary, onClose }) {
  const generatePDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait' });

    // Title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("فیش حقوقی", 105, 25, { align: "center" });

    // Company info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("استودیو فلوسی", 105, 32, { align: "center" });
    doc.text("فیش حقوق کارمند", 105, 38, { align: "center" });

    // Employee info table
    autoTable(doc, {
      startY: 45,
      head: [['فیلد', 'مقدار']],
      body: [
        ['نام کارمند', salary.employee_name],
        ['ماه', salary.month],
        ['تاریخ پرداخت', salary.date || '—'],
        ['وضعیت', salary.status === 'paid' ? 'پرداخت شده' : 'در انتظار'],
        ['حقوق پایه', faNum(salary.base_pay) + ' تومان'],
        ['اضافه‌کاری', faNum(salary.overtime) + ' تومان'],
        ['مزایا', faNum(salary.benefits) + ' تومان'],
        ['کسورات', faNum(salary.deductions) + ' تومان'],
        ['مبلغ قابل پرداخت', faNum(salary.amount) + ' تومان'],
      ],
      theme: 'striped',
      styles: { font: 'helvetica', halign: 'right', fontSize: 10 },
      headStyles: { fillColor: [31, 160, 80], halign: 'center' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 120 } },
      margin: { left: 14, right: 14 },
    });

    // Notes section
    if (salary.notes) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("یادداشت‌ها:", 14, doc.lastAutoTable.finalY + 10);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const splitNotes = doc.splitTextToSize(salary.notes, 180);
      doc.text(splitNotes, 14, doc.lastAutoTable.finalY + 16);
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`تولید شده در ${new Date().toLocaleDateString('fa-IR')} | استودیو فلوسی`, 105, pageHeight - 10, { align: "center" });

    doc.save(`فیش-حقوق-${salary.employee_name}-${salary.month}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg">فیش حقوقی</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold">{salary.employee_name}</p>
                <p className="text-sm text-muted-foreground">{salary.month}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">حقوق پایه:</span> <span className="font-medium ml-2">{faNum(salary.base_pay)}</span></div>
              <div><span className="text-muted-foreground">اضافه‌کاری:</span> <span className="font-medium ml-2">{faNum(salary.overtime)}</span></div>
              <div><span className="text-muted-foreground">مزایا:</span> <span className="font-medium ml-2">{faNum(salary.benefits)}</span></div>
              <div><span className="text-muted-foreground">کسورات:</span> <span className="font-medium ml-2">{faNum(salary.deductions)}</span></div>
            </div>
            <div className="pt-3 border-t border-border flex justify-between">
              <span className="font-bold text-lg">مبلغ کل:</span>
              <span className="font-bold text-green-600 text-xl">{faNum(salary.amount)} تومان</span>
            </div>
          </div>

          {salary.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-medium text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> یادداشت
              </p>
              <p className="text-sm text-amber-700">{salary.notes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={generatePDF}
            className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> دانلود PDF
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-input rounded-xl font-medium hover:bg-accent"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}