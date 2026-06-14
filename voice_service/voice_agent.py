"""
Voice Agent - Multi-Producto con Corrección Instantánea
- Recibe lista de productos escaneados (con SKU)
- Procesa uno por uno
- Corrección instantánea de campos
- Sin latencia
"""
import os
import re
import struct
import time
import tempfile
import subprocess
from typing import Dict, Optional, List, Tuple
from groq import Groq
from fastapi import WebSocket


class VoiceAgent:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            print("ERROR: GROQ_API_KEY no configurada")
            self.client = None
        else:
            self.client = Groq(api_key=self.api_key)
            print("GROQ API configurada")

        self.piper_model = "/app/models/es_ES-sharvard-medium.onnx"
        self.sessions: Dict[str, Dict] = {}
        
        # Configuración optimizada
        self.vad_threshold = 1500.0  # EXTREMADAMENTE ALTO para evitar TODO ruido
        self.min_voice_duration_ms = 1500  # EXTREMADAMENTE ALTO para evitar ruido
        self.silence_frames_required = 3  # Frames de silencio antes de procesar
          # REDUCIDO para menor latencia (0.512s)
        
        # Palabras que Whisper alucina frecuentemente con ruido
        self.hallucination_words = [
            "gracias", "thank", "thanks", "you", "the", "and",
            "bye", "goodbye", "hello", "hi", "okay", "ok",
            "um", "uh", "hmm", "ah", "eh",
            "por favor", "please", "yes", "no",
            "video", "suscríbete", "suscribirse", "like", "comenta",
            "compartir", "suscribete", "canal", "siguiente"
        ]

        # Frases típicas de YouTube que Whisper alucina
        self.youtube_phrases = [
            "gracias por ver", "gracias por ver el video", "suscríbete al canal",
            "suscribete al canal", "dale like", "comenta abajo", "comparte este video",
            "thank you for watching", "thanks for watching", "please subscribe",
            "like and subscribe", "chau", "chao", "adiós", "hasta luego"
        ]  # REDUCIDO para menor latencia (0.512s)

    def get_agents_list(self) -> List[str]:
        return ["voice_agent"]

    def get_active_sessions(self) -> List[str]:
        """Retorna lista de sesiones activas"""
        return list(self.sessions.keys())

    # ═══════════════════════════════════════════════════════════
    # VAD Y AUDIO
    # ═══════════════════════════════════════════════════════════

    def _validate_audio_energy(self, audio_data: bytes) -> bool:
        """Valida que el audio tenga energía real (no solo ruido) - 6 VALIDACIONES"""
        if len(audio_data) < 1000:
            print(f"⚠️ Audio descartado: muy corto ({len(audio_data)} bytes)")
            return False

        try:
            num_samples = len(audio_data) // 2
            samples = struct.unpack(f'<{num_samples}h', audio_data[:num_samples * 2])

            # Calcular métricas
            sum_squares = sum(s * s for s in samples)
            rms = (sum_squares / len(samples)) ** 0.5
            max_amplitude = max(abs(s) for s in samples)
            mean = sum(samples) / len(samples)
            variance = sum((s - mean) ** 2 for s in samples) / len(samples)

            # VALIDACIÓN 1: RMS mínimo
            if rms < 1200:
                print(f"⚠️ Audio descartado: RMS muy bajo ({rms:.0f} < 1200)")
                return False
            
            # VALIDACIÓN 2: Max amplitude mínimo
            if max_amplitude < 5000:
                print(f"⚠️ Audio descartado: Max amplitude muy bajo ({max_amplitude} < 5000)")
                return False
            
            # VALIDACIÓN 3: Varianza mínima
            if variance < 200000:
                print(f"⚠️ Audio descartado: Varianza muy baja ({variance:.0f} < 200000)")
                return False

            # VALIDACIÓN 4: No es ruido constante (Max debe ser > RMS * 3)
            if max_amplitude < rms * 3:
                print(f"⚠️ Audio descartado: Parece ruido constante (Max={max_amplitude}, RMS={rms:.0f})")
                return False

            # VALIDACIÓN 5: Voz consistente (picos > 5%)
            peak_count = sum(1 for s in samples if abs(s) > rms * 2)
            peak_percentage = (peak_count / num_samples) * 100
            if peak_percentage < 5:
                print(f"⚠️ Audio descartado: Muy pocos picos de voz ({peak_percentage:.1f}%)")
                return False

            # VALIDACIÓN 6: No es silencio con picos (silencio < 70%)
            zero_count = sum(1 for s in samples if abs(s) < 100)
            zero_percentage = (zero_count / num_samples) * 100
            if zero_percentage > 70:
                print(f"⚠️ Audio descartado: Demasiado silencio ({zero_percentage:.1f}%)")
                return False

            print(f"✅ Audio válido: RMS={rms:.0f}, Max={max_amplitude}, Var={variance:.0f}, Picos={peak_percentage:.1f}%")
            return True

        except Exception as e:
            print(f"❌ Error validando energía: {e}")
            return False

    def _is_hallucination(self, text: str) -> bool:
        """Detecta si el texto es una alucinación de Whisper"""
        text_lower = text.lower().strip()
        
        # Si el texto es muy corto (1-2 palabras) y está en la lista
        words = text_lower.split()
        if len(words) <= 2:
            for halluc_word in self.hallucination_words:
                if halluc_word in text_lower:
                    print(f"⚠️ Alucinación detectada: '{text}'")
                    return True
        
        # Si el texto es solo una palabra repetida
        if len(words) > 1 and len(set(words)) == 1:
            print(f"⚠️ Palabra repetida detectada: '{text}'")
            return True
        
        return False

    def _calculate_rms(self, audio_data: bytes) -> float:
        """Calcula RMS del audio PCM16"""
        if len(audio_data) < 100:
            return 0.0
        try:
            num_samples = len(audio_data) // 2
            samples = struct.unpack(f'<{num_samples}h', audio_data[:num_samples * 2])
            if not samples:
                return 0.0
            sum_squares = sum(s * s for s in samples)
            return (sum_squares / len(samples)) ** 0.5
        except:
            return 0.0

    def _is_voice_activity(self, audio_data: bytes) -> Tuple[bool, float]:
        """Detecta si hay voz"""
        rms = self._calculate_rms(audio_data)
        return rms > self.vad_threshold, rms

    def _add_wav_header(self, pcm_data: bytes, sample_rate: int = 16000) -> bytes:
        """Agrega header WAV a PCM16 raw"""
        data_size = len(pcm_data)
        byte_rate = sample_rate * 2
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF', 36 + data_size, b'WAVE', b'fmt ',
            16, 1, 1, sample_rate, byte_rate, 2, 16, b'data', data_size
        )
        return header + pcm_data

    # ═══════════════════════════════════════════════════════════
    # FLUJO PRINCIPAL
    # ═══════════════════════════════════════════════════════════
    async def handle_session(self, websocket: WebSocket):
        """Maneja sesión de voz con multi-producto"""
        await websocket.accept()
        session_id = str(id(websocket))

        # Inicializar sesión
        self.sessions[session_id] = {
            "product_queue": [],  # Lista de productos escaneados
            "current_index": 0,   # Índice del producto actual
            "product_data": {
                "name": None,
                "category": None,
                "brand": None,
                "quantity": None,
                "sale_price": None,
            },
            "current_sku": None,  # SKU del producto actual
            "current_barcode": None,  # Barcode del producto actual
            "current_field": "name",
            "state": "waiting_products",  # waiting_products, collecting, confirming, correcting, complete
            "audio_buffer": b"",
            "silence_frames": 0,
            "voice_frames": 0,
            "correcting_field": None,  # Campo que se está corrigiendo
        }

        try:
            # Saludo inicial
            await self._send_audio(websocket, "Hola, escanea los productos.", session_id)
            await self._send_field_update(websocket, session_id)

            while True:
                try:
                    message = await websocket.receive()
                    
                    if "bytes" in message:
                        await self._handle_audio(message["bytes"], session_id, websocket)
                    elif "text" in message:
                        # Manejar comandos del frontend (lista de productos)
                        await self._handle_command(message["text"], session_id, websocket)

                    if self.sessions[session_id]["state"] == "complete":
                        break

                except Exception as e:
                    print(f"Error: {e}")
                    break

        finally:
            self.sessions.pop(session_id, None)

    async def _handle_command(self, command_text: str, session_id: str, websocket: WebSocket):
        """Maneja comandos del frontend (JSON)"""
        import json
        try:
            command = json.loads(command_text)
            
            if command.get("type") == "start_with_products":
                products = command.get("products", [])
                await self._start_with_products(products, session_id, websocket)
                
        except Exception as e:
            print(f"Error procesando comando: {e}")

    async def _start_with_products(self, products: List[Dict], session_id: str, websocket: WebSocket):
        """Inicia sesión con lista de productos escaneados - GUARDA BARCODE Y SKU"""
        session = self.sessions.get(session_id)
        if not session:
            return

        # Guardar productos con barcode y sku de CADA producto
        session["product_queue"] = []
        for product in products:
            session["product_queue"].append({
                "barcode": product.get("barcode", ""),
                "sku": product.get("sku", ""),
                "name": product.get("name"),
                "category": product.get("category"),
                "brand": product.get("brand"),
                "sale_price": product.get("sale_price"),
                "quantity": product.get("quantity")
            })
    
        session["current_index"] = 0
        session["state"] = "collecting"

        total = len(products)
        await self._send_audio(websocket, f"{total} productos. Empezamos.", session_id)

        # Anunciar primer producto
        await self._announce_current_product(session_id, websocket)

    async def _announce_current_product(self, session_id: str, websocket: WebSocket):
        """Anuncia el producto actual con su SKU"""
        session = self.sessions.get(session_id)
        if not session:
            return

        idx = session["current_index"]
        total = len(session["product_queue"])
        
        if idx >= total:
            # Todos completados
            session["state"] = "complete"
            await self._send_audio(websocket, f"Listo. {total} productos registrados.", session_id)
            await websocket.send_json({"type": "all_complete", "total": total})
            return

        product = session["product_queue"][idx]
        sku = product.get("sku", f"Producto {idx + 1}")
        barcode = product.get("barcode", "")
        session["current_sku"] = sku
        session["current_barcode"] = barcode
        
        # Resetear campos
        session["product_data"] = {
            "name": None,
            "category": None,
            "brand": None,
            "quantity": None,
            "sale_price": None,
        }
        session["current_field"] = "name"
        
        msg = "Nombre del producto?"
        await self._send_audio(websocket, msg, session_id)
        await self._send_field_update(websocket, session_id)

    async def _handle_audio(self, audio_chunk: bytes, session_id: str, websocket: WebSocket):
        """Maneja chunks de audio"""
        session = self.sessions.get(session_id)
        if not session:
            return

        # VAD
        is_voice, rms = self._is_voice_activity(audio_chunk)
        
        await websocket.send_json({
            "type": "vad_metrics",
            "rms": round(rms, 2),
            "is_voice": is_voice,
            "threshold": self.vad_threshold
        })

        if not is_voice:
            session["silence_frames"] += 1
            session["voice_frames"] = 0
            
            # Procesar después de 3 frames de silencio
            if session["audio_buffer"] and session["silence_frames"] >= self.silence_frames_required:
                # Verificar que el buffer tenga suficiente duración
                duration_ms = (len(session["audio_buffer"]) / 32000) * 1000
                if duration_ms >= self.min_voice_duration_ms:
                    await self._process_audio(session["audio_buffer"], session_id, websocket)
                    session["audio_buffer"] = b""
                    session["silence_frames"] = 0
            return

        # Hay voz REAL (RMS > threshold): acumular
        print(f"🎤 Voz detectada: RMS={rms:.0f} > {self.vad_threshold}, frames={session['voice_frames']}")
        session["voice_frames"] += 1
        session["silence_frames"] = 0
        session["audio_buffer"] += audio_chunk

    async def _process_audio(self, audio_data: bytes, session_id: str, websocket: WebSocket):
        """Procesa audio completo - OPTIMIZADO PARA VELOCIDAD"""
        session = self.sessions.get(session_id)
        if not session or not self.client:
            return

        # Verificar duración mínima (reducida a 200ms)
        duration_ms = (len(audio_data) / 32000) * 1000
        if duration_ms < 200:  # REDUCIDO de 300 a 200
            return

        print(f"🎤 Audio recibido: {len(audio_data)} bytes ({duration_ms:.0f}ms)")
        
        # VALIDACIÓN 1: Verificar energía del audio (no solo ruido)
        if not self._validate_audio_energy(audio_data):
            print(f"⚠️ Audio descartado: no tiene energía real")
            return

        # VALIDACIÓN 2: Verificar que el audio no sea silencio prolongado
        num_samples = len(audio_data) // 2
        if num_samples > 0:
            samples = struct.unpack(f'<{num_samples}h', audio_data[:num_samples * 2])
            zero_count = sum(1 for s in samples if s == 0)
            zero_percentage = (zero_count / num_samples) * 100
            if zero_percentage > 80:
                print(f"⚠️ Audio descartado: {zero_percentage:.1f}% ceros (silencio)")
                return
            return
        
        # STT
        user_text = await self._stt_transcribe(audio_data)
        
        # VALIDACIÓN 2: Texto no vacío
        if not user_text or len(user_text.strip()) < 2:
            print(f"⚠️ STT vacío o muy corto: '{user_text}'")
            return
        
        # VALIDACIÓN 3: No es alucinación de Whisper
        if self._is_hallucination(user_text):
            print(f"⚠️ Texto descartado por alucinación: '{user_text}'")
            return

        print(f"✅ Cliente: {user_text}")

        # Enviar transcripción al frontend
        await websocket.send_json({
            "type": "transcription",
            "speaker": "user",
            "text": user_text
        })

        # Procesar según estado
        state = session["state"]
        
        if state == "collecting":
            await self._handle_collecting(user_text, session, websocket)
        elif state == "confirming":
            await self._handle_confirming(user_text, session, websocket)
        elif state == "correcting":
            await self._handle_correcting(user_text, session, websocket)

        # Actualizar frontend
        await self._send_field_update(websocket, session_id)

    # ═══════════════════════════════════════════════════════════
    # ESTADOS
    # ═══════════════════════════════════════════════════════════
    async def _handle_collecting(self, user_text: str, session: Dict, websocket: WebSocket):
        """Maneja estado de recolección de datos - OPTIMIZADO"""
        current_field = session["current_field"]
        
        print(f"📝 Procesando campo '{current_field}' con texto: '{user_text}'")
        
        # Extraer valor con LLM
        value = await self._extract_value(user_text, current_field)
        
        if not value:
            print(f"❌ No se pudo extraer valor para {current_field}")
            await self._send_audio(websocket, "No entendí. Repite por favor.", str(id(websocket)))
            return

        # Guardar valor INMEDIATAMENTE
        session["product_data"][current_field] = value
        print(f"✅ Campo {current_field} actualizado: {value}")
        
        # Enviar actualización INMEDIATA al frontend (antes del TTS)
        await self._send_field_update(websocket, str(id(websocket)))

        # Avanzar al siguiente campo
        field_order = ["name", "category", "brand", "quantity", "sale_price"]
        current_idx = field_order.index(current_field)
        
        if current_idx < len(field_order) - 1:
            next_field = field_order[current_idx + 1]
            session["current_field"] = next_field
            
            # Pregunta DIRECTA
            questions = {
                "category": "Categoría.",
                "brand": "Marca.",
                "quantity": "Cantidad.",
                "sale_price": "Precio de venta."
            }
            
            await self._send_audio(websocket, questions[next_field], str(id(websocket)))
        else:
            # Todos los campos completos → confirmación
            session["state"] = "confirming"
            await self._ask_confirmation(session, websocket)

    async def _handle_confirming(self, user_text: str, session: Dict, websocket: WebSocket):
        """Maneja estado de confirmación"""
        user_text_lower = user_text.lower()
        
        # Detectar intención
        if any(word in user_text_lower for word in ["sí", "si", "correcto", "bien", "ok", "perfecto"]):
            # Confirmado → avanzar al siguiente producto
            # Confirmado → enviar product_complete con barcode y sku
            product_data = session["product_data"].copy()
            product_data["barcode"] = session.get("current_barcode", "")
            product_data["sku"] = session.get("current_sku", "")
            product_data["index"] = session.get("current_index", 0)
            
            await websocket.send_json({
                "type": "product_complete",
                "data": product_data
            })
            
            session["current_index"] += 1
            
            # Anunciar siguiente producto
            await self._announce_current_product(str(id(websocket)), websocket)
        
        elif any(word in user_text_lower for word in ["no", "incorrecto", "mal", "cambiar", "corregir"]):
            # No confirmado → preguntar qué campo corregir
            await self._send_audio(websocket, "Qué campo?", str(id(websocket)))
            session["state"] = "correcting"
        
        else:
            # No entendió
            await self._send_audio(websocket, "Sí o no?", str(id(websocket)))

    async def _handle_correcting(self, user_text: str, session: Dict, websocket: WebSocket):
        """Maneja estado de corrección"""
        user_text_lower = user_text.lower()
        
        # Detectar qué campo quiere corregir
        field_map = {
            "nombre": "name",
            "categoría": "category", "categoria": "category",
            "marca": "brand",
            "cantidad": "quantity",
            "precio": "sale_price"
        }
        
        detected_field = None
        for keyword, field in field_map.items():
            if keyword in user_text_lower:
                detected_field = field
                break
        
        if detected_field:
            # Guardar campo a corregir
            session["correcting_field"] = detected_field
            session["current_field"] = detected_field
            session["state"] = "collecting"
            
            field_names = {
                "name": "nombre",
                "category": "categoría",
                "brand": "marca",
                "quantity": "cantidad",
                "sale_price": "precio"
            }
            
            await self._send_audio(websocket, f"Ok. {field_names[detected_field].capitalize()}?", str(id(websocket)))
        else:
            # No entendió qué campo
            await self._send_audio(websocket, "Qué campo?", str(id(websocket)))

    async def _extract_value(self, user_text: str, field: str) -> Optional[str]:
        """Extrae valor del campo con LLM - OPTIMIZADO PARA NÚMEROS"""
        if not self.client:
            return None

        # Prompt ESPECÍFICO para cada tipo de campo
        if field in ["quantity", "sale_price"]:
            # PROMPT ESPECIAL PARA NÚMEROS
            prompt = f"""Eres un experto en extraer números de texto en español.

Campo: {field}
Usuario dice: "{user_text}"

INSTRUCCIONES:
- Extrae SOLO el número mencionado
- Si dice "veinticinco mil" → responde "25000"
- Si dice "cien" → responde "100"
- Si dice "tres mil quinientos" → responde "3500"
- Si dice "25000" → responde "25000"
- Si hay múltiples números, usa el MÁS GRANDE para precio, el más pequeño para cantidad
- Responde SOLO con el número en dígitos, sin texto adicional

Ejemplos:
- "veinticinco mil trescientos" → "25300"
- "cincuenta" → "50"
- "tres unidades" → "3"
- "el precio es 25000" → "25000"

Responde SOLO con el número:"""
        else:
            # PROMPT PARA TEXTO
            prompt = f"""Campo: {field}
Usuario dice: "{user_text}"
Extrae SOLO el valor. Responde SOLO con el valor, nada más."""

        try:
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=20,
                temperature=0.0,  # TEMPERATURA CERO para máxima precisión
            )
            
            value = completion.choices[0].message.content.strip()
            print(f"🔍 LLM extrajo: '{value}' para campo {field}")
            
            # Validación ESPECÍFICA para números
            if field in ["quantity", "sale_price"]:
                # Extraer todos los números del texto
                numbers = re.findall(r'\d+', value)
                if not numbers:
                    # Intentar extraer de user_text directamente
                    numbers = re.findall(r'\d+', user_text)
                
                if numbers:
                    # Para precio, usar el número más grande
                    # Para cantidad, usar el número más pequeño
                    if field == "sale_price":
                        result = max([int(n) for n in numbers])
                    else:
                        result = min([int(n) for n in numbers])
                    
                    print(f"✅ Número extraído: {result}")
                    return str(result)
                else:
                    print(f"❌ No se pudo extraer número de: '{value}'")
                    return None
            
            # Para texto, validar longitud
            return value if value and len(value) < 50 else None
            
        except Exception as e:
            print(f"❌ Error extrayendo valor: {e}")
            return None

    async def _ask_confirmation(self, session: Dict, websocket: WebSocket):
        """Pregunta confirmación final"""
        data = session["product_data"]
        
        msg = f"{data['name']}, {data['category']}, {data['brand']}, {data['quantity']}, {data['sale_price']}. Correcto?"
        
        await self._send_audio(websocket, msg, str(id(websocket)))

    # ═══════════════════════════════════════════════════════════
    # STT Y TTS
    # ═══════════════════════════════════════════════════════════
    async def _stt_transcribe(self, audio_data: bytes) -> str:
        """Transcribe audio con Groq Whisper - OPTIMIZADO"""
        wav_data = self._add_wav_header(audio_data)
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_data)
            temp_path = f.name

        try:
            print(f"🎙️ Enviando {len(wav_data)} bytes a Groq STT...")
            with open(temp_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3-turbo",
                    language="es",
                    response_format="text",
                )
            result = transcription.strip()
            print(f"✅ STT transcribió: '{result}'")
            return result
        except Exception as e:
            print(f"❌ STT error: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    async def _send_audio(self, websocket: WebSocket, text: str, session_id: str):
        """Sintetiza y envía audio"""
        print(f"Agente: {text}")
        
        # Enviar transcripción al frontend
        await websocket.send_json({
            "type": "transcription",
            "speaker": "agent",
            "text": text
        })
        
        # Sintetizar con Piper
        audio = await self.tts_synthesize(text)
        if audio:
            await websocket.send_bytes(audio)

    async def tts_synthesize(self, text: str) -> bytes:
        """Sintetiza texto con Piper TTS"""
        if not os.path.exists(self.piper_model):
            return b""

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            output_path = f.name

        try:
            cmd = [
                "/usr/local/bin/piper/piper",
                "-m", self.piper_model,
                "-f", output_path
            ]
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            stdout, stderr = process.communicate(input=text.encode("utf-8"), timeout=5)

            if process.returncode != 0:
                return b""

            with open(output_path, "rb") as f:
                return f.read()
        except:
            return b""
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)

    # ═══════════════════════════════════════════════════════════
    # FRONTEND
    # ═══════════════════════════════════════════════════════════
    async def _send_field_update(self, websocket: WebSocket, session_id: str):
        """Envía actualización de campos al frontend"""
        session = self.sessions.get(session_id)
        if not session:
            return

        await websocket.send_json({
            "type": "field_update",
            "data": {
                "product_data": session["product_data"],
                "current_field": session["current_field"],
                "state": session["state"],
                "current_sku": session.get("current_sku"),
                "current_barcode": session.get("current_barcode"),
                "current_index": session.get("current_index", 0),
                "total_products": len(session.get("product_queue", []))
            }
        })
