// src/app/components/Note.js

export default function Note({ children, index, total }) {
  return (
    <div className="left -ml-full flex min-h-screen flex-1 flex-col justify-center border-s bg-neutral-200 p-10 pl-full pt-32">
      <div className="note w-full rounded-lg bg-white p-10">{children}</div>
      <div className="p-10 pb-0 text-lg">
        Note <span className="font-bold">{index + 1}</span> of{' '}
        <span className="font-bold">{total}</span>
      </div>
    </div>
  )
}
