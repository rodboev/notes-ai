// src/app/components/Settings.js

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import TextareaAutosize from 'react-textarea-autosize'
import { useLocalStorage } from '../hooks/useLocalStorage'

export default function Settings({ onClose }) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [emailPrompt, setEmailPrompt] = useState('')
  const [cachedPrompts, setCachedPrompts] = useLocalStorage('promptsCache', {
    system: { current: '', default: '' },
    email: { current: '', default: '' },
  })
  const [savingPrompts, setSavingPrompts] = useState(false)

  const fetchPrompts = useCallback(async () => {
    try {
      const response = await fetch('/api/prompts')
      if (response.ok) {
        const data = await response.json()
        setSystemPrompt(data.system.current || data.system.default)
        setEmailPrompt(data.email.current || data.email.default)
        setCachedPrompts((prev) => {
          const newValue = {
            system: {
              current: data.system.current || data.system.default,
              default: data.system.default,
            },
            email: {
              current: data.email.current || data.email.default,
              default: data.email.default,
            },
          }
          if (JSON.stringify(prev) !== JSON.stringify(newValue)) {
            return newValue
          }
          return prev
        })
      } else {
        throw new Error('Failed to fetch prompts from API')
      }
    } catch (error) {
      console.warn('Error fetching prompts:', error.message)
      // Fall back to cached prompts if available, otherwise use empty strings
      setSystemPrompt(cachedPrompts.system.current || '')
      setEmailPrompt(cachedPrompts.email.current || '')
    }
  }, [cachedPrompts, setCachedPrompts])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const savePrompts = async () => {
    setSavingPrompts(true)
    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: { current: systemPrompt },
          email: { current: emailPrompt },
        }),
      })
      if (response.ok) {
        console.log('Prompts saved successfully')
        // Update the cached prompts
        setCachedPrompts((prev) => ({
          ...prev,
          system: { ...prev.system, current: systemPrompt },
          email: { ...prev.email, current: emailPrompt },
        }))
        onClose()
      } else {
        console.error('Failed to save prompts')
      }
    } catch (error) {
      console.error('Error saving prompts:', error)
    } finally {
      setSavingPrompts(false)
    }
  }

  const resetPrompts = () => {
    setSystemPrompt(cachedPrompts.system.default || '')
    setEmailPrompt(cachedPrompts.email.default || '')
    console.log('Prompts reverted to defaults')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="z-20 flex h-screen flex-col items-center overflow-y-auto bg-gradient-to-b from-neutral-700/50 to-black/75 p-6 pb-24 text-white backdrop-blur-md"
    >
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
    </motion.div>
  )
}
