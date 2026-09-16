import React from "react";

type PxIconProps = {
  name: string;
  className?: string;
  title?: string;
};

/** Pixelarticons webfont glyph — keeps the Mario / Digital Forest look sharp. */
export function PxIcon({ name, className = "", title }: PxIconProps) {
  return (
    <i
      className={`px-icon pixelart-icons-font-${name}${
        className ? ` ${className}` : ""
      }`}
      aria-hidden={title ? undefined : true}
      title={title}
      role={title ? "img" : undefined}
    />
  );
}
