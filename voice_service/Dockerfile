FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    espeak \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalar Piper TTS (binario oficial)
RUN wget -q https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar -xzf piper_linux_x86_64.tar.gz \
    && mv piper /usr/local/bin/ \
    && chmod +x /usr/local/bin/piper \
    && rm piper_linux_x86_64.tar.gz

# Crear directorio de modelos
RUN mkdir -p /app/models

# Descargar modelo español (sharvard medium - confirmado 200 OK)
RUN wget -q --show-progress \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx \
    -O /app/models/es_ES-sharvard-medium.onnx \
    && wget -q \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json \
    -O /app/models/es_ES-sharvard-medium.onnx.json

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
