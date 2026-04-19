import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import type { AssetMediaSelection } from "@/features/assets/lib/assets-actions-utils";

const EMPTY_MEDIA_SELECTION: AssetMediaSelection = {
  images: [],
  video: null,
  audio: null,
};

export function useAssetMediaSelection(
  resetKey: number | string,
  onSelectionChange: (selection: AssetMediaSelection) => void,
) {
  const [selection, setSelection] = useState<AssetMediaSelection>(EMPTY_MEDIA_SELECTION);

  const resetSelection = useCallback(() => {
    setSelection(EMPTY_MEDIA_SELECTION);
    onSelectionChange(EMPTY_MEDIA_SELECTION);
  }, [onSelectionChange]);

  useEffect(() => {
    queueMicrotask(resetSelection);
  }, [resetKey, resetSelection]);

  const updateSelection = useCallback(
    (nextSelection: AssetMediaSelection) => {
      setSelection(nextSelection);
      onSelectionChange(nextSelection);
    },
    [onSelectionChange],
  );

  const onImagesChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSelection({
        ...selection,
        images: Array.from(event.currentTarget.files ?? []),
      });
    },
    [selection, updateSelection],
  );

  const onVideoChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSelection({
        ...selection,
        video: event.currentTarget.files?.[0] ?? null,
      });
    },
    [selection, updateSelection],
  );

  const onAudioChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSelection({
        ...selection,
        audio: event.currentTarget.files?.[0] ?? null,
      });
    },
    [selection, updateSelection],
  );

  return {
    onImagesChange,
    onVideoChange,
    onAudioChange,
  };
}
