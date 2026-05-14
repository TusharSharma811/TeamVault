export type Provider = "aws-s3" | "gcs";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface StorageConnection {
  _id?: string;
  id?: string;
  owner: string;
  provider: Provider;
  name: string;
  bucket: string;
  region?: string;
  allowedUsers: string[];
  defaultPrefix?: string;
  createdAt?: string;
}

export interface FileObject {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  size: number;
  mimetype: string;
  connection: string;
  owner: string;
  allowedUsers: string[];
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
