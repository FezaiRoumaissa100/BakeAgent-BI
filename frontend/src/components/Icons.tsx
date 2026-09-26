import React from "react";

const stroke = "#E8734A";
const strokeAlt = "#F0A882";
const ink = "#1C1410";
const muted = "#9a8070";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
};

const base = (size = 18, color = stroke, sw = 2) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconTrendUp = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

export const IconTrophy = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M17 5h3v3a3 3 0 0 1-3 3" />
    <path d="M7 5H4v3a3 3 0 0 0 3 3" />
  </svg>
);

export const IconCalendar = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const IconTag = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M20.59 13.41 11 24.58a2 2 0 0 1-2.83 0L2 18.41V2h16.41a2 2 0 0 1 1.41.59l.77.82a2 2 0 0 1 0 2.83z" />
    <circle cx="7" cy="7" r="1.5" fill={color} />
  </svg>
);

export const IconFilter = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const IconCash = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 10v4M18 10v4" />
  </svg>
);

export const IconTicket = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M13 5v14" strokeDasharray="2 2" />
  </svg>
);

export const IconCart = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="9" cy="21" r="1.5" />
    <circle cx="20" cy="21" r="1.5" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

export const IconCalendarDays = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <rect x="7" y="13" width="3" height="3" rx=".5" fill={color} stroke="none" />
    <rect x="14" y="13" width="3" height="3" rx=".5" fill={color} stroke="none" />
  </svg>
);

export const IconBox = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const IconDonut = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v5M12 16v5" />
  </svg>
);

export const IconClock = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

export const IconGrid = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconAlert = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconArrowMaxUp = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polyline points="3 11 12 2 21 11" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);

export const IconArrowMinDown = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polyline points="21 13 12 22 3 13" />
    <line x1="12" y1="22" x2="12" y2="2" />
  </svg>
);

export const IconBar = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="6" y1="20" x2="6" y2="4" />
    <line x1="18" y1="20" x2="18" y2="14" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

export const IconPin = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 17a6 6 0 0 0 6-6c0-4-6-9-6-9s-6 5-6 9a6 6 0 0 0 6 6z" />
    <circle cx="12" cy="11" r="2.2" fill={color} stroke="none" />
  </svg>
);

export const IconSparkline = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polyline points="2 19 7 13 11 16 16 7 22 11" />
    <line x1="2" y1="21" x2="22" y2="21" />
  </svg>
);

export const IconScale = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <line x1="12" y1="3" x2="12" y2="22" />
    <line x1="3" y1="7" x2="21" y2="7" />
    <path d="m7 7-4 8a4 4 0 0 0 8 0z" />
    <path d="m17 7 4 8a4 4 0 0 1-8 0z" />
  </svg>
);

export const IconBarsGrouped = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="4" y="11" width="3" height="9" rx="1" />
    <rect x="9" y="5" width="3" height="15" rx="1" />
    <rect x="14" y="9" width="3" height="11" rx="1" />
    <rect x="19" y="3" width="3" height="17" rx="1" />
  </svg>
);

export const IconTarget = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
  </svg>
);

export const IconBolt = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const IconTicketPerc = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M9 15l6-6" />
    <path d="M9.5 9h.01M14.5 15h.01" />
  </svg>
);

export const IconRepeat = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export const IconLink2 = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export const IconSearch = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const IconDonutPie = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const IconScatter = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <line x1="3" y1="21" x2="21" y2="21" />
    <line x1="3" y1="21" x2="3" y2="3" />
    <circle cx="8" cy="16" r="1.2" fill={color} stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill={color} stroke="none" />
    <circle cx="16" cy="9" r="1.2" fill={color} stroke="none" />
    <circle cx="10" cy="7" r="1.2" fill={color} stroke="none" />
    <circle cx="14" cy="15" r="1.2" fill={color} stroke="none" />
  </svg>
);

export const IconBubble = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="7" cy="14" r="3" />
    <circle cx="15" cy="9" r="5" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

