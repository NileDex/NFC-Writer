import { useCallback, useMemo, useState } from 'react'
import { tokenizeCpp, tokenizeJson, type Token } from '../lib/highlight'
import { CheckIcon, CopyIcon, DownloadIcon } from './Icons'

interface CodeBlockProps {
  code: string
  filename: string
  /** Download name; defaults to `filename`. */
  downloadAs?: string
  language?: 'cpp' | 'json'
}

export function CodeBlock({ code, filename, downloadAs, language = 'cpp' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const tokens = useMemo<Token[]>(
    () => (language === 'json' ? tokenizeJson(code) : tokenizeCpp(code)),
    [code, language],
  )

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable - user can select the text manually */
    }
  }, [code])

  const download = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadAs ?? filename
    anchor.click()
    URL.revokeObjectURL(url)
  }, [code, filename, downloadAs])

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span className="code-block__title">{filename}</span>
        <div className="code-block__actions">
          <button type="button" className="btn" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn" onClick={download}>
            <DownloadIcon />
            Download
          </button>
        </div>
      </div>
      <pre className="code-block__pre" tabIndex={0}>
        <code>
          {tokens.map((token, index) =>
            token.kind === 'plain' ? (
              <span key={index}>{token.text}</span>
            ) : (
              <span key={index} className={`tok-${token.kind}`}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  )
}
