import React from 'react'

function Transcription({ items }) {
  return (
    <div className="transcription h-[600px] w-full overflow-y-auto rounded-lg border-2 p-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`mb-2 ${item.role === 'assistant' ? 'text-black' : 'text-neutral-600'}`}
        >
          <strong>{item.role === 'assistant' ? 'Emily: ' : 'Alex: '}</strong>
          {item.formatted?.transcript || item.formatted?.text || ''}
        </div>
      ))}
    </div>
  )
}

export default Transcription
