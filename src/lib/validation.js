import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long")
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export const presignSchema = z.object({
  file_name: z.string().min(1, "File name is required").max(255),
  file_size: z.number().positive("File size must be greater than zero"),
  file_type: z.string().min(1, "File type is required").max(100)
});

export const firmwareSchema = z.object({
  device_model: z.string().min(1, "Device model is required").max(100),
  device_type: z.string().min(1, "Device type is required").max(100),
  version: z.string().min(1, "Version is required").max(50),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().or(z.literal("")),
  file_key: z.string().min(1, "File key is required").max(512),
  file_name: z.string().min(1, "File name is required").max(255),
  file_size: z.number().positive("File size must be greater than zero"),
  checksum: z.string().length(64, "Checksum must be a valid 64-character SHA-256 hash")
});
