export interface ConvertedImage {
  id: string;
  originalName: string;
  originalSize: number;
  previewUrl: string;
  blob: Blob;
  status: 'pending' | 'converting' | 'done' | 'error';
  jpegSize?: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
