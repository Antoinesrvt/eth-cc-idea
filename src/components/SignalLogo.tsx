import Image from "next/image";

interface SignalLogoProps {
  size?: number;
  className?: string;
}

export function SignalLogo({ size = 32, className }: SignalLogoProps) {
  return (
    <Image
      src="/signal-logo.jpeg"
      alt="TrustSignal"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
