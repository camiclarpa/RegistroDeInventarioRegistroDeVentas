"""
Multi-Agent Orchestrator HÍBRIDO para SIGC-Motos
Groq API para entender lenguaje natural + Lógica rápida para flujo
"""
import os
import re
import json
from typing import TypedDict, List, Dict, Any
from groq import Groq

class AgentState(TypedDict):
    messages: List[str]
    current_field: str
    product_data: dict
    product_queue: List[dict]
    current_product_index: int
    response: str
    phase: str

class VoiceMultiAgentOrchestrator:
    """Orquestador HÍBRIDO: Groq para NLP + Lógica para flujo"""

    FIELDS = ['name', 'category', 'brand', 'quantity', 'sale_price']
    FIELD_NAMES_ES = {
        'name': 'nombre',
        'category': 'categoría',
        'brand': 'marca',
        'quantity': 'cantidad',
        'sale_price': 'precio'
    }

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY no configurada")
        self.client = Groq(api_key=self.api_key)

    async def process(self, user_message: str, context: dict = None) -> dict:
        """Procesa mensaje con Groq para extracción + lógica para flujo"""
        ctx = context or {}
        product_data = ctx.get('product_data', {})
        product_queue = ctx.get('product_queue', [])
        current_index = ctx.get('current_product_index', 0)
        current_field = ctx.get('current_field', 'name')
        phase = ctx.get('phase', 'collecting')

        if phase == 'collecting':
            return await self._handle_collecting(user_message, product_data, current_field, product_queue, current_index)
        elif phase == 'confirming':
            return await self._handle_confirming(user_message, product_data, product_queue, current_index)
        elif phase == 'correcting':
            return await self._handle_correcting(user_message, product_data, current_field)
        
        return {"response": "Error", "product_data": product_data}

    async def _handle_collecting(self, user_msg: str, product_data: dict, current_field: str, queue: list, idx: int) -> dict:
        """Fase: Recopilando datos con Groq para extracción"""
        # Usar Groq para extraer el valor del mensaje
        value = await self._extract_with_groq(user_msg, current_field, product_data)
        product_data[current_field] = value

        # Avanzar al siguiente campo
        field_idx = self.FIELDS.index(current_field)
        if field_idx < len(self.FIELDS) - 1:
            next_field = self.FIELDS[field_idx + 1]
            response = f"{self.FIELD_NAMES_ES[next_field]}?"
            return {
                "response": response,
                "product_data": product_data,
                "current_field": next_field,
                "phase": "collecting"
            }
        else:
            # Todos los campos completados → Confirmación
            response = self._build_confirmation(product_data)
            return {
                "response": response,
                "product_data": product_data,
                "phase": "confirming"
            }

    async def _extract_with_groq(self, user_msg: str, field: str, product_data: dict) -> str:
        """Usa Groq para extraer valor del mensaje en lenguaje natural"""
        try:
            prompt = f"""
Extrae el valor del campo '{self.FIELD_NAMES_ES[field]}' del mensaje del usuario.

Datos actuales del producto:
{json.dumps(product_data, ensure_ascii=False, indent=2)}

Mensaje del usuario: "{user_msg}"

Responde SOLO con el valor extraído, sin explicaciones.
Si es cantidad o precio, responde solo el número.
Si no puedes extraer el valor, responde con el mensaje original.

Valor extraído:
"""

            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
                temperature=0.1
            )

            extracted = response.choices[0].message.content.strip()
            
            # Limpiar comillas si las hay
            extracted = extracted.strip('"').strip("'")
            
            return extracted if extracted else user_msg
            
        except Exception as e:
            print(f"Error en Groq extraction: {e}")
            # Fallback: usar regex simple
            return self._extract_fallback(user_msg, field)

    def _extract_fallback(self, text: str, field: str) -> str:
        """Extracción fallback con regex si Groq falla"""
        text = text.strip()
        
        if field == 'quantity':
            match = re.search(r'\d+', text)
            return match.group(0) if match else text
        
        elif field == 'sale_price':
            text = text.replace('$', '').replace(',', '').replace(' ', '')
            match = re.search(r'\d+', text)
            return match.group(0) if match else text
        
        else:
            return text

    async def _handle_confirming(self, user_msg: str, product_data: dict, queue: list, idx: int) -> dict:
        """Fase: Confirmación del producto"""
        msg_lower = user_msg.lower()
        
        if any(word in msg_lower for word in ['sí', 'si', 'correcto', 'bien', 'ok', 'dale', 'perfecto']):
            # Confirmado → Siguiente producto o completar
            if idx < len(queue) - 1:
                next_idx = idx + 1
                response = f"Producto {next_idx + 1}: {self.FIELD_NAMES_ES['name']}?"
                return {
                    "response": response,
                    "product_data": {},
                    "current_field": "name",
                    "current_product_index": next_idx,
                    "phase": "collecting"
                }
            else:
                return {
                    "response": "Todos los productos registrados!",
                    "product_data": product_data,
                    "phase": "complete"
                }
        
        elif any(word in msg_lower for word in ['no', 'incorrecto', 'mal', 'cambiar', 'error']):
            return {
                "response": "¿Qué campo(s)?",
                "product_data": product_data,
                "phase": "correcting"
            }
        
        else:
            return {
                "response": "¿Sí o no?",
                "product_data": product_data,
                "phase": "confirming"
            }

    async def _handle_correcting(self, user_msg: str, product_data: dict, current_field: str) -> dict:
        """Fase: Corrigiendo campos específicos con Groq"""
        # Usar Groq para entender qué campos quiere corregir
        try:
            prompt = f"""
El usuario quiere corregir campos del producto. Responde en formato JSON.

Campos disponibles: {', '.join(self.FIELD_NAMES_ES.values())}

Mensaje del usuario: "{user_msg}"

Responde SOLO con un JSON array de los campos a corregir.
Ejemplo: ["name", "price"] o ["nombre", "marca"]

JSON:
"""

            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50,
                temperature=0.1
            )

            fields_json = response.choices[0].message.content.strip()
            fields_to_correct = json.loads(fields_json)
            
            # Convertir nombres en español a inglés
            field_map = {v: k for k, v in self.FIELD_NAMES_ES.items()}
            fields_to_correct = [field_map.get(f, f) for f in fields_to_correct]
            
        except Exception as e:
            print(f"Error en Groq correction: {e}")
            # Fallback: detección simple
            fields_to_correct = []
            msg_lower = user_msg.lower()
            for field, name_es in self.FIELD_NAMES_ES.items():
                if name_es in msg_lower or field in msg_lower:
                    fields_to_correct.append(field)

        if fields_to_correct:
            field_to_correct = fields_to_correct[0]
            response = f"{self.FIELD_NAMES_ES[field_to_correct]}?"
            return {
                "response": response,
                "product_data": product_data,
                "current_field": field_to_correct,
                "phase": "collecting"
            }
        else:
            return {
                "response": "¿Qué campo? Nombre, categoría, marca, cantidad o precio?",
                "product_data": product_data,
                "phase": "correcting"
            }

    def _build_confirmation(self, product_data: dict) -> str:
        """Construye mensaje de confirmación corto"""
        name = product_data.get('name', '?')
        category = product_data.get('category', '?')
        brand = product_data.get('brand', '?')
        quantity = product_data.get('quantity', '?')
        price = product_data.get('sale_price', '?')
        
        return f"{name}, {category}, {brand}, {quantity} unidades, ${price}. ¿Correcto?"

