// src/app/Components/Nav.js

import React, { useState, useEffect } from 'react'
import UploadButton from './UploadButton'
import RefreshButton from './RefreshButton'
import ClearButton from './ClearButton'
import UploadComponent from './UploadComponent'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'

export default function Nav({
  fetchData,
  notesExist,
  pairRefs,
  onClear,
  ...props
}) {
  const [showUploadZone, setShowUploadZone] = useState(false)

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
        await fetchData(true)
        pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
      } else {
        console.warn('Failed to upload the file.')
      }
    } catch (error) {
      console.warn('Upload error:', String(error).split('\n')[0])
    }

    setShowUploadZone(false)
  }

  useEffect(() => {
    let dragCounter = 0

    const handleDragEnter = () => {
      dragCounter++
      if (dragCounter === 1) {
        setShowUploadZone(true)
      }
    }

    const handleDragLeave = () => {
      dragCounter--
      if (dragCounter === 0) {
        setShowUploadZone(false)
      }
    }

    const handleDrop = () => {
      dragCounter = 0
      setShowUploadZone(false)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <>
      <nav {...props}>
        <div className="container flex w-full max-w-screen-2xl items-center justify-between">
          <div className="left tracking-tighter">
            <span className="display-inline mx-1 text-5xl font-bold text-teal">
              liberty
            </span>
            <span className="display-inline mx-1 text-2xl">notes ai</span>
          </div>
          <div className="right align-center flex items-center px-3">
            <UploadButton handleUpload={handleUpload} pairRefs={pairRefs} />
            {notesExist && (
              <>
                <RefreshButton pairRefs={pairRefs} fetchData={fetchData} />
                <ClearButton
                  fetchData={fetchData}
                  onClear={onClear}
                  pairRefs={pairRefs}
                />
              </>
            )}
            <Cog6ToothIcon className="icon align-center flex cursor-pointer text-neutral-500" />
          </div>
        </div>
      </nav>
      {showUploadZone && <UploadComponent onUpload={handleUpload} />}
      {!showUploadZone && !notesExist && (
        <div className="flex h-screen flex-col items-center justify-center text-neutral-400">
          <CloudArrowUpIcon className="w-60" />
          <p className="text-2xl">Notes not found. Please upload a CSV file.</p>
        </div>
      )}
    </>
  )
}
