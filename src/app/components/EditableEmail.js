// src/app/Components/EditableEmail.js

import { Editor } from '@tinymce/tinymce-react'
import { useEffect, useRef, useState } from 'react'
import RefreshIcon from './Icons/RefreshIcon-v4'
import FeedbackButton from './FeedbackButton'
import SendEmailButton from './SendEmailButton'
import { usePersistedEmailStatus } from '../hooks/usePersistedEmailStatus'

const EditableEmail = ({
  subject,
  body,
  fingerprint,
  fetchData,
  pairRefs,
  pairIndex,
  pairsLength,
}) => {
  const editorRef = useRef(null)
  const [editorReady, setEditorReady] = useState(false)
  const [emailStatus, setEmailStatus] = usePersistedEmailStatus(fingerprint)

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

  const handleSendEmailButtonClick = () => {
    if (pairRefs && pairRefs.current && pairIndex < pairsLength - 1) {
      setTimeout(() => {
        pairRefs.current[pairIndex + 1].scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }

  const handleEmailStatusChange = (newStatus) => {
    setEmailStatus(newStatus)
    const isDisabled = ['sending', 'success'].includes(newStatus.status)
    updateEditorState(isDisabled)
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
      editorRef.current.setContent(body || '')
    }
    if (editorReady) {
      const isDisabled = ['sending', 'success'].includes(emailStatus.status)
      updateEditorState(isDisabled)
    }
  }, [emailStatus, editorReady])

  return (
    <div className="relative mb-4 flex flex-col">
      <Editor
        apiKey="1dfanp3sshjkkjouv1izh4fn0547seddg55evzdtep178l09"
        onInit={(evt, editor) => {
          editorRef.current = editor
          setTimeout(() => {
            autoResizeEditor()
            setEditorReady(true)
          }, 0)
        }}
        initialValue={body}
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
        }}
      />
      {!(emailStatus.status === 'sending' || emailStatus.status === 'success') && (
        <button
          onClick={() => fetchData(fingerprint)}
          className="refresh absolute z-10 m-6 self-end"
        >
          <span className="-mx-1 -my-0.5 flex items-center gap-1.5">
            <RefreshIcon className="h-5 w-5" />
          </span>
        </button>
      )}
      <div className="mt-4 flex items-center justify-between">
        <SendEmailButton
          fingerprint={fingerprint}
          subject={subject}
          emailStatus={emailStatus}
          onEmailStatusChange={handleEmailStatusChange}
          editorRef={editorRef}
          onEmailSent={handleSendEmailButtonClick}
        />
        {!(emailStatus.status === 'sending' || emailStatus.status === 'success') && (
          <FeedbackButton
            note={body}
            subject={subject}
            email={editorRef.current ? editorRef.current.getContent() : ''}
          />
        )}
      </div>
    </div>
  )
}

export default EditableEmail
