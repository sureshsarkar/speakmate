import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

export const cloudinaryEnabled = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

export function uploadAvatar(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'speakmate/avatars',
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}
