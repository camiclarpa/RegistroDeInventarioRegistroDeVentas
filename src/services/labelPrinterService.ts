import * as net from 'net';
import PDFDocument from 'pdfkit';
import { logger } from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface LabelData {
  productName: string;
  price: number;
  sku: string;
  barcode: string;  // EAN13: 13 dígitos numéricos
  brandName?: string;
}

export interface PrinterConfig {
  type: 'network' | 'bartender';
  ip?: string;
  port?: number;     // Puerto ZPL: 9100 (default)
  bartenderPath?: string;
  bartenderTemplate?: string;
  // Configuración de etiqueta SAT TT460 UE (203 dpi)
  labelWidthMm?: number;   // 32mm
  labelHeightMm?: number;  // 25mm
  dpi?: number;            // 203
}

export class LabelPrinterService {
  private config: PrinterConfig;

  constructor(config: PrinterConfig = { 
    type: 'network', 
    ip: '192.168.1.100', 
    port: 9100,
    labelWidthMm: 32,
    labelHeightMm: 25,
    dpi: 203
  }) {
    this.config = config;
  }

  /**
   * Generar ZPL para SAT TT460 UE (203 dpi)
   * Tamaño: 32mm x 25mm ≈ 256 x 200 dots a 203 DPI
   */
  generateZPL(data: LabelData): string {
    const { productName, price, sku, barcode } = data;
    
    // Convertir mm a dots: (mm * DPI) / 25.4
    const widthDots = Math.round((this.config.labelWidthMm || 32) * (this.config.dpi || 203) / 25.4);
    const heightDots = Math.round((this.config.labelHeightMm || 25) * (this.config.dpi || 203) / 25.4);
    
    // ZPL para etiqueta 32x25mm, texto y barcode EAN13
    return `
^XA
^LL${heightDots}
^LH0,0
^FO10,10^A0N,28,28^FD${productName.toUpperCase()}^FS
^FO10,45^A0N,40,40^FD$${price.toFixed(2)}^FS
^FO10,95^BY3,2.5,60^BCN,60,Y,N,N
^FD${barcode}^FS
^FO10,170^A0N,20,20^FD${sku}^FS
^PQ1
^XZ
`.trim();
  }

