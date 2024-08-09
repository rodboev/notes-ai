// src/app/components/UploadButton.js

import React, { useRef } from 'react'
import { CloudArrowUpIcon } from '@heroicons/react/24/solid'
import Papa from 'papaparse'

const UploadButton = ({ onUpload, pairRefs }) => {
  const fileInputRef = useRef(null)

  const handleClick = () => {
    fileInputRef.current.click()
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const csv = e.target.result
        Papa.parse(csv, {
          header: true,
          complete: function (results) {
            onUpload(results.data)
          },
        })
      }
      reader.readAsText(file)
    }
  }

  return (
    <>
      <button
        className="upload btn-teal group m-2 overflow-hidden"
        onClick={() => fileInputRef.current.click()}
      >
        <CloudArrowUpIcon className="relative -top-0.5 -my-4 -ml-1 mr-5 inline-block w-9 transition-all duration-500 group-hover:-ml-16 group-hover:mr-7" />
        <span className="-mr-20 inline-block transition-all duration-500 group-hover:mr-0">
        Upload
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
    </>
  )
}

export default UploadButton
