// src/app/components/Settings.js

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import TextareaAutosize from 'react-textarea-autosize'
import { usePrompts } from '../hooks/usePrompts'

export default function Settings({ onClose }) {
  const { data: prompts, isLoading, isError, updatePrompts, isUpdating } = usePrompts()
  const [systemPrompt, setSystemPrompt] = useState('')
  const [emailPrompt, setEmailPrompt] = useState('')

  React.useEffect(() => {
    if (prompts) {
      setSystemPrompt(prompts.system.current || prompts.system.default)
      setEmailPrompt(prompts.email.current || prompts.email.default)
    }
  }, [prompts])

  const savePrompts = async () => {
    await updatePrompts({
      system: { current: systemPrompt },
      email: { current: emailPrompt },
    })
    onClose()
  }

  const resetPrompts = () => {
    if (prompts) {
      setSystemPrompt(prompts.system.default)
      setEmailPrompt(prompts.email.default)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (isError) return <div>Error loading prompts</div>

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
            disabled={isUpdating}
            type="button"
          >
            {isUpdating ? 'Saving' : 'Save prompts'}
          </button>
        </div>
        <div className="right flex flex-1">
          <button className="btn bg-neutral-500 px-4 py-2" onClick={resetPrompts} type="button">
            Revert to originals
          </button>
        </div>
      </div>
    </motion.div>
  )
}
