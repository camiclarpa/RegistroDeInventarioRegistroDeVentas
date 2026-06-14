"""
Voice Agent Microservice for SIGC-Motos
Multi-agent system using Groq (FREE) + Piper TTS (Open Source)
"""
import os
import json
import asyncio
import tempfile
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Voice components
from voice_agent import VoiceAgent

app = FastAPI(title="SIGC-Motos Voice Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

voice_agent = VoiceAgent()

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "voice-agent",
        "groq_key_configured": bool(os.getenv("GROQ_API_KEY")),
    }

@app.get("/status")
async def status():
    return {
        "stt": "groq_whisper",
        "tts": "piper",
        "llm": "groq_llama3",
        "multi_agent": True,
        "agents": voice_agent.get_agents_list(),
    }

@app.websocket("/ws")
async def voice_websocket(websocket: WebSocket):
    """Main WebSocket endpoint for voice interactions"""
    await voice_agent.handle_session(websocket)



@app.get("/sessions")
async def list_sessions():
    """Lista sesiones activas en Redis"""
    return {
        "active_sessions": voice_agent.get_active_sessions(),
        "count": len(voice_agent.get_active_sessions())
    }

@app.post("/synthesize")
async def synthesize(text: str = "Hola"):
    """Quick test endpoint"""
    audio = await voice_agent.tts_synthesize(text)
    return {"audio_length": len(audio), "text": text}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
