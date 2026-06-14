"""
Text-to-Speech usando Piper TTS (Open Source, rápido)
"""
import subprocess
import tempfile
import os
from typing import AsyncGenerator

class PiperTTS:
    """TTS engine usando Piper"""
    
    def __init__(self, model_path: str = "/opt/SIGH_MOTOS/voice_models/es_ES-carlfm-x_medium.onnx"):
        self.model_path = model_path
        self.piper_binary = "/usr/local/bin/piper"
        
        if not os.path.exists(self.piper_binary):
            raise FileNotFoundError(f"Piper binary no encontrado en {self.piper_binary}")
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modelo TTS no encontrado en {self.model_path}")
    
    async def synthesize(self, text: str) -> bytes:
        """
        Sintetiza texto a audio WAV
        
        Args:
            text: Texto a sintetizar
        
        Returns:
            Bytes de audio WAV
        """
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            output_path = f.name
        
        try:
            # Ejecutar Piper
            cmd = [
                self.piper_binary,
                "-m", self.model_path,
                "-f", output_path
            ]
            
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            stdout, stderr = process.communicate(input=text.encode('utf-8'))
            
            if process.returncode != 0:
                raise RuntimeError(f"Error en Piper TTS: {stderr.decode()}")
            
            # Leer audio generado
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            return audio_data
        
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)
    
    async def synthesize_stream(self, text: str) -> AsyncGenerator[bytes, None]:
        """
        Generator para streaming de audio en chunks
        
        Args:
            text: Texto a sintetizar
        
        Yields:
            Chunks de audio (1024 bytes)
        """
        audio = await self.synthesize(text)
        
        # Enviar en chunks
        chunk_size = 1024
        for i in range(0, len(audio), chunk_size):
            yield audio[i:i + chunk_size]
