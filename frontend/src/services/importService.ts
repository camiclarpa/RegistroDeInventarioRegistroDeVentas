/// <reference types="vite/client" />
import type { RawImportProduct, ImportMappingConfig, SmartTranslateResponse, EnrichedProduct, ValidationReport } from '../types';

const API_BASE = import.meta.env?.VITE_API_URL ?? '/api/v1';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token') ?? '';
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '', ...options?.headers },
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error ?? `HTTP ${response.status}`);
  return json.data as T;
}

export const importService = {
  smartTranslate: async (products: RawImportProduct[], mappingConfig: ImportMappingConfig, userId: string): Promise<SmartTranslateResponse> => {
    const formData = new FormData();
    formData.append('products', JSON.stringify(products));
    formData.append('mappingConfig', JSON.stringify(mappingConfig));
    formData.append('userId', userId);
    return apiFetch<SmartTranslateResponse>('/import/smart-translate', { method: 'POST', body: formData });
  },
  confirmImport: async (enrichedProducts: EnrichedProduct[], userId: string) => {
    return apiFetch('/import/confirm', { method: 'POST', body: JSON.stringify({ enrichedProducts, userId }) });
  },
  downloadErrorReport: (enrichedProducts: EnrichedProduct[]): void => {
    const errors = enrichedProducts.flatMap(p => p.errors.map(e => ({ fila: p.rowIndex, producto: p.name, tipo: 'Error', mensaje: e })));
    if (errors.length === 0) return;
    const csv = ['Fila,Producto,Tipo,Mensaje', ...errors.map(r => `${r.fila},"${r.producto}",${r.tipo},"${r.mensaje}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'errores-importacion.csv'; a.click();
    URL.revokeObjectURL(url);
  }
};
