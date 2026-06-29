import { useEffect, useState } from 'react'
import App from '../App.tsx'
import BitratePocPage from './BitratePocPage.tsx'

const POC_HASH = '#/bitrate-poc'

function FloatingNav({ onPoc }: { onPoc: boolean }) {
  return (
    <a
      href={onPoc ? '#/' : POC_HASH}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9998,
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
        color: '#000',
        background: 'var(--primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      {onPoc ? 'Metadata Explorer' : 'Bitrate PoC →'}
    </a>
  )
}

export default function Root() {
  const [hash, setHash] = useState<string>(typeof location !== 'undefined' ? location.hash : '')

  useEffect(() => {
    const onHash = () => setHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const onPoc = hash === POC_HASH
  return (
    <>
      {onPoc ? <BitratePocPage /> : <App />}
      <FloatingNav onPoc={onPoc} />
    </>
  )
}
