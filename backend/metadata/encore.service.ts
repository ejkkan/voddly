import { Service } from "encore.dev/service";

// Encore will consider this directory and all its subdirectories as part of the "metadata" service.
// https://encore.dev/docs/ts/primitives/services

// The metadata service handles fetching and caching content metadata from various providers (TMDB, etc.)
export default new Service("metadata");