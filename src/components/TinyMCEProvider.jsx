import { TinyMCE } from '@tinymce/tinymce-react'

function TinyMCEProvider({ children }) {
  return (
    <>
      <TinyMCE init={{ suffix: '.min' }} />
      {children}
    </>
  )
}

export default TinyMCEProvider
