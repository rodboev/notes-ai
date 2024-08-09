// src/app/Components/EditableEmail.js

import { Editor } from '@tinymce/tinymce-react'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import RefreshIcon from './Icons/RefreshIcon-v4'
import SendIcon from './Icons/SendIcon-v1'
import { usePersistedEmailStatus } from '../hooks/usePersistedEmailStatus'
import { motion, AnimatePresence } from 'framer-motion'

const EditableEmail = ({
  htmlContent,
  subject,
  to,
  onEmailSent,
  fingerprint,
  fetchData,
  ...domProps
}) => {
  const editorRef = useRef(null)
  const [emailStatus, setEmailStatus, isLoading] = usePersistedEmailStatus(fingerprint)
  const [editorReady, setEditorReady] = useState(false)

  const [feedbackFieldVisible, setFeedbackFieldVisible] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState('idle')

  const disableToolbarButtons = (disable) => {
    const editor = editorRef.current
    if (editor) {
      const toolbarGroups = editor.container.querySelectorAll('.tox-toolbar__group')
      toolbarGroups.forEach((group) => {
        const buttons = group.querySelectorAll('.tox-tbtn')
        buttons.forEach((button) => {
          if (disable) {
            button.classList.add('tox-tbtn--disabled')
          } else {
            button.classList.remove('tox-tbtn--disabled')
          }
        })
      })
    }
  }

  const applyTextEditorEffects = () => {
    if (editorRef.current) {
      if (emailStatus.status === 'sending' || emailStatus.status === 'success') {
        editorRef.current.getBody().setAttribute('contenteditable', 'false')
        const styleElement = editorRef.current.getDoc().getElementById('custom-styles')
        if (!styleElement) {
          const newStyleElement = editorRef.current.getDoc().createElement('style')
          newStyleElement.id = 'custom-styles'
          newStyleElement.innerHTML = 'body { color: #999 !important; cursor: not-allowed; }'
          editorRef.current.getDoc().head.appendChild(newStyleElement)
        }
        disableToolbarButtons(true)
      } else {
        editorRef.current.getBody().setAttribute('contenteditable', 'true')
        const styleElement = editorRef.current.getDoc().getElementById('custom-styles')
        if (styleElement) {
          styleElement.remove()
        }
        disableToolbarButtons(false)
      }
    }
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setContent(htmlContent || '')
    }
    if (editorReady && !isLoading) {
      applyTextEditorEffects()
    }
  }, [htmlContent, emailStatus, editorReady, isLoading])

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

  const sendEmail = async () => {
    const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
    const reallySend = isProduction

    if (editorRef.current) {
      const content = editorRef.current.getContent()
      setEmailStatus({ status: 'sending' })
      if (reallySend) {
        try {
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: to, subject, content, fingerprint }),
          })
          if (response.ok) {
            const data = await response.json()
            console.log('Email sent successfully!')
            setEmailStatus(data.status)
            onEmailSent()
          } else {
            console.warn('Failed to send email.')
            setEmailStatus({ status: 'error' })
          }
        } catch (error) {
          console.error('Error sending email:', error)
          setEmailStatus({ status: 'error', error: error.message })
        }
      } else {
        // Simulate sending for non-production environments
        setTimeout(() => {
          setEmailStatus({
            status: 'success',
            sentAt: new Date().toISOString(),
            subject,
            content,
            to,
          })
          onEmailSent()
        }, 800)
      }
      applyTextEditorEffects()
    }
  }

  const handleFeedbackClick = async () => {
    if (!feedbackFieldVisible) {
      setFeedbackFieldVisible(true)
    } else if (feedbackStatus !== 'sending' && feedbackStatus !== 'success') {
      setFeedbackStatus('sending')
      try {
        const response = await fetch('/api/send-feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedback: feedbackText, fingerprint }),
        })
        if (response.ok) {
          console.log('Feedback sent successfully!')
          setFeedbackStatus('success')
        } else {
          console.warn('Failed to send feedback.')
          setFeedbackStatus('error')
        }
      } catch (error) {
        console.error('Error sending feedback:', error)
        setFeedbackStatus('error')
      }
    }
  }

  return (
    <div {...domProps}>
      <Editor
        apiKey="1dfanp3sshjkkjouv1izh4fn0547seddg55evzdtep178l09"
        onInit={(evt, editor) => {
          editorRef.current = editor
          setTimeout(() => {
            autoResizeEditor()
            setEditorReady(true)
          }, 0)
        }}
        initialValue={htmlContent}
        init={{
          height: 300,
          menubar: false,
          statusbar: false,
          plugins: ['lists', 'advlist', 'autoresize', 'autolink', 'anchor', 'searchreplace'],
          branding: false,
          toolbar: 'bold italic bullist numlist',
          autoresize_bottom_margin: 0,
          autoresize_min_height: 300,
          autoresize_min_height: 300,
          content_style:
            "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: sans-serif; }",
          font_formats:
            'Inter=Inter, sans-serif; Arial=arial,helvetica,sans-serif; Courier New=courier new,courier; Times New Roman=times new roman,times',
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
        <button
          onClick={() => {
            ;(Object.keys(emailStatus).length === 0 || emailStatus.status === 'error') &&
              sendEmail()
          }}
          disabled={!(Object.keys(emailStatus).length === 0 || emailStatus.status === 'error')}
          className={`mr-2 ${
            Object.keys(emailStatus).length === 0
              ? 'btn-teal flex'
              : emailStatus.status === 'sending'
                ? 'btn-teal flex cursor-not-allowed'
                : emailStatus.status === 'success'
                  ? 'btn flex cursor-not-allowed border-2 border-green-600 bg-white !py-0'
                  : emailStatus.status === 'error'
                    ? 'btn flex border-2 border-red-600'
                    : null
          }`}
        >
          {Object.keys(emailStatus).length === 0 ? (
            <span>Send email</span>
          ) : emailStatus.status === 'sending' ? (
            <>
              <SpinnerIcon className="-m-1 mr-2" />
              <span>Send email</span>
            </>
          ) : emailStatus.status === 'success' ? (
            <>
              <CheckIcon className="-m-2 mr-1.5 h-8 w-8 text-green-600" />
              <span>Email sent</span>
            </>
          ) : emailStatus.status === 'error' ? (
            <>
              <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
              <span>Try again</span>
            </>
          ) : null}
        </button>
        <div className="mx-2 flex items-center justify-end">
          <AnimatePresence>
            {feedbackFieldVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className={`mr-2 w-[calc(8rem+11vw)] rounded border-2 p-1.5 px-3 ${
                    feedbackStatus === 'success' || feedbackStatus === 'sending'
                      ? 'cursor-not-allowed'
                      : ''
                  }`}
                  placeholder="Enter feedback"
                  disabled={feedbackStatus === 'sending' || feedbackStatus === 'success'}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleFeedbackClick}
            className={`btn inline-block w-fit ${
              feedbackStatus === 'success'
                ? 'cursor-not-allowed border-2 border-green-600 bg-white'
                : feedbackStatus === 'sending'
                  ? 'cursor-not-allowed bg-neutral-500 text-white'
                  : feedbackStatus === 'error'
                    ? 'border-2 border-red-600'
                    : 'bg-neutral-500 text-white'
            }`}
            disabled={feedbackStatus === 'sending' || feedbackStatus === 'success'}
          >
            {!feedbackFieldVisible ? (
              'Send feedback'
            ) : feedbackStatus === 'sending' ? (
              <>
                <SpinnerIcon className="mr-3 h-6 w-6" />
                <span>Sending</span>
              </>
            ) : feedbackStatus === 'success' ? (
              <>
                <CheckIcon className="-ml-2 mr-1.5 h-8 w-8 text-green-600" />
                <span>Sent</span>
              </>
            ) : feedbackStatus === 'error' ? (
              <>
                <ExclamationTriangleIcon className="-ml-0.5 mr-2.5 h-6 w-6 text-red-600" />
                <span>Try again</span>
              </>
            ) : (
              <>
                <SendIcon className="mr-3 h-5 w-5" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditableEmail
