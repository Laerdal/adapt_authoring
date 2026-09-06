// The Samaritan brand mark — a heart formed of two interlocking puzzle
// pieces (collaboration/assistance). Used everywhere an "AI"/"Ask Samaritan"
// action appears, replacing the generic lucide Sparkles icon for that specific
// brand touchpoint so it reads the same wherever it shows up in the app.

export default function SamaritanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24,42 C10,32 4,24 4,17 A10,10 0 0 1 16,8 C20,8 23,10 24,14 L24,20 A5,5 0 0 1 24,30 L24,42 Z"
        fill="#DED0F7"
      />
      <path
        d="M24,14 C25,10 28,8 32,8 A10,10 0 0 1 44,17 C44,24 38,32 24,42 L24,30 A5,5 0 0 0 24,20 L24,14 Z"
        fill="#F4EEFC"
      />
      <path
        d="M24,42 C10,32 4,24 4,17 A10,10 0 0 1 16,8 C20,8 23,10 24,14 C25,10 28,8 32,8 A10,10 0 0 1 44,17 C44,24 38,32 24,42 Z"
        stroke="#171717"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M24,14 L24,20 A5,5 0 0 1 24,30 L24,42"
        stroke="#171717"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
