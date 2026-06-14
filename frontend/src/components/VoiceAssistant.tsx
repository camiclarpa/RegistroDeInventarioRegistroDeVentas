import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Volume2, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface VoiceAssistantProps {
  onProductData: (data: ProductVoiceData) => void
  isOpen: boolean
  onClose: () => void
}

export interface ProductVoiceData {
  name: string
  category: string
  brand: string
  salePrice: number
  quantity: number
}

type SessionStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'complete' | 'error'

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onProductData, isOpen, onClose }) => {
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [currentField, setCurrentField] = useState<string>('')
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [productData, setProductData] = useState<Partial<ProductVoiceData>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)

  // Determinar URL del WebSocket (wss:// para HTTPS, ws:// para HTTP)
  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/v1/voice/ws`
  }

  const playAudioChunk = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 22050 })
    }

    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      return new Promise<void>((resolve) => {
        source.onended = () => resolve()
        source.start()
      })
    } catch (err) {
      console.error('Error reproduciendo audio:', err)
    }
  }, [])

  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current) return
    isPlayingRef.current = true

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!
      await playAudioChunk(chunk)
    }

    isPlayingRef.current = false
  }, [playAudioChunk])

  const startListening = async () => {
    try {
      // Solicitar permiso del micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })
      mediaStreamRef.current = stream

      // Conectar WebSocket
      const wsUrl = getWsUrl()
      console.log('🎤 Conectando a:', wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        console.log('✅ WebSocket conectado')
        setStatus('listening')
        setCurrentQuestion('Conectado. Habla ahora...')
        toast.success('Asistente de voz activado')

        // Iniciar captura de audio
        const audioContext = new AudioContext({ sampleRate: 16000 })
        const source = audioContext.createMediaStreamSource(stream)
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0)
            const pcm16 = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(inputData[i] * 32768)))
            }
            ws.send(pcm16.buffer)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Audio del agente
          audioQueueRef.current.push(event.data)
          setStatus('speaking')
          processAudioQueue()
        } else {
          // JSON con datos
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'product_complete') {
              setStatus('complete')
              setProductData(msg.data)
              toast.success('¡Producto registrado por voz!')
              onProductData(msg.data as ProductVoiceData)
              setTimeout(() => stopListening(), 2000)
            } else if (msg.type === 'text') {
              setCurrentQuestion(msg.content)
            } else if (msg.type === 'status') {
              setCurrentField(msg.field || '')
              setCurrentQuestion(msg.question || '')
            }
          } catch (err) {
            console.error('Error parsing JSON:', err)
          }
        }
      }

      ws.onerror = (err) => {
        console.error('❌ WebSocket error:', err)
        setStatus('error')
        toast.error('Error de conexión con el asistente de voz')
      }

      ws.onclose = () => {
        console.log('🔌 WebSocket cerrado')
        setStatus('idle')
      }

    } catch (err) {
      console.error('Error iniciando escucha:', err)
      toast.error('No se pudo acceder al micrófono')
      setStatus('error')
    }
  }

  const stopListening = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    setStatus('idle')
    setProductData({})
    setCurrentQuestion('')
  }

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [])

  if (!isOpen) return null

  const statusConfig = {
    idle: { color: 'bg-gray-500', icon: Mic, text: 'Listo para iniciar' },
    listening: { color: 'bg-red-500 animate-pulse', icon: Mic, text: 'Escuchando...' },
    processing: { color: 'bg-yellow-500', icon: AlertCircle, text: 'Procesando...' },
    speaking: { color: 'bg-blue-500', icon: Volume2, text: 'Agente hablando...' },
    complete: { color: 'bg-green-500', icon: CheckCircle, text: '¡Producto registrado!' },
    error: { color: 'bg-red-700', icon: AlertCircle, text: 'Error de conexión' },
  }

  const { color, icon: StatusIcon, text } = statusConfig[status]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-80">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <h3 className="font-semibold text-gray-800">Asistente de Voz</h3>
          </div>
          <button 
            onClick={() => { stopListening(); onClose() }}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Status */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon className={`w-4 h-4 ${status === 'listening' ? 'text-red-500' : 'text-gray-500'}`} />
            <span className="text-sm font-medium text-gray-700">{text}</span>
          </div>
          {currentQuestion && (
            <p className="text-xs text-gray-600 italic">"{currentQuestion}"</p>
          )}
        </div>

        {/* Datos del producto */}
        {Object.keys(productData).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-xs space-y-1">
            <p className="font-semibold text-green-800">Producto capturado:</p>
            {productData.name && <p><span className="text-gray-600">Nombre:</span> {productData.name}</p>}
            {productData.category && <p><span className="text-gray-600">Categoría:</span> {productData.category}</p>}
            {productData.brand && <p><span className="text-gray-600">Marca:</span> {productData.brand}</p>}
            {productData.salePrice && <p><span className="text-gray-600">Precio:</span> ${productData.salePrice?.toLocaleString()}</p>}
            {productData.quantity && <p><span className="text-gray-600">Cantidad:</span> {productData.quantity}</p>}
          </div>
        )}

        {/* Botón principal */}
        <button
          onClick={status === 'idle' || status === 'error' ? startListening : stopListening}
          className={`w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
            status === 'idle' || status === 'error'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {status === 'idle' || status === 'error' ? (
            <>
              <Mic className="w-5 h-5" />
              Iniciar Asistente
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5" />
              Detener
            </>
          )}
        </button>

        {/* Info */}
        <p className="text-xs text-gray-400 text-center mt-2">
          Te preguntará: nombre, categoría, marca, precio y cantidad
        </p>
      </div>
    </div>
  )
}
