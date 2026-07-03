import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MAP_VIEWBOX, US_MAP_STATES } from '../data/usMapPaths'
import './USStateMap.css'

const INSET_STATE_IDS = new Set(['NH', 'VT', 'NJ', 'DE', 'DC', 'MA', 'CT', 'RI', 'MD'])

function stateDirectoryUrl(stateName) {
  return `/rehab-centers?state=${encodeURIComponent(stateName)}`
}

export default function USStateMap() {
  const navigate = useNavigate()
  const svgRef = useRef(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [labelPositions, setLabelPositions] = useState({})

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const positions = {}
    for (const state of US_MAP_STATES) {
      if (state.label?.inset) {
        positions[state.id] = { x: state.label.x, y: state.label.y }
        continue
      }
      const path = svg.querySelector(`#${state.id.toLowerCase()}`)
      if (!path) continue
      const bbox = path.getBBox()
      positions[state.id] = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      }
    }
    setLabelPositions(positions)
  }, [])

  function handleSelect(state) {
    navigate(stateDirectoryUrl(state.name))
  }

  const hoveredState = hoveredId
    ? US_MAP_STATES.find(s => s.id === hoveredId)
    : null

  return (
    <div className="us-state-map">
      <svg
        ref={svgRef}
        viewBox={MAP_VIEWBOX}
        className="us-state-map-svg"
        role="img"
        aria-label="Interactive map of the United States. Select a state to browse treatment centers."
      >
        {US_MAP_STATES.map(state => {
          const isHovered = hoveredId === state.id
          const isInset = INSET_STATE_IDS.has(state.id)
          return (
            <path
              key={state.id}
              id={state.id.toLowerCase()}
              d={state.d}
              className={[
                'us-map-state',
                isInset ? 'us-map-state--inset-source' : '',
                isHovered ? 'is-hovered' : '',
              ].filter(Boolean).join(' ')}
              tabIndex={0}
              role="link"
              aria-label={`View treatment centers in ${state.name}`}
              onMouseEnter={() => setHoveredId(state.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(state.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => handleSelect(state)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect(state)
                }
              }}
            />
          )
        })}

        {US_MAP_STATES.filter(s => s.label?.box).map(state => {
          const { box } = state.label
          const isHovered = hoveredId === state.id
          return (
            <g key={`${state.id}-inset`}>
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx={6}
                className={[
                  'us-map-inset-box',
                  isHovered ? 'is-hovered' : '',
                ].filter(Boolean).join(' ')}
                tabIndex={0}
                role="link"
                aria-label={`View treatment centers in ${state.name}`}
                onMouseEnter={() => setHoveredId(state.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(state.id)}
                onBlur={() => setHoveredId(null)}
                onClick={() => handleSelect(state)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect(state)
                  }
                }}
              />
            </g>
          )
        })}

        {US_MAP_STATES.map(state => {
          const pos = labelPositions[state.id] || state.label
          if (!pos) return null
          const hideOnMap = state.label?.hideOnMap && !state.label?.inset
          if (hideOnMap) return null
          return (
            <text
              key={`${state.id}-label`}
              x={pos.x}
              y={pos.y}
              className="us-map-label"
              pointerEvents="none"
              aria-hidden="true"
            >
              {state.id}
            </text>
          )
        })}
      </svg>

      <div className="us-state-map-tooltip" aria-live="polite">
        {hoveredState ? (
          <>
            <strong>{hoveredState.name}</strong>
            <span>Click to browse centers</span>
          </>
        ) : (
          <span>Select a state to find treatment centers near you</span>
        )}
      </div>
    </div>
  )
}
