"""
Voice Activity Detection usando Silero VAD
"""
import torch

class SileroVAD:
    """VAD usando Silero (ML-based, alta precisión)"""
    
    def __init__(self, threshold: float = 0.5, sample_rate: int = 16000):
        self.threshold = threshold
        self.sample_rate = sample_rate
        
        # Cargar modelo Silero
        self.model, self.utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            trust_repo=True
        )
        
        self.model.eval()
    
    async def is_speech(self, audio_chunk: bytes) -> bool:
        """
        Detecta si un chunk de audio contiene voz
        
        Args:
            audio_chunk: Bytes de audio
        
        Returns:
            True si hay voz, False si es silencio
        """
        # Convertir a float32
        import numpy as np
        audio_float = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        
        # Si el chunk es muy corto, asumir que no es voz
        if len(audio_float) < 256:
            return False
        
        # Obtener confidence del modelo
        with torch.no_grad():
            speech_prob = self.model(
                torch.FloatTensor(audio_float),
                self.sample_rate
            ).item()
        
        return speech_prob > self.threshold
