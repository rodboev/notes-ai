// src/app/components/Nav.js

import React, { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Settings from './Settings'
import { Cog6ToothIcon as SettingsIcon } from '@heroicons/react/20/solid'

export default function Nav({ children }) {
  const [showSettings, setShowSettings] = useState(false)

  const toggleSettings = () => {
    setShowSettings(!showSettings)
  }

  return (
    <div className="nav relative z-20 flex w-full flex-col">
      <nav className="z-30 flex h-20 w-full justify-center border-b bg-white/20 backdrop-blur-md">
        <div className="container flex w-full max-w-full items-center justify-between pl-4 pr-4 sm:pr-6 md:pr-8 lg:pr-10 2xl:max-w-screen-2xl 2xl:pl-0">
          <div className="left tracking-tighter">
            <span className="display-inline mx-1 text-4xl font-bold text-teal sm:text-5xl">
              liberty
            </span>
            <span className="display-inline mx-1 text-xl sm:text-2xl">notes ai</span>
          </div>
          <div className="right flex items-center">
            {children}
            <div className="relative ml-4 hidden md:block">
              <SettingsIcon
                className="icon h-5 w-5 cursor-pointer text-neutral-500 hover:opacity-85 sm:h-6 sm:w-6"
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
  )
}
