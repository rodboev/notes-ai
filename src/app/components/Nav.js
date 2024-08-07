// src/app/Components/Nav.js

import React, { useState, useEffect } from 'react'
import UploadButton from './UploadButton'
import RefreshButton from './RefreshButton'
import ClearButton from './ClearButton'
import UploadComponent from './UploadComponent'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'
import TextareaAutosize from 'react-textarea-autosize'

export default function Nav({ fetchData, notesExist, pairRefs, onClear, ...props }) {
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [emailTemplatePrompt, setEmailTemplatePrompt] = useState('')

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

    setShowUploadZone(false)
  }

  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setSystemPrompt(data.system)
        setEmailTemplatePrompt(data.emailTemplate)
      } else {
        console.error('Failed to fetch prompts')
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
    }
  }

  const savePrompts = async () => {
    try {
      const response = await fetch('/api/prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ system: systemPrompt, emailTemplate: emailTemplatePrompt }),
      })
      if (response.ok) {
        console.log('Prompts saved successfully')
      } else {
        console.error('Failed to save prompts')
      }
    } catch (error) {
      console.error('Error saving prompts:', error)
    }
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

    // System prompt and email emailTemplate
    fetchPrompts()

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const toggleSettings = () => {
    setShowSettings(!showSettings)
  }

  return (
    <>
      <div className="align-center fixed left-0 z-20 flex w-full flex-col">
        <nav className="flex justify-center border-b bg-white/50 p-3 backdrop-blur-md">
          <div className="container flex w-full max-w-screen-2xl items-center justify-between">
            <div className="left tracking-tighter">
              <span className="display-inline mx-1 text-5xl font-bold text-teal">liberty</span>
              <span className="display-inline mx-1 text-2xl">notes ai</span>
            </div>
            <div className="right align-center flex items-center px-3">
              <UploadButton handleUpload={handleUpload} pairRefs={pairRefs} />
              {notesExist && (
                <>
                  <RefreshButton pairRefs={pairRefs} fetchData={fetchData} />
                  <ClearButton fetchData={fetchData} onClear={onClear} pairRefs={pairRefs} />
                </>
              )}
              <div className="relative">
                <Cog6ToothIcon
                  className="icon align-center flex cursor-pointer text-neutral-500"
                  onClick={toggleSettings}
                />
              </div>
            </div>
          </div>
        </nav>
        {showSettings && (
          <div className="z-20 flex justify-center bg-gray-500 p-3 pt-2 text-white">
            <div class="container flex max-w-screen-2xl gap-6 p-3">
              <div className="left flex flex-1 flex-col gap-2">
                <label for="system">System prompt:</label>
                <TextareaAutosize
                  id="system"
                  rows="4"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
              <div className="right flex flex-1 flex-col gap-2">
                <label for="emailTemplate">Email emailTemplate:</label>
                <TextareaAutosize
                  id="emailTemplate"
                  rows="4"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900"
                  value={emailTemplatePrompt}
                  onChange={(e) => setEmailTemplatePrompt(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

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
