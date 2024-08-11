// src/app/components/RefreshButton.js

import RefreshIcon from './Icons/RefreshIcon-v4'

const RefreshButton = ({ onClick, className = '' }) => (
  <button onClick={onClick} className={`refresh absolute z-10 m-6 self-end ${className}`}>
    <span className="-mx-1 -my-0.5 flex items-center gap-1.5">
      <RefreshIcon className="h-5 w-5" />
    </span>
  </button>
)

export default RefreshButton
