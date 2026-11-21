import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import campus from '../../campus/campus.json'
import { CampusScene } from './CampusScene.ts'

export default function App() {
  const parent = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current!,
      width: campus.width,
      height: campus.height,
      backgroundColor: '#0d1b14',
      scene: [CampusScene],
    })
    return () => game.destroy(true)
  }, [])

  return <div ref={parent} />
}
