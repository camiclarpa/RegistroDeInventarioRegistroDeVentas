import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import { logger } from "../config/logger";

export interface QuotePdfData {
  quoteId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  expiresAt?: Date;
  createdAt: Date;
}

export async function generateQuotePdf(data: QuotePdfData): Promise<string> {
  const outPath = path.join(process.env.PDF_TMP_DIR || "/tmp", `quote-${data.quoteId}.pdf`);
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);
      doc.fontSize(18).text(`COTIZACIÓN #${data.quoteId.slice(-8).toUpperCase()}`, 50, 50);
      doc.fontSize(12).text(`Cliente: ${data.customerName}`, 50, 80);
      doc.fontSize(10).text(`Tel: ${data.customerPhone ?? "N/A"}`, 50, 100);
      let y = 130;
      doc.font("Helvetica-Bold").text("Descripción", 50, y).text("Total", 400, y);
      y += 20;
      doc.font("Helvetica");
      data.items.forEach((i) => {
        doc.text(i.description, 50, y).text(`$${i.subtotal}`, 400, y);
        y += 15;
      });
      doc.fontSize(14).text(`TOTAL: $${data.total}`, 300, y + 20);
      doc.end();
      stream.on("finish", () => resolve(outPath));
      stream.on("error", reject);
    } catch (e) { reject(e); }
  });
}
