import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { EnrichedProduct } from '../types';

interface Props { enrichedProducts: EnrichedProduct[]; qualityScore: number; }

const FieldBadge = ({ label, value, inferred }: { label: string; value: any; inferred: boolean }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className="text-gray-500 min-w-[80px]">{label}:</span>
      <span className="font-medium">{String(value)}</span>
      {inferred && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px]"><Sparkles className="w-2.5 h-2.5 inline"/> Auto</span>}
    </div>
  );
};

export const ProductEnrichmentPreview: React.FC<Props> = ({ enrichedProducts, qualityScore }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const preview = enrichedProducts.slice(0, 3);
  const qualityColor = qualityScore >= 85 ? 'text-green-600' : qualityScore >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-600"/>Vista Inteligente</span>
          <span className={`text-sm font-bold px-3 py-1 rounded-full text-white ${qualityScore >= 85 ? 'bg-green-500' : qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}>Calidad: {qualityScore}%</span>
        </div>
      </div>
      <div className="space-y-2">
        {preview.map((p, i) => (
          <div key={i} className={`border rounded-lg ${p.errors.length > 0 ? 'border-red-200' : p.warnings.length > 0 ? 'border-yellow-200' : 'border-green-200'}`}>
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex justify-between px-4 py-3 text-left">
              <div><p className="font-semibold truncate">{p.name}</p><p className="text-xs text-gray-500">{p.categoryName} · {p.brandName}</p></div>
              <div className="flex items-center gap-2">
                {p.errors.length > 0 && <XCircle className="w-4 h-4 text-red-500"/>}
                {p.warnings.length > 0 && !p.errors.length && <AlertTriangle className="w-4 h-4 text-yellow-500"/>}
                {!p.errors.length && !p.warnings.length && <CheckCircle className="w-4 h-4 text-green-500"/>}
                <span className={`text-xs font-bold ${qualityColor}`}>{p.dataQualityScore}%</span>
                {expanded === i ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
              </div>
            </button>
            {expanded === i && (
              <div className="px-4 py-3 bg-gray-50 grid grid-cols-2 gap-2 text-xs">
                <FieldBadge label="SKU" value={p.skuInternal} inferred={p.inferredFields.includes('sku')}/>
                <FieldBadge label="Barcode" value={p.barcodeExternal} inferred={p.inferredFields.includes('barcode')}/>
                <FieldBadge label="Categoría" value={p.categoryName} inferred={p.inferredFields.includes('category')}/>
                <FieldBadge label="Marca" value={p.brandName} inferred={p.inferredFields.includes('brand')}/>
                <FieldBadge label="P. Venta" value={p.salePrice ? `$${p.salePrice.toLocaleString('es-CO')}` : null} inferred={false}/>
                <FieldBadge label="IVA" value={`${p.taxRate}%`} inferred={p.inferredFields.includes('iva')}/>
                {p.warnings.length > 0 && <div className="col-span-2 text-yellow-700 text-xs">{p.warnings[0]}</div>}
                {p.errors.length > 0 && <div className="col-span-2 text-red-700 text-xs">{p.errors[0]}</div>}
              </div>
            )}
          </div>
        ))}
        {enrichedProducts.length > 3 && <p className="text-xs text-center text-gray-400">...y {enrichedProducts.length - 3} productos más</p>}
      </div>
    </div>
  );
};
