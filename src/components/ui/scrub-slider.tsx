import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// A compact "scrub field" built on the shadcn/Radix slider primitive: the
// label and value sit inside the bar, the fill shows the value, and the whole
// bar is the drag target (like number fields in Figma or Photoshop).
function ScrubSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      data-slot="scrub-slider"
      className={cn("scrub", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
    >
      <SliderPrimitive.Track className="scrub-track">
        <SliderPrimitive.Range className="scrub-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="scrub-thumb" aria-label={label} />
      <span className="scrub-label">{label}</span>
      <span className="scrub-value">{format ? format(value) : value}</span>
    </SliderPrimitive.Root>
  );
}

export { ScrubSlider };
