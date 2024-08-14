// src/app/page.js

'use client'

import { useState, useEffect, useRef } from 'react'
import { useData } from './hooks/useData'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import Datepicker from 'react-tailwindcss-datepicker'

export default function Home() {
  const { pairs, notesExist, fetchData, clearData } = useData()
  const pairRefs = useRef([])

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [date, setDate] = useState({
    startDate: yesterday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  })

  const handleDateChange = (newDate) => {
    console.log('newDate:', newDate)
    setDate(newDate)
    console.log(`Selected: ${newDate}`)
  }

  useEffect(() => {
    fetchData(date.startDate, date.endDate)
  }, [date.startDate, date.endDate])

  const scrollToNextPair = (index) => {
    pairRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="w- outline- flex h-screen max-w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll">
      <Nav>
        <Datepicker
          useRange={false}
          primaryColor={'teal'}
          placeholder={'Select date range'}
          separator={'-'}
          displayFormat={'M/D/YY'}
          inputClassName={
            'h-10 w-40 items-center overflow-hidden rounded px-3 pt-0.5 focus-visible:outline-none align-middle text-right cursor-pointer'
          }
          readOnly={true}
          containerClassName={'relative w-fit text-black border-color z-30'}
          toggleClassName={
            'h-10 w-fit items-center overflow-hidden rounded px-4 pb-0.5 font-bold hover:bg-opacity-95 active:bg-opacity-100 bg-teal text-white align-middle ml-4'
          }
          startFrom={new Date('2024-08-13')}
          value={date}
          onChange={handleDateChange}
        />
      </Nav>

      {notesExist &&
        pairs.map(({ note, email }, index) => (
          <div
            key={note.fingerprint}
            ref={(el) => (pairRefs.current[index] = el)}
            className="pair container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
          >
            <Note note={note} index={index} total={pairs.length} />
            <Email
              email={email}
              noteFingerprint={note.fingerprint}
              index={index}
              total={pairs.length}
              fetchData={fetchData}
              scrollToNextPair={scrollToNextPair}
            />
          </div>
        ))}
    </div>
  )
}
