export type AssetPickerType = "image" | "audio" | "video" | "h5p";

export interface AssetPickerResult {
  id: string;
  url: string;
  assetLink: string;
}

export interface AssetPickerRequest {
  assetType: AssetPickerType;
  title?: string;
  description?: string;
  onSelect: (asset: AssetPickerResult) => void;
}