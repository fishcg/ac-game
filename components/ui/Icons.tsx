import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></IconBase>;
export const HomeIcon = (props: IconProps) => <IconBase {...props}><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-6h6v6" /></IconBase>;
export const GameIcon = (props: IconProps) => <IconBase {...props}><path d="M8.5 7h7a5.5 5.5 0 0 1 5.2 7.3l-1 3a2.5 2.5 0 0 1-4.1 1l-1.6-1.5h-4l-1.6 1.5a2.5 2.5 0 0 1-4.1-1l-1-3A5.5 5.5 0 0 1 8.5 7Z" /><path d="M8 11v4M6 13h4M16.5 12.5h.01M18.5 14.5h.01" /></IconBase>;
export const ClockIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconBase>;
export const TrophyIcon = (props: IconProps) => <IconBase {...props}><path d="M8 4h8v4a4 4 0 0 1-8 0Z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></IconBase>;
export const BoxIcon = (props: IconProps) => <IconBase {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></IconBase>;
export const SparkIcon = (props: IconProps) => <IconBase {...props}><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6Z" /></IconBase>;
export const ArrowIcon = (props: IconProps) => <IconBase {...props}><path d="M5 12h14M14 7l5 5-5 5" /></IconBase>;
export const CloseIcon = (props: IconProps) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>;
export const VolumeIcon = (props: IconProps) => <IconBase {...props}><path d="M5 10v4h4l5 4V6L9 10Z" /><path d="M18 9a4 4 0 0 1 0 6" /></IconBase>;
export const VolumeOffIcon = (props: IconProps) => <IconBase {...props}><path d="M5 10v4h4l5 4V6L9 10Z" /><path d="m18 10 4 4M22 10l-4 4" /></IconBase>;
export const FullscreenIcon = (props: IconProps) => <IconBase {...props}><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></IconBase>;
export const FullscreenExitIcon = (props: IconProps) => <IconBase {...props}><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" /></IconBase>;
export const UserIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></IconBase>;
export const PlayIcon = (props: IconProps) => <IconBase {...props}><path fill="currentColor" stroke="none" d="m8 5 11 7-11 7Z" /></IconBase>;
export const ChevronIcon = (props: IconProps) => <IconBase {...props}><path d="m9 18 6-6-6-6" /></IconBase>;
