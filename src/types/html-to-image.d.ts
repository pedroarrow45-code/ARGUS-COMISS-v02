declare module "html-to-image" {
  export function toJpeg(node: HTMLElement, options?: {
    quality?: number;
    pixelRatio?: number;
    cacheBust?: boolean;
    backgroundColor?: string;
  }): Promise<string>;
}
