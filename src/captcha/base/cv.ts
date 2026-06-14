import cv, { type Mat, type Vector } from '@techstark/opencv-js';
import { Jimp } from 'jimp';

export class BaseCvService {
  // Convert base64 image to RGBA matrix
  public async b64ImgToMatRGBA(base64: string): Promise<Mat> {
    const image = await Jimp.read(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')); // jimp defaults to RGBA
    const { width, height, data } = image.bitmap;

    const matRGBA = new cv.Mat(height, width, cv.CV_8UC4);
    matRGBA.data.set(data);

    return matRGBA;
  }

  // Convert base64 image to grayscale matrix
  public async b64ImgToGray(base64: string): Promise<Mat> {
    const matRGBA = await this.b64ImgToMatRGBA(base64);

    const gray = new cv.Mat();
    cv.cvtColor(matRGBA, gray, cv.COLOR_RGBA2GRAY); // jimp defaults to RGBA
    matRGBA.delete(); // clean

    return gray;
  }

  // Convert base64 image to alpha mask matrix
  public async b64ImgToAlphaMask(base64: string): Promise<Mat> {
    const matRGBA = await this.b64ImgToMatRGBA(base64);

    const planes = new cv.MatVector();
    cv.split(matRGBA, planes);
    matRGBA.delete(); // clean

    const alpha = planes.get(3);
    const mask = new cv.Mat();
    cv.threshold(alpha, mask, 12, 255, cv.THRESH_BINARY);

    alpha.delete(); // clean
    planes.delete(); // clean

    return mask;
  }

  // Center crop
  public centerCrop(mat: Mat, width: number, height: number): Mat {
    const x0 = Math.floor((mat.cols - width) / 2);
    const y0 = Math.floor((mat.rows - height) / 2);

    return mat.roi(new cv.Rect(x0, y0, width, height));
  }

  // Gaussian blur
  public gaussianBlur(mat: Mat, ksize: number = 3, sigma: number = 0): Mat {
    const blurred = new cv.Mat();
    cv.GaussianBlur(mat, blurred, new cv.Size(ksize, ksize), sigma);
    return blurred;
  }

  // Canny edge detection
  public canny(mat: Mat, low: number = 100, high: number = 200): Mat {
    const edges = new cv.Mat();
    cv.Canny(mat, edges, low, high);
    return edges;
  }

  // Laplacian edge detection
  public laplacian(mat: Mat, ksize: number = 3): Mat {
    const edges = new cv.Mat();
    cv.Laplacian(mat, edges, cv.CV_64F, ksize);
    return edges;
  }

  // Sobel edge detection
  public sobel(mat: Mat, ksize: number = 3): Mat {
    const edgesX = new cv.Mat();
    const edgesY = new cv.Mat();
    const edges = new cv.Mat();

    cv.Sobel(mat, edgesX, cv.CV_64F, 1, 0, ksize);
    cv.Sobel(mat, edgesY, cv.CV_64F, 0, 1, ksize);

    cv.magnitude(edgesX, edgesY, edges);

    edgesX.delete(); // clean
    edgesY.delete(); // clean

    return edges;
  }
}

export class MatManager {
  private mats: (Mat | Vector<Mat>)[] = [];

  add<T extends Mat | Vector<Mat>>(mat: T) {
    if (mat) this.mats.push(mat);
    return mat;
  }

  async wrap<T extends Mat | Vector<Mat>>(promise: Promise<T>) {
    const mat = await promise;
    return this.add(mat);
  }

  release() {
    this.mats.forEach((m) => m.delete?.());
    this.mats = [];
  }
}
