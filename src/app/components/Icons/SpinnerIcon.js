// src/app/Components/Spinner.js

export default function Spinner(props) {
  return (
    <div className={['loading-spinner', props.className].join(' ')}>
      <svg viewBox="25 25 50 50" className="circular" aria-label="Loading spinner">
        <title>Loading...</title>
        <circle cx="50" cy="50" r="20" fill="none" className="path" />
      </svg>
    </div>
  )
}
