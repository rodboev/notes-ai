import React from 'react'
import SpinnerIcon from '@/app/components/Icons/SpinnerIcon'

function Transcription({ items }) {
  return (
    <div className="transcription h-[600px] w-full overflow-y-auto rounded-lg border-2 p-4">
      {items.length > 0 ? (
        items.map((item) => (
          <div
            key={item.id}
            className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
          >
            <strong>{item.role === 'assistant' ? 'Emily: ' : 'Alex: '}</strong>
            {item.formatted?.transcript || item.formatted?.text || ''}
          </div>
        ))
      ) : (
        <div class="space-y-2">
          <p className="italic text-neutral-500">Waiting for customer to start speaking...</p>
          <SpinnerIcon className="text-neutral-500" />
        </div>
      )}
    </div>
  )
}

export default Transcription
