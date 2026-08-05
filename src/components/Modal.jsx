import React, { useRef } from 'react'

export default function Modal({ title, onClose, children }) {
  // Close only when the press STARTED and ENDED on the backdrop itself.
  // Prevents the modal from closing (and losing input) when a text-selection
  // drag that began inside an input ends outside the modal.
  const pressStartedOnBackdrop = useRef(false)
  return (
    <div
      className="modal-back"
      onPointerDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose()
        pressStartedOnBackdrop.current = false
      }}
    >
      <div className="modal">
        <div className="section-head">
          <h2>{title}</h2>
          <button className="ghost small" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
