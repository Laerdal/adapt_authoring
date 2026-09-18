import type { AssetKind } from "@/api/adaptAuthoring";
import { AssetManagementWorkspace } from "@/pages/AssetManagementPage";

interface AssetPickerModalProps {
  onSelect: (asset: { id: string; url: string; assetLink: string }) => void;
  onClose: () => void;
  // Which media kind to browse/upload. Defaults to image (cover-image picker).
  assetType?: AssetKind;
}

const KIND_TEXT: Record<AssetKind, { title: string; description: string }> = {
  image: { title: "Select an Image", description: "Choose an image from Asset Management to continue." },
  audio: { title: "Select an Audio File", description: "Choose an audio asset from Asset Management to continue." },
  video: { title: "Select a Video", description: "Choose a video asset from Asset Management to continue." },
  h5p: { title: "Select an H5P File", description: "Choose an H5P package from Asset Management to continue." },
};

export default function AssetPickerModal({ onSelect, onClose, assetType = "image" }: AssetPickerModalProps) {
  const text = KIND_TEXT[assetType];

  return (
    <div className="fixed inset-0 z-[90] bg-[#f8fafc]">
      <AssetManagementWorkspace
        pickerMode
        pickerAssetType={assetType}
        pickerTitle={text.title}
        pickerDescription={text.description}
        hideAssistant
        onCancelPick={onClose}
        onPickAsset={onSelect}
      />
    </div>
  );
}
