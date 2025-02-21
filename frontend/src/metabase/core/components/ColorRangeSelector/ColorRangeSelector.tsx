import { useDisclosure } from "@mantine/hooks";

import ColorRange from "metabase/core/components/ColorRange";
import { Popover } from "metabase/ui";

import ColorRangePopover from "./ColorRangePopover";

export interface ColorRangeSelectorProps {
  value: string[];
  colors: string[];
  colorRanges?: string[][];
  colorMapping?: Record<string, string[]>;
  isQuantile?: boolean;
  onChange?: (newValue: string[]) => void;
  withinPortal?: boolean;
}

export const ColorRangeSelector = ({
  value,
  colors,
  colorRanges,
  colorMapping,
  isQuantile,
  onChange,
  withinPortal = true,
  ...props
}: ColorRangeSelectorProps) => {
  const [opened, { close, toggle }] = useDisclosure(false);
  return (
    <Popover opened={opened} onClose={close} withinPortal={withinPortal}>
      <Popover.Target>
        <ColorRange
          colors={value}
          isQuantile={isQuantile}
          onClick={toggle}
          role="button"
        />
      </Popover.Target>
      <Popover.Dropdown>
        <ColorRangePopover
          initialValue={value}
          colors={colors}
          colorRanges={colorRanges}
          colorMapping={colorMapping}
          isQuantile={isQuantile}
          onChange={onChange}
          onClose={close}
        />
      </Popover.Dropdown>
    </Popover>
  );
};
