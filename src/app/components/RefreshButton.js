import { ArrowPathIcon } from '@heroicons/react/16/solid'

export default function UploadButton({ fetchData, pairRefs }) {
  return (
    <>
      <button
        className="btn-teal group m-2"
        onClick={() => {
          fetchData(true)
          pairRefs?.current[0]?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        {/*
        <ArrowPathIcon className="relative -top-0.5 -my-4 -ml-1 mr-5 inline-block w-6 transition-all duration-500 group-hover:-ml-16 group-hover:mr-9" />
				<span className="-mr-28 inline-block transition-all duration-500 group-hover:ml-0.5 group-hover:mr-0">
				*/}
        Regenerate
        {/* </button> */}
      </button>
    </>
  )
}
