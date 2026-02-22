'use client'

import { useState, useRef } from 'react'
import { Image as ImageIcon, ExternalLink, AlertCircle, Check } from 'lucide-react'
import { FormField } from './form-field'
import { cn } from '@/lib/cn'

interface ImageUrlInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  required?: boolean
  helperText?: string
  schema?: any
  name?: string
}

export function ImageUrlInput({
  value,
  onChange,
  error,
  label,
  required,
  helperText,
  schema,
  name = 'imageUrl'
}: ImageUrlInputProps) {
  const [preview, setPreview] = useState<string>(value)
  const [imageStatus, setImageStatus] = useState<'loading' | 'valid' | 'error' | 'empty'>('empty')
  const [showPreview, setShowPreview] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleUrlChange = (newValue: string) => {
    onChange(newValue)

    if (!newValue || newValue.trim() === '') {
      setPreview('')
      setImageStatus('empty')
      setShowPreview(false)
      return
    }

    setPreview(newValue)
    setImageStatus('loading')
    setShowPreview(true)

    const img = new Image()
    img.onload = () => {
      setImageStatus('valid')
    }
    img.onerror = () => {
      setImageStatus('error')
    }
    img.src = newValue
  }

  const handleRemoveImage = () => {
    onChange('')
    setPreview('')
    setImageStatus('empty')
    setShowPreview(false)
  }

  return (
    <div className="space-y-3">
      <FormField
        name={name}
        type="text"
        label={label}
        placeholder="https://example.com/image.jpg"
        value={value}
        onChange={handleUrlChange}
        error={error}
        helperText={helperText}
        schema={schema}
        required={required}
      />

      {showPreview && preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-[1rem] h-[1rem] text-neutral-500" />
              <span className="text-sm text-neutral-600">Preview:</span>

              {imageStatus === 'loading' && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-neutral-200 rounded-full animate-pulse" />
                  <span className="text-xs text-neutral-500">Carregando...</span>
                </div>
              )}
              {imageStatus === 'valid' && (
                <span className="flex items-center gap-1 text-xs text-success-600">
                  <Check className="w-3 h-3" />
                  Imagem válida
                </span>
              )}
              {imageStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs text-warning-600">
                  <AlertCircle className="w-3 h-3" />
                  URL inválida ou imagem não carregada
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={preview}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir em nova aba
              </a>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-xs text-error-600 hover:text-error-700"
              >
                Remover
              </button>
            </div>
          </div>

          <div className="relative w-full h-48 md:h-80 rounded-2xl overflow-hidden bg-neutral-50 border-2 border-dashed border-neutral-200">
            <img
              ref={imgRef}
              src={preview}
              alt="Preview da imagem do evento"
              className="w-full h-full object-cover"
              onError={() => setImageStatus('error')}
              onLoad={() => setImageStatus('valid')}
            />
            {imageStatus === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
                <div className="text-center p-4">
                  <AlertCircle className="w-8 h-8 text-warning-500 mx-auto mb-2" />
                  <p className="text-sm text-neutral-600">Não foi possível carregar a imagem</p>
                  <p className="text-xs text-neutral-600 mt-1">Verifique a URL e tente novamente</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <span className="font-medium">Recomendações:</span>
            <span>1200x630px (mínimo 800x400px)</span>
            <span>·</span>
            <span>JPG, PNG, WebP</span>
            <span>·</span>
            <span>Máx 5MB</span>
          </div>
        </div>
      )}

      {!showPreview && value && (
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <ImageIcon className="w-[1rem] h-[1rem]" />
          Mostrar preview
        </button>
      )}
    </div>
  )
}
