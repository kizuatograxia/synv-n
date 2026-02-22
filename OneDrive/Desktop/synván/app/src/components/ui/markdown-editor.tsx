'use client'

import { useState } from 'react'
import { Eye, Type } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  label?: string
  required?: boolean
  helperText?: string
}

const parseMarkdown = (text: string): string => {
  if (!text) return ''

  return text
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-neutral-900 mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-neutral-900 mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-neutral-900 mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:text-primary-700 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br />')
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '',
  error,
  label,
  required,
  helperText
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-neutral-700">
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="ml-auto flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-700 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-100"
            aria-label={showPreview ? 'Mostrar editor' : 'Mostrar preview'}
          >
            {showPreview ? (
              <>
                <Type className="w-3 h-3" />
                Editar
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Preview
              </>
            )}
          </button>
        </div>
      )}

      <div className="relative">
        {showPreview ? (
          <div className="min-h-[120px] p-4 border border-neutral-200 rounded-xl bg-neutral-50/50 prose prose-sm max-w-none">
            {value ? (
              <div dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${parseMarkdown(value)}</p>` }} />
            ) : (
              <p className="text-neutral-500 italic">Preview aparecerá aqui...</p>
            )}
          </div>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              'w-full px-4 py-2.5 border rounded-xl transition-all duration-200',
              'focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none',
              'bg-neutral-50/50 placeholder:text-neutral-500',
              error ? 'border-error-300' : 'border-neutral-200'
            )}
            rows={6}
            aria-invalid={!!error}
          />
        )}

        {error && (
          <p className="mt-1.5 text-sm text-error-600" role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-sm text-neutral-600">
            {helperText}
          </p>
        )}

        {!showPreview && (
          <div className="mt-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <p className="text-xs text-neutral-600 font-medium mb-1">Markdown suportado:</p>
            <div className="text-xs text-neutral-600 space-y-0.5 font-mono">
              <div># Título 1</div>
              <div>## Título 2</div>
              <div>### Título 3</div>
              <div>**negrito** ou *itálico*</div>
              <div>[texto](https://exemplo.com)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
