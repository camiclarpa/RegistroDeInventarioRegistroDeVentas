"""
API Routes para el sistema de voz
"""
from fastapi import APIRouter, WebSocket, HTTPException
from typing import Optional
import os

from voice_agent.voice_channel import VoiceChannel

router = APIRouter(prefix="/api/v1/voice", tags=["Voice Agent"])

@router.websocket("/ws")
async def voice_websocket(websocket: WebSocket):
    """
    WebSocket endpoint para agente de voz en compras
    """
    channel = VoiceChannel()
    await channel.handle_voice_session(websocket)

@router.get("/status")
async def voice_status():
    """Verifica si el sistema de voz está disponible"""
    groq_key = os.getenv("GROQ_API_KEY")
    
    return {
        "status": "active" if groq_key else "missing_api_key",
        "stt": "groq_whisper",
        "tts": "piper",
        "llm": "groq_llama3"
    }
