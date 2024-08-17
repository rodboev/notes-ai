// src/app/components/EditableEmail.js

import { Editor } from '@tinymce/tinymce-react'
import { useState, useEffect } from 'react'
import RefreshButton from './RefreshButton'

const EditableEmail = ({ email, emailStatus, editorRef, children, onRefresh }) => {
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

    editor.container.querySelectorAll('.tox-toolbar__group .tox-tbtn').forEach((button) => {
      button.classList.toggle('tox-tbtn--disabled', isDisabled)
    })
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setContent(email.body || '')
    }
    if (editorReady) {
      const isDisabled = emailStatus && ['sending', 'success'].includes(emailStatus.status)
      updateEditorState(isDisabled)
    }
  }, [emailStatus, editorReady, email.body])

  return (
    <div className="relative mb-4 mt-2.5 flex flex-col">
      <Editor
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
          content_style: 'body { font-family: sans-serif; }',
          base_url: '/api/tinymce',
          suffix: '.min',
          license_key: 'gpl',
        }}
      />
      {children}
    </div>
  )
}

export default EditableEmail
