import { useState } from 'react';

export default function CRMPro() {
  const [activeTab, setActiveTab] = useState('analytics');
  
  const tabs = [
    { id: 'analytics', label: '📊 Analítica' },
    { id: 'communications', label: '💬 Comunicaciones' },
    { id: 'tickets', label: '🎫 Tickets' },
    { id: 'quotes', label: '📄 Cotizaciones' },
    { id: 'workshop', label: '🔧 Taller' },
    { id: 'campaigns', label: '🚀 Campañas' },
  ];

  const content: Record<string, string> = {
    analytics: 'Panel de KPIs, segmentación RFM y métricas de retención.',
    communications: 'Historial unificado de WhatsApp, Email y llamadas.',
    tickets: 'Gestión de incidencias con prioridades y asignación.',
    quotes: 'Generador de PDFs y envío por WhatsApp.',
    workshop: 'Registro de servicios por moto con kilometraje.',
    campaigns: 'Mensajes masivos segmentados por comportamiento.',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">CRM Pro - Módulo Unificado</h1>
      
      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-3">
          {tabs.find(t => t.id === activeTab)?.label}
        </h2>
        <p className="text-gray-600">{content[activeTab]}</p>
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <em>Contenido funcional en desarrollo...</em>
        </div>
      </div>
    </div>
  );
}
