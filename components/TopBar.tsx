'use client';

interface AppIconProps {
  size?: number;
}

/** App icon — indigo rounded-square with white pen nib + sparkle */
function AppIcon({ size = 28 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="#7C3AED" />
      <path
        d="M19.5 8.5L10 18L8.5 19.5L9.5 20.5L10 19L19.5 9.5L19.5 8.5Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M17 7L21 11"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="21" cy="7" r="1.2" fill="#C4B5FD" />
    </svg>
  );
}

export { AppIcon };
