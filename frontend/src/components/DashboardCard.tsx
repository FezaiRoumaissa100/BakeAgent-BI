import { ReactNode } from "react";

const CARD_SHADOW =
  "0 14px 40px rgba(60,30,8,0.08), 0 2px 8px rgba(60,30,8,0.04)";

export function DashboardCard({
  children,
  className = "",
  height,
}: {
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`bg-white rounded-[22px] p-5 border border-stone-100/80 ${className}`}
      style={{
        boxShadow: CARD_SHADOW,
        ...(height ? { minHeight: height } : {}),
      }}
    >
      {children}
    </div>
  );
}

export { CARD_SHADOW };
