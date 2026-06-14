import React, { useState } from 'react';
import { LabelDesigner } from '@/components/labels/LabelDesigner';
import { Tag } from 'lucide-react';

export default function Labels() {
  const [showDesigner, setShowDesigner] = useState(false);

  if (showDesigner) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <LabelDesigner />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Tag className="w-8 h-8" />
          Generador de Etiquetas
        </h1>
        <p className="text-gray-600 mt-2">
          Diseña e imprime etiquetas profesionales para tus productos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          onClick={() => setShowDesigner(true)}
          className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition border-2 border-transparent hover:border-blue-500"
        >
          <div className="h-48 bg-gray-100 rounded mb-4 flex items-center justify-center">
            <Tag className="w-16 h-16 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Nueva Etiqueta
          </h3>
          <p className="text-sm text-gray-600">
            Crea una etiqueta desde cero con el diseñador visual
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition border-2 border-transparent hover:border-blue-500">
          <div className="h-48 bg-gray-100 rounded mb-4 flex items-center justify-center">
            <span className="text-4xl">📦</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Plantillas Guardadas
          </h3>
          <p className="text-sm text-gray-600">
            Usa una plantilla predefinida y personalízala
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition border-2 border-transparent hover:border-blue-500">
          <div className="h-48 bg-gray-100 rounded mb-4 flex items-center justify-center">
            <span className="text-4xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Imprimir Lote
          </h3>
          <p className="text-sm text-gray-600">
            Imprime múltiples etiquetas de una vez
          </p>
        </div>
      </div>
    </div>
  );
}
