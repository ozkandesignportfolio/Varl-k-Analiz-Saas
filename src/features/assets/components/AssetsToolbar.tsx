import type { ComponentProps } from "react";
import { AssetsFilterBar } from "@/features/assets/components/assets-filter-bar";

type AssetsToolbarProps = ComponentProps<typeof AssetsFilterBar>;

export function AssetsToolbar(props: AssetsToolbarProps) {
  return <AssetsFilterBar {...props} />;
}
