import { AssetFormCreateCard } from "@/features/assets/components/asset-form-create-card";
import { AssetFormEditCard } from "@/features/assets/components/asset-form-edit-card";
import type { AssetFormProps } from "@/features/assets/components/asset-form.types";

export type {
  AssetFormExistingMediaItem,
  CreateAssetFormDefaults,
} from "@/features/assets/components/asset-form.types";

export function AssetForm(props: AssetFormProps) {
  if (props.mode === "create") {
    return <AssetFormCreateCard {...props} />;
  }

  return <AssetFormEditCard {...props} />;
}
