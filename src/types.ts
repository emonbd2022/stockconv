export interface ConvertedImage {
  id: string;
  originalName: string;
  originalSize: number;
  previewUrl: string;
  blob: Blob;
  status: 'pending' | 'converting' | 'done' | 'error';
  jpegSize?: number;
}
