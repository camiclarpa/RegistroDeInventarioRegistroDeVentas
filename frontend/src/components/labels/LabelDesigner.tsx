import React, { useState } from 'react';
import { BackstageView } from './BackstageView';
import {
  Save, Printer, Download, Undo, Redo, Type, Barcode,
  QrCode, Square, Grid3X3, ZoomIn, ZoomOut, Eye, EyeOff,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Trash2, Layers, Settings, MousePointer, FileText
} from 'lucide-react';

interface Element {
  id: string;
  type: 'text' | 'barcode' | 'qrcode' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style: any;
  visible: boolean;
}

export const LabelDesigner: React.FC = () => {
  const [showBackstage, setShowBackstage] = useState(false);
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [activeTab, setActiveTab] = useState<'layers' | 'templates'>('layers');
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentTemplateName, setCurrentTemplateName] = useState('');

  const addElement = (type: Element['type']) => {
    const newEl: Element = {
      id: Date.now().toString(),
      type,
      x: 50 + elements.length * 30,
      y: 50 + elements.length * 30,
      width: type === 'text' ? 200 : 150,
      height: type === 'text' ? 40 : 100,
      content: type === 'text' ? 'Texto' : type === 'barcode' ? '123456789' : 'QR',
      style: { fontSize: 14, fontFamily: 'Arial', color: '#000', textAlign: 'center' as const },
      visible: true
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateElement = (id: string, updates: Partial<Element>) => {
    setElements(elements.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const selectedEl = elements.find(e => e.id === selectedId);

  if (showBackstage) {
    return <BackstageView onClose={() => setShowBackstage(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* BARRA 1: MENÚ PRINCIPAL */}
      <div className="bg-white border-b border-gray-300 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowBackstage(true)}
            className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Archivo
          </button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Edición</button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Ver</button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Insertar</button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Formato</button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Herramientas</button>
          <button className="px-3 py-1.5 text-sm font-medium hover:bg-blue-50 text-blue-700 rounded transition">Ayuda</button>
          
          <div className="flex-1" />
          
          <button className="p-2 hover:bg-gray-100 rounded transition" title="Guardar">
            <Save className="w-4 h-4 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded transition" title="Imprimir">
            <Printer className="w-4 h-4 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded transition" title="Exportar">
            <Download className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      {/* BARRA 2: HERRAMIENTAS RÁPIDAS */}
      <div className="bg-gray-50 border-b border-gray-300 px-3 py-2">
        <div className="flex items-center gap-2">
          <button onClick={() => addElement('text')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm font-medium shadow-sm">
            <Type className="w-4 h-4 text-blue-600" /> <span>Texto</span>
          </button>
          <button onClick={() => addElement('barcode')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm font-medium shadow-sm">
            <Barcode className="w-4 h-4 text-blue-600" /> <span>Barcode</span>
          </button>
          <button onClick={() => addElement('qrcode')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm font-medium shadow-sm">
            <QrCode className="w-4 h-4 text-blue-600" /> <span>QR</span>
          </button>
          <button onClick={() => addElement('shape')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm font-medium shadow-sm">
            <Square className="w-4 h-4 text-blue-600" /> <span>Forma</span>
          </button>
          
          <div className="w-px h-7 bg-gray-300 mx-2" />
          
          <button className="p-1.5 hover:bg-gray-200 rounded transition"><Undo className="w-4 h-4 text-gray-700" /></button>
          <button className="p-1.5 hover:bg-gray-200 rounded transition"><Redo className="w-4 h-4 text-gray-700" /></button>
          
          <div className="w-px h-7 bg-gray-300 mx-2" />
          
          <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 rounded transition ${showGrid ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          
          <div className="flex-1" />
          
          <button onClick={() => setZoom(Math.max(25, zoom - 25))} className="p-1.5 hover:bg-gray-200 rounded transition">
            <ZoomOut className="w-4 h-4 text-gray-700" />
          </button>
          <span className="text-sm font-semibold w-16 text-center text-gray-700">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(200, zoom + 25))} className="p-1.5 hover:bg-gray-200 rounded transition">
            <ZoomIn className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      {/* BARRA 3: FORMATO */}
      {selectedEl && selectedEl.type === 'text' && (
        <div className="bg-white border-b border-gray-300 px-3 py-2">
          <div className="flex items-center gap-2">
            <select className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option>Arial</option>
              <option>Times New Roman</option>
            </select>
            <select className="px-2 py-1 border border-gray-300 rounded text-sm w-20">
              {[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(s => <option key={s}>{s}</option>)}
            </select>
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <button className="p-1.5 hover:bg-gray-100 rounded"><Bold className="w-4 h-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded"><Italic className="w-4 h-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded"><Underline className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <button className="p-1.5 hover:bg-gray-100 rounded"><AlignLeft className="w-4 h-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded"><AlignCenter className="w-4 h-4" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded"><AlignRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL IZQUIERDO */}
        <div className="w-72 bg-white border-r border-gray-300 flex flex-col">
          <div className="flex border-b border-gray-300 bg-gray-50">
            <button onClick={() => setActiveTab('layers')} className={`flex-1 px-4 py-2.5 text-sm font-medium ${activeTab === 'layers' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}>
              <Layers className="w-4 h-4 inline mr-1.5" />Capas
            </button>
            <button onClick={() => setActiveTab('templates')} className={`flex-1 px-4 py-2.5 text-sm font-medium ${activeTab === 'templates' ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}>
              <Save className="w-4 h-4 inline mr-1.5" />Plantillas
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'layers' ? (
              <div className="space-y-1.5">
                {elements.map((el, idx) => (
                  <div key={el.id} onClick={() => setSelectedId(el.id)} className={`p-2.5 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedId === el.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'}`}>
                    {el.type === 'text' && <Type className="w-4 h-4" />}
                    {el.type === 'barcode' && <Barcode className="w-4 h-4" />}
                    {el.type === 'qrcode' && <QrCode className="w-4 h-4" />}
                    <span className="flex-1 text-sm truncate">{el.content}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                ))}
                {elements.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <MousePointer className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay elementos</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Save className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay plantillas</p>
              </div>
            )}
          </div>
        </div>

        {/* CANVAS */}
        <div className="flex-1 overflow-auto bg-gray-200 p-8">
          <div className="bg-white shadow-2xl mx-auto relative" style={{ width: 800 * (zoom / 100), height: 600 * (zoom / 100), backgroundImage: showGrid ? 'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)' : 'none', backgroundSize: `${10 * (zoom / 100)}px ${10 * (zoom / 100)}px` }} onClick={() => setSelectedId(null)}>
            {elements.filter(el => el.visible).map(el => (
              <div key={el.id} onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }} className={`absolute cursor-move ${selectedId === el.id ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'}`} style={{ left: el.x, top: el.y, width: el.width, height: el.height }}>
                {el.type === 'text' && <div className="w-full h-full flex items-center justify-center p-2 text-sm" style={el.style}>{el.content}</div>}
                {el.type === 'barcode' && <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-50"><div className="flex-1 flex items-end gap-0.5">{Array.from({ length: 30 }).map((_, i) => <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '3px' : '1px', height: `${60 + Math.random() * 40}%` }} />)}</div><span className="text-xs mt-1 font-mono">{el.content}</span></div>}
                {el.type === 'qrcode' && <div className="w-full h-full flex items-center justify-center bg-white p-2"><div className="grid grid-cols-5 gap-0.5">{Array.from({ length: 25 }).map((_, i) => <div key={i} className={`w-4 h-4 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`} />)}</div></div>}
                {el.type === 'shape' && <div className="w-full h-full bg-blue-100 border-2 border-blue-300 rounded-lg" />}
              </div>
            ))}
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="w-80 bg-white border-l border-gray-300 overflow-y-auto">
          {selectedEl ? (
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-bold border-b pb-3">Propiedades</h3>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block">X</label><input type="number" value={selectedEl.x} onChange={(e) => updateElement(selectedId!, { x: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" /></div>
                <div><label className="text-xs text-gray-500 block">Y</label><input type="number" value={selectedEl.y} onChange={(e) => updateElement(selectedId!, { y: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block">Ancho</label><input type="number" value={selectedEl.width} onChange={(e) => updateElement(selectedId!, { width: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" /></div>
                <div><label className="text-xs text-gray-500 block">Alto</label><input type="number" value={selectedEl.height} onChange={(e) => updateElement(selectedId!, { height: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm" /></div>
              </div>
              <textarea value={selectedEl.content} onChange={(e) => updateElement(selectedId!, { content: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" rows={3} />
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <MousePointer className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecciona un elemento</p>
            </div>
          )}
        </div>
      </div>

      {/* BARRA DE ESTADO */}
      <div className="bg-white border-t border-gray-300 px-4 py-2 text-xs text-gray-600 flex justify-between">
        <span>Elementos: {elements.length}</span>
        <span>Zoom: {zoom}%</span>
      </div>
    </div>
  );
};