export const IconHeatmap = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1" fill={color} fillOpacity="0.2" />
    <rect x="14" y="3" width="7" height="7" rx="1" fill={color} fillOpacity="0.7" />
    <rect x="3" y="14" width="7" height="7" rx="1" fill={color} fillOpacity="0.5" />
    <rect x="14" y="14" width="7" height="7" rx="1" fill={color} fillOpacity="0.95" />
  </svg>
);

export const IconSparkles = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
);

/* Semantic icons — to replace all emojis in data viz cards */
export const IconStar = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.35l6.5-.95 2.9-5.9z" fill={color} fillOpacity="0.12" />
  </svg>
);
export const IconGem = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M6 4h12l4 6-10 11L2 10 6 4z" fill={color} fillOpacity="0.12" />
    <path d="M2 10h20M6 4l4 6 2-6 2 6 4-6" />
  </svg>
);
export const IconFlame = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-5 2 1 2 3 3-4z" fill={color} fillOpacity="0.12" />
  </svg>
);
export const IconRocket = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M14.5 3.5c3 0 5 2 5 5 0 4-3 7-6 9l-2 1.5-2.5-2.5-3 3-2-2 3-3L2.5 13l1.5-2c2-3 5-6 9-6 0 0 1.5-1.5 1.5-1.5zM15 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM4.5 18.5l3-3M6 20l2.5-2.5" />
  </svg>
);
export const IconHook = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 2v8a4 4 0 0 1-4 4 4 4 0 0 1-3-1.5M5 8V2M8 14l-3 3a2 2 0 0 0 3 3" />
  </svg>
);
export const IconMapPin = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 22s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z" fill={color} fillOpacity="0.12" />
    <circle cx="12" cy="11" r="2" />
  </svg>
);
export const IconBasket = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M3 9h18l-1.5 11a2 2 0 0 1-2 1.8h-11A2 2 0 0 1 4.5 20L3 9zM8 9l4-6 4 6M9 13v5M12 13v5M15 13v5" />
  </svg>
);
export const IconClipboard = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="6" y="3" width="12" height="19" rx="2" fill={color} fillOpacity="0.1" />
    <path d="M9 4h6v3H9zM8 12h8M8 16h6" />
  </svg>
);
export const IconSearchCircle = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="8" fill={color} fillOpacity="0.1" />
    <path d="M15.5 15.5 19 19" />
    <circle cx="10.5" cy="10.5" r="2.5" />
  </svg>
);

export { stroke, strokeAlt, ink, muted };

// Additional icons for forecast page
export const IconChartLine = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M3 3v18h18" />
    <path d="M18.5 7.5l-5 5-4-4-5 5" />
  </svg>
);

export const IconBrain = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

export const IconSun = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const IconSnowflake = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
  </svg>
);

export const IconWave = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M2 12c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4 2-4 4-4" />
  </svg>
);

export const IconActivity = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const IconZap = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const IconSettings = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconToggleLeft = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="2" y="6" width="20" height="12" rx="6" />
    <circle cx="8" cy="12" r="3" fill={color} stroke="none" />
  </svg>
);

export const IconToggleRight = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="2" y="6" width="20" height="12" rx="6" fill={color} fillOpacity="0.2" />
    <circle cx="16" cy="12" r="3" fill={color} stroke="none" />
  </svg>
);

export const IconEye = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const IconWind = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

export const IconPercent = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

export const IconLayers = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);

export const IconGitBranch = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

export const IconRefreshCw = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const IconPackage = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export const IconShoppingCart = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

export const IconEuro = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
    <path d="M16 8h-6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h6" />
    <path d="M7 8H5M7 16H5" />
  </svg>
);

export const IconRobot = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

export const IconCheckCircle = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const IconXCircle = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export const IconAlertTriangle = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconCircleDot = ({ size, color, strokeWidth: sw, className }: IconProps) => (
  <svg {...base(size, color, sw)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
  </svg>
);
