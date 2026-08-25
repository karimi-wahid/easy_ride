import {DeleteObjectCommand, GetObjectCommand,HeadObjectCommand,PutObjectCommand, S3Client,}from '@aws-sdk/client-s3';

export class ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  constructor() {
    const endpoint = process.env.RUSTFS_ENDPOINT;
    const accessKeyId = process.env.RUSTFS_ACCESS_KEY;
    const secretAccessKey = process.env.RUSTFS_SECRET_KEY;
    const bucket = process.env.RUSTFS_BUCKET;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('RustFS configuration is missing');
    }
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: process.env.RUSTFS_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async get(key: string) {
    return this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}