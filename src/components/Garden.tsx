export function Garden({ growth = 0, large = false }: { growth?: number; large?: boolean }) {
  return (
    <svg
      className={`garden ${large ? 'large' : ''}`}
      viewBox="0 0 300 250"
      role="img"
      aria-label={
        growth === 0
          ? 'A seedling ready to grow with your learning'
          : `Your learning garden, ${growth} lessons completed`
      }
    >
      <defs>
        <linearGradient id="pot" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#dd9770" />
          <stop offset="1" stopColor="#b8704e" />
        </linearGradient>
        <linearGradient id="leaves" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b8d68d" />
          <stop offset="1" stopColor="#56966b" />
        </linearGradient>
      </defs>
      <ellipse cx="150" cy="229" rx="87" ry="9" fill="#163b23" opacity=".08" />
      <circle cx="151" cy="103" r="88" fill="#e8efdb" />
      <circle cx="232" cy="54" r="4" fill="#cbda94" />
      <circle cx="66" cy="88" r="3" fill="#cbda94" />
      <path
        d="M149 183Q136 130 151 85"
        fill="none"
        stroke="#46865a"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M147 139Q83 138 79 89Q141 84 147 139" fill="url(#leaves)" />
      <path d="M149 108Q205 110 217 58Q153 50 149 108" fill="url(#leaves)" />
      <path
        d="M144 134L101 105M153 99L196 72"
        stroke="#477c51"
        strokeWidth="2"
        fill="none"
        opacity=".45"
      />
      {growth >= 3 && (
        <>
          <path d="M149 162Q192 156 207 120Q161 111 149 162" fill="#80b57c" />
          <path d="M150 157L193 132" stroke="#477c51" fill="none" />
        </>
      )}
      {growth >= 8 && (
        <>
          <path d="M148 92Q119 75 117 43Q156 43 148 92" fill="#91bd81" />
          <path d="M148 87Q148 58 163 35" stroke="#46865a" fill="none" strokeWidth="4" />
          <circle cx="166" cy="32" r="9" fill="#e5b16b" />
          <circle cx="165" cy="18" r="8" fill="#f0cca0" />
          <circle cx="179" cy="30" r="8" fill="#f0cca0" />
          <circle cx="168" cy="45" r="8" fill="#f0cca0" />
          <circle cx="153" cy="32" r="8" fill="#f0cca0" />
          <circle cx="166" cy="31" r="6" fill="#d7a957" />
        </>
      )}
      {growth >= 16 && (
        <>
          <path
            d="M118 182Q101 142 94 138M186 182Q202 147 218 136"
            stroke="#568b5a"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M106 161Q73 155 77 132Q108 138 106 161M204 157Q236 155 236 128Q207 129 204 157"
            fill="#9cc37b"
          />
        </>
      )}
      <path d="M99 180h103l-14 45q-38 12-75 0Z" fill="url(#pot)" />
      <rect x="94" y="173" width="112" height="17" rx="7" fill="#d39a75" />
      <ellipse cx="150" cy="174" rx="48" ry="5" fill="#795a40" />
      <path d="M119 201h5M176 201h5" stroke="#68442e" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M144 206q6 7 12 0"
        stroke="#68442e"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
