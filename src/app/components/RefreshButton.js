// src/app/components/RefreshButton.js

import RefreshIcon from './Icons/RefreshIcon-v4'

const RefreshButton = ({ onClick }) => (
  <button onClick={onClick} className="refresh absolute right-0 top-0 z-10 m-6 self-end">
    <span className="-mx-1 -my-0.5 flex items-center gap-1.5">
      <RefreshIcon className="h-5 w-5" />
    </span>
  </button>
)

export default RefreshButton
