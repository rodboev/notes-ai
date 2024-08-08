// src/app/Components/Nav.js

import React, { useState, useEffect } from 'react'
import UploadButton from './UploadButton'
import RefreshButton from './RefreshButton'
import ClearButton from './ClearButton'
import UploadComponent from './UploadComponent'
import { CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'
import TextareaAutosize from 'react-textarea-autosize'
import { useLocalStorage } from '../utils/useLocalStorage'

export default function Nav({ fetchData, notesExist, pairRefs, onClear, ...props }) {
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [emailPrompt, setEmailPrompt] = useState('')
  const [cachedPrompts, setCachedPrompts] = useLocalStorage('promptsCache', {
    system: '',
    email: '',
  })
  const [savingPrompts, setSavingPrompts] = useState(false) // Settings

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
      // Fetch from /api/prompts (reads from disk, then Firestore)
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setSystemPrompt(data.system)
        setEmailPrompt(data.email)
        setCachedPrompts({ system: data.system, email: data.email })
      } else {
        throw new Error('Failed to fetch prompts from API')
      }
    } catch (error) {
      // Fall back to local storage
      setSystemPrompt(cachedPrompts.system)
      setEmailPrompt(cachedPrompts.email)
      console.warn('Using cached prompts:', error.message)
    }
  }

  const savePrompts = async () => {
    setSavingPrompts(true)
    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ system: systemPrompt, email: emailPrompt }),
      })
      if (response.ok) {
        console.log('Prompts saved successfully')
        setShowSettings(false)
      } else {
        console.error('Failed to save prompts')
      }
    } catch (error) {
      console.error('Error saving prompts:', error)
    } finally {
      setSavingPrompts(false)
    }
  }

  const resetPrompts = async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setSystemPrompt(data.system)
        setEmailPrompt(data.email)
        console.log('Prompts reverted to defaults')
      } else {
        console.error('Failed to fetch default prompts')
      }
    } catch (error) {
      console.error('Error fetching default prompts:', error)
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

    // System prompt and email email
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
          <div className="z-20 flex h-screen flex-col items-center bg-gradient-to-b from-neutral-700/50 to-black/75 p-6 pb-24 text-white backdrop-blur-md">
            <div className="container flex max-w-screen-2xl justify-center gap-6 p-3">
              <div className="left flex flex-1 flex-col gap-4">
                <label htmlFor="system" className="text-base">
                  System prompt:
                </label>
                <TextareaAutosize
                  id="system"
                  rows="4"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 font-sans text-base text-gray-900"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
              <div className="right flex flex-1 flex-col gap-4">
                <label htmlFor="email">Email template:</label>
                <TextareaAutosize
                  id="email"
                  rows="4"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 font-sans text-base text-gray-900"
                  value={emailPrompt}
                  onChange={(e) => setEmailPrompt(e.target.value)}
                />
              </div>
            </div>
            <div className="container flex max-w-screen-2xl justify-center gap-6 p-6">
              <div className="left flex flex-1 justify-end">
                <button
                  className="btn-teal rounded px-4 py-2"
                  onClick={savePrompts}
                  disabled={savingPrompts}
                >
                  {savingPrompts ? 'Saving' : 'Save prompts'}
                </button>
              </div>
              <div className="right flex flex-1">
                <button className="btn bg-neutral-500 px-4 py-2" onClick={resetPrompts}>
                  Revert to originals
                </button>
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
