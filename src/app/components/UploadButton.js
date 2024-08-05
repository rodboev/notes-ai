// src/app/components/UploadButton.js

import { useRef } from 'react'
import Papa from 'papaparse'
import { CloudArrowUpIcon } from '@heroicons/react/24/solid'

export default function UploadButton({ handleUpload, pairRefs }) {
  const fileInputRef = useRef(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    const reader = new FileReader()

    reader.onload = () => {
      const csv = reader.result
      Papa.parse(csv, {
        header: true,
        complete: function (results) {
          handleUpload(results.data).then(() => {
            // Scroll to the first note after upload is complete
            pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
          })
        },
      })
    }

    reader.readAsText(file)
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
