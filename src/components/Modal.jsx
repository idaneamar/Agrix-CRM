import React from 'react'

export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
