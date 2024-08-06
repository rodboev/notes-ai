// src/app/Components/RefreshButton.js
export default function UploadButton({ fetchData, pairRefs }) {
  return (
    <button
      className="btn-teal group m-2"
      onClick={() => {
        fetchData('all')
        pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      Regenerate
    </button>
  )
}
