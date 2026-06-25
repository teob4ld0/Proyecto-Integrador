import { useMemo } from 'react'

export default function BulletBackground() {
  const particles = useMemo(() => {
    const colors = ['#ff2d55', '#00f0ff', '#bf00ff', '#ff8800', '#00ff88']
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${(i * 97) % 100}%`,
      drift: `${-24 + Math.random() * 48}px`,
      size: `${4 + Math.random() * 6}px`,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: `${6 + Math.random() * 10}s`,
      delay: `${Math.random() * 8}s`,
      opacity: 0.4 + Math.random() * 0.4,
    }))
  }, [])

  return (
    <div className="bullet-bg" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="bullet-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            '--bullet-drift-x': p.drift,
            backgroundColor: p.color,
            animationDuration: p.duration,
            animationDelay: p.delay,
            opacity: p.opacity,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}
