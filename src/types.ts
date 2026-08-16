export interface ConvertedImage {
  id: string;
  originalName: string;
  originalSize: number;
  previewUrl: string;
  file: File;
  blob?: Blob;
  status: 'pending' | 'converting' | 'done' | 'error';
  convertedSize?: number;
  isExported?: boolean;
  progress?: number;
  stage?: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
