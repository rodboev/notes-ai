// src/app/Components/UploadComponent.js

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'

const UploadComponent = ({ onUpload }) => {
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
          },
        })
      }

      reader.readAsText(file)
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div
      {...getRootProps()}
      className={`dropzone fixed z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 opacity-50 ${isDragActive ? 'active' : 'show'}`}
    >
      <input {...getInputProps()} />
      <CloudArrowUpIcon className="w-2/5 border-2 border-dashed border-black px-44 py-24" />
    </div>
  )
}

export default UploadComponent
