// src/app/Components/ClearButton.js

import { XMarkIcon } from '@heroicons/react/16/solid'

export default function ClearButton({ fetchData, onClear, pairRefs }) {
  async function handleClick() {
    try {
      const response = await fetch('/api/notes', { method: 'DELETE' })
      if (response.ok) {
        console.log('Data cleared successfully')
        // Clear local storage
        localStorage.removeItem('notesCache')
        localStorage.removeItem('emailsCache')
        // Fetch data to update the state
        await fetchData('all')
        // Call onClear to update the parent component's state
        onClear()
        // Scroll to the first note
        pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
      } else {
        console.error('Failed to clear data')
      }
    } catch (error) {
      console.error('Error clearing data:', error)
    }
  }

  return (
    <>
      <button className="btn-teal group m-2 inline-block overflow-hidden" onClick={handleClick}>
        <XMarkIcon className="relative -top-0.5 -mx-2 -my-4 inline-block h-8 w-8" />
        <span className="invisible">&nbsp;</span>
      </button>
    </>
  )
}
