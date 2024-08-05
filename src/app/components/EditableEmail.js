// src/app/Components/EditableEmail.js

import { Editor } from '@tinymce/tinymce-react'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import Spinner from './Spinner'
import { usePersistedEmailStatus } from '../hooks/usePersistedEmailStatus'

const EditableEmail = ({
  htmlContent,
  subject,
  recipient,
  onEmailSent,
  fingerprint,
  ...props
}) => {
  const editorRef = useRef(null)
  const [emailStatus, setEmailStatus, isLoading] =
    usePersistedEmailStatus(fingerprint)

  const disableToolbarButtons = (disable) => {
    const editor = editorRef.current
    if (editor) {
      const toolbarGroups = editor.container.querySelectorAll(
        '.tox-toolbar__group',
      )
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
      if (emailStatus === 'sending' || emailStatus === 'success') {
        editorRef.current.getBody().setAttribute('contenteditable', 'false')
        const styleElement = document.createElement('style')
        styleElement.innerHTML =
          'body { color: #999 !important; cursor: not-allowed; }'
        editorRef.current.getDoc().head.appendChild(styleElement)
        disableToolbarButtons(true)
      } else {
        disableToolbarButtons(false)
      }
    }
  }

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setContent(htmlContent || '')
    }
    applyTextEditorEffects()
  }, [htmlContent, emailStatus])

  const autoResizeEditor = () => {
    const editor = editorRef.current
    if (editor) {
      editor.execCommand('mceAutoResize')
      const body = editor.getBody()
      const doc = editor.getDoc()
      if (body && doc) {
        const bodyHeight = body.scrollHeight || body.offsetHeight
        const editorContainer = editor.container
        const targetHeight =
          bodyHeight + editorContainer.offsetHeight - body.offsetHeight + 37
        editorContainer.style.height = `${targetHeight}px`
        editor.getWin().dispatchEvent(new Event('resize'))
      }
    }
  }

  const sendEmail = async (reallySend = false) => {
    if (editorRef.current) {
      if (reallySend) {
        const content = editorRef.current.getContent()
        console.log({ recipient, subject, content })
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recipient, subject, content }),
        })
        if (response.ok) {
          console.log('Email sent successfully!')
          setEmailStatus('success')
          onEmailSent()
          applyTextEditorEffects()
        } else {
          console.warn('Failed to send email.')
          setEmailStatus('error')
        }
      } else {
        setEmailStatus('sending')
        setTimeout(() => {
          setEmailStatus('success')
          onEmailSent()
        }, 800)
      }
    }
  }

  return (
    <div {...props}>
      <Editor
        apiKey="1dfanp3sshjkkjouv1izh4fn0547seddg55evzdtep178l09"
        onInit={(evt, editor) => {
          editorRef.current = editor
          setTimeout(autoResizeEditor, 0)
        }}
        initialValue={htmlContent}
        init={{
          height: 300,
          menubar: false,
          statusbar: false,
          plugins: [
            'lists',
            'advlist',
            'autoresize',
            'autolink',
            'anchor',
            'searchreplace',
          ],
          branding: false, // Disable "Powered by TinyMCE"
          toolbar: 'bold italic bullist numlist',
          autoresize_bottom_margin: 0,
          autoresize_min_height: 300,
          content_style:
            "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: /*'Inter',*/ sans-serif; }",
          font_formats:
            'Inter=Inter, sans-serif; Arial=arial,helvetica,sans-serif; Courier New=courier new,courier; Times New Roman=times new roman,times',
          readonly: true,
        }}
      />
      <div className="mt-4 flex">
        <button
          onClick={() => {
            ;(emailStatus === '' || emailStatus === 'error') && sendEmail(false)
          }}
          disabled={!(emailStatus === '' || emailStatus === 'error')}
          className={
            emailStatus === ''
              ? 'btn-teal flex'
              : emailStatus === 'sending'
                ? 'btn-teal flex cursor-not-allowed'
                : emailStatus === 'success'
                  ? 'btn flex cursor-not-allowed border-2 border-green-600 bg-white !py-0'
                  : emailStatus === 'error'
                    ? 'btn flex border-2 border-red-600'
                    : null
          }
        >
          {emailStatus === '' ? (
            <span>Send email</span>
          ) : emailStatus === 'sending' ? (
            <>
              <Spinner className="-m-1 mr-2" />
              <span>Send email</span>
            </>
          ) : emailStatus === 'success' ? (
            <>
              <CheckIcon className="-m-2 mr-1.5 h-8 w-8 text-green-600" />
              <span>Email sent</span>
            </>
          ) : emailStatus === 'error' ? (
            <>
              <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
              <span>Try again</span>
            </>
          ) : null}
        </button>
        <button className="btn mx-4 inline-block w-fit bg-neutral-500 text-white">
          Send feedback
        </button>
      </div>
    </div>
  )
}

export default EditableEmail
