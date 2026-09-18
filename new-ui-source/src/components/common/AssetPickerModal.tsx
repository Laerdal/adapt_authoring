import type { AssetPickerType } from "@/types/assetPicker";
import { AssetManagementWorkspace } from "@/pages/AssetManagementPage";

interface AssetPickerModalProps {
  onSelect: (asset: { id: string; url: string; assetLink: string }) => void;
  onClose: () => void;
  assetType?: AssetPickerType;
}

const KIND_TEXT: Record<AssetPickerType, { title: string; description: string }> = {
  all: { title: "Select Asset", description: "Choose an asset from Asset Management to continue." },
  image: { title: "Select an Image", description: "Choose an image from Asset Management to continue." },
  audio: { title: "Select an Audio File", description: "Choose an audio asset from Asset Management to continue." },
  video: { title: "Select a Video", description: "Choose a video asset from Asset Management to continue." },
  media: { title: "Select Media", description: "Choose an audio or video asset from Asset Management to continue." },
  other: { title: "Select Document", description: "Choose a document or other non-media asset from Asset Management to continue." },
  h5p: { title: "Select an H5P File", description: "Choose an H5P package from Asset Management to continue." },
};

export default function AssetPickerModal({ onSelect, onClose, assetType }: AssetPickerModalProps) {
  const resolvedAssetType: AssetPickerType = assetType ?? "all";
  const text = KIND_TEXT[resolvedAssetType];

  return (
    <div className="fixed inset-0 z-[90] bg-[#f8fafc]">
      <AssetManagementWorkspace
        pickerMode
        pickerAssetType={resolvedAssetType}
        pickerTitle={text.title}
        pickerDescription={text.description}
        hideAssistant
        onCancelPick={onClose}
        onPickAsset={onSelect}
      />
    </div>
  );
}
