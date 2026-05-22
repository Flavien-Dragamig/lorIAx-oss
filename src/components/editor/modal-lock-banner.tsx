"use client";

interface ModalLockBannerProps {
  isLocked: boolean;
  lockedBy?: string;
}

/**
 * Badge inline affiché dans la toolbar d'un bloc lorsqu'un autre utilisateur
 * est en train de l'éditer (verrou optimiste).
 */
export function ModalLockBanner({ isLocked, lockedBy }: ModalLockBannerProps) {
  if (!isLocked) return null;

  return (
    <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">
      {lockedBy ? `Édité par ${lockedBy}` : "En cours d'édition"}
    </span>
  );
}
