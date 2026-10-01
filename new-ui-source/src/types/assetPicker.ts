export type AssetPickerType = "all" | "image" | "audio" | "video" | "media" | "other" | "h5p";

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