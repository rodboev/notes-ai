// src/app/Components/Nav.js

import React, { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import UploadButton from './UploadButton'
import ClearButton from './ClearButton'
import Upload from './Upload'
import Settings from './Settings'
import { Cog6ToothIcon as SettingsIcon } from '@heroicons/react/20/solid'

export default function Nav({ fetchData, notesExist, pairRefs, onClear }) {
  const [showSettings, setShowSettings] = useState(false)

  const handleUpload = async (data) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        console.log('File uploaded and data saved successfully!')
        await fetchData('all')
        pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
      } else {
        console.warn('Failed to upload the file.')
      }
    } catch (error) {
      console.warn('Upload error:', String(error).split('\n')[0])
    }
  }

  const toggleSettings = () => {
    setShowSettings(!showSettings)
  }

  return (
    <>
      <div className="align-center fixed z-20 -ml-4 flex w-full flex-col">
        <nav className="ml-4 flex justify-center border-b bg-white/50 p-3 backdrop-blur-md">
          <div className="container flex w-full max-w-screen-2xl items-center justify-between">
            <div className="left tracking-tighter">
              <span className="display-inline mx-1 text-5xl font-bold text-teal">liberty</span>
              <span className="display-inline mx-1 text-2xl">notes ai</span>
            </div>
            <div className="right align-center flex items-center px-3">
              <UploadButton onUpload={handleUpload} pairRefs={pairRefs} />
              {notesExist && (
                <ClearButton fetchData={fetchData} onClear={onClear} pairRefs={pairRefs} />
              )}
              <div className="relative m-1 mr-2">
                <SettingsIcon
                  className="icon align-center flex cursor-pointer text-neutral-500 hover:opacity-85"
                  onClick={toggleSettings}
                />
              </div>
            </div>
          </div>
        </nav>
        <AnimatePresence>
          {showSettings && <Settings onClose={() => setShowSettings(false)} />}
        </AnimatePresence>
      </div>

      <Upload onUpload={handleUpload} notesExist={notesExist} />
    </>
  )
}
