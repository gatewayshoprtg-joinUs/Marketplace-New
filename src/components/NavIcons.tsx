import React from 'react';

export interface NavIconProps {
  active?: boolean;
  className?: string;
}

export function NavHomeIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 10.6L12 4.2L19.5 10.6V18.5C19.5 19.6 18.6 20.5 17.5 20.5H6.5C5.4 20.5 4.5 19.6 4.5 18.5V10.6Z"
        fill="currentColor"
        fillOpacity={active ? 0.2 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 20.5V14.75C9.75 13.78 10.53 13 11.5 13H12.5C13.47 13 14.25 13.78 14.25 14.75V20.5"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.35 : 0}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavCatalogIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="3.75"
        y="3.75"
        width="7.25"
        height="7.25"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.25 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="13"
        y="3.75"
        width="7.25"
        height="7.25"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.14 : 0.04}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="3.75"
        y="13"
        width="7.25"
        height="7.25"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.14 : 0.04}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="13"
        y="13"
        width="7.25"
        height="7.25"
        rx="3.6"
        fill="currentColor"
        fillOpacity={active ? 0.9 : 0.2}
        stroke="currentColor"
        strokeWidth="1.85"
      />
    </svg>
  );
}

export function NavCartIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5.2 8.5H18.8L19.9 18.3C20.04 19.48 19.12 20.5 17.93 20.5H6.07C4.88 20.5 3.96 19.48 4.1 18.3L5.2 8.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.22 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 8.5V6.75C8.75 4.95 10.2 3.5 12 3.5C13.8 3.5 15.25 4.95 15.25 6.75V8.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M9.5 12.25H14.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavOrdersIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="5"
        y="3.5"
        width="14"
        height="17"
        rx="2.5"
        fill="currentColor"
        fillOpacity={active ? 0.2 : 0.07}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <path
        d="M9 8.25H15M9 12H15M9 15.75H12.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavProfileIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="8"
        r="3.5"
        fill="currentColor"
        fillOpacity={active ? 0.25 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <path
        d="M5 19.25C5.7 15.9 8.5 14 12 14C15.5 14 18.3 15.9 19 19.25"
        fill="currentColor"
        fillOpacity={active ? 0.16 : 0.05}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavBellIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.2 10.2C6.2 6.85 8.78 4.25 12 4.25C15.22 4.25 17.8 6.85 17.8 10.2V13.8L19.35 16.25C19.66 16.74 19.31 17.38 18.73 17.38H5.27C4.69 17.38 4.34 16.74 4.65 16.25L6.2 13.8V10.2Z"
        fill="currentColor"
        fillOpacity={active ? 0.22 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.25C10.45 20.1 11.17 20.5 12 20.5C12.83 20.5 13.55 20.1 14 19.25"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavStorefrontIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.25 9.5L5.75 4.75H18.25L19.75 9.5C19.75 10.88 18.63 12 17.25 12C15.87 12 14.75 10.88 14.75 9.5C14.75 10.88 13.63 12 12.25 12H11.75C10.37 12 9.25 10.88 9.25 9.5C9.25 10.88 8.13 12 6.75 12C5.37 12 4.25 10.88 4.25 9.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.25 : 0.1}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 12V18.75C5.75 19.44 6.31 20 7 20H17C17.69 20 18.25 19.44 18.25 18.75V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 20V15.5C10 14.95 10.45 14.5 11 14.5H13C13.55 14.5 14 14.95 14 15.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function NavDashboardIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="3.75"
        y="3.75"
        width="7.25"
        height="9.25"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.24 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="13"
        y="3.75"
        width="7.25"
        height="5.75"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.14 : 0.04}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="13"
        y="11.5"
        width="7.25"
        height="8.75"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.24 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <rect
        x="3.75"
        y="15"
        width="7.25"
        height="5.25"
        rx="2"
        fill="currentColor"
        fillOpacity={active ? 0.14 : 0.04}
        stroke="currentColor"
        strokeWidth="1.85"
      />
    </svg>
  );
}

export function NavBoxIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.5L19.5 7.5V16.5L12 20.5L4.5 16.5V7.5L12 3.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.2 : 0.07}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 7.5L12 11.5L19.5 7.5M12 11.5V20.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 5.4L15.75 9.35"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavTruckIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 7.5C3.5 6.4 4.4 5.5 5.5 5.5H14.5V16.5H3.5V7.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.22 : 0.08}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 9.5H18.2L20.5 12.2V16.5H14.5V9.5Z"
        fill="currentColor"
        fillOpacity={active ? 0.12 : 0.04}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <circle cx="7.25" cy="17.5" r="2" fill="white" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="17.25" cy="17.5" r="2" fill="white" stroke="currentColor" strokeWidth="1.85" />
    </svg>
  );
}

export function NavReturnIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 11.5C4.5 7.36 7.86 4 12 4C16.14 4 19.5 7.36 19.5 11.5C19.5 15.64 16.14 19 12 19C9.35 19 7.03 17.63 5.7 15.55"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6.5V11.5H9.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="11.5"
        r="2.75"
        fill="currentColor"
        fillOpacity={active ? 0.35 : 0.12}
        stroke="currentColor"
        strokeWidth="1.65"
      />
    </svg>
  );
}

export function NavSettingsIcon({ active = false, className = 'w-5 h-5' }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 7.5H10.5M14.5 7.5H19.5M4.5 16.5H9.5M13.5 16.5H19.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <circle
        cx="12.5"
        cy="7.5"
        r="2.25"
        fill="currentColor"
        fillOpacity={active ? 0.35 : 0.12}
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <circle
        cx="11.5"
        cy="16.5"
        r="2.25"
        fill="currentColor"
        fillOpacity={active ? 0.35 : 0.12}
        stroke="currentColor"
        strokeWidth="1.85"
      />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20.25 11.75A8.25 8.25 0 0 1 8.22 19.05L3.75 20.25l1.23-4.38A8.25 8.25 0 1 1 20.25 11.75Z"
        fill="#25D366"
        stroke="#15803D"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M9.45 8.75c-.19-.43-.39-.44-.57-.45h-.49c-.17 0-.45.06-.68.32-.23.26-.89.87-.89 2.13 0 1.26.91 2.48 1.04 2.65.13.17 1.76 2.81 4.35 3.83 2.15.85 2.59.68 3.06.64.47-.04 1.51-.62 1.72-1.21.22-.6.22-1.11.15-1.22-.06-.11-.23-.17-.49-.3-.25-.13-1.51-.75-1.74-.83-.23-.09-.4-.13-.58.13-.17.26-.66.83-.81 1-.15.17-.3.19-.55.07-.26-.13-1.08-.4-2.07-1.28-.76-.68-1.28-1.52-1.43-1.78-.15-.26-.02-.4.11-.52.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.08-.17.04-.32-.02-.45-.07-.13-.56-1.4-.79-1.91Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

