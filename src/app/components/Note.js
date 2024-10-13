// src/app/components/Note.js

import React from 'react'

const formatOccurrences = (annualOccurrences) => {
  const annually = annualOccurrences
  if (annually === 104 || annually === 96) return 'Twice a week'
  if (annually === 52) return 'Weekly'
  if (annually === 48) return '4x/month'
  if (annually === 24) return 'Twice a month'
  if (annually === 12) return 'Once a month'
  if (annually === 6) return 'Every 2 months'
  if (annually === 4) return 'Every quarter'
  if (annually === 1) return 'Once a year'
  return `${annually}x/year`
}

const Note = ({ note, index, total, children }) => {
  return (
    <div className="left -ml-full flex min-h-screen flex-1 flex-col justify-center border-s bg-neutral-200 p-10 pl-full pt-72">
      {children}
      <div className="note nd:p-10 relative w-full rounded-lg bg-white p-4 sm:left-4 sm:p-6 md:p-8">
        <div className="text-xl font-bold sm:text-2xl md:text-3xl">{note.code?.split(' ')[0]}</div>
        <div className="text-base font-bold sm:space-x-3 sm:text-lg md:text-xl">
          <a
            href={`https://app.pestpac.com/location/detail.asp?LocationID=${note.locationID}`}
            className="pr-2 hover:underline"
          >
            {note.company} - {note.locationCode}
          </a>
          <div className="relative -top-0.5 inline-block rounded-lg bg-teal px-2 py-0.5 text-xs font-semibold text-white sm:px-3 sm:py-1 sm:text-sm">
            {formatOccurrences(note.annualOccurrences)}
          </div>
        </div>
        <div className="content my-3 text-sm sm:my-4 md:my-5 lg:text-base">{note.content}</div>
        <div className="text-sm font-semibold sm:text-lg">{note.tech}</div>
      </div>
      <div className="p-4 pb-0 text-sm sm:p-6 sm:text-base md:p-8 md:text-lg lg:p-10">
        Note <span className="font-bold">{index + 1}</span> of{' '}
        <span className="font-bold">{total}</span>
      </div>
    </div>
  )
}

export default Note