  /**
   * Enviar ZPL crudo vía TCP a impresora ZPL (puerto 9100)
   */
  sendZPLViaTCP(zpl: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      const ip = this.config.ip || '192.168.1.100';
      const port = this.config.port || 9100;
      const timeout = 5000;

      client.setTimeout(timeout);

      client.on('connect', () => {
        logger.debug('[ZPL] Conectado a impresora', { ip, port });
        client.write(zpl + '\n');
      });

      client.on('data', (data) => {
        // Algunas impresoras ZPL responden con estado
        logger.debug('[ZPL] Respuesta:', data.toString().trim());
      });

      client.on('timeout', () => {
        logger.error('[ZPL] Timeout de conexión', { ip, port });
        client.destroy();
        reject(new Error('Timeout conectando a impresora'));
      });

      client.on('error', (err) => {
        logger.error('[ZPL] Error de conexión', { error: err.message, ip, port });
        client.destroy();
        reject(err);
      });

      client.on('close', () => {
        logger.debug('[ZPL] Conexión cerrada');
        resolve(true);
      });

      client.connect(port, ip);
    });
  }

  /**
   * Generar PDF para impresión manual o BarTender
   * Tamaño: 32mm x 25mm
   */
  async generatePDF(data: LabelData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // 32mm = 90.71 pts, 25mm = 70.87 pts (a 72 DPI)
        const doc = new PDFDocument({
          size: [90.71, 70.87],
          margins: { top: 3, bottom: 3, left: 3, right: 3 }
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Producto (arriba, centrado)
        doc.fontSize(7).font('Helvetica-Bold')
           .text(data.productName.toUpperCase().substring(0, 25), { align: 'center' });
        
        // Precio (grande, centro)
        doc.moveDown(0.3).fontSize(12).font('Helvetica-Bold')
           .text(`$${data.price.toFixed(2)}`, { align: 'center' });
        
        // Barcode EAN13 (texto debajo del código)
        doc.moveDown(0.6).fontSize(5).font('Helvetica')
           .text(data.barcode, { align: 'center' });
        
        // SKU (abajo)
        doc.moveDown(0.2).fontSize(4)
           .text(data.sku, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Imprimir vía red (ZPL directo a IP:9100)
   */
  async printViaNetwork(data: LabelData): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.config.ip) {
        return { success: false, error: 'IP de impresora no configurada' };
      }

      const zpl = this.generateZPL(data);
      logger.debug('[ZPL] Enviando:', zpl.substring(0, 100) + '...');
      
      await this.sendZPLViaTCP(zpl);
      
      logger.info('[LabelPrinter] Etiqueta ZPL impresa', { 
        ip: this.config.ip, 
        product: data.productName,
        barcode: data.barcode 
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[LabelPrinter] Error impresión ZPL', { error: msg });
      return { success: false, error: `No se pudo imprimir: ${msg}` };
    }
  }

  /**
   * Imprimir vía BarTender (Windows)
   */
  async printViaBarTender(data: LabelData): Promise<{ success: boolean; error?: string }> {
    try {
      const { exec } = require('child_process');
      const csvPath = path.join('/tmp', `label_${Date.now()}.csv`);
      
      const csv = `ProductName,Price,SKU,Barcode\n"${data.productName}",${data.price},"${data.sku}","${data.barcode}"`;
      fs.writeFileSync(csvPath, csv, 'utf-8');

      const exe = this.config.bartenderPath || 'C:\\Program Files\\Seagull Science\\BarTender Suite\\BarTender.exe';
      const tpl = this.config.bartenderTemplate || 'C:\\Labels\\product_label.btw';
      const cmd = `"${exe}" /F="${tpl}" /D="${csvPath}" /P /X`;

      return new Promise((resolve) => {
        exec(cmd, (err: any) => {
          fs.unlinkSync(csvPath);
          if (err) {
            logger.error('[LabelPrinter] Error BarTender', { error: err.message });
            resolve({ success: false, error: err.message });
          } else {
            logger.info('[LabelPrinter] Impreso vía BarTender');
            resolve({ success: true });
          }
        });
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[LabelPrinter] Error BarTender', { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Método principal: Imprimir etiqueta
   */
  async printLabel(data: LabelData): Promise<{ success: boolean; error?: string }> {
    logger.info('[LabelPrinter] Iniciando impresión ZPL', { 
      product: data.productName, 
      type: this.config.type 
    });

    switch (this.config.type) {
      case 'network':
        return this.printViaNetwork(data);
      case 'bartender':
        return this.printViaBarTender(data);
      default:
        return { success: false, error: 'Tipo de impresora no configurado' };
    }
  }

  /**
   * Descargar PDF (para impresión manual)
   */
  async downloadPDF(data: LabelData): Promise<{ success: boolean; pdf?: Buffer; error?: string }> {
    try {
      return { success: true, pdf: await this.generatePDF(data) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Test de conexión a impresora ZPL
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      const ip = this.config.ip || '192.168.1.100';
      const port = this.config.port || 9100;

      client.setTimeout(3000);

      client.on('connect', () => {
        logger.info('[ZPL] Test: Conexión exitosa', { ip, port });
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err) => {
        logger.error('[ZPL] Test: Error de conexión', { error: err.message });
        resolve({ success: false, error: err.message });
      });

      client.on('timeout', () => {
        client.destroy();
        resolve({ success: false, error: 'Timeout' });
      });

      client.connect(port, ip);
    });
  }
}

// Exportar instancia singleton con configuración desde .env
export const labelPrinter = new LabelPrinterService({
  type: (process.env.PRINTER_TYPE as 'network' | 'bartender') || 'network',
  ip: process.env.PRINTER_IP,
  port: parseInt(process.env.PRINTER_PORT || '9100'),
  bartenderPath: process.env.BARTENDER_PATH,
  bartenderTemplate: process.env.BARTENDER_TEMPLATE,
  labelWidthMm: 32,
  labelHeightMm: 25,
  dpi: 203,  // SAT TT460 UE usa 203 DPI
});
