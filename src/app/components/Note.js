// src/app/components/Note.js

import React from 'react'

const Note = React.forwardRef(({ note, index, total }, ref) => {
  return (
    <div
      ref={ref}
      className="left -ml-full flex min-h-screen flex-1 flex-col justify-center border-s bg-neutral-200 p-10 pl-full pt-32"
    >
      <div className="note w-full rounded-lg bg-white p-10">
        <div className="text-3xl font-bold">{note.code?.split(' ')[0]}</div>
        <div className="text-xl font-bold">
          <a href={`https://app.pestpac.com/location/detail.asp?LocationID=${note.locationID}`}>
            {note.company} - {note.locationCode}
          </a>
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
})

export default Note
