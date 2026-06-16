import { S3Client } from '@aws-sdk/client-s3';

const getRegionFromEndpoint = (endpoint) => {
  if (!endpoint) return 'us-east-1';
  // Extracts region from endpoints like https://s3.eu-central-003.backblazeb2.com
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match ? match[1] : 'us-east-1';
};

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: getRegionFromEndpoint(process.env.B2_ENDPOINT),
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true, // Backblaze B2 S3 API requires path-style access
});

export { s3Client };
