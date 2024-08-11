// src/app/components/Upload.js

import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { CloudArrowUpIcon } from '@heroicons/react/24/solid'

const Upload = ({ onUpload, notesExist }) => {
  const [showUploadZone, setShowUploadZone] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0]
      const reader = new FileReader()

      reader.onload = () => {
        const csv = reader.result
        Papa.parse(csv, {
          header: true,
          complete: function (results) {
            onUpload(results.data)
            setShowUploadZone(false)
          },
        })
      }

      reader.readAsText(file)
    },
    [onUpload],
  )

  const { getInputProps, isDragActive } = useDropzone({ onDrop })

  useEffect(() => {
    let dragCounter = 0

    const handleDragEnter = (e) => {
      e.preventDefault()
      dragCounter++
      if (dragCounter === 1) {
        setShowUploadZone(true)
      }
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      dragCounter--
      if (dragCounter === 0) {
        setShowUploadZone(false)
      }
    }

    const handleDrop = (e) => {
      e.preventDefault()
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

  if (!showUploadZone) {
    return null
  }

  return (
    <>
      <div
        className="dropzone fixed z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 opacity-50"
        onClick={(e) => {
          e.stopPropagation()
          setShowUploadZone(false)
        }}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="w-2/5 border-2 border-dashed border-black px-44 py-24" />
      </div>
      {!notesExist && (
        <div className="flex h-screen flex-col items-center justify-center text-neutral-400">
          <CloudArrowUpIcon className="w-60" />
          <p className="text-2xl">Notes not found. Please upload a CSV file.</p>
        </div>
      )}
    </>
  )
}

export default Upload
