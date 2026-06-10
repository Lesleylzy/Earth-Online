'use client'
import { ReactNode } from 'react'

export default function Monitor({ children }: { children: ReactNode }) {
  return (
    <div className="computer-wrap">
      <div className="mon">
        <div className="scn">
          {children}
          <div className="led">
            <i className="led-dot" />
            <span className="led-text">Signal_OK</span>
          </div>
        </div>
      </div>
      <div className="stand" />
      <div className="base">
        <div style={{ width: 120, height: 6, background: '#6a7e87' }} />
        <div style={{ width: 16, height: 16, background: '#6a7e87', borderRadius: '50%', marginLeft: 'auto' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ width: 44, height: 3, background: '#6a7e87' }} />
          <div style={{ width: 44, height: 3, background: '#6a7e87' }} />
        </div>
      </div>
    </div>
  )
}
