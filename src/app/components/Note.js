// src/app/components/Note.js

import React from 'react'

const formatOccurrences = (annualOccurrences) => {
  const annually = annualOccurrences
  if (annually === 104 || annually === 96) {
    return 'Twice a week'
  } else if (annually === 52) {
    return 'Weekly'
  } else if (annually === 48) {
    return '4x/month'
  } else if (annually === 24) {
    return 'Twice a month'
  } else if (annually === 12) {
    return 'Once a month'
  } else if (annually === 6) {
    return 'Every 2 months'
  } else if (annually === 4) {
    return 'Every quarter'
  } else if (annually === 1) {
    return 'Once a year'
  } else {
    return `${annually}x/year`
  }
}

const Note = ({ note, index, total, children }) => {
  return (
    <div className="left -ml-full flex min-h-screen flex-1 flex-col justify-center border-s bg-neutral-200 p-10 pl-full pt-32">
      {children}
      <div className="note w-full rounded-lg bg-white p-10">
        <div className="text-3xl font-bold">{note.code?.split(' ')[0]}</div>
        <div className="space-x-3 text-xl font-bold">
          <a href={`https://app.pestpac.com/location/detail.asp?LocationID=${note.locationID}`}>
            {note.company} - {note.locationCode}
          </a>
          <div className="relative -top-0.5 inline-block rounded-lg bg-teal px-3 py-1 text-sm font-semibold text-white">
            {formatOccurrences(note.annualOccurrences)}
          </div>
        </div>
        <div className="content my-5">{note.content}</div>
        <div className="text-lg font-semibold">{note.tech}</div>
      </div>
      <div className="p-10 pb-0 text-lg">
        Note <span className="font-bold">{index + 1}</span> of{' '}
        <span className="font-bold">{total}</span>
      </div>
    </div>
  )
}

export default Note
