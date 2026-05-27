'use client'

import { useRouter } from 'next/navigation'

export default function ComidasHome() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#000', color: '#fff' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '40px', fontWeight: 'bold' }}>HAPPY EXPRESS</h1>
      <p style={{ fontSize: '18px', marginBottom: '60px', color: '#aaa' }}>Gestión de Pedidos y Comidas</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', maxWidth: '600px', width: '100%' }}>
        <button onClick={() => router.push('/inventario-comidas/comidas/landing')} style={{
          padding: '40px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #ea580c, #ff6b35)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
          🌐 Landing<br/>(Público)
        </button>

        <button onClick={() => router.push('/inventario-comidas/comidas/qr')} style={{
          padding: '40px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
          📱 QR Mesa<br/>(Interno)
        </button>

        <button onClick={() => router.push('/inventario-comidas/comidas/cocina')} style={{
          padding: '40px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
          👨‍🍳 Cocina<br/>(TV Pedidos)
        </button>

        <button onClick={() => router.push('/inventario-comidas/comidas/caja')} style={{
          padding: '40px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
          border: 'none',
          borderRadius: '12px',
          color: '#000',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
          💰 Caja<br/>(Cierre)
        </button>
      </div>
    </div>
  )
}
