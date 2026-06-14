"""
Speech-to-Text usando Groq API (GRATIS)
Soporta Whisper-large-v3-turbo
"""
import os
import tempfile
from groq import Groq
from typing import Optional

class GroqWhisperSTT:
    """STT engine usando Groq Whisper API"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY no configurada")
        
        self.client = Groq(api_key=self.api_key)
        self.model = "whisper-large-v3-turbo"
    
    async def transcribe(self, audio_data: bytes, language: str = "es") -> str:
        """
        Transcribe audio a texto
        
        Args:
            audio_data: Bytes de audio en formato WAV/PCM
            language: Código de idioma (default: 'es')
        
        Returns:
            Texto transcrito
        """
        # Guardar audio temporalmente
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            with open(temp_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model=self.model,
                    language=language,
                    response_format="text"
                )
            return transcription.strip()
        finally:
            os.unlink(temp_path)
    
    async def transcribe_file(self, file_path: str, language: str = "es") -> str:
        """Transcribe un archivo de audio"""
        with open(file_path, "rb") as audio_file:
            transcription = self.client.audio.transcriptions.create(
                file=audio_file,
                model=self.model,
                language=language,
                response_format="text"
            )
        return transcription.strip()
