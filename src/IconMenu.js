//IconMenu.js
import React from 'react';
import './IconMenu.css'; // Ensure this file exists for styling

export default function IconMenu({ options, onClose, position }) {
  return (
    <div
      className="icon-menu"
      style={{
        position: 'absolute',
        top: position.y + 'px',
        left: position.x + 'px',
        transform: 'translate(-50%, -50%)', // Center the menu relative to the icon
      }}
    >
      {/* Close Mark */}
      <span
        className="menu-close"
        onClick={onClose}
        title="Close"
      >
        &#10005; {/* Unicode for 'X' */}
      </span>
      {options.map((option, index) => (
        <button key={index} onClick={option.onClick}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

