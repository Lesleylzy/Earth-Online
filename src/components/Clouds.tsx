'use client'

export default function Clouds() {
  return (
    <>
      <div className="cloud c1">
        <div style={{ position: 'relative', width: 300, height: 80 }}>
          <div className="cb" style={{ width: 120, height: 40, top: 30, left: 40 }} />
          <div className="cb" style={{ width: 80, height: 50, top: 10, left: 80 }} />
          <div className="cb" style={{ width: 60, height: 35, top: 20, left: 150 }} />
        </div>
      </div>
      <div className="cloud c2">
        <div style={{ position: 'relative', width: 220, height: 60 }}>
          <div className="cb" style={{ width: 100, height: 35, top: 20, left: 20 }} />
          <div className="cb" style={{ width: 70, height: 40, top: 5, left: 60 }} />
          <div className="cb" style={{ width: 80, height: 28, top: 22, left: 110 }} />
        </div>
      </div>
      <div className="cloud c3">
        <div style={{ position: 'relative', width: 250, height: 65 }}>
          <div className="cb" style={{ width: 110, height: 35, top: 25, left: 30 }} />
          <div className="cb" style={{ width: 75, height: 45, top: 8, left: 70 }} />
        </div>
      </div>
      <div className="cloud c4">
        <div style={{ position: 'relative', width: 180, height: 55 }}>
          <div className="cb" style={{ width: 90, height: 30, top: 18, left: 15 }} />
          <div className="cb" style={{ width: 65, height: 38, top: 5, left: 55 }} />
        </div>
      </div>
    </>
  )
}
