"""
Voice Channel OPTIMIZADO - Manejador de sesiones de voz multi-producto
Objetivo: Flujo ultra-rápido para 10 productos en 1 minuto
"""
import asyncio
import json
from typing import Dict, Any, List
from fastapi import WebSocket, WebSocketDisconnect

from .stt.groq_whisper import GroqWhisperSTT
from .tts.piper_engine import PiperTTS
from .agents.orchestrator import VoiceMultiAgentOrchestrator
from .audio.vad import SileroVAD

class VoiceChannel:
    """Canal de voz OPTIMIZADO para SIGC-Motos"""

    def __init__(self):
        self.stt = GroqWhisperSTT()
        self.tts = PiperTTS()
        self.orchestrator = VoiceMultiAgentOrchestrator()
        self.vad = SileroVAD()

        # Estado de la sesión
        self.session_data: Dict[str, Any] = {
            "product_data": {},
            "product_queue": [],
            "current_product_index": 0,
            "current_field": "name",
            "phase": "collecting"
        }

    async def handle_voice_session(self, websocket: WebSocket):
        """Maneja sesión de voz con múltiples productos"""
        await websocket.accept()

        audio_buffer = []
        is_speaking = False

        try:
            # Esperar mensaje de inicio con lista de productos
            init_msg = await websocket.receive_text()
            init_data = json.loads(init_msg)
            
            if init_data.get('type') == 'start_session':
                self.session_data['product_queue'] = init_data.get('products', [])
                
                if not self.session_data['product_queue']:
                    await self._send_tts_response(websocket, "No hay productos para registrar")
                    await websocket.close()
                    return
                
                # Iniciar con primer producto
                first_product = self.session_data['product_queue'][0]
                greeting = f"Producto 1: {self.orchestrator.FIELD_NAMES_ES['name']}?"
                await self._send_tts_response(websocket, greeting)
                
                # Enviar estado inicial
                await websocket.send_json({
                    "type": "field_update",
                    "data": {
                        "current_field": "name",
                        "product_data": {},
                        "state": "collecting"
                    }
                })

            # Bucle principal de audio
            while True:
                try:
                    audio_chunk = await websocket.receive_bytes()

                    if await self.vad.is_speech(audio_chunk):
                        audio_buffer.append(audio_chunk)
                        is_speaking = True
                    elif is_speaking:
                        is_speaking = False

                        if audio_buffer:
                            await self._process_user_utterance(audio_buffer, websocket)
                            audio_buffer = []

                except WebSocketDisconnect:
                    print("Cliente desconectado")
                    break

        except Exception as e:
            print(f"Error en sesión de voz: {e}")
            await websocket.close()

    async def _process_user_utterance(self, audio_chunks: list, websocket: WebSocket):
        """Procesa enunciado del usuario"""
        # 1. Speech-to-Text
        combined_audio = b"".join(audio_chunks)
        user_text = await self.stt.transcribe(combined_audio)

        if not user_text.strip():
            return

        print(f"🎤 Usuario: {user_text}")

        # 2. Procesar con orquestador optimizado
        agent_result = await self.orchestrator.process(
            user_text,
            context={
                "product_data": self.session_data["product_data"],
                "product_queue": self.session_data["product_queue"],
                "current_product_index": self.session_data["current_product_index"],
                "current_field": self.session_data["current_field"],
                "phase": self.session_data["phase"]
            }
        )

        response_text = agent_result["response"]
        print(f"🤖 Agente: {response_text}")

        # Actualizar estado
        self.session_data["product_data"] = agent_result.get("product_data", {})
        self.session_data["current_field"] = agent_result.get("current_field", "name")
        self.session_data["current_product_index"] = agent_result.get("current_product_index", 0)
        self.session_data["phase"] = agent_result.get("phase", "collecting")

        # 3. Enviar respuesta TTS
        await self._send_tts_response(websocket, response_text)

        # 4. Enviar actualización de estado al frontend
        await websocket.send_json({
            "type": "field_update",
            "data": {
                "current_field": self.session_data["current_field"],
                "product_data": self.session_data["product_data"],
                "state": self.session_data["phase"]
            }
        })

        # 5. Si fase es 'complete', enviar mensaje final
        if self.session_data["phase"] == "complete":
            await websocket.send_json({
                "type": "all_products_complete",
                "data": {"message": "Todos los productos registrados"}
            })

    async def _send_tts_response(self, websocket: WebSocket, text: str):
        """Sintetiza texto a voz y lo envía"""
        async for audio_chunk in self.tts.synthesize_stream(text):
            await websocket.send_bytes(audio_chunk)

