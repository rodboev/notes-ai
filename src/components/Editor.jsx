// src/app/components/Editor.js

import { Editor as TinyMCE } from '@tinymce/tinymce-react'
import { useState, useEffect } from 'react'

const Editor = ({ email, emailStatus, editorRef, children, onRefresh }) => {
  const [editorReady, setEditorReady] = useState(false)

  const autoResizeEditor = () => {
    const editor = editorRef.current
    if (editor) {
      editor.execCommand('mceAutoResize')
      const body = editor.getBody()
      const doc = editor.getDoc()
      if (body && doc) {
        const bodyHeight = body.scrollHeight || body.offsetHeight
        const editorContainer = editor.container
        const targetHeight = bodyHeight + editorContainer.offsetHeight - body.offsetHeight + 37
        editorContainer.style.height = `${targetHeight}px`
        editor.getWin().dispatchEvent(new Event('resize'))
      }
    }
  }

  const updateEditorState = (isDisabled) => {
    const editor = editorRef.current
    if (!editor) return
    const body = editor.getBody()
    const doc = editor.getDoc()

    body.contentEditable = !isDisabled
    const styleId = 'custom-styles'
    let styleElement = doc.getElementById(styleId)
    if (isDisabled) {
      if (!styleElement) {
        styleElement = doc.createElement('style')
        styleElement.id = styleId
        doc.head.appendChild(styleElement)
      }
      styleElement.textContent =
        'body { color: #999 !important; cursor: not-allowed; user-select: none; }'
    } else if (styleElement) {
      styleElement.remove()
    }

    for (const button of editor.container.querySelectorAll('.tox-toolbar__group .tox-tbtn')) {
      button.classList.toggle('tox-tbtn--disabled', isDisabled)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: updateEditorState would make the dependencies of useEffect change on every render
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setContent(email.body || '')
    }
    if (editorReady) {
      const isDisabled = emailStatus && ['sending', 'success'].includes(emailStatus.status)
      updateEditorState(isDisabled)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [emailStatus, editorReady, email.body])

  return (
    <div className="relative mb-4 mt-2.5 flex flex-col">
      <TinyMCE
        tinymceScriptSrc="/api/tinymce/tinymce.min.js"
        onInit={(evt, editor) => {
          editorRef.current = editor
          setTimeout(() => {
            autoResizeEditor()
            setEditorReady(true)
          }, 0)
        }}
        initialValue={email.body}
        init={{
          height: 300,
          menubar: false,
          statusbar: false,
          plugins: ['lists', 'advlist', 'autoresize', 'autolink', 'anchor', 'searchreplace'],
          branding: false,
          toolbar: 'bold italic bullist numlist',
          autoresize_bottom_margin: 0,
          autoresize_min_height: 300,
          content_style:
            'body { font-family: sans-serif; font-size: 10pt; } @media (min-width: 480px) { body { font-size: initial; } }',
          base_url: '/api/tinymce',
          suffix: '.min',
          license_key: 'gpl',
        }}
      />
      {children}
    </div>
  )
}

export default Editor
