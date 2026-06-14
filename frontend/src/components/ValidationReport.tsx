import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { EnrichedProduct, ValidationReport as VReport } from '../types';
import { importService } from '../services/importService';

interface Props { report: VReport; enrichedProducts: EnrichedProduct[]; }

export const ValidationReport: React.FC<Props> = ({ report, enrichedProducts }) => {
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const qualityColor = report.qualityScore >= 85 ? 'bg-green-500' : report.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const allWarnings = enrichedProducts.flatMap(p => p.warnings.map(w => ({ product: p.name, message: w })));
  const allErrors = enrichedProducts.flatMap(p => p.errors.map(e => ({ product: p.name, message: e })));

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 border">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold">Calidad de Importación</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full text-white ${qualityColor}`}>{report.qualityScore}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2"><div className={`${qualityColor} h-2 rounded-full`} style={{ width: `${report.qualityScore}%` }} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 p-3 rounded-lg text-center"><CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" /><span className="text-2xl font-bold text-green-600">{report.validProducts}</span><p className="text-xs text-green-700">Válidos</p></div>
        <div className="bg-yellow-50 p-3 rounded-lg text-center"><AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-1" /><span className="text-2xl font-bold text-yellow-600">{report.productsWithWarnings}</span><p className="text-xs text-yellow-700">Advertencias</p></div>
        <div className="bg-red-50 p-3 rounded-lg text-center"><XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" /><span className="text-2xl font-bold text-red-600">{report.productsWithErrors}</span><p className="text-xs text-red-700">Errores</p></div>
      </div>
      {allWarnings.length > 0 && (
        <div className="border border-yellow-200 rounded-lg">
          <button onClick={() => setWarningsOpen(!warningsOpen)} className="w-full flex justify-between px-4 py-3 bg-yellow-50 text-sm font-medium text-yellow-800">
            <span><AlertTriangle className="w-4 h-4 inline mr-1" />{allWarnings.length} advertencias</span>{warningsOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>
          {warningsOpen && <div className="divide-y max-h-48 overflow-y-auto">{allWarnings.slice(0,20).map((w,i) => <div key={i} className="px-4 py-2 text-xs"><span className="font-medium">{w.product}:</span> {w.message}</div>)}</div>}
        </div>
      )}
      {allErrors.length > 0 && (
        <div className="border border-red-200 rounded-lg">
          <button onClick={() => setErrorsOpen(!errorsOpen)} className="w-full flex justify-between px-4 py-3 bg-red-50 text-sm font-medium text-red-800">
            <span><XCircle className="w-4 h-4 inline mr-1" />{allErrors.length} errores</span>{errorsOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </button>
          {errorsOpen && <div className="divide-y max-h-48 overflow-y-auto">{allErrors.slice(0,20).map((e,i) => <div key={i} className="px-4 py-2 text-xs text-red-700"><span className="font-medium">{e.product}:</span> {e.message}</div>)}</div>}
        </div>
      )}
      {(allErrors.length > 0 || allWarnings.length > 0) && <button onClick={() => importService.downloadErrorReport(enrichedProducts)} className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm"><Download className="w-4 h-4"/>Descargar reporte (.csv)</button>}
    </div>
  );
};
