import { S3Client, ListObjectVersionsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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

/**
 * Permanently deletes all versions and delete markers of a file from Backblaze B2 bucket.
 * This is necessary because B2 buckets are versioned by default, and a standard delete command
 * only creates a delete marker (soft delete) instead of permanently freeing space.
 * 
 * @param {string} fileKey - The key of the file in the B2 bucket.
 */
async function deleteFileFromB2(fileKey) {
  if (!fileKey) return;
  const bucketName = process.env.B2_BUCKET_NAME;

  // 1. List all versions and delete markers for this prefix
  const listCommand = new ListObjectVersionsCommand({
    Bucket: bucketName,
    Prefix: fileKey,
  });

  const response = await s3Client.send(listCommand);

  // Combine versions and delete markers that match our exact file key
  const versions = (response.Versions || []).filter(v => v.Key === fileKey);
  const deleteMarkers = (response.DeleteMarkers || []).filter(m => m.Key === fileKey);
  const allItems = [...versions, ...deleteMarkers];

  if (allItems.length === 0) {
    // If no versions were found via listing, try a standard delete command as a fallback
    console.warn(`⚠️ No versions found for ${fileKey} via list. Trying standard fallback delete.`);
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
    }));
    return;
  }

  // 2. Delete each specific version permanently
  for (const item of allItems) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      VersionId: item.VersionId,
    }));
  }
}

export { s3Client, deleteFileFromB2 };

